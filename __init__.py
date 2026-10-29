"""ComfyUI Pose Gallery: online reference selection with source failover."""

from .nodes import PoseGallery, register_routes

NODE_CLASS_MAPPINGS = {"PoseGallery": PoseGallery}
NODE_DISPLAY_NAME_MAPPINGS = {"PoseGallery": "Pose Gallery / 姿势图库"}
WEB_DIRECTORY = "./web"

register_routes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
