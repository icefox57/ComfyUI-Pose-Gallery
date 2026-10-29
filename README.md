# ComfyUI Pose Gallery

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

Browse online mannequin pose references inside ComfyUI, choose a pose and camera angle, and send the original image to your workflow as `IMAGE`.

The picker uses the existing [Chinese gallery by Anhao](https://ai-pose-gallery.anhao.app/) and [Japanese original](https://ai-pose-gallery.pages.dev/). Resources are fetched on demand; installation does not download the complete image library or any models.

## Installation

Run this from your ComfyUI `custom_nodes` directory:

```bash
git clone https://github.com/icefox57/ComfyUI-Pose-Gallery.git
```

The resulting path should be `ComfyUI/custom_nodes/ComfyUI-Pose-Gallery/__init__.py`. Restart ComfyUI, then hard-refresh the browser (`Ctrl+F5` on Windows).

A standard ComfyUI installation already provides the required Python dependencies. No separate PyTorch installation or `npm install` is needed. Windows portable users should install under `ComfyUI_windows_portable/ComfyUI/custom_nodes/` and use the bundled `python_embeded/python.exe` for Python commands.

To update a Git installation, run `git pull` inside the plugin directory, then restart ComfyUI and refresh the browser.

## Pick an image

1. Search for **Pose Gallery** in the node menu and add the node.
2. Choose `language`: `zh` for 中文, `en` for English, or `ja` for 日本語. Existing workflows default to Chinese.
3. Click **Browse poses**. Search or filter by system, category, and angle. Click a card to preview the original or choose another angle of the same pose.
4. Click **Use this image**, connect the node's `image` output, and run the workflow.

The gallery displays 24 pose groups at a time. Use **Load more**, **Refresh**, and **Clear filters** to browse. `Esc` closes the picker; controls also support `Tab` and `Enter`.

The selected image ID, source mode, and language are saved with the workflow. You can enter an ID directly, such as `full_sexy_P001_front`; each ID identifies one image at a specific angle.

## Language and sources

The node and picker support Chinese, English, and Japanese. Interface controls and standard filter labels are translated locally. Pose titles remain in the selected upstream catalogue's original language; there is no separate English image source.

| UI language | `auto` source order on a cache miss |
| --- | --- |
| 中文 (`zh`, default) | Chinese → Japanese |
| English (`en`) | Chinese → Japanese |
| 日本語 (`ja`) | Japanese → Chinese |

Changing the UI language resets `source` to `auto`. You can then choose `zh` or `ja` to use one source strictly. Manual modes do not fall back until you change the language or select `auto` again.

Fallback applies to catalogues and individual images. The alternate source is asked for the **same image ID**; an unavailable image is never replaced with a different pose.

## Inputs and outputs

| Input | Meaning |
| --- | --- |
| `pose_id` | Selected image ID; filled by the picker or entered manually |
| `source` | `auto`, Chinese only (`zh`), or Japanese only (`ja`) |
| `language` | Chinese (`zh`), English (`en`), or Japanese (`ja`); default `zh` |

| Output | Type | Meaning |
| --- | --- | --- |
| `image` | `IMAGE` | Original reference image |
| `pose_name` | `STRING` | Pose title and angle; image ID if no catalogue is cached |
| `source_url` | `STRING` | Online source URL of the returned image |
| `sd_prompt` | `STRING` | English SD-style tags describing the people and their poses |

### SD pose prompt

Version 0.3.0 adds `sd_prompt` as the fourth output. The first three outputs and their connection order remain unchanged; `pose_name` still provides the original catalogue title.

`sd_prompt` is always a comma-separated English string, regardless of the UI language or selected source. It describes people counts and gender tags such as `1girl` and `1boy`, body positions, limb placement, and necessary interactions. It does not add mannequin, appearance, clothing, background, style, quality, or camera descriptions.

For example, `full_sexy_P001_front` returns:

```text
1girl, solo, standing, contrapposto, hand on hip, other arm behind head, one knee bent
```

To use it with an existing SD workflow, right-click your **CLIP Text Encode (Prompt)** node, choose **Convert Widget to Input → text**, and connect `sd_prompt` to that `text` input. Use the encoder and model already configured in your workflow.

The current 288 pose groups / 1,439 views have curated action tags checked against thumbnails and catalogue metadata. Views of the same pose share their action tags. This is a local tag lookup, not runtime image captioning: no VLM, external AI service, or extra model download is needed. A new upstream pose without a reviewed entry returns an empty string instead of an invented description.

Example connections:

```text
Pose Gallery → Preview Image
Pose Gallery → DWPose / OpenPose preprocessor → compatible ControlNet workflow
Pose Gallery → an image-reference workflow
Pose Gallery.sd_prompt → CLIP Text Encode.text
```

**These are mannequin reference images, not OpenPose skeleton maps.** For OpenPose ControlNet, extract the pose with a suitable preprocessor and use a ControlNet model compatible with your base model. Preprocessors and models come from your existing ComfyUI setup.

## Example workflows

- [Picker and image preview](examples/pose_gallery_preview.json): drag the JSON into ComfyUI and run it, or open the picker to change the image.
- [API request](examples/pose_gallery_api.json): a `PoseGallery → PreviewImage` prompt.

From the repository directory:

```bash
curl -X POST http://127.0.0.1:8188/prompt -H "Content-Type: application/json" --data-binary @examples/pose_gallery_api.json
```

Replace the address and port if your instance uses different ones.

## Network and cache

Requests are made by the ComfyUI backend. The computer or server **running ComfyUI** must be able to reach the gallery sites, even if your browser can open them.

Thumbnails load on demand. Originals are fetched when previewed, selected, or executed. Each source reuses its own cached images first; the preferred source is checked before the alternate source, even if the alternate image is already cached. Catalogues are cached for one hour; the last catalogue can still be shown when online sources are unavailable. This is not a complete offline library.

The default cache is `pose_gallery/cache` under the ComfyUI user directory. Set `POSE_GALLERY_CACHE_DIR` to change it. Older versions without the user-directory API use `comfyui_pose_gallery/cache` under the system temporary directory.

If loading fails, use **Refresh**, try the other source, and check the backend's network or proxy settings. The plugin does not change system network settings. If the node or picker is missing, check for an extra nested ZIP directory, restart ComfyUI, hard-refresh the browser, and inspect the console for import errors.

## Contribute pose resources

**Everyone is welcome to contribute more high-quality mannequin pose reference resources.** Open a [GitHub Issue](https://github.com/icefox57/ComfyUI-Pose-Gallery/issues) to suggest a resource or send a pull request for a source integration. Include:

- A few sample links and a description of the poses, resolution, and available camera angles.
- The creator's name and original source URL.
- The usage and redistribution licence, or the creator's permission to host and distribute the images.
- Available metadata, such as stable IDs, pose names, categories, and angle labels.

Original work and properly authorised resources are welcome. Clear silhouettes, consistent framing, useful resolution, and multiple views of the same pose are especially helpful. Please do not upload existing gallery images whose terms prohibit redistribution. To propose an online source, link to it rather than copying its entire library into this repository.

## Development and validation

The node uses Python and build-free JavaScript. Use a Python environment containing the normal ComfyUI dependencies and a recent Node.js:

```bash
python -m unittest discover -s tests -v
node --test tests/frontend.test.mjs
node --check web/pose_gallery.js
```

Previous real-instance checks and their limits are recorded in [docs/VALIDATION.md](docs/VALIDATION.md); they do not establish browser visual or manual interaction acceptance for every version. See [upstream integration notes](docs/UPSTREAM.md) for data formats and [the changelog](CHANGELOG.md) for changes.

## Licence and credits

The plugin code is [MIT licensed](LICENSE). This licence **does not cover third-party images or original metadata**. The repository does not redistribute the existing image collection.

- Chinese gallery and localisation: [Anhao / ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh).
- Original gallery and images: [ギア / @giaaibusi](https://x.com/giaaibusi), [Japanese website](https://ai-pose-gallery.pages.dev/).

Read the original creator's current terms before use. The original site permits reference use, editing, and creating commercial artwork, but prohibits redistribution, reposting, or resale of the image data itself, including modified images. Rights remain with the respective creators. The gallery includes adult-oriented pose categories.
