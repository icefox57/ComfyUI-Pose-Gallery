# ComfyUI Pose Gallery · 在线姿势图库

[English](README.md) · **简体中文** · [日本語](README.ja.md)

在 ComfyUI 内浏览在线素体姿势参考图，选好姿势和视角后，将原图直接输出为 `IMAGE`，接入后续工作流。

组件使用现成的 [Anhao 中文图库](https://ai-pose-gallery.anhao.app/) 和[日文原站](https://ai-pose-gallery.pages.dev/)，按需获取资源。安装时无需下载整套图库或额外模型。

## 安装

在 ComfyUI 的 `custom_nodes` 目录中执行：

```bash
git clone https://github.com/icefox57/ComfyUI-Pose-Gallery.git
```

安装后应存在 `ComfyUI/custom_nodes/ComfyUI-Pose-Gallery/__init__.py`。重启 ComfyUI，再强制刷新浏览器页面（Windows：`Ctrl+F5`）。

正常安装的 ComfyUI 已提供所需 Python 依赖，无需为本插件另装 PyTorch，也无需执行 `npm install`。Windows 便携版请安装到 `ComfyUI_windows_portable/ComfyUI/custom_nodes/`；执行 Python 命令时使用便携版自带的 `python_embeded/python.exe`。

通过 Git 安装后，可在插件目录执行 `git pull` 更新，然后重启 ComfyUI 并刷新浏览器。

## 选图与使用

1. 在节点搜索中输入 **Pose Gallery**，添加姿势图库节点。
2. 通过 `language` 选择界面语言：`zh` 为中文、`en` 为英文、`ja` 为日文。旧工作流默认使用中文。
3. 点击 **选择姿势**，按关键词、体系、动作分类和视角筛选。点击卡片查看原图，也可切换同一姿势的其他角度。
4. 点击 **使用这张姿势**，连接节点的 `image` 输出，运行工作流。

图库每批显示 24 组姿势，可用 **加载更多** 继续浏览，或用 **刷新**、**清除筛选** 重新查找。`Esc` 关闭图库，控件也支持 `Tab` 和 `Enter` 操作。

所选图片 ID、数据源模式和界面语言会随工作流保存。也可直接填写 ID，例如 `full_sexy_P001_front`；每个 ID 对应一张指定视角的图片。

## 界面语言与数据源

节点和图库支持中文、英文、日文。界面控件及常用筛选标签在本地翻译；姿势标题仍使用上游目录的原始语言，没有独立的英文图片源。

| 界面语言 | `auto` 未命中缓存时的请求顺序 |
| --- | --- |
| 中文（`zh`，默认） | 中文 → 日文 |
| English（`en`） | 中文 → 日文 |
| 日本語（`ja`） | 日文 → 中文 |

切换界面语言时，`source` 会恢复为 `auto`。之后仍可手动选择 `zh` 或 `ja`，只使用一个来源；手动模式不自动切换，直到再次更改语言或选择 `auto`。

自动切换同时适用于目录和单张图片。备用源请求的是**相同图片 ID**，不会把加载失败的图片换成其他姿势。

## 输入与输出

| 输入 | 说明 |
| --- | --- |
| `pose_id` | 姿势图片 ID，由图库填写，也可手动输入 |
| `source` | 自动（`auto`）、仅中文（`zh`）或仅日文（`ja`） |
| `language` | 中文（`zh`）、英文（`en`）或日文（`ja`），默认 `zh` |

| 输出 | 类型 | 用途 |
| --- | --- | --- |
| `image` | `IMAGE` | 原始姿势参考图 |
| `pose_name` | `STRING` | 姿势标题和角度；未缓存目录时返回图片 ID |
| `source_url` | `STRING` | 本次输出图片的在线来源地址 |
| `sd_prompt` | `STRING` | 描述人物数量和姿势的英文 SD 提示词标签 |

### SD 姿势提示词

0.3.0 在第四个输出位置新增 `sd_prompt`，前三个输出及其连接顺序不变。原有 `pose_name` 继续提供图库中的姿势名称。

无论界面语言或数据源如何选择，`sd_prompt` 都使用英文逗号分隔标签，只描述 `1girl`、`1boy` 等人物数量和性别标签、身体姿态、肢体位置及必要互动，不添加人偶、外观、衣着、背景、风格、画质或镜头描述。

例如，`full_sexy_P001_front` 输出：

```text
1girl, solo, standing, contrapposto, hand on hip, other arm behind head, one knee bent
```

接入已有 SD 工作流时，右键点击 **CLIP Text Encode (Prompt)** 节点，选择 **Convert Widget to Input → text**，再把 `sd_prompt` 连接到该 `text` 输入。继续使用工作流原有的文本编码器和模型即可。

当前 288 组姿势／1,439 个视角使用逐组整理的动作标签，已结合缩略图和目录信息核对；同一姿势的不同视角共用动作标签。这是本地标签查询，不是运行时图片识别，无需 VLM、外部 AI 服务或额外模型下载。上游新增但尚未审核的姿势会返回空字符串，不编造描述。

推荐连接方式：

```text
Pose Gallery → Preview Image
Pose Gallery → DWPose / OpenPose 预处理器 → 匹配的 ControlNet 工作流
Pose Gallery → 支持图像参考的工作流
Pose Gallery.sd_prompt → CLIP Text Encode.text
```

**图库图片是素体参考图，不是 OpenPose 骨骼控制图。** 使用 OpenPose ControlNet 时，应先用相应预处理器提取姿势，再选择与底模兼容的 ControlNet 模型。预处理器和模型由你现有的 ComfyUI 环境提供。

## 示例工作流

- [选图并预览](examples/pose_gallery_preview.json)：将 JSON 拖入 ComfyUI 即可运行，也可打开图库重新选图。
- [API 请求示例](examples/pose_gallery_api.json)：包含 `PoseGallery → PreviewImage` 的 API prompt。

在仓库根目录执行：

```bash
curl -X POST http://127.0.0.1:8188/prompt -H "Content-Type: application/json" --data-binary @examples/pose_gallery_api.json
```

若你的 ComfyUI 使用其他地址或端口，请替换 URL。

## 网络与缓存

在线请求由 ComfyUI 后端发起，因此**运行 ComfyUI 的电脑或服务器**必须能访问资源站点。浏览器能打开网站，不代表后端也能访问。

缩略图按需加载；预览、选择或执行时按需获取原图。各数据源优先复用自身缓存，先检查首选源，再检查备用源，即使备用图片已经缓存也不改变此顺序。目录缓存一小时；在线来源不可用时，可以显示上次缓存的目录。这不等于完整离线图库。

默认缓存位于 ComfyUI 用户目录下的 `pose_gallery/cache`。可通过环境变量 `POSE_GALLERY_CACHE_DIR` 指定位置。较旧 ComfyUI 未提供用户目录接口时，使用系统临时目录中的 `comfyui_pose_gallery/cache`。

加载失败时，可点击 **刷新**、尝试另一个来源，并检查后端进程的网络或代理设置。插件不会修改系统网络配置。搜不到节点或没有图库按钮时，请检查 ZIP 是否多嵌套一层目录，重启 ComfyUI、强制刷新浏览器，并查看控制台的导入错误。

## 欢迎贡献姿势资源

**欢迎任何人贡献更多高质量的人偶／素体姿势参考资源。** 可通过 [GitHub Issues](https://github.com/icefox57/ComfyUI-Pose-Gallery/issues) 推荐资源，或用 PR 提交数据源接入方案。请提供：

- 少量样例链接，以及姿势内容、分辨率和可用视角的简要说明。
- 原作者姓名及原始来源链接。
- 使用与再分发许可，或原作者允许托管和分发图片的授权。
- 可用的元数据，例如稳定 ID、姿势名称、分类和视角标签。

欢迎原创或取得充分授权的资源。轮廓清楚、构图统一、分辨率实用、同一姿势提供多个视角的素材尤其有帮助。请勿上传现有图库中禁止再分发的图片；推荐在线来源时，提供链接即可，无需将整套图库复制进仓库。

## 开发与验证

本项目采用 Python 节点和原生 JavaScript，无前端构建步骤。使用包含常规 ComfyUI 依赖的 Python 环境和较新的 Node.js 执行：

```bash
python -m unittest discover -s tests -v
node --test tests/frontend.test.mjs
node --check web/pose_gallery.js
```

此前的真实实例验证及其范围见 [docs/VALIDATION.md](docs/VALIDATION.md)，这些记录不能代替每个版本在浏览器中的视觉和手动交互验收。上游格式见 [接入说明](docs/UPSTREAM.md)，版本变更见 [更新记录](CHANGELOG.md)。

## 协议与致谢

插件源代码使用 [MIT](LICENSE) 协议。MIT **不覆盖第三方图片或原始元数据**，本仓库不再发布现有整套图库。

- 中文图库与汉化：[Anhao / ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh)。
- 原始图库与图片作者：[ギア / @giaaibusi](https://x.com/giaaibusi)，[日文原站](https://ai-pose-gallery.pages.dev/)。

使用前请阅读原作者的当前条款。原站允许参考、编辑及商业作品制作，但禁止图片数据本身（包括加工后图片）的再分发、转载或转售。资源权利归各自作者所有。图库包含成人向姿势分类，请按你的使用场景选择。
