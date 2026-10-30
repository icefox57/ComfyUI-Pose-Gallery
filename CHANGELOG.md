# Changelog

## 0.4.0

- Read the Chinese-based pose catalogue, thumbnails, and original images locally, with no network requests during browsing or execution.
- Preserve Chinese, English, and Japanese UI and locally stored Japanese titles.
- Preserve the output order and legacy `source` input; `source_url` now returns a local file URI.

## 0.3.0

- Appended the `sd_prompt` string output while preserving the first three output positions.
- Added curated, English SD-style people and action tags for the current 288 pose groups, shared across their 1,439 views and independent of interface language or source.
- Kept prompts limited to people, body positions, limbs, and neutral interactions, without appearance, background, style, or camera additions.
- Used local reviewed tags without runtime AI captioning or extra models; unknown future groups return an empty string.
- Updated all three guides with the new output and instructions for connecting it to an existing CLIP Text Encode node.

## 0.2.0

- Added Chinese, English, and Japanese interface languages, saved per node and workflow.
- Japanese UI prefers the Japanese source in automatic mode; Chinese and English UI prefer the Chinese source. Changing language resets the source to automatic mode.
- Kept existing workflows compatible with the default Chinese language.
- Added complete English, Chinese, and Japanese guides, with an open invitation to contribute authorised, high-quality mannequin pose resources.

## 0.1.0

- Added the online pose picker, same-image Japanese fallback, local cache, and ComfyUI `IMAGE` output.
- Added preview and API examples, automated checks, and the MIT code licence.
