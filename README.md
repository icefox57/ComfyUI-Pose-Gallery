# ComfyUI Pose Gallery

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

Browse pose references in ComfyUI and send a selected image and pose prompt into your workflow. The gallery uses local files based on the Chinese edition: after installation, browsing and execution work without internet access.

## Installation

Clone this repository into `ComfyUI/custom_nodes/`, restart ComfyUI, and hard-refresh the browser (`Ctrl+F5` on Windows):

```bash
git clone https://github.com/icefox57/ComfyUI-Pose-Gallery.git
```

The repository does not include the upstream gallery images or catalogue. Prepare them once from the Chinese site (1,439 originals, about 638 MiB), using the Python interpreter from your ComfyUI installation:

```bash
python scripts/setup_assets.py --download
```

Alternatively, if you already have the Chinese gallery on disk, import it without a network connection: `python scripts/setup_assets.py --from-directory PATH_TO_GALLERY`. The source directory must contain `img/` and `data/pose-zh.json`; `data/pose.json` provides Japanese titles when available. Re-run the command to resume an interrupted setup. Images are stored under `assets/zh/` and are not replaced if a different file already exists. Make sure your network route and available traffic allowance are suitable before downloading.

A normal ComfyUI installation provides the required Python dependencies; no additional model or npm installation is needed. For portable installations, use the `custom_nodes` folder inside the ComfyUI directory and its bundled Python interpreter.

To update, run `git pull` inside the plugin directory, then restart ComfyUI and refresh the browser.

## Use

1. Add **Pose Gallery** from the node menu.
2. Set `language` to `zh`, `en`, or `ja`, and click **Browse poses**.
3. Search or filter by category and angle; click a card to preview and select an angle, then click **Use this image**.
4. Connect `image` to your reference-image workflow. To use `sd_prompt`, convert a **CLIP Text Encode (Prompt)** node's text widget to an input and connect it.

The picker displays 24 pose groups at a time. Load more results with the button, or close it with `Esc`. The selected image ID and language are saved in the workflow. You can also enter an ID such as `full_sexy_P001_front` directly.

| Output | Type | Meaning |
| --- | --- | --- |
| `image` | `IMAGE` | Original local reference image |
| `pose_name` | `STRING` | Chinese or Japanese pose title and angle; English uses the Chinese title |
| `source_url` | `STRING` | Local image `file:` URI (changed from an online URL in v0.4.0) |
| `sd_prompt` | `STRING` | English SD-style people and action tags |

The 288 pose groups have curated tags shared by their views; unreviewed new poses return an empty prompt. These are reference images, not OpenPose skeleton maps: use a compatible pose preprocessor and ControlNet if your workflow requires a skeleton. [Example workflows](examples/) are included.

The interface and filter labels support Chinese, English, and Japanese. Japanese pose names come from the local Japanese label snapshot; no language changes the image source. Old workflows keep their output order and their legacy `source` value is accepted but ignored.

## Sources, rights, and contributions

Original pose images: [Japanese gallery by ギア](https://ai-pose-gallery.pages.dev/) ([creator](https://x.com/giaaibusi)); Chinese catalogue: [Anhao's Chinese edition](https://github.com/anhao/ai-pose-gallery-zh). The plugin code is [MIT licensed](LICENSE); this does not grant a licence for the upstream images or metadata. The original gallery's notice permits reference use and editing but prohibits redistribution, reposting, and resale of the image data, including edited images. The repository therefore does not include those images. See [upstream notes](docs/UPSTREAM.md) and the original site's current terms.

Contributions of more high-quality mannequin pose resources are welcome. Please provide the source and permission to include and distribute each contribution.
