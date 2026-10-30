"""Local-gallery behavior, including legacy workflows and offline operation."""
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from pose_gallery_service import GalleryError, GalleryInputError, GalleryService, default_assets_directory


POSE_ID = "example_P001_front"


def png_bytes(color=(64, 128, 192)):
    output = io.BytesIO()
    Image.new("RGB", (30, 40), color).save(output, format="PNG")
    return output.getvalue()


def catalogue(name="测试姿势"):
    return [{"id": POSE_ID, "体系": "测试体系", "姿势编号": "P001",
             "分类": "站姿", "姿势名称": name, "角度": "正面", "检索": "测试"}]


class LocalGalleryTests(unittest.TestCase):
    def setUp(self):
        runtime = Path(__file__).resolve().parents[1] / ".runtime"
        runtime.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "img").mkdir()
        (self.root / "thumbs").mkdir()
        (self.root / "pose-zh.json").write_text(json.dumps(catalogue(), ensure_ascii=False), encoding="utf-8")
        japanese = {POSE_ID: {"name": "テストポーズ", "angle": "正面"}}
        (self.root / "pose-ja.json").write_text(json.dumps(japanese, ensure_ascii=False), encoding="utf-8")
        self.image = png_bytes()
        (self.root / "img" / (POSE_ID + ".png")).write_bytes(self.image)
        with Image.new("RGB", (12, 16), (64, 128, 192)) as image:
            image.save(self.root / "thumbs" / (POSE_ID + ".jpg"))
        self.gallery = GalleryService(self.root)

    def test_catalogue_and_images_work_with_network_disabled(self):
        with patch("socket.socket", side_effect=AssertionError("Network access is forbidden")):
            for language in ("zh", "en", "ja"):
                for legacy_source in ("auto", "zh", "ja"):
                    with self.subTest(language=language, source=legacy_source):
                        catalog = self.gallery.get_catalog(legacy_source, language=language)
                        self.assertEqual(catalog["source"], "local")
                        expected_name = "テストポーズ" if language == "ja" else "测试姿势"
                        self.assertEqual(catalog["items"][0]["name"], expected_name)
                        asset = self.gallery.get_image(POSE_ID, "full", legacy_source, language)
                        self.assertEqual(asset.source, "local")
                        self.assertEqual(asset.data, self.image)
                        self.assertEqual((asset.width, asset.height), (30, 40))
                        self.assertTrue(asset.url.startswith("file:"))
                        selected = self.gallery.select(POSE_ID, legacy_source, language)
                        self.assertEqual(selected["name"], expected_name + " · 正面")
                        self.assertEqual(selected["source_url"], asset.url)

    def test_normalized_labels_and_image_ids_are_preserved(self):
        item = self.gallery.get_catalog()["items"][0]
        self.assertEqual(item["id"], POSE_ID)
        self.assertEqual(item["group"], "example_P001")
        self.assertEqual(item["category"], "站姿")
        self.assertEqual(item["thumbnail"], "thumbs/" + POSE_ID + ".jpg")
        self.assertEqual(item["image"], "img/" + POSE_ID + ".png")

    def test_missing_thumbnail_is_generated_in_memory_without_network_or_disk_write(self):
        thumbnail = self.root / "thumbs" / (POSE_ID + ".jpg")
        thumbnail.unlink()
        with patch("socket.socket", side_effect=AssertionError("Network access is forbidden")):
            asset = self.gallery.get_image(POSE_ID, "thumb")
        self.assertEqual(asset.source, "local")
        self.assertEqual(Image.open(io.BytesIO(asset.data)).size, (30, 40))
        self.assertFalse(thumbnail.exists())

    def test_missing_and_damaged_images_fail_without_trying_another_site(self):
        (self.root / "img" / (POSE_ID + ".png")).unlink()
        with patch("socket.socket", side_effect=AssertionError("Network access is forbidden")):
            with self.assertRaisesRegex(GalleryError, "Local image"):
                self.gallery.get_image(POSE_ID, source="ja", language="ja")
            (self.root / "img" / (POSE_ID + ".png")).write_bytes(b"not an image")
            with self.assertRaises(GalleryError):
                self.gallery.get_image(POSE_ID)

    def test_catalogue_changes_are_observed_and_update_the_node_fingerprint(self):
        self.assertEqual(self.gallery.pose_name(POSE_ID), "测试姿势 · 正面")
        before = self.gallery.image_fingerprint(POSE_ID)
        path = self.root / "pose-zh.json"
        path.write_text(json.dumps(catalogue("新的中文姿势"), ensure_ascii=False), encoding="utf-8")
        self.assertEqual(self.gallery.pose_name(POSE_ID, language="zh"), "新的中文姿势 · 正面")
        self.assertEqual(self.gallery.pose_name(POSE_ID, language="ja"), "テストポーズ · 正面")
        self.assertNotEqual(before, self.gallery.image_fingerprint(POSE_ID))
        self.assertEqual(self.gallery.get_catalog(refresh=True)["items"][0]["name"], "新的中文姿势")

    def test_missing_catalogue_provides_actionable_error(self):
        (self.root / "pose-zh.json").unlink()
        with self.assertRaisesRegex(GalleryError, "local Chinese catalogue"):
            self.gallery.get_catalog()
        self.assertEqual(self.gallery.pose_name(POSE_ID), POSE_ID)

    def test_invalid_parameters_and_escaping_paths_are_rejected(self):
        for value in ("../secret", "a/b", "https://example.org/a", "", "a?b", "a\\b", None):
            with self.subTest(pose_id=value), self.assertRaises(GalleryInputError):
                self.gallery.get_image(value)
        for value in ("invalid", [], None):
            with self.subTest(language=value), self.assertRaises(GalleryInputError):
                self.gallery.get_catalog(language=value)
        with self.assertRaises(GalleryInputError):
            self.gallery.get_image(POSE_ID, kind="bad-kind")
        with self.assertRaises(GalleryInputError):
            self.gallery.get_image(POSE_ID, source="bad-source")

    def test_optional_asset_directory_override(self):
        with patch.dict(os.environ, {"POSE_GALLERY_ASSETS_DIR": str(self.root)}):
            self.assertEqual(default_assets_directory(), self.root)
            self.assertEqual(GalleryService().get_image(POSE_ID).data, self.image)

    def test_japanese_labels_are_local_and_optional(self):
        with patch("socket.socket", side_effect=AssertionError("Network access is forbidden")):
            self.assertEqual(self.gallery.pose_name(POSE_ID, language="ja"), "テストポーズ · 正面")
            self.assertEqual(self.gallery.get_catalog(language="ja")["items"][0]["name"], "テストポーズ")
            (self.root / "pose-ja.json").unlink()
            self.assertEqual(self.gallery.pose_name(POSE_ID, language="ja"), "测试姿势 · 正面")

    def test_replaced_image_changes_the_fingerprint(self):
        before = self.gallery.image_fingerprint(POSE_ID)
        (self.root / "img" / (POSE_ID + ".png")).write_bytes(png_bytes((255, 0, 0)))
        self.assertNotEqual(before, self.gallery.image_fingerprint(POSE_ID))


if __name__ == "__main__":
    unittest.main()
