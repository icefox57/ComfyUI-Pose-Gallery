"""ComfyUI node and local HTTP routes for online pose selection."""

from __future__ import annotations

import asyncio
import io
import json
import logging

import numpy as np
import torch
from aiohttp import web

from .pose_prompts import get_sd_prompt
from .pose_gallery_service import (
    GalleryError, GalleryInputError, asset_to_image, get_service,
    validate_id, validate_language, validate_source,
)


LOGGER = logging.getLogger(__name__)


class PoseGallery:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "pose_id": ("STRING", {"default": "", "tooltip": "Use Browse poses to select an online reference image."}),
                "source": (["auto", "zh", "ja"], {"default": "auto", "tooltip": "auto: primary source follows language; the other site is the fallback."}),
                "language": (["zh", "en", "ja"], {"default": "zh", "tooltip": "Gallery interface language. Japanese prefers the Japanese source; Chinese and English prefer Chinese."}),
            }
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("image", "pose_name", "source_url", "sd_prompt")
    FUNCTION = "load_pose"
    CATEGORY = "image/Pose Gallery"
    DESCRIPTION = "Browse online pose references with language-aware source fallback. Outputs the image, pose name, source URL, and concise English SD people/action tags."

    def load_pose(self, pose_id, source="auto", language="zh"):
        service = get_service()
        asset = service.get_image(pose_id, "full", source, language)
        image = asset_to_image(asset)
        tensor = torch.from_numpy(np.array(image, dtype=np.float32) / 255.0).unsqueeze(0)
        name = service.pose_name(pose_id, source, language)
        preferred = "ja" if language == "ja" else "zh"
        if source == "auto" and asset.source != preferred:
            LOGGER.info("Pose Gallery: using fallback %s source for %s", asset.source, pose_id)
        return (tensor, name, asset.url, get_sd_prompt(pose_id))

    @classmethod
    def VALIDATE_INPUTS(cls, pose_id=None, source="auto", language="zh"):
        try:
            # ComfyUI passes None for a linked input whose upstream value is
            # not available during validation. Runtime loading validates it.
            if pose_id is not None:
                validate_id(pose_id)
            if source is not None:
                validate_source(source)
            if language is not None:
                validate_language(language)
            return True
        except GalleryError as error:
            return str(error)

    @classmethod
    def IS_CHANGED(cls, pose_id, source="auto", language="zh"):
        try:
            return get_service().image_fingerprint(pose_id, source, language)
        except GalleryError:
            return f"invalid:{language}:{source}:{pose_id}"


def _json_error(error, status=502):
    return web.json_response({"error": str(error)}, status=status)


def _browser_image(asset, kind):
    # The already validated remote file is re-encoded before it reaches a
    # browser. Keep decoding and compression off ComfyUI's event loop too.
    image = asset_to_image(asset)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG" if kind == "thumb" else "PNG")
    return buffer.getvalue()


def register_routes():
    """Called once by the ComfyUI custom-node loader."""
    from server import PromptServer

    routes = PromptServer.instance.routes

    @routes.get("/pose_gallery/catalog")
    async def gallery_catalog(request):
        try:
            source = validate_source(request.query.get("source", "auto"))
            language = validate_language(request.query.get("language", "zh"))
            result = await asyncio.to_thread(get_service().get_catalog, source, request.query.get("refresh") == "1", language)
            return web.json_response(result, headers={"Cache-Control": "no-store"})
        except GalleryInputError as error:
            return _json_error(error, 400)
        except GalleryError as error:
            return _json_error(error)
        except OSError:
            LOGGER.exception("Pose Gallery cache error")
            return _json_error("Unable to write the pose cache. Check directory permissions.")

    @routes.get("/pose_gallery/image")
    async def gallery_image(request):
        try:
            pose_id = validate_id(request.query.get("id", ""))
            source = validate_source(request.query.get("source", "auto"))
            language = validate_language(request.query.get("language", "zh"))
            kind = request.query.get("kind", "thumb")
            if kind not in ("thumb", "full"):
                return _json_error("Unknown image kind.", 400)
            asset = await asyncio.to_thread(get_service().get_image, pose_id, kind, source, language)
            body = await asyncio.to_thread(_browser_image, asset, kind)
            return web.Response(
                body=body,
                content_type="image/jpeg" if kind == "thumb" else "image/png",
                headers={
                    "Cache-Control": "private, max-age=3600",
                    "X-Pose-Gallery-Source": asset.source,
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except GalleryInputError as error:
            return _json_error(error, 400)
        except GalleryError as error:
            return _json_error(error)
        except OSError:
            LOGGER.exception("Pose Gallery image error")
            return _json_error("Unable to read or write the pose cache.")

    @routes.post("/pose_gallery/select")
    async def gallery_select(request):
        try:
            if request.content_length is not None and request.content_length > 4096:
                return _json_error("Selection request is too large.", 413)
            # Content-Length may be absent for chunked requests. Bound the
            # actual body too instead of letting request.json() read it all.
            try:
                body = await request.content.readexactly(4097)
            except asyncio.IncompleteReadError as error:
                body = error.partial
            if len(body) > 4096:
                return _json_error("Selection request is too large.", 413)
            payload = json.loads(body)
            if not isinstance(payload, dict):
                return _json_error("Expected a pose selection object.", 400)
            pose_id = validate_id(payload.get("id", ""))
            source = validate_source(payload.get("source", "auto"))
            language = validate_language(payload.get("language", "zh"))
            result = await asyncio.to_thread(get_service().select, pose_id, source, language)
            result["sd_prompt"] = get_sd_prompt(pose_id)
            return web.json_response(result)
        except (ValueError, TypeError):
            return _json_error("Invalid selection JSON.", 400)
        except GalleryInputError as error:
            return _json_error(error, 400)
        except GalleryError as error:
            return _json_error(error)
        except OSError:
            LOGGER.exception("Pose Gallery selection cache error")
            return _json_error("Unable to write the pose cache. Check directory permissions.")
