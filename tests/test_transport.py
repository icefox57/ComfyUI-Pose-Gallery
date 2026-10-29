"""Transport boundaries tested without network access or external fixtures."""

from http.client import IncompleteRead
import json
import unittest
from unittest.mock import MagicMock, patch
from urllib.request import Request

from pose_gallery_service import (
    GalleryError,
    GalleryInputError,
    GalleryService,
    REQUEST_TIMEOUT_SECONDS,
    _SafeRedirectHandler,
    checked_url,
    fetch_bytes,
    validate_source,
)


URL = "https://ai-pose-gallery.anhao.app/data/pose-zh.json"
JAPANESE_URL = "https://ai-pose-gallery.pages.dev/"


class TransportTests(unittest.TestCase):
    def response(self, data=b"{}", *, headers=None, final_url=URL):
        response = MagicMock()
        response.__enter__.return_value = response
        response.geturl.return_value = final_url
        response.headers = headers or {}
        response.read.return_value = data
        return response

    def test_bounded_read_uses_timeout_and_identity_encoding(self):
        response = self.response()
        with patch("pose_gallery_service.build_opener") as build:
            build.return_value.open.return_value = response
            self.assertEqual(fetch_bytes(URL, 20), b"{}")
        request = build.return_value.open.call_args.args[0]
        self.assertEqual(request.get_header("Accept-encoding"), "identity")
        self.assertEqual(build.return_value.open.call_args.kwargs["timeout"], REQUEST_TIMEOUT_SECONDS)
        response.read.assert_called_once_with(21)

    def test_advertised_oversize_is_rejected_before_reading_body(self):
        response = self.response(headers={"Content-Length": "21"})
        with patch("pose_gallery_service.build_opener") as build:
            build.return_value.open.return_value = response
            with self.assertRaises(GalleryError):
                fetch_bytes(URL, 20)
        response.read.assert_not_called()

    def test_missing_or_incorrect_size_cannot_bypass_body_limit(self):
        for headers in ({}, {"Content-Length": "1"}):
            with self.subTest(headers=headers):
                response = self.response(b"x" * 21, headers=headers)
                with patch("pose_gallery_service.build_opener") as build:
                    build.return_value.open.return_value = response
                    with self.assertRaises(GalleryError):
                        fetch_bytes(URL, 20)
                response.read.assert_called_once_with(21)

    def test_empty_or_broken_http_response_is_reported_as_gallery_error(self):
        for failure in (b"", IncompleteRead(b"partial", 2), TimeoutError("timeout")):
            with self.subTest(failure=failure):
                response = self.response(failure if isinstance(failure, bytes) else b"{}")
                if isinstance(failure, Exception):
                    response.read.side_effect = failure
                with patch("pose_gallery_service.build_opener") as build:
                    build.return_value.open.return_value = response
                    with self.assertRaises(GalleryError):
                        fetch_bytes(URL, 20)

    def test_only_supported_https_origins_are_requested(self):
        rejected = (
            "http://ai-pose-gallery.anhao.app/data/pose-zh.json",
            "https://localhost/file",
            "https://ai-pose-gallery.anhao.app.evil.example/file",
            "https://user@ai-pose-gallery.anhao.app/file",
            "https://ai-pose-gallery.anhao.app:8443/file",
            "https://ai-pose-gallery.anhao.app:invalid/file",
        )
        with patch("pose_gallery_service.build_opener") as build:
            for url in rejected:
                with self.subTest(url=url), self.assertRaises(GalleryError):
                    fetch_bytes(url, 20)
        build.assert_not_called()

    def test_redirect_is_checked_before_a_new_request_is_created(self):
        handler = _SafeRedirectHandler()
        request = Request(URL)
        for target in ("http://ai-pose-gallery.pages.dev/file", "https://example.org/file"):
            with self.subTest(target=target), self.assertRaises(GalleryError):
                handler.redirect_request(request, None, 302, "Found", {}, target)
        redirected = handler.redirect_request(request, None, 302, "Found", {}, JAPANESE_URL)
        self.assertEqual(redirected.full_url, JAPANESE_URL)

    def test_response_final_url_is_checked_as_well(self):
        response = self.response(final_url="https://example.org/unexpected")
        with patch("pose_gallery_service.build_opener") as build:
            build.return_value.open.return_value = response
            with self.assertRaises(GalleryError):
                fetch_bytes(URL, 20)
        response.read.assert_not_called()

    def test_non_string_json_source_values_are_input_errors(self):
        for value in ({"source": "auto"}, ["auto"], None, 1, True):
            with self.subTest(value=value), self.assertRaises(GalleryInputError):
                validate_source(value)
        self.assertEqual(checked_url(JAPANESE_URL), JAPANESE_URL)

    def test_japanese_page_decodes_only_the_json_catalog_literal(self):
        # A small invented fixture: no upstream images or metadata are bundled.
        record = {"id": "test_P001_front", "ポーズ名": "テスト \"名前\"", "アングル": "正面"}
        literal = json.dumps([record], ensure_ascii=False)
        html = ("<!doctype html><script>const D = " + literal + "; const ANG=['front'];</script>").encode("utf-8")
        self.assertEqual(GalleryService._parse_catalog(html, "ja"), [record])
        # A synthetic JSON catalogue is accepted too, without requiring HTML.
        self.assertEqual(GalleryService._parse_catalog(literal.encode("utf-8"), "ja"), [record])
        for invalid in (b"<html>no catalogue</html>", b"<script>const D = executeCode();</script>"):
            with self.subTest(invalid=invalid), self.assertRaises((GalleryError, ValueError)):
                GalleryService._parse_catalog(invalid, "ja")


if __name__ == "__main__":
    unittest.main()
