"""Read a locally installed Chinese pose catalogue and its images."""

from __future__ import annotations

from dataclasses import dataclass
import io
import json
import os
from pathlib import Path
import re
import threading

from PIL import Image, ImageOps, UnidentifiedImageError


ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
MAX_CATALOG_BYTES = 4 * 1024 * 1024
MAX_IMAGE_BYTES = 16 * 1024 * 1024
MAX_PIXELS = 24_000_000


class GalleryError(RuntimeError):
    """A user-readable local gallery failure."""


class GalleryInputError(GalleryError):
    """An invalid node or local API input."""


def validate_source(source):
    # Kept for old saved workflows. All accepted values now use local assets.
    if not isinstance(source, str) or source not in ("auto", "zh", "ja"):
        raise GalleryInputError("Unknown legacy source.")
    return source


def validate_language(language):
    if not isinstance(language, str) or language not in ("zh", "en", "ja"):
        raise GalleryInputError("Unknown language. Choose zh, en, or ja.")
    return language


def validate_id(pose_id):
    if not isinstance(pose_id, str) or not ID_PATTERN.fullmatch(pose_id):
        raise GalleryInputError("Choose a pose in the gallery first (a valid pose_id is required).")
    return pose_id


def _decode_image(data):
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise GalleryError("The local image exceeds the pixel limit.")
            if image.format not in ("PNG", "JPEG", "WEBP"):
                raise GalleryError("The local file is not a supported image.")
            image.load()
            return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise GalleryError("The local image is unreadable or damaged.") from error


@dataclass(frozen=True)
class ImageAsset:
    data: bytes
    source: str
    url: str
    width: int
    height: int
    cached: bool = True


def default_assets_directory():
    override = os.environ.get("POSE_GALLERY_ASSETS_DIR")
    return Path(override).expanduser() if override else Path(__file__).parent / "assets" / "zh"


