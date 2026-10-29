"""Language/source policy regressions, using small invented local fixtures."""

import io
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from pose_gallery_service import GalleryInputError, GalleryService


POSE_ID = "test_P001_front"


class LanguageUpstream:
    def __init__(self):
        self.requests = []
        self.fail = set()
        buffer = io.BytesIO()
        Image.new("RGB", (3, 4), "gray").save(buffer, format="PNG")
        self.image = buffer.getvalue()

    def __call__(self, url, limit):
        self.requests.append(url)
        source = "zh" if "anhao.app" in url else "ja"
        if source in self.fail:
            raise OSError("synthetic offline source")
        if "/data/" in url or url.endswith("pages.dev/"):
            keys = ("体系", "姿势编号", "分类", "姿势名称", "角度") if source == "zh" else ("系統", "ポーズ番号", "分類", "ポーズ名", "アングル")
            record = dict(zip(keys, [source, "P001", source, source + " name", "正面"]))
            record["id"] = POSE_ID
            return json.dumps([record]).encode("utf-8")
        return self.image


class LanguagePolicyTests(unittest.TestCase):
    def setUp(self):
        runtime = Path(__file__).resolve().parents[1] / ".runtime"
        runtime.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.directory.cleanup)
        self.fetch = LanguageUpstream()
        self.service = GalleryService(self.directory.name, self.fetch)

    def test_catalog_order_follows_language_and_ignores_cached_secondary(self):
        self.assertEqual(self.service.get_catalog()["source"], "zh")
        self.fetch.requests.clear()
        japanese = self.service.get_catalog(language="ja")
        self.assertEqual(japanese["source"], "ja")
        self.assertEqual(japanese["preferred_source"], "ja")
        self.assertFalse(japanese["fallback_used"])
        self.assertIn("pages.dev", self.fetch.requests[0])
        self.assertEqual(self.service.get_catalog(language="en")["source"], "zh")

    def test_cached_chinese_original_cannot_mask_japanese_primary(self):
        self.service.get_image(POSE_ID, source="zh")
        self.fetch.requests.clear()
        asset = self.service.get_image(POSE_ID, language="ja")
        self.assertEqual(asset.source, "ja")
        self.assertFalse(asset.cached)
        self.assertEqual(len(self.fetch.requests), 1)
        self.assertIn("pages.dev", self.fetch.requests[0])

    def test_cached_japanese_original_cannot_mask_chinese_primary(self):
        self.service.get_image(POSE_ID, source="ja")
        self.fetch.requests.clear()
        self.assertEqual(self.service.get_image(POSE_ID, language="en").source, "zh")
        self.assertEqual(len(self.fetch.requests), 1)
        self.assertIn("anhao.app", self.fetch.requests[0])

    def test_primary_failure_can_reuse_secondary_cache_and_cooldown(self):
        self.service.get_image(POSE_ID, source="zh")
        self.fetch.requests.clear()
        self.fetch.fail.add("ja")
        result = self.service.select(POSE_ID, language="ja")
        self.assertEqual(result["source"], "zh")
        self.assertTrue(result["cached"])
        self.assertTrue(result["fallback_used"])
        self.assertEqual(result["preferred_source"], "ja")
        self.assertEqual(len(self.fetch.requests), 1)
        self.service.select(POSE_ID, language="ja")
        self.assertEqual(len(self.fetch.requests), 1)

    def test_secondary_cached_original_does_not_bypass_primary_thumbnail(self):
        self.service.get_image(POSE_ID, source="zh")
        self.fetch.requests.clear()
        result = self.service.get_image(POSE_ID, kind="thumb", language="ja")
        self.assertEqual(result.source, "ja")
        self.assertIn("pages.dev/thumbs/", self.fetch.requests[0])

    def test_cached_primary_original_can_supply_offline_thumbnail(self):
        self.service.get_image(POSE_ID, source="ja")
        self.fetch.requests.clear()
        self.fetch.fail.update(("zh", "ja"))
        result = self.service.get_image(POSE_ID, kind="thumb", language="ja")
        self.assertEqual(result.source, "ja")
        self.assertTrue(result.cached)
        self.assertFalse(self.fetch.requests)

    def test_manual_source_remains_strict_despite_language(self):
        result = self.service.get_catalog(source="zh", language="ja")
        self.assertEqual(result["source"], "zh")
        self.assertEqual(result["preferred_source"], "zh")
        self.assertFalse(result["fallback_used"])
        self.assertTrue(all("anhao.app" in url for url in self.fetch.requests))

    def test_names_and_fingerprints_follow_language_policy(self):
        self.service.get_catalog(source="zh")
        self.service.get_catalog(source="ja")
        self.assertTrue(self.service.pose_name(POSE_ID, language="ja").startswith("ja name"))
        self.assertTrue(self.service.pose_name(POSE_ID, language="en").startswith("zh name"))
        self.service.get_image(POSE_ID, source="zh")
        fingerprints = {self.service.image_fingerprint(POSE_ID, language=language) for language in ("zh", "en", "ja")}
        self.assertEqual(len(fingerprints), 3)

    def test_fallback_and_stale_warnings_are_localized(self):
        self.fetch.fail.add("ja")
        japanese = self.service.get_catalog(language="ja")
        self.assertEqual(japanese["source"], "zh")
        self.assertTrue(japanese["fallback_used"])
        self.assertIn("切り替え", japanese["warning"])
        self.fetch.fail.add("zh")
        english = self.service.get_catalog(language="en", refresh=True)
        self.assertTrue(english["stale"])
        self.assertIn("cached catalogue", english["warning"])
        chinese = self.service.get_catalog(language="zh", refresh=True)
        self.assertIn("缓存", chinese["warning"])

    def test_invalid_language_values_are_rejected_before_network(self):
        for language in (None, {}, [], True, 2, "de"):
            with self.subTest(language=language), self.assertRaises(GalleryInputError):
                self.service.get_catalog(language=language)
        self.assertFalse(self.fetch.requests)


if __name__ == "__main__":
    unittest.main()
