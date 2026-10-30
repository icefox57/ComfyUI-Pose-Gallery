export const LANGUAGES = Object.freeze({ zh: "中文", en: "English", ja: "日本語" });

export const MESSAGES = Object.freeze({
  zh: {
    title: "姿势图库", subtitle: "选择姿势与视角，将原图送入工作流", close: "关闭图库",
    searchPlaceholder: "搜索姿势、动作或 ID…", searchLabel: "搜索姿势",
    refresh: "刷新", refreshTitle: "重新读取本地目录", system: "体系", category: "动作分类", angle: "视角",
    allSystems: "全部体系", allCategories: "全部动作", allAngles: "全部视角", language: "语言",
    clearFilters: "清除筛选", catalogLoading: "正在读取本地图库…", resultsLabel: "姿势列表", previewLabel: "姿势预览",
    more: "加载更多", moreCount: "加载更多 · {shown} / {total}", count: "{groups} 组姿势 · {images} 张图片",
    footerLocal: "使用本地姿势资源 · 浏览和选图无需联网",
    unreadableResponse: "服务返回了无法读取的结果（HTTP {status}）。请检查 ComfyUI 控制台。",
    emptyCatalog: "本地目录为空，请检查图库资源。", catalogFailed: "图库加载失败",
    catalogError: "无法读取本地图库：{error}\n请检查图库资源是否已安装。",
    localCatalog: "本地图册", retry: "重新加载",
    noResults: "没有匹配的姿势。试试其他关键词，或清除筛选。", cardLabel: "{name} · {angle} · 预览姿势",
    thumbFailed: "缩略图加载失败 · 点击预览", detailEmpty: "点击一张姿势图，预览原图并选择视角。\n选好后点击「使用这张姿势」。",
    originalLoading: "正在读取本地原图…", useImage: "使用这张姿势", originalError: "原图读取失败：{error}。可点击使用重试。",
    caching: "正在读取所选原图…",
    selectionError: "选图失败：{error}。请检查本地文件后重试。", browse: "选择姿势", nodeEmpty: "选择一张姿势参考图",
    nodePreviewError: "{id} · 无法读取本地预览图", nodePoseId: "姿势 ID", nodeLanguage: "界面语言",
    poseIdTooltip: "所选姿势的稳定 ID，随工作流保存。",
    languageTooltip: "切换界面语言；姿势名称使用本地中文或日文标签。",
    outputImage: "参考图", outputName: "姿势名称", outputUrl: "本地图像文件地址", outputSdPrompt: "SD 姿势提示词",
  },
  en: {
    title: "Pose Gallery", subtitle: "Choose a pose and view to send the original image into your workflow", close: "Close gallery",
    searchPlaceholder: "Search poses, actions, or IDs…", searchLabel: "Search poses",
    refresh: "Refresh", refreshTitle: "Reload the local catalog", system: "System", category: "Category", angle: "View",
    allSystems: "All systems", allCategories: "All categories", allAngles: "All views", language: "Language",
    clearFilters: "Clear filters", catalogLoading: "Loading the local gallery…", resultsLabel: "Pose list", previewLabel: "Pose preview",
    more: "Load more", moreCount: "Load more · {shown} / {total}", count: "{groups} pose groups · {images} images",
    footerLocal: "Local pose assets · Browsing and selection work offline",
    unreadableResponse: "The server returned an unreadable response (HTTP {status}). Check the ComfyUI console.",
    emptyCatalog: "The local catalog is empty. Check the gallery assets.", catalogFailed: "Gallery failed to load",
    catalogError: "Cannot read the local gallery: {error}\nCheck that the gallery assets are installed.",
    localCatalog: "Local gallery", retry: "Retry",
    noResults: "No matching poses. Try another keyword or clear the filters.", cardLabel: "{name} · {angle} · Preview pose",
    thumbFailed: "Thumbnail unavailable · Click to preview", detailEmpty: "Click a pose to preview the original and choose a view.\nThen click “Use this image”.",
    originalLoading: "Reading the local image…", useImage: "Use this image", originalError: "Could not read the image: {error}. Click Use this image to retry.",
    caching: "Reading the selected image…",
    selectionError: "Cannot select image: {error}. Check the local files and retry.", browse: "Browse poses", nodeEmpty: "Choose a pose reference image",
    nodePreviewError: "{id} · Local preview unavailable", nodePoseId: "Pose ID", nodeLanguage: "UI language",
    poseIdTooltip: "The stable ID of the selected pose, saved with the workflow.",
    languageTooltip: "Change the interface language; pose titles use local Chinese or Japanese labels.",
    outputImage: "Reference image", outputName: "Pose name", outputUrl: "Local image file URI", outputSdPrompt: "SD pose prompt",
  },
  ja: {
    title: "ポーズギャラリー", subtitle: "ポーズとアングルを選び、元画像をワークフローへ送信", close: "ギャラリーを閉じる",
    searchPlaceholder: "ポーズ、動作、ID を検索…", searchLabel: "ポーズを検索",
    refresh: "更新", refreshTitle: "ローカル一覧を再読み込み", system: "系統", category: "分類", angle: "アングル",
    allSystems: "すべての系統", allCategories: "すべての分類", allAngles: "すべてのアングル", language: "言語",
    clearFilters: "絞り込みを解除", catalogLoading: "ローカル一覧を読み込み中…", resultsLabel: "ポーズ一覧", previewLabel: "ポーズのプレビュー",
    more: "さらに表示", moreCount: "さらに表示 · {shown} / {total}", count: "{groups} 組のポーズ · {images} 枚の画像",
    footerLocal: "ローカル素材を使用 · 閲覧と選択はオフラインで可能",
    unreadableResponse: "読み取れない応答が返されました（HTTP {status}）。ComfyUI のコンソールを確認してください。",
    emptyCatalog: "ローカル一覧が空です。素材を確認してください。", catalogFailed: "一覧を読み込めませんでした",
    catalogError: "ローカル一覧を読み取れません：{error}\n素材がインストールされているか確認してください。",
    localCatalog: "ローカルギャラリー", retry: "再試行",
    noResults: "一致するポーズがありません。別のキーワードを試すか、絞り込みを解除してください。", cardLabel: "{name} · {angle} · ポーズをプレビュー",
    thumbFailed: "サムネイルを取得できません · クリックでプレビュー", detailEmpty: "ポーズをクリックして元画像とアングルを確認します。\n選択後に「この画像を使用」をクリックしてください。",
    originalLoading: "ローカル画像を読み込み中…", useImage: "この画像を使用", originalError: "画像を読み取れません：{error}。「この画像を使用」で再試行できます。",
    caching: "選択した画像を読み込み中…",
    selectionError: "画像を選択できません：{error}。ローカルファイルを確認して再試行してください。", browse: "ポーズを選択", nodeEmpty: "参考にするポーズ画像を選択",
    nodePreviewError: "{id} · ローカル画像をプレビューできません", nodePoseId: "ポーズ ID", nodeLanguage: "表示言語",
    poseIdTooltip: "選択したポーズの固定 ID。ワークフローに保存されます。",
    languageTooltip: "表示言語を切り替えます。ポーズ名はローカルの中国語または日本語ラベルを使用します。",
    outputImage: "参考画像", outputName: "ポーズ名", outputUrl: "ローカル画像ファイル URI", outputSdPrompt: "SD ポーズプロンプト",
  },
});

