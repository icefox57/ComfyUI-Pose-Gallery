import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const SOURCE_NAMES = { zh: "中文版", ja: "日本語版" };
const PAGE_SIZE = 24;
const states = new WeakMap();
let dialogSequence = 0;

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function button(text, className, onClick) {
  const result = element("button", className, text);
  result.type = "button";
  if (onClick) result.addEventListener("click", onClick);
  return result;
}

function link(text, href) {
  const result = element("a", "", text);
  result.href = href;
  result.target = "_blank";
  result.rel = "noopener noreferrer";
  return result;
}

function loadStyles() {
  if (document.querySelector("link[data-pose-gallery-style]")) return;
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("./pose_gallery.css", import.meta.url).href;
  style.dataset.poseGalleryStyle = "true";
  document.head.append(style);
}

export function imageUrl(id, source = "auto", kind = "thumb") {
  return api.apiURL(`/pose_gallery/image?${new URLSearchParams({ id, source, kind })}`);
}

export function filterItems(items, filters) {
  const words = (filters.query || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.system && item.system !== filters.system) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.angle && item.angle !== filters.angle) return false;
    const search = `${item.search || ""} ${item.id} ${item.name} ${item.system} ${item.category} ${item.angle}`.toLocaleLowerCase();
    return words.every((word) => search.includes(word));
  });
}

export function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.group || item.id.replace(/_[^_]+$/, "");
    if (!groups.has(key) || /_front$/.test(item.id)) groups.set(key, item);
  }
  return [...groups.values()];
}

async function jsonRequest(path, options) {
  const response = await api.fetchApi(path, options);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`服务返回了无法读取的结果（HTTP ${response.status}）。请检查 ComfyUI 控制台。`);
  }
  if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
  return payload;
}

function setOptions(select, values, allLabel, previous = select.value) {
  const options = [new Option(allLabel, ""), ...values.filter(Boolean).map((v) => new Option(v, v))];
  select.replaceChildren(...options);
  select.value = values.includes(previous) ? previous : "";
}

