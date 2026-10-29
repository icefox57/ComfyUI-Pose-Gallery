# ComfyUI Pose Gallery · 在线姿势图库

在 ComfyUI 节点中打开姿势图库，按分类、关键词和视角选图，将参考图直接输出为 `IMAGE`，连接后续工作流。

使用 [Anhao 中文姿势图库](https://ai-pose-gallery.anhao.app/) 的在线目录与图片；自动模式下，中文资源无法访问时切换到[日文原站](https://ai-pose-gallery.pages.dev/)。安装时无需下载整套图库、额外模型或前端构建依赖。

## 安装

在 ComfyUI 的 `custom_nodes` 目录中执行：

```bash
git clone https://github.com/icefox57/ComfyUI-Pose-Gallery.git
```

目录应类似：

```text
ComfyUI/
└── custom_nodes/
    └── ComfyUI-Pose-Gallery/
        ├── __init__.py
        └── web/
```

重启 ComfyUI，然后强制刷新浏览器页面（Windows：`Ctrl+F5`）。正常安装的 ComfyUI 已提供所需的 Python 运行依赖，无需为本插件单独安装 PyTorch，也无需运行 `npm install`。

Windows 便携版请将仓库放入 `ComfyUI_windows_portable/ComfyUI/custom_nodes/`。若需运行开发检查，使用便携版自带的 `python_embeded/python.exe`，不要调用另一个 Python 环境。

## 选图与使用

1. 在节点搜索中输入 `Pose Gallery`，添加姿势图库节点。
2. 点击 **选择姿势 / Browse poses**，打开在线姿势图库。
3. 用关键词、体系、动作分类和视角缩小范围，点击姿势卡片查看原图、切换角度，再点击 **使用这张姿势 / Use image**。
4. 将节点的 `image` 输出连接到后续节点，运行工作流。

`pose_id` 保存的是选中图片的稳定 ID，随工作流一起保存。也可直接填写，例如 `full_sexy_P001_front`。每个 ID 对应一张指定视角的图片。

图库按姿势分组显示，每批 24 组；点击 **加载更多** 继续浏览。可在 **在线数据源 / Source** 切换来源，点击 **刷新** 重读目录，或用 **清除筛选** 恢复全部结果。`Esc` 关闭图库，也支持 `Tab` 和 `Enter` 操作。

| 输入 | 说明 |
| --- | --- |
| `pose_id` | 姿势图片 ID；通过图库选图自动填写，也支持手动输入 |
| `source` = `auto` | 优先中文；目录或所选图片获取失败时尝试日文资源 |
| `source` = `zh` | 仅使用中文站点，失败时报告错误 |
| `source` = `ja` | 仅使用日文站点，失败时报告错误 |

| 输出 | 类型 | 用途 |
| --- | --- | --- |
| `image` | `IMAGE` | 原始参考图，可连接预览、预处理或图像参考节点 |
| `pose_name` | `STRING` | 所选姿势名称；未缓存目录时返回图片 ID |
| `source_url` | `STRING` | 本次获取图片的在线来源地址 |

推荐连接方式：

```text
Pose Gallery → Preview Image

Pose Gallery → DWPose / OpenPose 预处理器 → 匹配的 ControlNet 工作流

Pose Gallery → 支持图像参考的工作流
```

**图库图片是人体素体参考图，不是 OpenPose 骨骼控制图。** 使用 OpenPose ControlNet 时，应先通过相应预处理器提取姿势，并选用与底模兼容的 ControlNet 模型。预处理器、模型及图像参考节点需由你现有的 ComfyUI 环境提供。

## 示例工作流

- [选图并预览](examples/pose_gallery_preview.json)：下载 JSON 后拖入 ComfyUI，可直接运行，也可打开图库重新选图。
- [API 请求示例](examples/pose_gallery_api.json)：包含 `PoseGallery → PreviewImage` 的 API prompt。

API 示例可在仓库根目录执行：

```bash
curl -X POST http://127.0.0.1:8188/prompt -H "Content-Type: application/json" --data-binary @examples/pose_gallery_api.json
```

若 ComfyUI 运行在其他地址或端口，请替换 URL。

## 在线资源与缓存

插件通过 ComfyUI 后端请求在线目录与图片，因此远程部署时需要**运行 ComfyUI 的服务器**可以访问资源站点。浏览器能打开站点，不代表后端网络也能访问。

- 不在安装或启动时批量下载图库。
- 浏览时按需加载缩略图；选中或运行时按需获取原图。
- 本地缓存减少重复获取。默认缓存位于 ComfyUI 用户目录下的 `pose_gallery/cache`；可用环境变量 `POSE_GALLERY_CACHE_DIR` 指定其他位置。较旧 ComfyUI 未提供用户目录接口时，使用系统临时目录下的 `comfyui_pose_gallery/cache`。
- 原图按来源与 ID 缓存，优先复用已下载文件；未命中缓存时，`auto` 按中文、日文的顺序请求。在线目录缓存一小时；来源失败后会短暂避让，避免反复等待。
- 自动模式会尝试从备用站点获取相同 ID 的图片，不会悄悄换成其他姿势。手动指定来源时不自动切换。
- 首次浏览与首次获取图片需要联网；缓存并不提供完整离线图库。

## 常见问题

**搜不到节点，或没有图库按钮**

检查插件是否位于 `custom_nodes/ComfyUI-Pose-Gallery`，避免下载 ZIP 后多嵌套一层目录。重启 ComfyUI 并强制刷新浏览器，查看 ComfyUI 控制台是否报告导入错误。

**目录或图片加载失败**

先选择 `auto`，或手动切换到 `ja`。确认 ComfyUI 后端能访问对应站点。代理设置应作用于运行 ComfyUI 的进程；插件不会自动改变系统网络设置。第三方站点的可用性与内容由各自维护者决定。

**已保存的工作流换电脑后还能使用吗？**

可以。安装插件后，节点根据保存的 `pose_id` 和 `source` 重新获取图片。图片本身不嵌入工作流；首次运行仍需要访问相应在线资源。

**为什么日文备用源显示日文名称？**

日文站点使用原始日文目录。切换来源后保留同一图片 ID，但名称和分类可能使用日文。

## 开发

本项目使用 Python 节点和原生 JavaScript 扩展，无前端构建步骤。开发检查：

```bash
python -m unittest discover -s tests -v
node --test tests/frontend.test.mjs
node --check web/pose_gallery.js
```

已在 Windows 的隔离 ComfyUI 0.42.1 实例中验证真实在线资源、日文备用源、自动切换及 `PoseGallery → PreviewImage` 队列执行；19 项后端单元检查和 12 项前端 DOM 模拟检查通过。浏览器中的视觉与手动交互仍待验证，检查范围见 [验证记录](docs/VALIDATION.md)。数据字段与上游来源说明见 [docs/UPSTREAM.md](docs/UPSTREAM.md)。

## 协议与致谢

本插件源代码以 [MIT](LICENSE) 协议发布。MIT **不覆盖在线图库的图片或原始数据**，本仓库不打包、再发布整套素材。

- 中文图库与汉化：[Anhao / ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh)
- 原始图库与图片作者：[ギア / @giaaibusi](https://x.com/giaaibusi)，[日文原站](https://ai-pose-gallery.pages.dev/)

使用素材前请阅读原作者网站的当前条款。原站说明允许免费参考、编辑与商业作品制作，但禁止图片数据本身（包括加工后图片）的再分发、转载和转售。原图权利归其各自权利人所有。图库含成人向姿势分类，请按你的使用场景自行选择。

## English

An online pose-reference picker for ComfyUI. Install this repository under `ComfyUI/custom_nodes`, restart ComfyUI, hard-refresh the browser, and add **Pose Gallery**. Open its gallery, choose a pose and camera angle, and connect the `IMAGE` output to your workflow.

`auto` prefers the Chinese gallery and falls back to the original Japanese source for catalogue or image failures. `zh` and `ja` select one source strictly. Images are fetched on demand and cached; the full asset collection is never installed. Reference images are not OpenPose maps: use a suitable pose preprocessor before an OpenPose ControlNet workflow.

The plugin code is MIT licensed. Third-party images and metadata have separate terms; consult the original creator's website. No image redistribution rights are granted by this repository.
