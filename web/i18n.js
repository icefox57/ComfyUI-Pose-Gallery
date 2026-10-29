export const LANGUAGES = Object.freeze({ zh: "中文", en: "English", ja: "日本語" });

export const MESSAGES = Object.freeze({
  zh: {
    title: "姿势图库", subtitle: "选择姿势与视角，将原图送入工作流", close: "关闭图库",
    openSite: "打开原站 ↗", searchPlaceholder: "搜索姿势、动作或 ID…", searchLabel: "搜索姿势",
    refresh: "刷新", refreshTitle: "重新读取在线目录", system: "体系", category: "动作分类", angle: "视角",
    allSystems: "全部体系", allCategories: "全部动作", allAngles: "全部视角", source: "在线数据源", language: "语言",
    sourceZh: "中文站", sourceJa: "日文站", autoZh: "自动 · 中文 → 日文", autoJa: "自动 · 日文 → 中文",
    clearFilters: "清除筛选", catalogLoading: "正在读取在线图库…", resultsLabel: "姿势列表", previewLabel: "姿势预览",
    more: "加载更多", moreCount: "加载更多 · {shown} / {total}", count: "{groups} 组姿势 · {images} 张图片",
    footerCache: "缩略图按需加载 · 仅缓存浏览或选中的资源", upstreamLink: "中文图库 · Anhao", termsLink: "原作者与素材使用条款 ↗",
    unreadableResponse: "服务返回了无法读取的结果（HTTP {status}）。请检查 ComfyUI 控制台。",
    emptyCatalog: "在线目录为空。请刷新或切换数据源。", catalogFailed: "图库加载失败",
    catalogError: "无法读取在线图库：{error}\n请检查 ComfyUI 所在电脑的网络，或切换数据源。",
    onlineCatalog: "{source} · 在线目录", cachedCatalog: "{source} · 使用已缓存目录",
    catalogFallback: "{preferred}当前不可用，已自动切换至{actual}。", retry: "重新加载",
    noResults: "没有匹配的姿势。试试其他关键词，或清除筛选。", cardLabel: "{name} · {angle} · 预览姿势",
    thumbFailed: "缩略图加载失败 · 点击预览", detailEmpty: "点击一张姿势图，预览原图并选择视角。\n选好后点击「使用这张姿势」。",
    originalLoading: "正在加载原图…", useImage: "使用这张姿势", originalError: "原图加载失败：{error}。可点击使用重试。",
    imageFallback: "此图片的{preferred}资源不可用，已自动使用{actual}的同一姿势。", caching: "正在缓存所选原图…",
    selectionError: "选图失败：{error}。请重试或切换数据源。", browse: "选择姿势", nodeEmpty: "选择一张姿势参考图",
    nodePreviewError: "{id} · 预览不可用，运行时仍会尝试读取缓存原图", nodePoseId: "姿势 ID", nodeSource: "数据源", nodeLanguage: "界面语言",
    poseIdTooltip: "所选姿势的稳定 ID，随工作流保存。", sourceTooltip: "auto 按界面语言自动选择主站与备份；zh / ja 固定使用对应站点。",
    languageTooltip: "切换语言会恢复自动数据源；日语优先日文站，中文和英语优先中文站。",
    outputImage: "参考图", outputName: "姿势名称", outputUrl: "图片来源 URL",
  },
  en: {
    title: "Pose Gallery", subtitle: "Choose a pose and view to send the original image into your workflow", close: "Close gallery",
    openSite: "Open original site ↗", searchPlaceholder: "Search poses, actions, or IDs…", searchLabel: "Search poses",
    refresh: "Refresh", refreshTitle: "Reload the online catalog", system: "System", category: "Category", angle: "View",
    allSystems: "All systems", allCategories: "All categories", allAngles: "All views", source: "Online source", language: "Language",
    sourceZh: "Chinese site", sourceJa: "Japanese site", autoZh: "Auto · Chinese → Japanese", autoJa: "Auto · Japanese → Chinese",
    clearFilters: "Clear filters", catalogLoading: "Loading the online gallery…", resultsLabel: "Pose list", previewLabel: "Pose preview",
    more: "Load more", moreCount: "Load more · {shown} / {total}", count: "{groups} pose groups · {images} images",
    footerCache: "Thumbnails load on demand · Only viewed or selected resources are cached", upstreamLink: "Chinese gallery · Anhao", termsLink: "Original author and image terms ↗",
    unreadableResponse: "The server returned an unreadable response (HTTP {status}). Check the ComfyUI console.",
    emptyCatalog: "The online catalog is empty. Refresh or choose another source.", catalogFailed: "Gallery failed to load",
    catalogError: "Cannot read the online gallery: {error}\nCheck the network on the computer running ComfyUI, or choose another source.",
    onlineCatalog: "{source} · Online catalog", cachedCatalog: "{source} · Cached catalog",
    catalogFallback: "{preferred} is unavailable. Switched automatically to {actual}.", retry: "Retry",
    noResults: "No matching poses. Try another keyword or clear the filters.", cardLabel: "{name} · {angle} · Preview pose",
    thumbFailed: "Thumbnail unavailable · Click to preview", detailEmpty: "Click a pose to preview the original and choose a view.\nThen click “Use this image”.",
    originalLoading: "Loading original image…", useImage: "Use this image", originalError: "Original image failed to load: {error}. Click Use this image to retry.",
    imageFallback: "This image is unavailable on {preferred}. Using the same pose from {actual}.", caching: "Caching the selected original image…",
    selectionError: "Cannot select image: {error}. Retry or choose another source.", browse: "Browse poses", nodeEmpty: "Choose a pose reference image",
    nodePreviewError: "{id} · Preview unavailable; the cached original will still be tried when running", nodePoseId: "Pose ID", nodeSource: "Source", nodeLanguage: "UI language",
    poseIdTooltip: "The stable ID of the selected pose, saved with the workflow.", sourceTooltip: "auto follows the UI language and falls back to the other site; zh / ja use a fixed site.",
    languageTooltip: "Changing language restores automatic sources. Japanese prefers the Japanese site; Chinese and English prefer the Chinese site.",
    outputImage: "Reference image", outputName: "Pose name", outputUrl: "Image source URL",
  },
  ja: {
    title: "ポーズギャラリー", subtitle: "ポーズとアングルを選び、元画像をワークフローへ送信", close: "ギャラリーを閉じる",
    openSite: "元のサイトを開く ↗", searchPlaceholder: "ポーズ、動作、ID を検索…", searchLabel: "ポーズを検索",
    refresh: "更新", refreshTitle: "オンライン一覧を再読み込み", system: "系統", category: "分類", angle: "アングル",
    allSystems: "すべての系統", allCategories: "すべての分類", allAngles: "すべてのアングル", source: "オンライン取得元", language: "言語",
    sourceZh: "中国語サイト", sourceJa: "日本語サイト", autoZh: "自動 · 中国語 → 日本語", autoJa: "自動 · 日本語 → 中国語",
    clearFilters: "絞り込みを解除", catalogLoading: "オンライン一覧を読み込み中…", resultsLabel: "ポーズ一覧", previewLabel: "ポーズのプレビュー",
    more: "さらに表示", moreCount: "さらに表示 · {shown} / {total}", count: "{groups} 組のポーズ · {images} 枚の画像",
    footerCache: "サムネイルは必要に応じて取得 · 閲覧・選択した素材のみ保存", upstreamLink: "中国語ギャラリー · Anhao", termsLink: "原作者・素材の利用規約 ↗",
    unreadableResponse: "読み取れない応答が返されました（HTTP {status}）。ComfyUI のコンソールを確認してください。",
    emptyCatalog: "オンライン一覧が空です。更新するか、取得元を変更してください。", catalogFailed: "一覧を読み込めませんでした",
    catalogError: "オンライン一覧を取得できません：{error}\nComfyUI を実行しているパソコンの接続を確認するか、取得元を変更してください。",
    onlineCatalog: "{source} · オンライン一覧", cachedCatalog: "{source} · 保存済みの一覧",
    catalogFallback: "{preferred}に接続できないため、{actual}へ自動で切り替えました。", retry: "再試行",
    noResults: "一致するポーズがありません。別のキーワードを試すか、絞り込みを解除してください。", cardLabel: "{name} · {angle} · ポーズをプレビュー",
    thumbFailed: "サムネイルを取得できません · クリックでプレビュー", detailEmpty: "ポーズをクリックして元画像とアングルを確認します。\n選択後に「この画像を使用」をクリックしてください。",
    originalLoading: "元画像を読み込み中…", useImage: "この画像を使用", originalError: "元画像を取得できません：{error}。「この画像を使用」で再試行できます。",
    imageFallback: "この画像を{preferred}から取得できないため、{actual}の同じポーズを使用しています。", caching: "選択した元画像を保存中…",
    selectionError: "画像を選択できません：{error}。再試行するか、取得元を変更してください。", browse: "ポーズを選択", nodeEmpty: "参考にするポーズ画像を選択",
    nodePreviewError: "{id} · プレビューできません。実行時には保存済みの元画像も確認します", nodePoseId: "ポーズ ID", nodeSource: "取得元", nodeLanguage: "表示言語",
    poseIdTooltip: "選択したポーズの固定 ID。ワークフローに保存されます。", sourceTooltip: "auto は表示言語に応じて優先サイトを選び、接続できない場合は切り替えます。zh / ja は取得元を固定します。",
    languageTooltip: "言語を変更すると取得元は自動に戻ります。日本語では日本語サイト、中国語・英語では中国語サイトを優先します。",
    outputImage: "参考画像", outputName: "ポーズ名", outputUrl: "画像の取得元 URL",
  },
});

export function normalizeLanguage(language) { return Object.hasOwn(LANGUAGES, language) ? language : "zh"; }
export function preferredSource(language) { return normalizeLanguage(language) === "ja" ? "ja" : "zh"; }
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
