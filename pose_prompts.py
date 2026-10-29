"""English action tags reviewed per pose group; no runtime captioning or downloads."""

import json
from functools import lru_cache
from pathlib import Path


_FAMILIES = ("full_sexy", "full_single", "upper80v2", "pair60")


@lru_cache(maxsize=1)
def _prompts():
    prompts = {}
    directory = Path(__file__).with_name("data")
    for family in _FAMILIES:
        with (directory / f"sd_prompts_{family}.json").open(encoding="utf-8") as stream:
            prompts.update(json.load(stream))
    return prompts


def get_sd_prompt(pose_id):
    """Keep view variants consistent; unknown future poses have no invented tags."""
    if not isinstance(pose_id, str):
        return ""
    group, separator, view = pose_id.rpartition("_")
    if not separator or view not in ("front", "high", "low", "side", "diag"):
        return ""
    return _prompts().get(group, "")
