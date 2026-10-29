"""Reviewed pose descriptions stay useful, scoped, and stable across views."""

import json
from pathlib import Path
import re
import unittest

from pose_prompts import get_sd_prompt


DATA_DIRECTORY = Path(__file__).resolve().parents[1] / "data"
FAMILY_COUNTS = {"full_sexy": 80, "full_single": 73, "upper80v2": 80, "pair60": 55}
VIEWS = ("front", "high", "low", "side", "diag")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise AssertionError(f"Repeated pose group in JSON: {key}")
        result[key] = value
    return result


class SDPromptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.families = {
            family: json.loads(
                (DATA_DIRECTORY / f"sd_prompts_{family}.json").read_text(encoding="utf-8"),
                object_pairs_hook=unique_object,
            )
            for family in FAMILY_COUNTS
        }

    def test_reviewed_collection_has_all_current_groups_without_namespace_collisions(self):
        combined = set()
        for family, prompts in self.families.items():
            with self.subTest(family=family):
                self.assertEqual(len(prompts), FAMILY_COUNTS[family])
                self.assertFalse(combined.intersection(prompts))
                for group in prompts:
                    self.assertRegex(group, rf"^{family}_P[0-9]{{3}}$")
                combined.update(prompts)
        self.assertEqual(len(combined), 288)

    def test_all_supported_view_variants_preserve_the_reviewed_action_description(self):
        # This covers a superset of the 1,439 current images. One pose has four
        # upstream views, but a known view suffix never changes its body pose.
        for prompts in self.families.values():
            for group, expected in prompts.items():
                for view in VIEWS:
                    with self.subTest(group=group, view=view):
                        actual = get_sd_prompt(f"{group}_{view}")
                        self.assertTrue(actual)
                        self.assertEqual(actual, expected)

    def test_subject_counts_match_the_visually_reviewed_solo_and_pair_collections(self):
        for family, prompts in self.families.items():
            for group, prompt in prompts.items():
                with self.subTest(group=group):
                    tags = prompt.split(", ")
                    counts = [tag for tag in tags if re.fullmatch(r"\d+(?:girl|boy|girls|boys)", tag)]
                    if family == "pair60":
                        self.assertEqual(counts, ["1girl", "1boy"])
                        self.assertNotIn("solo", tags)
                    else:
                        self.assertEqual(counts, ["1girl"])
                        self.assertIn("solo", tags)

    def test_descriptions_are_concise_english_actions_without_unrequested_image_traits(self):
        forbidden_words = re.compile(
            r"\b(?:mannequin|doll|nude|naked|breasts?|nipples?|cleavage|genitals?|"
            r"sex|sexy|intercourse|penetration|missionary|doggystyle|"
            r"masterpiece|photorealistic|anime|illustration|sketch|background|"
            r"clothing|clothes|outfit|dress|camera|cropped)\b",
            re.IGNORECASE,
        )
        forbidden_tags = {
            "full body", "upper body", "portrait", "close-up", "from above",
            "from below", "from side", "from behind", "high angle", "low angle",
            "best quality", "high quality", "line art", "looking at viewer",
        }
        for prompts in self.families.values():
            for group, prompt in prompts.items():
                with self.subTest(group=group):
                    self.assertIsInstance(prompt, str)
                    self.assertTrue(prompt.isascii())
                    tags = prompt.split(", ")
                    self.assertTrue(all(tag and tag == tag.strip() for tag in tags))
                    self.assertEqual(len(tags), len(set(tags)))
                    self.assertGreaterEqual(len(tags), 4)
                    self.assertLessEqual(len(tags), 14)
                    self.assertIsNone(forbidden_words.search(prompt))
                    self.assertFalse(forbidden_tags.intersection(tags))

    def test_same_pose_number_in_different_systems_keeps_different_actions(self):
        standing = get_sd_prompt("full_sexy_P001_front")
        seated = get_sd_prompt("full_single_P001_front")
        self.assertNotEqual(standing, seated)
        self.assertIn("standing", standing.split(", "))
        self.assertIn("hand on hip", standing)
        self.assertIn("arm behind head", standing)
        self.assertIn("sitting", seated.split(", "))
        self.assertIn("one knee raised", seated)

    def test_upper_body_annotations_preserve_distinct_visible_gestures(self):
        heart = get_sd_prompt("upper80v2_P001_front")
        overhead = get_sd_prompt("upper80v2_P002_front")
        finger_heart = get_sd_prompt("upper80v2_P003_front")
        self.assertIn("heart hands", heart.split(", "))
        self.assertIn("hands above head", overhead.split(", "))
        self.assertIn("finger heart", finger_heart.split(", "))
        self.assertIn("other hand on hip", finger_heart)
        # The inspected image differs from its upstream title; do not add the
        # title's hand-heart gesture when the actual hands are held down.
        lowered = get_sd_prompt("upper80v2_P026_front")
        self.assertIn("hands clasped in front", lowered)
        self.assertIn("leaning forward", lowered)
        self.assertNotIn("heart", lowered)

    def test_upper_body_descriptions_do_not_invent_unseen_lower_body_positions(self):
        unseen = re.compile(r"\b(?:standing|sitting|kneeling|crouching|lying|legs?|knees?|ankles?|heels?|toes?)\b")
        for group, prompt in self.families["upper80v2"].items():
            with self.subTest(group=group):
                self.assertIsNone(unseen.search(prompt))

    def test_pair_actions_identify_the_participants_instead_of_just_listing_a_category(self):
        prompt = get_sd_prompt("pair60_P001_front")
        self.assertIn("facing each other", prompt)
        self.assertIn("embracing", prompt)
        self.assertIn("girl raising one knee", prompt)
        self.assertIn("boy supporting girl's raised leg", prompt)

    def test_unknown_future_ids_and_bad_views_do_not_receive_invented_tags(self):
        invalid = (
            None, 1, True, [], {}, b"full_sexy_P001_front", "", "full_sexy_P001",
            "../full_sexy_P001_front", "full_sexy_P001_rear", "full_sexy_P001_FRONT",
            "full_sexy_P001_front?x=1", "future_P001_front", "full_single_P999_front",
            "full_single_P023_front", "pair60_P012_front",
        )
        for pose_id in invalid:
            with self.subTest(pose_id=pose_id):
                self.assertEqual(get_sd_prompt(pose_id), "")
        # Real numbering has gaps; the last currently reviewed groups remain usable.
        self.assertTrue(get_sd_prompt("full_single_P079_front"))
        self.assertTrue(get_sd_prompt("pair60_P063_front"))


if __name__ == "__main__":
    unittest.main()