export function normalizeLanguage(language) { return Object.hasOwn(LANGUAGES, language) ? language : "zh"; }
export function t(language, key, parameters = {}) {
  const value = MESSAGES[normalizeLanguage(language)][key];
  if (value === undefined) throw new Error(`Missing Pose Gallery translation: ${key}`);
  return value.replace(/\{(\w+)\}/g, (match, parameter) => parameters[parameter] === undefined ? match : String(parameters[parameter]));
}

// Finite taxonomy labels from the cached upstream catalogs; individual pose titles remain upstream content.
const TAXONOMY = {
  system: [
    ["全身单人・性感系", "Full body · Sensual", "全身1人・セクシー系"],
    ["全身单人・标准系", "Full body · Standard", "全身1人・標準系"],
    ["上半身单人", "Upper body · Solo", "上半身1人"],
    ["双人缠绵", "Two-person poses", "2人絡み"],
  ],
  angle: [
    ["正面", "Front", "正面"], ["俯视", "High angle", "上から"], ["仰视", "Low angle", "下から"],
    ["侧面", "Side", "横"], ["斜侧", "Three-quarter", "斜め"],
  ],
  category: [
    ["站姿", "Standing", "立ち"], ["坐姿", "Sitting", "座り"], ["跪立・四肢着地", "Kneeling / All fours", "膝立ち・四つん這い"],
    ["趴卧", "Lying down", "寝そべり"], ["特殊", "Special", "特殊"], ["跪立", "Kneeling", "膝立ち"],
    ["侧坐・女孩坐", "Side-sitting / W-sitting", "横座り・女の子座り"], ["蹲姿", "Crouching", "しゃがみ"],
    ["前倾", "Leaning forward", "前かがみ"], ["后仰・挺背", "Leaning back / Arched back", "のけぞり・反り"],
    ["扭身", "Twisting", "ひねり"], ["可爱系", "Cute poses", "かわいい系"],
    ["挤胸・强调事业线系", "Chest emphasis", "胸寄せ・谷間強調系"], ["性感・大胆系", "Sensual / Bold", "セクシー・露骨寄り系"],
    ["立位", "Standing positions", "立位"], ["贴脸系", "Faces close together", "顔寄せ系"],
    ["正常位（传教士）", "Missionary position", "正常位"], ["后入位", "Rear-entry position", "後背位"],
    ["坐位", "Seated positions", "座位"], ["背向坐位", "Back-facing seated", "背面座位"],
    ["骑乘位", "Straddling", "騎乗位"], ["侧卧位", "Side-lying", "側位"], ["面对面坐位", "Face-to-face seated", "対面座位"],
    ["立位贴身", "Standing close contact", "立位密着"], ["坐位贴身", "Seated close contact", "座位密着"], ["贴身", "Close contact", "密着"],
  ],
};

export function taxonomy(language, kind, value) {
  const row = TAXONOMY[kind]?.find((labels) => labels.includes(value));
  return row ? row[{ zh: 0, en: 1, ja: 2 }[normalizeLanguage(language)]] : value;
}
