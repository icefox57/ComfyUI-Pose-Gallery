"""Small online client for the two public Pose Gallery sites.

No image catalogue is shipped with this extension. Only requested thumbnails and
selected original images are downloaded, checked, and cached on this machine.
"""

from __future__ import annotations

import io
from http.client import HTTPException
import json
import logging
import os
from pathlib import Path
import re
import tempfile
import threading
import time
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from PIL import Image, ImageOps, UnidentifiedImageError


LOGGER = logging.getLogger(__name__)
SOURCES = {
    "zh": {
        "base": "https://ai-pose-gallery.anhao.app/",
        "catalog": "data/pose-zh.json",
    },
    "ja": {
        "base": "https://ai-pose-gallery.pages.dev/",
        "catalog": "",
    },
}
ALLOWED_HOSTS = frozenset(urlsplit(value["base"]).hostname for value in SOURCES.values())
MAX_CATALOG_BYTES = 4 * 1024 * 1024
MAX_IMAGE_BYTES = 16 * 1024 * 1024
MAX_THUMB_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 24_000_000
CATALOG_TTL_SECONDS = 3600
FAILURE_COOLDOWN_SECONDS = 30
REQUEST_TIMEOUT_SECONDS = 10
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
WARNING_MESSAGES = {
    "zh": {
        "zh": "中文版数据源暂时无法访问，已切换到日文版。",
        "ja": "日文版数据源暂时无法访问，已切换到中文版。",
        "stale": "在线数据源暂时无法访问，正在显示上次缓存的图库目录。",
    },
    "en": {
        "zh": "Chinese source is unavailable; using the Japanese source.",
        "ja": "Japanese source is unavailable; using the Chinese source.",
        "stale": "Online sources are unavailable; showing the last cached catalogue.",
    },
    "ja": {
        "zh": "中国語のデータソースに接続できないため、日本語版に切り替えました。",
        "ja": "日本語のデータソースに接続できないため、中国語版に切り替えました。",
        "stale": "オンラインデータに接続できないため、保存済みの一覧を表示しています。",
    },
}


class GalleryError(RuntimeError):
    """An expected, user-readable gallery failure."""


class GalleryInputError(GalleryError):
    """A malformed local API or node input, before any network request."""


def validate_source(source: str) -> str:
    if not isinstance(source, str) or source not in ("auto", "zh", "ja"):
        raise GalleryInputError("Unknown source. Choose auto, zh, or ja.")
    return source


def validate_language(language: str) -> str:
    if not isinstance(language, str) or language not in ("zh", "en", "ja"):
        raise GalleryInputError("Unknown language. Choose zh, en, or ja.")
    return language


def validate_id(pose_id: str) -> str:
    if not isinstance(pose_id, str) or not ID_PATTERN.fullmatch(pose_id):
        raise GalleryInputError("Choose a pose in the gallery first (a valid pose_id is required).")
    return pose_id


def checked_url(url: str) -> str:
    try:
        parsed = urlsplit(url)
        allowed = (
            parsed.scheme == "https"
            and parsed.hostname in ALLOWED_HOSTS
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
        )
    except (TypeError, ValueError):
        allowed = False
    if not allowed:
        raise GalleryError("The gallery redirected to an unsupported address.")
    return url


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        checked_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_bytes(url: str, max_bytes: int) -> bytes:
    """Read a bounded HTTPS response, including redirects, without disabling TLS."""
    checked_url(url)
    request = Request(
        url,
        headers={
            "User-Agent": "ComfyUI-Pose-Gallery/0.2.0 (+https://github.com/icefox57/ComfyUI-Pose-Gallery)",
            "Accept-Encoding": "identity",
        },
    )
    try:
        with build_opener(_SafeRedirectHandler()).open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            checked_url(response.geturl())
            length = response.headers.get("Content-Length")
            if length is not None and int(length) > max_bytes:
                raise GalleryError("The gallery response exceeds the download size limit.")
            data = response.read(max_bytes + 1)
    except (HTTPError, URLError, HTTPException, TimeoutError, OSError, ValueError) as error:
        raise GalleryError(f"Could not reach the gallery: {error}") from error
    if len(data) > max_bytes:
        raise GalleryError("The gallery response exceeds the download size limit.")
    if not data:
        raise GalleryError("The gallery returned an empty response.")
    return data


