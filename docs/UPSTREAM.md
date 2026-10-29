# Upstream integration notes

Reviewed on 2026-10-29.

## Sources

| Source | Website | Catalogue |
| --- | --- | --- |
| Chinese mirror by Anhao | https://ai-pose-gallery.anhao.app/ | `data/pose-zh.json` |
| Japanese original by ギア | https://ai-pose-gallery.pages.dev/ | JSON array assigned to `const D` in the root HTML |

Chinese source repository: https://github.com/anhao/ai-pose-gallery-zh

Original creator: https://x.com/giaaibusi

The upstream Chinese repository contains 1,439 image records grouped into 288 poses. It is roughly 660 MB because it includes all full-size images and thumbnails. This plugin does not vendor that repository or its asset library. It reads the online catalogue and fetches images on demand.

The Chinese repository also contains a Japanese snapshot at `data/pose.json`; that path is **not** the catalogue endpoint of the live Japanese original. A direct check on 2026-10-29 confirmed that the original root page returns HTML (449,746 bytes) with an embedded JSON array, `const D=[...];`, containing 1,439 records. The following declaration is `const ANG=...`. Parse the array as JSON; do not evaluate the surrounding JavaScript. A HEAD request for `https://ai-pose-gallery.pages.dev/img/full_sexy_P001_front.png` returned HTTP 200 with `Content-Type: image/png`.

## Catalogue fields

| Normalized meaning | Chinese key | Japanese key |
| --- | --- | --- |
| Stable image ID | `id` | `id` |
| System | `体系` | `系統` |
| Pose number | `姿势编号` | `ポーズ番号` |
| Category | `分类` | `分類` |
| Pose name | `姿势名称` | `ポーズ名` |
| Camera angle | `角度` | `アングル` |
| Thumbnail path | `缩略图` | `サムネ` |
| Full-size path | `原图` | `原寸` |
| Search text | `检索` | Derive from the fields above |

An example ID is `full_sexy_P001_front`. The corresponding paths are `thumbs/full_sexy_P001_front.jpg` and `img/full_sexy_P001_front.png`. Paths are relative to the selected source website. Upstream documents thumbnails as 300×400 JPEG and full-size images as 900×1200 PNG.

Pose grouping requires both the system and pose number; the number alone is not globally unique. Japanese angle names include `正面`, `斜め`, `横`, `上から`, and `下から`; Chinese labels include `正面`, `斜侧`, `侧面`, `俯视`, and `仰视`.

## Licensing boundary

The wrapper code in this repository is MIT licensed. Upstream code is MIT licensed with copyright © 2026 Anhao, while the upstream licence explicitly excludes images and original metadata. No asset licence is granted by this wrapper's MIT licence.

The original Japanese site's current usage notice permits free reference use, editing, and use in creating commercial artwork, while prohibiting redistribution, reposting, or resale of the image data itself, including modified images. The Chinese repository's licence has different wording about commercial use. Users should consult the original creator's current terms before using assets. This plugin does not bundle or publish the asset collection.

References: [Chinese README](https://github.com/anhao/ai-pose-gallery-zh/blob/main/README.md), [Chinese LICENSE](https://github.com/anhao/ai-pose-gallery-zh/blob/main/LICENSE), and the **注意点** notice on the [Japanese original](https://ai-pose-gallery.pages.dev/).