class GalleryService:
    def __init__(self, assets_dir=None):
        self.assets_dir = Path(assets_dir) if assets_dir is not None else default_assets_directory()
        self._catalog = None
        self._index = {}
        self._catalog_signature = None
        self._japanese_labels = {}
        self._japanese_signature = None
        self._lock = threading.RLock()

    def _asset_path(self, pose_id, kind):
        validate_id(pose_id)
        if kind not in ("thumb", "full"):
            raise GalleryInputError("Unknown image kind. Choose thumb or full.")
        directory, extension = ("thumbs", ".jpg") if kind == "thumb" else ("img", ".png")
        root = self.assets_dir.resolve()
        path = (root / directory / (pose_id + extension)).resolve()
        if not path.is_relative_to(root):
            raise GalleryInputError("The image path leaves the local gallery directory.")
        return path

    @staticmethod
    def _normalize_catalog(raw):
        if not isinstance(raw, list) or not raw or len(raw) > 20_000:
            raise GalleryError("The local Chinese catalogue has an unsupported format.")
        items = []
        seen = set()
        for record in raw:
            if not isinstance(record, dict):
                raise GalleryError("The local catalogue contains an invalid entry.")
            pose_id = validate_id(record.get("id"))
            if pose_id in seen:
                continue
            seen.add(pose_id)
            values = [record.get(key, "") for key in ("体系", "姿势编号", "分类", "姿势名称", "角度", "检索")]
            if not all(isinstance(value, str) and len(value) <= 4096 for value in values):
                raise GalleryError("The local catalogue contains invalid labels.")
            system, pose, category, name, angle, search = values
            if not name or not system or not angle:
                raise GalleryError("The local catalogue is missing required labels.")
            items.append({
                "id": pose_id, "system": system, "pose": pose, "category": category,
                "name": name, "angle": angle, "group": pose_id.rsplit("_", 1)[0],
                "thumbnail": "thumbs/" + pose_id + ".jpg", "image": "img/" + pose_id + ".png",
                "search": " ".join([pose_id, system, pose, category, name, angle, search]).lower(),
            })
        return items

    def get_catalog(self, source="auto", refresh=False, language="zh"):
        validate_source(source)
        validate_language(language)
        path = self.assets_dir / "pose-zh.json"
        with self._lock:
            try:
                stat = path.stat()
                if stat.st_size > MAX_CATALOG_BYTES:
                    raise GalleryError("The local catalogue exceeds the size limit.")
                signature = (stat.st_mtime_ns, stat.st_size)
                if refresh or self._catalog is None or signature != self._catalog_signature:
                    raw = json.loads(path.read_text(encoding="utf-8-sig"))
                    items = self._normalize_catalog(raw)
                    self._catalog = items
                    self._index = {item["id"]: item for item in items}
                    self._catalog_signature = signature
                    self._japanese_signature = None
            except (OSError, ValueError, UnicodeError) as error:
                raise GalleryError(f"Cannot read the local Chinese catalogue at {path}. Install the local gallery assets.") from error
            labels = self._read_japanese_labels(refresh) if language == "ja" else {}
            items = [dict(item, name=labels[item["id"]]["name"],
                          search=item["search"] + " " + labels[item["id"]]["name"].lower())
                     if item["id"] in labels else item for item in self._catalog]
            return {"items": items, "source": "local", "stale": False,
                    "warning": "", "language": language}

    def _read_japanese_labels(self, refresh=False):
        path = self.assets_dir / "pose-ja.json"
        try:
            stat = path.stat()
            signature = (stat.st_mtime_ns, stat.st_size)
            if stat.st_size > MAX_CATALOG_BYTES:
                raise GalleryError("The local Japanese labels exceed the size limit.")
            if refresh or signature != self._japanese_signature:
                raw = json.loads(path.read_text(encoding="utf-8-sig"))
                if not isinstance(raw, dict):
                    raise GalleryError("The local Japanese labels have an unsupported format.")
                labels = {}
                for pose_id, value in raw.items():
                    if (pose_id in self._index and isinstance(value, dict)
                            and isinstance(value.get("name"), str) and 0 < len(value["name"]) <= 4096
                            and isinstance(value.get("angle"), str) and len(value["angle"]) <= 4096):
                        labels[pose_id] = {"name": value["name"], "angle": value["angle"]}
                self._japanese_labels = labels
                self._japanese_signature = signature
            return self._japanese_labels
        except FileNotFoundError:
            # The Chinese catalogue remains complete if optional labels are absent.
            self._japanese_labels = {}
            self._japanese_signature = None
            return {}
        except (OSError, ValueError, UnicodeError) as error:
            raise GalleryError(f"Cannot read local Japanese pose labels at {path}.") from error

    def get_image(self, pose_id, kind="full", source="auto", language="zh"):
        validate_source(source)
        validate_language(language)
        path = self._asset_path(pose_id, kind)
        try:
            if kind == "thumb" and not path.exists():
                # A local original is enough if its thumbnail is missing.
                original = self.get_image(pose_id, "full", source, language)
                image = _decode_image(original.data)
                image.thumbnail((300, 400), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                image.save(buffer, format="JPEG", quality=85)
                return ImageAsset(buffer.getvalue(), "local", original.url, image.width, image.height)
            if path.stat().st_size > MAX_IMAGE_BYTES:
                raise GalleryError("The local image exceeds the size limit.")
            data = path.read_bytes()
        except OSError as error:
            raise GalleryError(f"Local image not found or unreadable: {pose_id}. Install the local gallery assets.") from error
        image = _decode_image(data)
        return ImageAsset(data, "local", path.as_uri(), image.width, image.height)

    def pose_name(self, pose_id, source="auto", language="zh"):
        validate_id(pose_id)
        try:
            self.get_catalog(source, False, language)
        except GalleryError:
            return pose_id
        if language == "ja":
            label = self._read_japanese_labels().get(pose_id)
            if label:
                return f"{label['name']} · {label['angle']}"
        item = self._index.get(pose_id)
        return f"{item['name']} · {item['angle']}" if item else pose_id

    def select(self, pose_id, source="auto", language="zh"):
        asset = self.get_image(pose_id, "full", source, language)
        return {"id": pose_id, "source": "local", "source_url": asset.url,
                "name": self.pose_name(pose_id, source, language), "width": asset.width,
                "height": asset.height, "cached": True, "language": language}

    def image_fingerprint(self, pose_id, source="auto", language="zh"):
        validate_source(source)
        validate_language(language)
        path = self._asset_path(pose_id, "full")
        try:
            image = path.stat()
            catalog = (self.assets_dir / "pose-zh.json").stat()
            try:
                labels = (self.assets_dir / "pose-ja.json").stat() if language == "ja" else None
            except OSError:
                labels = None
            labels_signature = f"{labels.st_mtime_ns}:{labels.st_size}" if labels else "none"
            return f"local:{language}:{pose_id}:{image.st_mtime_ns}:{image.st_size}:{catalog.st_mtime_ns}:{catalog.st_size}:{labels_signature}"
        except OSError:
            return f"local:{language}:{pose_id}:missing"


_SERVICE = None
_SERVICE_LOCK = threading.Lock()


def get_service():
    global _SERVICE
    with _SERVICE_LOCK:
        if _SERVICE is None:
            _SERVICE = GalleryService()
        return _SERVICE


def asset_to_image(asset):
    return _decode_image(asset.data)