def default_cache_directory() -> Path:
    override = os.environ.get("POSE_GALLERY_CACHE_DIR")
    if override:
        return Path(override).expanduser()
    try:
        import folder_paths

        return Path(folder_paths.get_user_directory()) / "pose_gallery" / "cache"
    except (ImportError, AttributeError):
        return Path(tempfile.gettempdir()) / "comfyui_pose_gallery" / "cache"


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".download-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _decode_image(data: bytes) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise GalleryError("The gallery image exceeds the pixel limit.")
            if image.format not in ("PNG", "JPEG", "WEBP"):
                raise GalleryError("The gallery returned an unsupported image format.")
            image.load()
            return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise GalleryError("The gallery did not return a valid image.") from error


@dataclass(frozen=True)
class ImageAsset:
    data: bytes
    source: str
    url: str
    width: int
    height: int
    cached: bool


class GalleryService:
    def __init__(self, cache_dir=None, fetcher=None, clock=None):
        self.cache_dir = Path(cache_dir) if cache_dir is not None else default_cache_directory()
        self.fetcher = fetcher or fetch_bytes
        self.clock = clock or time.time
        self._catalogs = {}
        self._failures = {}
        self._state_lock = threading.RLock()
        self._locks = {}
        self._network_limits = {source: threading.BoundedSemaphore(4) for source in SOURCES}

    def _lock(self, key):
        with self._state_lock:
            return self._locks.setdefault(key, threading.Lock())

    def _candidates(self, source, language="zh"):
        validate_source(source)
        validate_language(language)
        if source != "auto":
            return (source,)
        return ("ja", "zh") if language == "ja" else ("zh", "ja")

    def _available(self, source):
        with self._state_lock:
            return self._failures.get(source, 0) <= self.clock()

    def _failed(self, source):
        with self._state_lock:
            self._failures[source] = self.clock() + FAILURE_COOLDOWN_SECONDS

    def _download(self, source, url, limit):
        # A failed host cannot tie up every worker when many visible cards load
        # together. Waiting requests recheck the cooldown before connecting.
        with self._network_limits[source]:
            if not self._available(source):
                raise GalleryError(f"{source} source is temporarily unavailable; retry shortly.")
            return self.fetcher(url, limit)

    @staticmethod
    def _image_url(pose_id, kind, source):
        directory, extension = ("thumbs", "jpg") if kind == "thumb" else ("img", "png")
        return f"{SOURCES[source]['base']}{directory}/{pose_id}.{extension}"

    @staticmethod
    def _parse_catalog(data, source):
        text = data.decode("utf-8-sig").strip()
        if source == "zh" or text.startswith("["):
            return json.loads(text)
        # The original Japanese site publishes its catalogue as a JSON array
        # literal in the page rather than a separate JSON endpoint. Decode
        # that one literal; never execute scripts or accept JavaScript syntax.
        match = re.search(r"(?:const|let|var)\s+D\s*=\s*", text)
        if match is None:
            raise GalleryError("The Japanese gallery page no longer contains its catalogue.")
        raw, _ = json.JSONDecoder().raw_decode(text, match.end())
        if not isinstance(raw, list):
            raise GalleryError("The Japanese gallery catalogue has an unsupported format.")
        return raw

    @staticmethod
    def _normalize_catalog(raw, source):
        if not isinstance(raw, list) or not raw or len(raw) > 20_000:
            raise GalleryError("The gallery catalogue has an unsupported format.")
        names = (
            ("体系", "姿势编号", "分类", "姿势名称", "角度", "检索")
            if source == "zh"
            else ("系統", "ポーズ番号", "分類", "ポーズ名", "アングル", "検索")
        )
        items = []
        seen = set()
        for record in raw:
            if not isinstance(record, dict):
                raise GalleryError("The gallery catalogue contains an invalid entry.")
            pose_id = validate_id(record.get("id"))
            if pose_id in seen:
                continue
            seen.add(pose_id)
            values = [record.get(key, "") for key in names]
            if not all(isinstance(value, str) and len(value) <= 4096 for value in values):
                raise GalleryError("The gallery catalogue contains invalid labels.")
            system, pose, category, name, angle, search = values
            if not name or not system or not angle:
                raise GalleryError("The gallery catalogue is missing required labels.")
            item = dict(
                id=pose_id,
                system=system,
                pose=pose,
                category=category,
                name=name,
                angle=angle,
                group=pose_id.rsplit("_", 1)[0],
                thumbnail=GalleryService._image_url(pose_id, "thumb", source),
                image=GalleryService._image_url(pose_id, "full", source),
                search=" ".join([pose_id, system, pose, category, name, angle, search]).lower(),
            )
            items.append(item)
        return items

    def _read_catalog(self, source):
        with self._state_lock:
            if source in self._catalogs:
                return self._catalogs[source]
        path = self.cache_dir / f"catalog-{source}.json"
        try:
            if path.stat().st_size > MAX_CATALOG_BYTES:
                return None
            payload = json.loads(path.read_text(encoding="utf-8"))
            raw = payload["data"]
            result = {"items": self._normalize_catalog(raw, source), "fetched": float(payload["fetched"])}
        except (OSError, ValueError, KeyError, TypeError, GalleryError):
            return None
        with self._state_lock:
            self._catalogs[source] = result
        return result

    def get_catalog(self, source="auto", refresh=False, language="zh"):
        candidates = self._candidates(source, language)
        errors = []
        with self._lock("catalog"):
            if refresh:
                with self._state_lock:
                    for candidate in candidates:
                        self._failures.pop(candidate, None)
            for candidate in candidates:
                cached = self._read_catalog(candidate)
                if cached and not refresh and self.clock() - cached["fetched"] < CATALOG_TTL_SECONDS:
                    return self._catalog_response(cached, candidate, source, False, language)
                if not self._available(candidate):
                    errors.append(f"{candidate}: temporarily unavailable")
                    continue
                try:
                    url = SOURCES[candidate]["base"] + SOURCES[candidate]["catalog"]
                    data = self._download(candidate, url, MAX_CATALOG_BYTES)
                    raw = self._parse_catalog(data, candidate)
                    normalized = self._normalize_catalog(raw, candidate)
                    fetched = self.clock()
                    payload = json.dumps({"fetched": fetched, "data": raw}, ensure_ascii=False).encode("utf-8")
                    _atomic_write(self.cache_dir / f"catalog-{candidate}.json", payload)
                    cached = {"items": normalized, "fetched": fetched}
                    with self._state_lock:
                        self._catalogs[candidate] = cached
                        self._failures.pop(candidate, None)
                    return self._catalog_response(cached, candidate, source, False, language)
                except (GalleryError, OSError, ValueError, UnicodeError) as error:
                    self._failed(candidate)
                    errors.append(f"{candidate}: {error}")
            for candidate in candidates:
                cached = self._read_catalog(candidate)
                if cached:
                    return self._catalog_response(cached, candidate, source, True, language)
        raise GalleryError("Unable to load the pose gallery. Check your network and retry. " + "; ".join(errors))

    @staticmethod
    def _catalog_response(cached, candidate, requested, stale, language="zh"):
        preferred = ("ja" if language == "ja" else "zh") if requested == "auto" else requested
        fallback_used = requested == "auto" and candidate != preferred
        messages = WARNING_MESSAGES[language]
        warnings = []
        if fallback_used:
            warnings.append(messages[preferred])
        if stale:
            warnings.append(messages["stale"])
        return {
            "items": cached["items"], "source": candidate, "stale": stale,
            "warning": " ".join(warnings), "language": language,
            "preferred_source": preferred, "fallback_used": fallback_used,
        }

    def _asset_path(self, pose_id, kind, source):
        extension = "jpg" if kind == "thumb" else "png"
        return self.cache_dir / "images" / source / kind / f"{pose_id}.{extension}"

    def _read_asset(self, pose_id, kind, source):
        path = self._asset_path(pose_id, kind, source)
        try:
            if path.stat().st_size > (MAX_THUMB_BYTES if kind == "thumb" else MAX_IMAGE_BYTES):
                return None
            data = path.read_bytes()
            image = _decode_image(data)
            return ImageAsset(data, source, self._image_url(pose_id, kind, source), image.width, image.height, True)
        except (OSError, GalleryError):
            return None

    def get_image(self, pose_id, kind="full", source="auto", language="zh"):
        validate_id(pose_id)
        candidates = self._candidates(source, language)
        if kind not in ("thumb", "full"):
            raise GalleryInputError("Unknown image kind. Choose thumb or full.")
        errors = []
        with self._lock(("asset", pose_id, kind)):
            # Check each source in policy order, including its network attempt,
            # before considering the next source's cache. A cached fallback
            # must not mask a newly chosen primary source.
            for candidate in candidates:
                cached = self._read_asset(pose_id, kind, candidate)
                if cached:
                    return cached
                if kind == "thumb":
                    # A restored workflow can preview its selected pose offline,
                    # even if its small thumbnail had never been requested.
                    original = self._read_asset(pose_id, "full", candidate)
                    if original:
                        image = _decode_image(original.data)
                        image.thumbnail((256, 344), Image.Resampling.LANCZOS)
                        buffer = io.BytesIO()
                        image.save(buffer, format="JPEG", quality=85)
                        data = buffer.getvalue()
                        _atomic_write(self._asset_path(pose_id, "thumb", candidate), data)
                        return ImageAsset(data, candidate, original.url, image.width, image.height, True)
                if not self._available(candidate):
                    errors.append(f"{candidate}: temporarily unavailable")
                    continue
                try:
                    url = self._image_url(pose_id, kind, candidate)
                    data = self._download(candidate, url, MAX_THUMB_BYTES if kind == "thumb" else MAX_IMAGE_BYTES)
                    image = _decode_image(data)
                    _atomic_write(self._asset_path(pose_id, kind, candidate), data)
                    with self._state_lock:
                        self._failures.pop(candidate, None)
                    return ImageAsset(data, candidate, url, image.width, image.height, False)
                except (GalleryError, OSError, ValueError) as error:
                    self._failed(candidate)
                    errors.append(f"{candidate}: {error}")
        raise GalleryError(f"Could not load pose {pose_id}. The same pose was tried on all selected sources. " + "; ".join(errors))

    def pose_name(self, pose_id, source="auto", language="zh"):
        for candidate in self._candidates(source, language):
            cached = self._read_catalog(candidate)
            if cached:
                for item in cached["items"]:
                    if item["id"] == pose_id:
                        return f"{item['name']} · {item['angle']}"
        return pose_id

    def select(self, pose_id, source="auto", language="zh"):
        asset = self.get_image(pose_id, "full", source, language)
        preferred = self._candidates(source, language)[0]
        return {
            "id": pose_id,
            "source": asset.source,
            "source_url": asset.url,
            "name": self.pose_name(pose_id, source, language),
            "width": asset.width,
            "height": asset.height,
            "cached": asset.cached,
            "language": language,
            "preferred_source": preferred,
            "fallback_used": source == "auto" and asset.source != preferred,
        }

    def image_fingerprint(self, pose_id, source="auto", language="zh"):
        """Stable while the selection is unchanged; no network activity for hashing."""
        validate_id(pose_id)
        candidates = self._candidates(source, language)
        policy = f"{language}:{source}:{'>'.join(candidates)}"
        for candidate in candidates:
            path = self._asset_path(pose_id, "full", candidate)
            try:
                stat = path.stat()
                return f"{policy}:{candidate}:{pose_id}:{stat.st_mtime_ns}:{stat.st_size}"
            except OSError:
                continue
        return f"{policy}:{pose_id}:not-cached"


_SERVICE = None
_SERVICE_LOCK = threading.Lock()


def get_service():
    global _SERVICE
    with _SERVICE_LOCK:
        if _SERVICE is None:
            _SERVICE = GalleryService()
        return _SERVICE


def asset_to_image(asset):
    """Return an independent RGB Pillow image; tensor conversion lives in nodes.py."""
    return _decode_image(asset.data)
