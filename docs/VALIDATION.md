# Validation record

Date: 2026-10-29.

## 0.3.0 SD pose prompts

- 38 Python checks and 22 JavaScript DOM-double checks passed. Existing three-output workflows restore the fourth socket while preserving their original links.
- Reviewed one representative front thumbnail per current pose group, using the existing cached first image and 287 additional thumbnails (4,631,015 bytes). The four annotation files cover all 288 groups and all 1,439 current image IDs. Other views reuse their group's action tags; they were not individually captioned.
- Checked counts, visible limb positions, and neutral interactions. Upper-body annotations do not infer unseen leg positions. Known title/image discrepancies follow visible geometry; uncertain support positions use conservative wording.
- A local SD1 CLIP tokenizer check placed every prompt below the 75-content-token budget. No captioning model, external AI service, or model download was used.
- The same ComfyUI Python dependencies returned the four outputs in order and matching English tags under all three interface languages. Local HTTP selection responses also returned `sd_prompt`; the original image output remained `[1, 1200, 900, 3]`.
- This verifies prompt delivery and annotation coverage, not SD image-generation quality or live browser acceptance. Those require testing with the user's chosen workflow and models.

## 0.2.0 language update

- 29 Python checks and 21 JavaScript DOM-double checks passed, including both fallback directions, cached-secondary priority, all three translation dictionaries, language persistence, and legacy workflows.
- Using the same ComfyUI Python dependencies, a registration stub loaded the updated node and the real catalogue, image, and selection routes were exercised over loopback in all three languages. Japanese selected `ja`; Chinese and English selected `zh`. Invalid languages returned HTTP 400.
- Cached real upstream catalogues each supplied 1,439 entries. Cached real originals produced float32 `IMAGE` tensors shaped `[1, 1200, 900, 3]`; changing language changed the node fingerprint. No external requests or model downloads were needed for these update checks.
- These checks do not establish live browser layout, manual interaction, or a new full-ComfyUI queue run for 0.2.0. The original full-instance result is recorded below.

## Initial 0.1.0 release

The following results document the initial release.

## Environment

An isolated Windows instance running Python 3.10.11, ComfyUI 0.42.1, and the ComfyUI frontend package 1.55.18 in CPU mode. No model downloads were required.

The frontend package version identifies the installed package; it does not mean that browser presentation or manual interaction has been visually verified.

## Verified

| Check | Result |
| --- | --- |
| Custom-node import | `PoseGallery` registered successfully in the real ComfyUI instance |
| Frontend extension delivery | ComfyUI served `/extensions/ComfyUI-Pose-Gallery/pose_gallery.js` |
| Chinese catalogue | Real upstream request through `source=auto` selected `zh`; 1,439 images / 288 pose groups |
| Japanese catalogue | Real original-site request through `source=ja`; embedded root-page JSON parsed into 1,439 images / 288 groups |
| Original image, both sources | `full_sexy_P001_front` fetched from each real source; 900×1200 PNG, 523,791 bytes |
| Automatic fallback | A simulated Chinese outage using captured real Japanese responses selected Japanese catalogue and the same image ID |
| Selection endpoint | `POST /pose_gallery/select` succeeded and reused the cached original |
| Input validation | Invalid image IDs and source values returned HTTP 400 |
| Real queue execution | `PoseGallery → PreviewImage` submitted through ComfyUI `/prompt` completed successfully; 900×1200 output, pixel-identical to the original |
| Backend unit checks | 19 tests passed |
| Frontend DOM checks | 12 tests passed using DOM doubles |

The preview workflow completed in approximately 0.78 seconds in this cached, isolated CPU test. This is a single observed execution, not a performance guarantee.

## Remaining acceptance

Browser screenshots and manual browser interaction were unavailable in the validation environment. Visual layout, pointer/keyboard interaction in a live ComfyUI browser, and browser workflow save/reload remain unaccepted. DOM-double checks do not establish these results.

Model-based downstream workflows, including pose preprocessing and ControlNet generation, were not run. The node's decoded image output and ComfyUI preview execution were verified; generation quality depends on the user's downstream workflow and models.

## Reproduce offline checks

From the repository directory, using a Python environment with the normal ComfyUI dependencies:

```bash
python -m unittest discover -s tests -v
node --test tests/frontend.test.mjs
node --check web/pose_gallery.js
```

The supplied [preview workflow](../examples/pose_gallery_preview.json) and [API request](../examples/pose_gallery_api.json) can be used for an additional real-instance check. Online checks depend on the current availability of third-party sources.
