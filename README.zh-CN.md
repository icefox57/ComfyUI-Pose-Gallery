# ComfyUI Pose Gallery · 本地姿势图库

[English](README.md) · **简体中文** · [日本語](README.ja.md)

在 ComfyUI 中浏览姿势参考图，将选中的图片和姿势提示词接入工作流。图库以中文版为基础，安装完成后浏览和运行均读取本地文件，无需联网。

## 安装

在 ComfyUI 的 `custom_nodes` 目录中执行以下命令，然后重启 ComfyUI，强制刷新浏览器（Windows 使用 `Ctrl+F5`）：

```bash
git clone https://github.com/icefox57/ComfyUI-Pose-Gallery.git
```

仓库不包含上游图片和目录数据。请使用 ComfyUI 自带的 Python 执行一次素材准备，从中文站下载 1,439 张原图（约 638 MiB）：

```bash
python scripts/setup_assets.py --download
```

如果硬盘上已有中文版图库，也可以离线导入：`python scripts/setup_assets.py --from-directory 图库目录`。源目录须包含 `img/` 和 `data/pose-zh.json`；如有 `data/pose.json`，也会导入日文名称。中断后可重新运行以继续准备。素材保存在 `assets/zh/`，脚本不会覆盖已有的不同图片。下载前请确认网络线路和流量额度。

标准 ComfyUI 已提供所需 Python 依赖，无需额外模型或 npm 安装。便携版请使用 ComfyUI 目录内的 `custom_nodes` 文件夹及其自带的 Python。

更新时在插件目录执行 `git pull`，再重启 ComfyUI 并刷新浏览器。

## 使用

1. 在节点菜单中添加 **Pose Gallery**。
2. 将 `language` 设置为 `zh`、`en` 或 `ja`，点击**选择姿势**。
3. 搜索或按分类、角度筛选；点击卡片预览并选择视角，再点击**使用这张姿势**。
4. 将 `image` 连接到参考图工作流。若要使用 `sd_prompt`，将 **CLIP Text Encode (Prompt)** 节点的 text 控件转换为输入并连接。

图库每次显示 24 组姿势，可点击加载更多，或按 `Esc` 关闭。选中的图片 ID 和语言会保存到工作流；也可直接填写 ID，例如 `full_sexy_P001_front`。

| 输出 | 类型 | 用途 |
| --- | --- | --- |
| `image` | `IMAGE` | 本地原始姿势参考图 |
| `pose_name` | `STRING` | 中文或日文姿势名称和角度；英文界面使用中文名称 |
| `source_url` | `STRING` | 本地图片的 `file:` URI（v0.4.0 起不再是在线地址） |
| `sd_prompt` | `STRING` | 描述人物和动作的英文 SD 标签 |

当前 288 组姿势使用人工整理的标签，同一姿势的不同视角共用；尚未整理的新姿势返回空提示词。这些图片是参考图，不是 OpenPose 骨架图；需要骨架的工作流请使用兼容的姿势预处理器及 ControlNet。仓库提供[示例工作流](examples/)。

界面和筛选标签支持中、英、日三种语言。日文姿势名称来自本地日文标签，切换语言不会切换图片来源。旧工作流的输出顺序不变，旧 `source` 参数仍可读取但不再影响加载。

## 来源、权利和贡献

姿势图片原作：[ギア的日文图库](https://ai-pose-gallery.pages.dev/)（[作者](https://x.com/giaaibusi)）；中文目录：[Anhao 中文版](https://github.com/anhao/ai-pose-gallery-zh)。本插件代码采用 [MIT 协议](LICENSE)，这不代表上游图片或元数据使用 MIT 协议。日文原站的注意事项允许参考和编辑，但禁止再分发、转载、转售图片数据，包括加工后的图片，因此仓库不包含这些图片。请参阅[上游说明](docs/UPSTREAM.md)和原站当前条款。

欢迎任何人提供更多优质的人偶姿势素材，帮助扩充项目；请同时提供素材来源和可纳入、分发的授权。
