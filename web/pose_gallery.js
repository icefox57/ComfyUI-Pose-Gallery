import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { LANGUAGES, normalizeLanguage, preferredSource, t, taxonomy } from "./i18n.js";

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

export function imageUrl(id, source = "auto", kind = "thumb", language = "zh") {
  return api.apiURL(`/pose_gallery/image?${new URLSearchParams({ id, source, kind, language: normalizeLanguage(language) })}`);
}

export function filterItems(items, filters) {
  const words = (filters.query || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.system && item.system !== filters.system) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.angle && item.angle !== filters.angle) return false;
    const translated = ["system", "category", "angle"].map((kind) => taxonomy(filters.language, kind, item[kind])).join(" ");
    const search = `${item.search || ""} ${item.id} ${item.name} ${item.system} ${item.category} ${item.angle} ${translated}`.toLocaleLowerCase();
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

async function jsonRequest(path, options, language = "zh") {
  const response = await api.fetchApi(path, options);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(t(language, "unreadableResponse", { status: response.status }));
  }
  if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
  return payload;
}

function setOptions(select, values, allLabel, labeler = (value) => value, previous = select.value) {
  const options = [new Option(allLabel, ""), ...values.filter(Boolean).map((v) => new Option(labeler(v), v))];
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
    this.language = normalizeLanguage(node.widgets?.find((w) => w.name === "language")?.value);
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
    this.dialog.setAttribute("lang", this.language);
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

  text(key, parameters) { return t(this.language, key, parameters); }
  sourceName(source) { return this.text(source === "ja" ? "sourceJa" : "sourceZh"); }

  changeLanguage(language) {
    const code = normalizeLanguage(language);
    const languageWidget = widget(this.node, "language");
    const sourceWidget = widget(this.node, "source");
    if (sourceWidget) sourceWidget.value = "auto";
    if (languageWidget) {
      languageWidget.value = code;
      languageWidget.callback?.(code);
    }
    // A node callback updates an attached dialog; standalone dialogs use this path.
    if (this.language !== code || this.source !== "auto") this.applyLanguage(code);
    this.node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
    app.graph?.change?.();
  }

  applyLanguage(language) {
    if (this.closed) return;
    this.language = normalizeLanguage(language);
    this.source = "auto";
    this.dialog.setAttribute("lang", this.language);
    this.dialog.replaceChildren();
    this.build();
    this.languageFilter.focus();
    this.load();
  }

  build() {
    const header = element("header", "pg-header");
    const heading = element("div", "pg-heading");
    const title = element("h2", "", this.text("title"));
    title.id = this.titleId;
    heading.append(title, element("p", "", this.text("subtitle")));
    const close = button("×", "pg-close", () => this.close());
    close.setAttribute("aria-label", this.text("close"));
    const site = preferredSource(this.language) === "ja" ? "https://ai-pose-gallery.pages.dev/" : "https://ai-pose-gallery.anhao.app/";
    header.append(heading, link(this.text("openSite"), site), close);

    const toolbar = element("section", "pg-toolbar");
    const searchRow = element("div", "pg-search-row");
    this.search = element("input");
    this.search.type = "search";
    this.search.placeholder = this.text("searchPlaceholder");
    this.search.setAttribute("aria-label", this.text("searchLabel"));
    let searchTimer;
    this.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.render(), 120);
    });
    this.refreshButton = button(this.text("refresh"), "", () => this.load(true));
    this.refreshButton.title = this.text("refreshTitle");
    searchRow.append(this.search, this.refreshButton);
    const filters = element("div", "pg-filters");
    this.systemFilter = this.addSelect(filters, this.text("system"), this.text("allSystems"));
    this.categoryFilter = this.addSelect(filters, this.text("category"), this.text("allCategories"));
    this.angleFilter = this.addSelect(filters, this.text("angle"), this.text("allAngles"));
    this.sourceFilter = this.addSelect(filters, this.text("source"), null, "pg-source");
    this.sourceFilter.append(new Option(this.text(preferredSource(this.language) === "ja" ? "autoJa" : "autoZh"), "auto"), new Option(this.text("sourceZh"), "zh"), new Option(this.text("sourceJa"), "ja"));
    this.sourceFilter.value = this.source;
    this.systemFilter.addEventListener("change", () => { this.updateCategories(); this.render(); });
    this.categoryFilter.addEventListener("change", () => this.render());
    this.angleFilter.addEventListener("change", () => this.render());
    this.sourceFilter.addEventListener("change", () => { this.source = this.sourceFilter.value; this.load(); });
    this.languageFilter = this.addSelect(filters, this.text("language"), null, "pg-language");
    this.languageFilter.append(...Object.entries(LANGUAGES).map(([code, name]) => new Option(name, code)));
    this.languageFilter.value = this.language;
    this.languageFilter.title = this.text("languageTooltip");
    this.languageFilter.addEventListener("change", () => this.changeLanguage(this.languageFilter.value));
    filters.append(button(this.text("clearFilters"), "", () => {
      this.search.value = "";
      this.systemFilter.value = "";
      this.updateCategories();
      this.categoryFilter.value = "";
      this.angleFilter.value = "";
      this.render();
    }));
    const summary = element("div", "pg-summary");
    this.count = element("span", "pg-count", this.text("catalogLoading"));
    this.sourceStatus = element("span", "pg-source-status");
    this.sourceStatus.setAttribute("role", "status");
    summary.append(this.count, this.sourceStatus);
    this.warning = element("p", "pg-warning");
    this.warning.hidden = true;
    this.warning.setAttribute("role", "status");
    toolbar.append(searchRow, filters, summary, this.warning);

    const body = element("div", "pg-body");
    this.results = element("section", "pg-results");
    this.results.setAttribute("aria-label", this.text("resultsLabel"));
    this.grid = element("div", "pg-grid");
    this.more = button(this.text("more"), "pg-more", () => this.render(true));
    this.more.hidden = true;
    this.results.append(this.grid, this.more);
    this.detail = element("aside", "pg-detail");
    this.detail.setAttribute("aria-label", this.text("previewLabel"));
    this.clearDetail();
    body.append(this.results, this.detail);
    const footer = element("footer", "pg-footer");
    footer.append(element("span", "", this.text("footerCache")), link(this.text("upstreamLink"), "https://github.com/anhao/ai-pose-gallery-zh"), link(this.text("termsLink"), "https://ai-pose-gallery.pages.dev/"));
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
    setOptions(this.categoryFilter, [...new Set(items.map((item) => item.category))], this.text("allCategories"), (value) => taxonomy(this.language, "category", value));
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
    this.grid.replaceChildren(this.message(this.text("catalogLoading")));
    this.more.hidden = true;
    this.count.textContent = this.text("catalogLoading");
    this.sourceStatus.textContent = "";
    this.catalogWarning = "";
    this.warning.hidden = true;
    this.refreshButton.disabled = true;
    const controller = this.controller();
    try {
      const query = new URLSearchParams({ source: this.source, language: this.language });
      if (refresh) query.set("refresh", "1");
      const data = await jsonRequest(`/pose_gallery/catalog?${query}`, { signal: controller.signal }, this.language);
      if (this.closed || generation !== this.generation) return;
      if (!Array.isArray(data.items) || !data.items.length) throw new Error(this.text("emptyCatalog"));
      this.items = data.items;
      this.sourceStatus.textContent = this.text(data.stale ? "cachedCatalog" : "onlineCatalog", { source: this.sourceName(data.source) });
      const preferred = data.preferred_source || preferredSource(this.language);
      this.catalogWarning = data.warning || (this.source === "auto" && (data.fallback_used || data.source !== preferred)
        ? this.text("catalogFallback", { preferred: this.sourceName(preferred), actual: this.sourceName(data.source) }) : "");
      this.warning.textContent = this.catalogWarning;
      this.warning.hidden = !this.warning.textContent;
      setOptions(this.systemFilter, [...new Set(this.items.map((item) => item.system))], this.text("allSystems"), (value) => taxonomy(this.language, "system", value));
      this.updateCategories();
      setOptions(this.angleFilter, [...new Set(this.items.map((item) => item.angle))], this.text("allAngles"), (value) => taxonomy(this.language, "angle", value));
      this.render();
      const id = this.node.widgets?.find((w) => w.name === "pose_id")?.value;
      const selected = this.items.find((item) => item.id === id);
      if (selected) this.showDetail(selected);
    } catch (error) {
      if (error.name === "AbortError" || this.closed || generation !== this.generation) return;
      this.count.textContent = this.text("catalogFailed");
      this.grid.replaceChildren(this.message(this.text("catalogError", { error: error.message }), () => this.load(true)));
    } finally {
      this.controllers.delete(controller);
      if (!this.closed && generation === this.generation) this.refreshButton.disabled = false;
    }
  }

  message(text, retry) {
    const message = element("div", "pg-message");
    message.append(element("p", "", text));
    if (retry) message.append(button(this.text("retry"), "", retry));
    return message;
  }

  render(append = false) {
    if (this.closed || !this.items.length) return;
    if (!append) {
      const matching = filterItems(this.items, {
        query: this.search.value, system: this.systemFilter.value,
        category: this.categoryFilter.value, angle: this.angleFilter.value, language: this.language,
      });
      this.filtered = groupItems(matching);
      this.count.textContent = this.text("count", { groups: this.filtered.length, images: matching.length });
      this.shown = 0;
      this.grid.replaceChildren();
      this.results.scrollTop = 0;
      if (!matching.length) this.grid.append(this.message(this.text("noResults")));
    }
    const entries = this.filtered.slice(this.shown, this.shown + PAGE_SIZE);
    for (const item of entries) this.grid.append(this.card(item));
    this.shown += entries.length;
    this.more.hidden = this.shown >= this.filtered.length;
    this.more.textContent = this.text("moreCount", { shown: this.shown, total: this.filtered.length });
    this.markSelected();
  }

  card(item) {
    const card = button("", "pg-card", () => this.showDetail(item));
    card.dataset.group = item.group || item.id.replace(/_[^_]+$/, "");
    const angle = taxonomy(this.language, "angle", item.angle);
    card.setAttribute("aria-label", this.text("cardLabel", { name: item.name, angle }));
    card.setAttribute("aria-pressed", "false");
    const stage = element("div", "pg-card-image");
    stage.dataset.error = this.text("thumbFailed");
    const image = element("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = `${item.name} · ${angle}`;
    image.src = imageUrl(item.id, this.source, "thumb", this.language);
    image.addEventListener("error", () => { image.hidden = true; stage.classList.add("pg-image-error"); }, { once: true });
    stage.append(image, element("span", "pg-angle-tag", angle));
    const copy = element("span", "pg-card-copy");
    const category = item.category ? taxonomy(this.language, "category", item.category) : taxonomy(this.language, "system", item.system);
    copy.append(element("span", "pg-card-name", item.name), element("span", "pg-card-meta", `${item.pose || ""} · ${category}`));
    card.append(stage, copy);
    return card;
  }

  markSelected() {
    const group = this.selected?.group || this.selected?.id.replace(/_[^_]+$/, "");
    for (const card of this.grid.querySelectorAll(".pg-card")) card.setAttribute("aria-pressed", String(card.dataset.group === group));
  }

  clearDetail() {
    this.detail.replaceChildren(element("p", "pg-detail-empty", this.text("detailEmpty")));
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
    image.alt = `${item.name} · ${taxonomy(this.language, "angle", item.angle)}`;
    image.src = imageUrl(item.id, this.source, "thumb", this.language);
    const previewStatus = element("span", "pg-preview-status", this.text("originalLoading"));
    previewStatus.setAttribute("role", "status");
    stage.append(image, previewStatus);
    const title = element("h3", "", item.name);
    const id = element("div", "pg-id", item.id);
    const angles = element("div", "pg-angle-list");
    const group = item.group || item.id.replace(/_[^_]+$/, "");
    const related = this.items.filter((entry) => (entry.group || entry.id.replace(/_[^_]+$/, "")) === group);
    for (const entry of related) {
      const angle = button(taxonomy(this.language, "angle", entry.angle), "pg-angle-button", () => this.showDetail(entry));
      angle.setAttribute("aria-pressed", String(entry.id === item.id));
      angles.append(angle);
    }
    const meta = element("p", "pg-detail-meta", `${taxonomy(this.language, "system", item.system)}\n${taxonomy(this.language, "category", item.category)} · ${taxonomy(this.language, "angle", item.angle)}`);
    meta.style.whiteSpace = "pre-line";
    this.useButton = button(this.text("useImage"), "pg-use", () => this.select());
    this.selectionStatus = element("p", "pg-selection-status");
    this.selectionStatus.setAttribute("role", "status");
    this.detail.replaceChildren(stage, title, id, angles, meta, this.useButton, this.selectionStatus);
    const controller = this.controller();
    this.previewController = controller;
    try {
      const response = await api.fetchApi(`/pose_gallery/image?${new URLSearchParams({ id: item.id, source: this.source, kind: "full", language: this.language })}`, { signal: controller.signal });
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
      if (this.source === "auto" && actualSource && actualSource !== preferredSource(this.language)) {
        const imageWarning = this.text("imageFallback", { preferred: this.sourceName(preferredSource(this.language)), actual: this.sourceName(actualSource) });
        this.warning.textContent = [this.catalogWarning, imageWarning].filter(Boolean).join(" ");
        this.warning.hidden = false;
      }
    } catch (error) {
      if (error.name !== "AbortError" && !this.closed && previewGeneration === this.previewGeneration) previewStatus.textContent = this.text("originalError", { error: error.message });
    } finally {
      this.controllers.delete(controller);
    }
  }

  async select() {
    if (this.busy || !this.selected || this.closed) return;
    const generation = this.generation;
    this.busy = true;
    this.useButton.disabled = true;
    this.sourceFilter.disabled = true;
    this.languageFilter.disabled = true;
    this.refreshButton.disabled = true;
    this.selectionStatus.textContent = this.text("caching");
    const controller = this.controller();
    try {
      const selection = await jsonRequest("/pose_gallery/select", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.selected.id, source: this.source, language: this.language }), signal: controller.signal,
      }, this.language);
      if (this.closed || generation !== this.generation) return;
      this.onSelected(selection, this.source, this.language);
      this.close();
    } catch (error) {
      if (error.name !== "AbortError" && !this.closed && generation === this.generation) this.selectionStatus.textContent = this.text("selectionError", { error: error.message });
    } finally {
      this.controllers.delete(controller);
      if (generation === this.generation) this.busy = false;
      if (!this.closed && generation === this.generation) {
        this.useButton.disabled = false;
        this.sourceFilter.disabled = false;
        this.languageFilter.disabled = false;
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
  node.setSize?.([Math.max(node.size?.[0] || 0, 310), Math.max(node.size?.[1] || 0, 410)]);
}

function attachNode(node) {
  if (states.has(node)) return;
  loadStyles();
  const state = { dialog: null, preview: null, language: normalizeLanguage(widget(node, "language")?.value) };
  states.set(node, state);
  const updatePreview = () => {
    if (!state.preview) return;
    const id = String(widget(node, "pose_id")?.value || "");
    const source = widget(node, "source")?.value || "auto";
    const language = normalizeLanguage(widget(node, "language")?.value);
    state.preview.replaceChildren();
    if (!id) {
      state.preview.append(element("div", "pg-node-empty", t(language, "nodeEmpty")));
    } else {
      const image = element("img");
      image.alt = id;
      image.src = imageUrl(id, source, "thumb", language);
      const status = element("p", "pg-id", id);
      image.addEventListener("error", () => { image.hidden = true; status.textContent = t(language, "nodePreviewError", { id }); }, { once: true });
      state.preview.append(image, status);
    }
  };
  state.updatePreview = updatePreview;
  const browse = node.addWidget("button", t(state.language, "browse"), null, () => {
    if (state.dialog && !state.dialog.closed) { state.dialog.dialog.focus(); return; }
    state.dialog = new GalleryDialog(node, (selection, source, language) => {
      const idWidget = widget(node, "pose_id");
      const sourceWidget = widget(node, "source");
      if (idWidget) idWidget.value = selection.id;
      if (sourceWidget) sourceWidget.value = source;
      const languageWidget = widget(node, "language");
      if (languageWidget) languageWidget.value = language;
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
  state.syncLanguage = (resetSource = false) => {
    const language = normalizeLanguage(widget(node, "language")?.value);
    const changed = state.language !== language;
    state.language = language;
    if (resetSource && widget(node, "source")) widget(node, "source").value = "auto";
    browse.name = t(language, "browse");
    browse.label = browse.name;
    for (const [name, label, tooltip] of [["pose_id", "nodePoseId", "poseIdTooltip"], ["source", "nodeSource", "sourceTooltip"], ["language", "nodeLanguage", "languageTooltip"]]) {
      const field = widget(node, name);
      if (!field) continue;
      field.label = t(language, label);
      field.options = { ...(field.options || {}), tooltip: t(language, tooltip) };
    }
    const defaultTitles = new Set(["Pose Gallery / 姿势图库", ...Object.keys(LANGUAGES).map((code) => t(code, "title"))]);
    if (!node.title || defaultTitles.has(node.title)) node.title = t(language, "title");
    for (const [index, key] of ["outputImage", "outputName", "outputUrl"].entries()) {
      if (node.outputs?.[index]) node.outputs[index].label = t(language, key);
    }
    updatePreview();
    if (state.dialog && !state.dialog.closed && (changed || resetSource)) state.dialog.applyLanguage(language);
    node.setDirtyCanvas?.(true, true);
  };
  const languageWidget = widget(node, "language");
  if (languageWidget) {
    const previous = languageWidget.callback;
    languageWidget.callback = function (value, ...args) {
      languageWidget.value = normalizeLanguage(value);
      const result = previous?.apply(this, [languageWidget.value, ...args]);
      state.syncLanguage(true);
      app.graph?.setDirtyCanvas?.(true, true);
      app.graph?.change?.();
      return result;
    };
  }
  ensureNodeSize(node);
  state.syncLanguage();
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
      states.get(this)?.syncLanguage();
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
