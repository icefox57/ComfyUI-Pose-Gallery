"""Offline contract tests; no upstream images or metadata are distributed."""
import io
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from pose_gallery_service import GalleryService


POSE_ID = "example_P001_front"


def catalog(language="zh"):
    if language == "zh":
        return [{"id": POSE_ID, "体系": "测试体系", "姿势编号": "P001",
                 "分类": "测试分类", "姿势名称": "测试姿势", "角度": "正面",
                 "缩略图": "thumbs/" + POSE_ID + ".jpg", "原图": "img/" + POSE_ID + ".png"}]
    return [{"id": POSE_ID, "系統": "テスト", "ポーズ番号": "P001",
             "分類": "テスト", "ポーズ名": "テストポーズ", "アングル": "正面",
             "サムネ": "thumbs/" + POSE_ID + ".jpg", "原寸": "img/" + POSE_ID + ".png"}]


def image_bytes():
    data = io.BytesIO()
    Image.new("RGB", (3, 4), (64, 128, 192)).save(data, format="PNG")
    return data.getvalue()


class FakeUpstream:
    def __init__(self):
        self.requests = []
        self.fail_zh = False
        self.fail_ja = False
        self.corrupt_zh_image = False
        self.broken_zh_catalog = False

    def __call__(self, url, max_bytes):
        self.requests.append(url)
        zh = "anhao.app" in url
        if (zh and self.fail_zh) or (not zh and self.fail_ja):
            raise OSError("simulated upstream unavailable")
        if "/data/" in url or url.endswith("pages.dev/"):
            if zh and self.broken_zh_catalog:
                return b"<html>unexpected proxy page</html>"
            data = json.dumps(catalog("zh" if zh else "ja"), ensure_ascii=False)
            return data.encode("utf-8") if zh else ("<!doctype html><script>const D=" + data + ";const ANG=[];</script>").encode("utf-8")
        if zh and self.corrupt_zh_image:
            return b"this is not an image"
        return image_bytes()


class GalleryServiceTests(unittest.TestCase):
    def setUp(self):
        runtime = Path(__file__).resolve().parents[1] / ".runtime"
        runtime.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.temp.cleanup)
        self.fetch = FakeUpstream()
        self.service = GalleryService(cache_dir=Path(self.temp.name), fetcher=self.fetch)

    def test_chinese_catalog_normalization(self):
        result = self.service.get_catalog()
        self.assertEqual(result["source"], "zh")
        self.assertFalse(result["stale"])
        item = result["items"][0]
        self.assertEqual(item["id"], POSE_ID)
        self.assertEqual(item["name"], "测试姿势")
        self.assertEqual(item["angle"], "正面")
        self.assertEqual(item["group"], "example_P001")
        self.assertTrue(item["image"].endswith("/img/" + POSE_ID + ".png"))

    def test_catalog_switches_to_japanese_on_network_failure(self):
        self.fetch.fail_zh = True
        result = self.service.get_catalog()
        self.assertEqual(result["source"], "ja")
        self.assertEqual(result["items"][0]["name"], "テストポーズ")
        self.assertTrue(result["warning"])

    def test_invalid_catalog_switches_to_japanese(self):
        self.fetch.broken_zh_catalog = True
        self.assertEqual(self.service.get_catalog()["source"], "ja")

    def test_full_image_fallback_preserves_selected_id(self):
        self.fetch.fail_zh = True
        result = self.service.select(POSE_ID)
        self.assertEqual(result["id"], POSE_ID)
        self.assertEqual(result["source"], "ja")
        self.assertEqual((result["width"], result["height"]), (3, 4))
        self.assertIn("/img/" + POSE_ID + ".png", result["source_url"])

    def test_corrupt_image_triggers_fallback(self):
        self.fetch.corrupt_zh_image = True
        result = self.service.get_image(POSE_ID)
        self.assertEqual(result.source, "ja")
        self.assertEqual((result.width, result.height), (3, 4))

    def test_thumbnail_fallback(self):
        self.fetch.fail_zh = True
        result = self.service.get_image(POSE_ID, kind="thumb")
        self.assertEqual(result.source, "ja")
        self.assertTrue(result.url.endswith("/thumbs/" + POSE_ID + ".jpg"))

    def test_manual_source_does_not_silently_switch(self):
        self.fetch.fail_zh = True
        with self.assertRaises(Exception):
            self.service.get_catalog("zh")
        self.assertFalse(any("pages.dev" in url for url in self.fetch.requests))

    def test_full_image_cache_survives_restart_without_catalog(self):
        original = self.service.get_image(POSE_ID)
        self.fetch.fail_zh = self.fetch.fail_ja = True
        self.fetch.requests.clear()
        restarted = GalleryService(cache_dir=Path(self.temp.name), fetcher=self.fetch)
        result = restarted.get_image(POSE_ID)
        self.assertEqual(result.data, original.data)
        self.assertTrue(result.cached)
        self.assertFalse(self.fetch.requests)

    def test_last_catalog_remains_available_offline(self):
        self.service.get_catalog()
        self.fetch.fail_zh = self.fetch.fail_ja = True
        restarted = GalleryService(cache_dir=Path(self.temp.name), fetcher=self.fetch)
        result = restarted.get_catalog(refresh=True)
        self.assertTrue(result["stale"])
        self.assertEqual(result["items"][0]["id"], POSE_ID)
        self.assertTrue(result["warning"])

    def test_path_url_and_bad_source_inputs_rejected_before_network(self):
        for pose_id in ["../secret", "a/b", "https://example.org/a", "", "a?b", "a\\b"]:
            with self.subTest(pose_id=pose_id):
                with self.assertRaises((ValueError, RuntimeError)):
                    self.service.get_image(pose_id)
        with self.assertRaises((ValueError, RuntimeError)):
            self.service.get_catalog("bad-source")
        with self.assertRaises((ValueError, RuntimeError)):
            self.service.get_image(POSE_ID, kind="bad-kind")
        self.assertFalse(self.fetch.requests)


if __name__ == "__main__":
    unittest.main()