export class GalleryDialog {
  constructor(node, onSelected) {
    loadStyles();
    this.node = node;
    this.onSelected = onSelected;
    this.items = [];
    this.filtered = [];
    this.source = node.widgets?.find((w) => w.name === "source")?.value || "auto";
    this.closed = false;
    this.busy = false;
    this.controllers = new Set();
    this.generation = 0;
    this.previewGeneration = 0;
    this.catalogWarning = "";
    this.titleId = `pose-gallery-title-${++dialogSequence}`;
    this.returnFocus = document.activeElement;
    this.dialog = element("dialog", "pose-gallery");
    this.dialog.setAttribute("aria-labelledby", this.titleId);
    this.build();
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
    });
    this.dialog.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Tab") this.trapFocus(event);
    });
    document.body.append(this.dialog);
    this.dialog.showModal();
    this.search.focus();
    this.load();
  }

  build() {
    const header = element("header", "pg-header");
    const heading = element("div", "pg-heading");
    const title = element("h2", "", "姿势图库 / Pose Gallery");
    title.id = this.titleId;
    heading.append(title, element("p", "", "选择姿势与视角，将原图送入工作流"));
    const close = button("×", "pg-close", () => this.close());
    close.setAttribute("aria-label", "关闭图库 / Close gallery");
    header.append(heading, link("打开原站 ↗", "https://ai-pose-gallery.anhao.app/"), close);

    const toolbar = element("section", "pg-toolbar");
    const searchRow = element("div", "pg-search-row");
    this.search = element("input");
    this.search.type = "search";
    this.search.placeholder = "搜索姿势、动作或 ID / Search poses…";
    this.search.setAttribute("aria-label", "搜索姿势 / Search poses");
    let searchTimer;
    this.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.render(), 120);
    });
    this.refreshButton = button("刷新", "", () => this.load(true));
    this.refreshButton.title = "重新读取在线目录 / Refresh online catalog";
    searchRow.append(this.search, this.refreshButton);
    const filters = element("div", "pg-filters");
    this.systemFilter = this.addSelect(filters, "体系 / System", "全部体系");
    this.categoryFilter = this.addSelect(filters, "动作 / Category", "全部动作");
    this.angleFilter = this.addSelect(filters, "视角 / Angle", "全部视角");
    this.sourceFilter = this.addSelect(filters, "在线数据源 / Source", null, "pg-source");
    this.sourceFilter.append(new Option("自动 · 中文 → 日文", "auto"), new Option("中文站", "zh"), new Option("日本語站", "ja"));
    this.sourceFilter.value = this.source;
    this.systemFilter.addEventListener("change", () => { this.updateCategories(); this.render(); });
    this.categoryFilter.addEventListener("change", () => this.render());
    this.angleFilter.addEventListener("change", () => this.render());
    this.sourceFilter.addEventListener("change", () => { this.source = this.sourceFilter.value; this.load(); });
    filters.append(button("清除筛选", "", () => {
      this.search.value = "";
      this.systemFilter.value = "";
      this.updateCategories();
      this.categoryFilter.value = "";
      this.angleFilter.value = "";
      this.render();
    }));
    const summary = element("div", "pg-summary");
    this.count = element("span", "pg-count", "正在读取在线图库…");
    this.sourceStatus = element("span", "pg-source-status");
    this.sourceStatus.setAttribute("role", "status");
    summary.append(this.count, this.sourceStatus);
    this.warning = element("p", "pg-warning");
    this.warning.hidden = true;
    this.warning.setAttribute("role", "status");
    toolbar.append(searchRow, filters, summary, this.warning);

    const body = element("div", "pg-body");
    this.results = element("section", "pg-results");
    this.results.setAttribute("aria-label", "姿势列表 / Pose list");
    this.grid = element("div", "pg-grid");
    this.more = button("加载更多", "pg-more", () => this.render(true));
    this.more.hidden = true;
    this.results.append(this.grid, this.more);
    this.detail = element("aside", "pg-detail");
    this.detail.setAttribute("aria-label", "姿势预览 / Pose preview");
    this.clearDetail();
    body.append(this.results, this.detail);
    const footer = element("footer", "pg-footer");
    footer.append(element("span", "", "缩略图按需加载 · 仅缓存浏览或选中的资源"), link("中文图库 · Anhao", "https://github.com/anhao/ai-pose-gallery-zh"), link("原作者与素材使用条款 ↗", "https://ai-pose-gallery.pages.dev/"));
    this.dialog.append(header, toolbar, body, footer);
  }

  addSelect(parent, text, allLabel, className = "") {
    const label = element("label", `pg-filter ${className}`);
    const select = element("select");
    if (allLabel !== null) select.append(new Option(allLabel, ""));
    label.append(element("span", "", text), select);
    parent.append(label);
    return select;
  }

  updateCategories() {
    const items = this.items.filter((item) => !this.systemFilter.value || item.system === this.systemFilter.value);
    setOptions(this.categoryFilter, [...new Set(items.map((item) => item.category))], "全部动作");
  }

  controller() {
    const controller = new AbortController();
    this.controllers.add(controller);
    return controller;
  }

  async load(refresh = false) {
    const generation = ++this.generation;
    this.previewGeneration++;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.items = [];
    this.selected = null;
    this.busy = false;
    this.clearDetail();
    this.grid.replaceChildren(this.message("正在读取在线图库…"));
    this.more.hidden = true;
    this.count.textContent = "正在读取在线图库…";
    this.sourceStatus.textContent = "";
    this.catalogWarning = "";
    this.warning.hidden = true;
    this.refreshButton.disabled = true;
    const controller = this.controller();
    try {
      const query = new URLSearchParams({ source: this.source });
      if (refresh) query.set("refresh", "1");
      const data = await jsonRequest(`/pose_gallery/catalog?${query}`, { signal: controller.signal });
      if (this.closed || generation !== this.generation) return;
      if (!Array.isArray(data.items) || !data.items.length) throw new Error("在线目录为空。请刷新或切换数据源。");
      this.items = data.items;
      this.sourceStatus.textContent = `${SOURCE_NAMES[data.source] || data.source}${data.stale ? " · 使用已缓存目录" : " · 在线目录"}`;
      this.catalogWarning = data.warning || (this.source === "auto" && data.source === "ja" ? "中文站当前不可用，已自动切换至日文站。" : "");
      this.warning.textContent = this.catalogWarning;
      this.warning.hidden = !this.warning.textContent;
      setOptions(this.systemFilter, [...new Set(this.items.map((item) => item.system))], "全部体系");
      this.updateCategories();
      setOptions(this.angleFilter, [...new Set(this.items.map((item) => item.angle))], "全部视角");
      this.render();
      const id = this.node.widgets?.find((w) => w.name === "pose_id")?.value;
      const selected = this.items.find((item) => item.id === id);
      if (selected) this.showDetail(selected);
    } catch (error) {
      if (error.name === "AbortError" || this.closed || generation !== this.generation) return;
      this.count.textContent = "图库加载失败";
      this.grid.replaceChildren(this.message(`无法读取在线图库：${error.message}\n请检查 ComfyUI 所在电脑的网络，或切换数据源。`, () => this.load(true)));
    } finally {
      this.controllers.delete(controller);
      if (!this.closed && generation === this.generation) this.refreshButton.disabled = false;
    }
  }

  message(text, retry) {
    const message = element("div", "pg-message");
    message.append(element("p", "", text));
    if (retry) message.append(button("重新加载 / Retry", "", retry));
    return message;
  }

  render(append = false) {
    if (this.closed || !this.items.length) return;
    if (!append) {
      const matching = filterItems(this.items, {
        query: this.search.value, system: this.systemFilter.value,
        category: this.categoryFilter.value, angle: this.angleFilter.value,
      });
      this.filtered = groupItems(matching);
      this.count.textContent = `${this.filtered.length} 组姿势 · ${matching.length} 张图片`;
      this.shown = 0;
      this.grid.replaceChildren();
      this.results.scrollTop = 0;
      if (!matching.length) this.grid.append(this.message("没有匹配的姿势。试试其他关键词，或清除筛选。"));
    }
    const entries = this.filtered.slice(this.shown, this.shown + PAGE_SIZE);
    for (const item of entries) this.grid.append(this.card(item));
    this.shown += entries.length;
    this.more.hidden = this.shown >= this.filtered.length;
    this.more.textContent = `加载更多 · ${this.shown} / ${this.filtered.length}`;
    this.markSelected();
  }

  card(item) {
    const card = button("", "pg-card", () => this.showDetail(item));
    card.dataset.group = item.group || item.id.replace(/_[^_]+$/, "");
    card.setAttribute("aria-label", `${item.name} · ${item.angle} · 预览姿势`);
    card.setAttribute("aria-pressed", "false");
    const stage = element("div", "pg-card-image");
    const image = element("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = `${item.name} · ${item.angle}`;
    image.src = imageUrl(item.id, this.source);
    image.addEventListener("error", () => { image.hidden = true; stage.classList.add("pg-image-error"); }, { once: true });
    stage.append(image, element("span", "pg-angle-tag", item.angle));
    const copy = element("span", "pg-card-copy");
    copy.append(element("span", "pg-card-name", item.name), element("span", "pg-card-meta", `${item.pose || ""} · ${item.category || item.system}`));
    card.append(stage, copy);
    return card;
  }

  markSelected() {
    const group = this.selected?.group || this.selected?.id.replace(/_[^_]+$/, "");
    for (const card of this.grid.querySelectorAll(".pg-card")) card.setAttribute("aria-pressed", String(card.dataset.group === group));
  }

  clearDetail() {
    this.detail.replaceChildren(element("p", "pg-detail-empty", "点击一张姿势图，预览原图并选择视角。\n选好后点击「使用这张姿势」。"));
  }

  async showDetail(item) {
    if (this.busy || this.closed) return;
    const previewGeneration = ++this.previewGeneration;
    if (this.previewController) this.previewController.abort();
    if (this.previewBlob) { URL.revokeObjectURL(this.previewBlob); this.previewBlob = null; }
    this.warning.textContent = this.catalogWarning;
    this.warning.hidden = !this.catalogWarning;
    this.selected = item;
    this.markSelected();
    const stage = element("div", "pg-preview-stage");
    const image = element("img");
    image.alt = `${item.name} · ${item.angle}`;
    image.src = imageUrl(item.id, this.source);
    const previewStatus = element("span", "pg-preview-status", "正在加载原图…");
    previewStatus.setAttribute("role", "status");
    stage.append(image, previewStatus);
    const title = element("h3", "", item.name);
    const id = element("div", "pg-id", item.id);
    const angles = element("div", "pg-angle-list");
    const group = item.group || item.id.replace(/_[^_]+$/, "");
    const related = this.items.filter((entry) => (entry.group || entry.id.replace(/_[^_]+$/, "")) === group);
    for (const entry of related) {
      const angle = button(entry.angle, "pg-angle-button", () => this.showDetail(entry));
      angle.setAttribute("aria-pressed", String(entry.id === item.id));
      angles.append(angle);
    }
    const meta = element("p", "pg-detail-meta", `${item.system}\n${item.category} · ${item.angle}`);
    meta.style.whiteSpace = "pre-line";
    this.useButton = button("使用这张姿势 / Use image", "pg-use", () => this.select());
    this.selectionStatus = element("p", "pg-selection-status");
    this.selectionStatus.setAttribute("role", "status");
    this.detail.replaceChildren(stage, title, id, angles, meta, this.useButton, this.selectionStatus);
    const controller = this.controller();
    this.previewController = controller;
    try {
      const response = await api.fetchApi(`/pose_gallery/image?${new URLSearchParams({ id: item.id, source: this.source, kind: "full" })}`, { signal: controller.signal });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try { message = (await response.json()).error || message; } catch { /* Keep the HTTP status. */ }
        throw new Error(message);
      }
      const blob = await response.blob();
      if (this.closed || previewGeneration !== this.previewGeneration) return;
      this.previewBlob = URL.createObjectURL(blob);
      image.src = this.previewBlob;
      image.onload = () => { if (previewGeneration === this.previewGeneration) previewStatus.hidden = true; };
      const actualSource = response.headers.get("X-Pose-Gallery-Source");
      if (this.source === "auto" && actualSource === "ja") {
        this.warning.textContent = [this.catalogWarning, "此图片的中文资源不可用，已自动使用日文站的同一姿势。"].filter(Boolean).join(" ");
        this.warning.hidden = false;
      }
    } catch (error) {
      if (error.name !== "AbortError" && !this.closed && previewGeneration === this.previewGeneration) previewStatus.textContent = `原图加载失败：${error.message}。可点击使用重试。`;
    } finally {
      this.controllers.delete(controller);
    }
  }

  async select() {
    if (this.busy || !this.selected || this.closed) return;
    this.busy = true;
    this.useButton.disabled = true;
    this.sourceFilter.disabled = true;
    this.refreshButton.disabled = true;
    this.selectionStatus.textContent = "正在缓存所选原图…";
    const controller = this.controller();
    try {
      const selection = await jsonRequest("/pose_gallery/select", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.selected.id, source: this.source }), signal: controller.signal,
      });
      if (this.closed) return;
      this.onSelected(selection, this.source);
      this.close();
    } catch (error) {
      if (error.name !== "AbortError" && !this.closed) this.selectionStatus.textContent = `选图失败：${error.message}。请重试或切换数据源。`;
    } finally {
      this.controllers.delete(controller);
      this.busy = false;
      if (!this.closed) {
        this.useButton.disabled = false;
        this.sourceFilter.disabled = false;
        this.refreshButton.disabled = false;
      }
    }
  }

  trapFocus(event) {
    const focusable = [...this.dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter((entry) => entry.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.generation++;
    this.previewGeneration++;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    for (const image of this.dialog.querySelectorAll("img")) image.removeAttribute("src");
    if (this.previewBlob) URL.revokeObjectURL(this.previewBlob);
    this.dialog.close();
    this.dialog.remove();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.onClose?.();
  }
}

function widget(node, name) { return node.widgets?.find((entry) => entry.name === name); }

function ensureNodeSize(node) {
  node.setSize?.([Math.max(node.size?.[0] || 0, 310), Math.max(node.size?.[1] || 0, 390)]);
}

function attachNode(node) {
  if (states.has(node)) return;
  loadStyles();
  const state = { dialog: null, preview: null };
  states.set(node, state);
  const updatePreview = () => {
    if (!state.preview) return;
    const id = String(widget(node, "pose_id")?.value || "");
    const source = widget(node, "source")?.value || "auto";
    state.preview.replaceChildren();
    if (!id) {
      state.preview.append(element("div", "pg-node-empty", "选择一张姿势参考图\nChoose a pose reference"));
    } else {
      const image = element("img");
      image.alt = id;
      image.src = imageUrl(id, source);
      const status = element("p", "pg-id", id);
      image.addEventListener("error", () => { image.hidden = true; status.textContent = `${id} · 预览不可用，运行时仍会尝试读取缓存原图`; }, { once: true });
      state.preview.append(image, status);
    }
  };
  state.updatePreview = updatePreview;
  const browse = node.addWidget("button", "选择姿势 / Browse poses", null, () => {
    if (state.dialog && !state.dialog.closed) { state.dialog.dialog.focus(); return; }
    state.dialog = new GalleryDialog(node, (selection, source) => {
      const idWidget = widget(node, "pose_id");
      const sourceWidget = widget(node, "source");
      if (idWidget) idWidget.value = selection.id;
      if (sourceWidget) sourceWidget.value = source;
      idWidget?.callback?.(selection.id);
      sourceWidget?.callback?.(source);
      updatePreview();
      node.setDirtyCanvas?.(true, true);
      app.graph?.setDirtyCanvas?.(true, true);
      app.graph?.change?.();
    });
    state.dialog.onClose = () => { state.dialog = null; };
  });
  browse.serialize = false;
  browse.options = { ...(browse.options || {}), serialize: false };
  if (node.addDOMWidget) {
    state.preview = element("div", "pose-gallery-node-preview");
    const previewWidget = node.addDOMWidget("pose_gallery_preview", "div", state.preview, {
      serialize: false, hideOnZoom: false,
      getValue: () => "", setValue: () => {},
    });
    previewWidget.computeSize = () => [260, 250];
    previewWidget.serialize = false;
  }
  for (const name of ["pose_id", "source"]) {
    const field = widget(node, name);
    if (!field) continue;
    const previous = field.callback;
    field.callback = function (...args) { const value = previous?.apply(this, args); updatePreview(); return value; };
  }
  ensureNodeSize(node);
  updatePreview();
}

app.registerExtension({
  name: "Comfy.PoseGallery",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PoseGallery") return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const result = created?.apply(this, args);
      attachNode(this);
      return result;
    };
    const configured = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const result = configured?.apply(this, args);
      attachNode(this);
      // LiteGraph restores the saved size after creation, including old/small node sizes.
      ensureNodeSize(this);
      states.get(this)?.updatePreview();
      return result;
    };
    const removed = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function (...args) {
      states.get(this)?.dialog?.close();
      states.delete(this);
      return removed?.apply(this, args);
    };
  },
});
