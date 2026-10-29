/** Contract tests with a small DOM double; these do not claim browser/layout coverage. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sourceFile = await readFile(new URL("../web/pose_gallery.js", import.meta.url), "utf8");
const translationFile = await readFile(new URL("../web/i18n.js", import.meta.url), "utf8");
const rows = [
  { id: "full_P001_side", group: "full_P001", system: "全身", pose: "P001", category: "站姿", name: "侧身站立", angle: "侧面", search: "standing profile" },
  { id: "full_P001_front", group: "full_P001", system: "全身", pose: "P001", category: "站姿", name: "侧身站立", angle: "正面", search: "standing front" },
  { id: "duo_P002_front", group: "duo_P002", system: "双人", pose: "P002", category: "坐姿", name: "并肩坐姿", angle: "正面", search: "sitting pair" },
];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function response(payload, { status = 200, source = "zh" } = {}) {
  return {
    ok: status >= 200 && status < 300, status,
    json: async () => payload,
    blob: async () => new Blob(["image"]),
    headers: { get: (name) => name.toLowerCase() === "x-pose-gallery-source" ? source : null },
  };
}

const settle = async () => { await new Promise((resolve) => setImmediate(resolve)); };

function makeDocument() {
  const document = { activeElement: null };
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.className = "";
      this.value = "";
      this.textContent = "";
      this.hidden = false;
      this.disabled = false;
      this.classList = {
        add: (value) => { this.className = [...new Set([...this.className.split(/\s+/), value])].filter(Boolean).join(" "); },
        contains: (value) => this.className.split(/\s+/).includes(value),
      };
    }
    append(...children) {
      for (const child of children) { child.parentElement = this; this.children.push(child); }
    }
    replaceChildren(...children) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.append(...children);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); if (name === "src") this.src = ""; }
    addEventListener(name, handler, options) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push({ handler, once: options?.once });
    }
    async fire(name, event = {}) {
      const handlers = [...(this.listeners.get(name) || [])];
      for (const entry of handlers) {
        if (entry.once) this.listeners.set(name, this.listeners.get(name).filter((candidate) => candidate !== entry));
        await entry.handler({ target: this, preventDefault() {}, stopPropagation() {}, ...event });
      }
    }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }
    get isConnected() { return this === document.body || this === document.head || Boolean(this.parentElement?.isConnected); }
    getClientRects() { return this.hidden || this.parentElement?.hidden ? [] : [{}]; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 1000, bottom: 800 }; }
    querySelectorAll(selector) {
      const matches = (node, clause) => {
        if (clause === "link[data-pose-gallery-style]") return node.tagName === "LINK" && Boolean(node.dataset.poseGalleryStyle);
        if (clause === 'a[href]') return node.tagName === "A" && Boolean(node.href);
        if (clause === 'button:not(:disabled)') return node.tagName === "BUTTON" && !node.disabled;
        if (clause === 'input:not(:disabled)') return node.tagName === "INPUT" && !node.disabled;
        if (clause === 'select:not(:disabled)') return node.tagName === "SELECT" && !node.disabled;
        if (clause === '[tabindex="0"]') return node.getAttribute("tabindex") === "0";
        if (clause.startsWith(".")) return node.classList.contains(clause.slice(1));
        return node.tagName === clause.toUpperCase();
      };
      const result = [];
      const clauses = selector.split(",");
      const walk = (node) => {
        for (const child of node.children) {
          if (clauses.some((clause) => matches(child, clause))) result.push(child);
          walk(child);
        }
      };
      walk(this);
      return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  document.createElement = (tag) => new Element(tag);
  document.body = new Element("body");
  document.head = new Element("head");
  document.querySelector = (selector) => document.head.querySelector(selector) || document.body.querySelector(selector);
  class Option extends Element {
    constructor(label, value) { super("option"); this.textContent = label; this.value = value; }
  }
  return { document, Option };
}

function environment(fetchApi = async () => response({ items: rows, source: "zh", stale: false, warning: "" })) {
  const { document, Option } = makeDocument();
  const requests = [];
  const app = {
    registerExtension(extension) { this.extension = extension; },
    graph: { changes: 0, setDirtyCanvas() {}, change() { this.changes++; } },
  };
  const api = {
    apiURL: (route) => `/comfy/proxy${route}`,
    fetchApi: (path, options = {}) => { requests.push({ path, options }); return fetchApi(path, options); },
  };
  const context = vm.createContext({ document, Option, app, api, URL, URLSearchParams, Blob, AbortController, setTimeout, clearTimeout, console });
  vm.runInContext(translationFile.replace(/\bexport (?=(?:const|function)\b)/g, ""), context, { filename: "i18n.js" });
  // Only remove ESM bindings for injected app/api doubles; execute the actual implementation.
  const source = sourceFile
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/\bexport (?=(?:function|class)\b)/g, "")
    .replace(/import\.meta\.url/g, JSON.stringify("https://localhost/extensions/pose-gallery/pose_gallery.js"));
  vm.runInContext(`${source}\nglobalThis.subject = { GalleryDialog, filterItems, groupItems, imageUrl, LANGUAGES, MESSAGES, normalizeLanguage, preferredSource, t, taxonomy };`, context, { filename: "pose_gallery.js" });
  return { ...context.subject, app, api, document, requests };
}

function bareNode(id = "", source = "auto", language = "zh") {
  return { widgets: [{ name: "pose_id", value: id }, { name: "source", value: source }, { name: "language", value: language }] };
}

test("grouped browsing chooses the front view without mixing systems or omitting single-angle poses", () => {
  const env = environment();
  const grouped = env.groupItems(rows);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].id, "full_P001_front");
  assert.equal(grouped[1].id, "duo_P002_front");
  assert.equal(env.groupItems([{ ...rows[0], group: undefined }])[0].id, rows[0].id);
});

test("search requires every word and combines with system, category, and angle filters", () => {
  const env = environment();
  assert.equal(env.filterItems(rows, { query: "  STANDING p001  " }).length, 2);
  assert.equal(env.filterItems(rows, { query: "站立", system: "全身", category: "站姿", angle: "侧面" })[0].id, "full_P001_side");
  assert.equal(env.filterItems(rows, { query: "standing sitting" }).length, 0);
  assert.equal(env.filterItems(rows, { system: "双人", angle: "侧面" }).length, 0);
});

test("image URLs preserve reverse-proxy prefixes and encode input parameters", () => {
  const env = environment();
  const url = env.imageUrl("pose&bad=1", "ja", "full");
  assert.ok(url.startsWith("/comfy/proxy/pose_gallery/image?"));
  const query = new URL(url, "http://localhost").searchParams;
  assert.equal(query.get("id"), "pose&bad=1");
  assert.equal(query.get("source"), "ja");
  assert.equal(query.get("kind"), "full");
  assert.equal(query.get("language"), "zh");
  assert.equal(query.get("bad"), null);
});

test("opening a gallery requests a catalog and lazy thumbnails, without downloading every original", async () => {
  const env = environment();
  const gallery = new env.GalleryDialog(bareNode(), () => {});
  await settle();
  assert.equal(gallery.grid.querySelectorAll(".pg-card").length, 2);
  assert.equal(env.requests.length, 1);
  assert.ok(env.requests[0].path.startsWith("/pose_gallery/catalog?source=auto"));
  for (const image of gallery.grid.querySelectorAll("img")) {
    assert.equal(image.loading, "lazy");
    assert.equal(new URL(image.src, "http://localhost").searchParams.get("kind"), "thumb");
  }
  gallery.close();
});

test("source switching aborts the previous request and ignores its late catalog response", async () => {
  const pending = [];
  const env = environment(() => { const request = deferred(); pending.push(request); return request.promise; });
  const gallery = new env.GalleryDialog(bareNode(), () => {});
  gallery.source = "ja";
  const secondLoad = gallery.load();
  assert.equal(env.requests[0].options.signal.aborted, true);
  assert.equal(new URL(env.requests[1].path, "http://localhost").searchParams.get("source"), "ja");
  const japanese = [{ ...rows[2], name: "日本語のポーズ" }];
  pending[1].resolve(response({ items: japanese, source: "ja", stale: false, warning: "" }));
  await secondLoad;
  pending[0].resolve(response({ items: rows, source: "zh", stale: false, warning: "" }));
  await settle();
  assert.equal(gallery.items.length, 1);
  assert.equal(gallery.items[0].name, "日本語のポーズ");
  assert.match(gallery.sourceStatus.textContent, /日文站/);
  gallery.close();
});

test("individual-image failover warning clears when the next image comes from the Chinese source", async () => {
  let imageSource = "ja";
  const env = environment(async (path) => path.startsWith("/pose_gallery/catalog")
    ? response({ items: rows, source: "zh", stale: false, warning: "" })
    : response({}, { source: imageSource }));
  const gallery = new env.GalleryDialog(bareNode(), () => {});
  await settle();
  await gallery.showDetail(rows[0]);
  assert.equal(gallery.warning.hidden, false);
  assert.match(gallery.warning.textContent, /此图片.*日文站/);
  assert.match(gallery.sourceStatus.textContent, /中文站/);
  imageSource = "zh";
  await gallery.showDetail(rows[2]);
  assert.equal(gallery.warning.hidden, true);
  assert.equal(gallery.warning.textContent, "");
  gallery.close();
});

test("catalog fallback and stale-cache warnings survive changing the preview", async () => {
  const env = environment(async (path) => path.startsWith("/pose_gallery/catalog")
    ? response({ items: rows, source: "ja", stale: true, warning: "Both websites offline; using cached catalog." })
    : response({}, { source: "zh" }));
  const gallery = new env.GalleryDialog(bareNode(), () => {});
  await settle();
  await gallery.showDetail(rows[0]);
  assert.equal(gallery.warning.hidden, false);
  assert.match(gallery.warning.textContent, /Both websites offline/);
  assert.match(gallery.sourceStatus.textContent, /已缓存目录/);
  gallery.close();
});

test("closing aborts preview work, removes its dialog, and prevents late selection callbacks", async () => {
  const image = deferred();
  let selected = 0;
  const env = environment(async (path) => path.startsWith("/pose_gallery/catalog")
    ? response({ items: rows, source: "zh" }) : image.promise);
  const gallery = new env.GalleryDialog(bareNode(), () => { selected++; });
  await settle();
  const preview = gallery.showDetail(rows[0]);
  const previewRequest = env.requests.at(-1);
  gallery.close();
  assert.equal(previewRequest.options.signal.aborted, true);
  assert.equal(gallery.dialog.isConnected, false);
  image.resolve(response({}));
  await preview;
  assert.equal(gallery.previewBlob, undefined);
  assert.equal(selected, 0);
});

test("server errors provide retry UI and do not change the saved pose", async () => {
  const node = bareNode("saved_pose_front");
  const env = environment(async () => response({ error: "Both sources unavailable" }, { status: 502 }));
  const gallery = new env.GalleryDialog(node, () => assert.fail("must not select on catalog error"));
  await settle();
  assert.match(gallery.grid.querySelector("p").textContent, /Both sources unavailable/);
  assert.ok(gallery.grid.querySelector("button"));
  assert.equal(node.widgets[0].value, "saved_pose_front");
  gallery.close();
});

test("dialog labels are unique and Tab is trapped at either end of the modal", async () => {
  const env = environment();
  const one = new env.GalleryDialog(bareNode(), () => {});
  const two = new env.GalleryDialog(bareNode(), () => {});
  await settle();
  assert.notEqual(one.dialog.getAttribute("aria-labelledby"), two.dialog.getAttribute("aria-labelledby"));
  const controls = two.dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')
    .filter((entry) => entry.getClientRects().length);
  let prevented = false;
  controls.at(-1).focus();
  two.trapFocus({ shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(env.document.activeElement, controls[0]);
  controls[0].focus();
  two.trapFocus({ shiftKey: true, preventDefault() {} });
  assert.equal(env.document.activeElement, controls.at(-1));
  two.close();
  one.close();
});

test("node hooks preserve previous callbacks and restore thumbnails without adding serialized widgets", async () => {
  const env = environment();
  class Node {
    constructor() { this.widgets = bareNode().widgets; this.size = [500, 600]; this.original = []; this.domWidgets = []; }
    onNodeCreated() { this.original.push("created"); return "previous-created"; }
    onConfigure(config) { this.original.push("configured"); this.widgets[0].value = config.pose_id; this.widgets[1].value = config.source; if (config.size) this.size = config.size; return "previous-configured"; }
    onRemoved() { this.original.push("removed"); return "previous-removed"; }
    addWidget(type, name, value, callback) { const result = { type, name, value, callback }; this.widgets.push(result); return result; }
    addDOMWidget(name, type, element, options) { const result = { name, type, element, options }; this.widgets.push(result); this.domWidgets.push(result); return result; }
    setSize(size) { this.size = size; }
  }
  await env.app.extension.beforeRegisterNodeDef(Node, { name: "PoseGallery" });
  const node = new Node();
  assert.equal(node.onNodeCreated(), "previous-created");
  assert.deepEqual([...node.size], [500, 600]);
  assert.equal(node.onConfigure({ pose_id: rows[2].id, source: "ja", size: [200, 200] }), "previous-configured");
  assert.deepEqual([...node.size], [310, 410]);
  assert.equal(node.domWidgets.length, 1);
  assert.equal(node.widgets.filter((entry) => entry.options?.serialize !== false && entry.serialize !== false).length, 3);
  const preview = node.domWidgets[0].element.querySelector("img");
  assert.equal(new URL(preview.src, "http://localhost").searchParams.get("id"), rows[2].id);
  assert.equal(new URL(preview.src, "http://localhost").searchParams.get("source"), "ja");
  assert.equal(node.onRemoved(), "previous-removed");
  assert.deepEqual(node.original, ["created", "configured", "removed"]);
});

test("selecting commits node pose/source only after the original is cached, and failed selection preserves the old pose", async () => {
  const selection = deferred();
  let fail = true;
  const env = environment(async (path) => {
    if (path.startsWith("/pose_gallery/catalog")) return response({ items: rows, source: "zh" });
    if (path === "/pose_gallery/select") return fail ? response({ error: "Image unavailable" }, { status: 502 }) : selection.promise;
    return response({});
  });
  class Node {
    constructor() { this.widgets = bareNode("old_front", "zh").widgets; this.size = [310, 390]; }
    addWidget(type, name, value, callback) { const result = { type, name, value, callback }; this.widgets.push(result); return result; }
    addDOMWidget(name, type, element, options) { const result = { name, type, element, options }; this.widgets.push(result); return result; }
    setSize() {}
    setDirtyCanvas() {}
  }
  await env.app.extension.beforeRegisterNodeDef(Node, { name: "PoseGallery" });
  const node = new Node();
  node.onNodeCreated();
  node.widgets.find((entry) => entry.type === "button").callback();
  await settle();
  const dialog = env.document.body.querySelector("dialog");
  const sourceSelect = dialog.querySelector(".pg-source").querySelector("select");
  sourceSelect.value = "auto";
  await sourceSelect.fire("change");
  await settle();
  await dialog.querySelector(".pg-card").fire("click");
  await dialog.querySelector(".pg-use").fire("click");
  assert.equal(node.widgets[0].value, "old_front");
  assert.match(dialog.querySelector(".pg-selection-status").textContent, /Image unavailable/);
  fail = false;
  const use = dialog.querySelector(".pg-use").fire("click");
  assert.equal(node.widgets[0].value, "old_front");
  assert.equal(dialog.querySelector(".pg-use").disabled, true);
  selection.resolve(response({ id: rows[1].id, source: "ja", cached: true }));
  await use;
  assert.equal(node.widgets[0].value, rows[1].id);
  assert.equal(node.widgets[1].value, "auto"); // Preserve automatic failover on later workflow runs.
  assert.equal(dialog.isConnected, false);
  assert.equal(env.app.graph.changes, 1);
  const request = env.requests.find((entry) => entry.path === "/pose_gallery/select");
  assert.equal(JSON.parse(request.options.body).id, rows[1].id);
  assert.equal(JSON.parse(request.options.body).source, "auto");
  assert.equal(JSON.parse(request.options.body).language, "zh");
});

async function registeredNode(env, { id = "", source = "auto", language = "zh", legacy = false } = {}) {
  class Node {
    constructor() {
      this.widgets = bareNode(id, source, language).widgets;
      if (legacy) this.widgets.pop();
      this.size = [310, 410];
      this.outputs = [{ name: "image" }, { name: "pose_name" }, { name: "source_url" }];
    }
    addWidget(type, name, value, callback) { const result = { type, name, value, callback }; this.widgets.push(result); return result; }
    addDOMWidget(name, type, element, options) { const result = { name, type, element, options }; this.widgets.push(result); return result; }
    setSize(size) { this.size = size; }
    setDirtyCanvas() {}
  }
  await env.app.extension.beforeRegisterNodeDef(Node, { name: "PoseGallery" });
  const node = new Node();
  node.onNodeCreated();
  return node;
}

test("all three message dictionaries have exact key/placeholder parity and English chrome has no CJK text", () => {
  const env = environment();
  const keys = Object.keys(env.MESSAGES.zh).sort();
  for (const language of ["zh", "en", "ja"]) {
    assert.deepEqual(Object.keys(env.MESSAGES[language]).sort(), keys);
    for (const key of keys) {
      const text = env.MESSAGES[language][key];
      assert.equal(typeof text, "string");
      assert.ok(text.length, `${language}.${key} is empty`);
      const placeholders = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(placeholders, [...env.MESSAGES.zh[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort());
      const params = Object.fromEntries(placeholders.map((name) => [name, "TEST"]));
      assert.doesNotMatch(env.t(language, key, params), /\{\w+\}/);
      if (language === "en") assert.doesNotMatch(text, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u, key);
    }
  }
  assert.equal(env.normalizeLanguage(undefined), "zh");
  assert.equal(env.normalizeLanguage("unsupported"), "zh");
  assert.equal(env.preferredSource("ja"), "ja");
  assert.equal(env.preferredSource("en"), "zh");
});

for (const language of ["zh", "en", "ja"]) {
  test(`${language}: gallery chrome, taxonomy, original/thumbnail requests, errors and selection carry the chosen language`, async () => {
    const canonical = [{ ...rows[1], system: "全身单人・标准系" }];
    let failSelection = true;
    const env = environment(async (path) => {
      if (path.startsWith("/pose_gallery/catalog")) return response({ items: canonical, source: language === "ja" ? "ja" : "zh", stale: false });
      if (path === "/pose_gallery/select") return failSelection ? response({ error: "DETAIL" }, { status: 502 }) : response({ id: canonical[0].id, source: language === "ja" ? "ja" : "zh", cached: true });
      return response({}, { source: language === "ja" ? "ja" : "zh" });
    });
    const node = bareNode("", "auto", language);
    let selection;
    const gallery = new env.GalleryDialog(node, (...args) => { selection = args; });
    await settle();
    assert.equal(gallery.dialog.getAttribute("lang"), language);
    assert.equal(gallery.dialog.querySelector("h2").textContent, env.t(language, "title"));
    assert.equal(gallery.refreshButton.textContent, env.t(language, "refresh"));
    assert.equal(gallery.search.placeholder, env.t(language, "searchPlaceholder"));
    assert.equal(gallery.results.getAttribute("aria-label"), env.t(language, "resultsLabel"));
    assert.equal(gallery.detail.getAttribute("aria-label"), env.t(language, "previewLabel"));
    assert.equal(gallery.count.textContent, env.t(language, "count", { groups: 1, images: 1 }));
    assert.equal(gallery.sourceFilter.children[0].textContent, env.t(language, language === "ja" ? "autoJa" : "autoZh"));
    assert.equal(gallery.systemFilter.children[1].textContent, env.taxonomy(language, "system", canonical[0].system));
    assert.equal(gallery.categoryFilter.children[1].textContent, env.taxonomy(language, "category", canonical[0].category));
    assert.equal(gallery.angleFilter.children[1].textContent, env.taxonomy(language, "angle", canonical[0].angle));
    assert.deepEqual(gallery.languageFilter.children.map((option) => option.textContent), ["中文", "English", "日本語"]);
    const thumbnail = gallery.grid.querySelector("img");
    assert.equal(new URL(thumbnail.src, "http://localhost").searchParams.get("language"), language);
    const stage = gallery.grid.querySelector(".pg-card-image");
    assert.equal(stage.dataset.error, env.t(language, "thumbFailed"));
    await gallery.showDetail(canonical[0]);
    assert.equal(gallery.useButton.textContent, env.t(language, "useImage"));
    await gallery.select();
    assert.equal(gallery.selectionStatus.textContent, env.t(language, "selectionError", { error: "DETAIL" }));
    assert.equal(selection, undefined);
    for (const request of env.requests.filter((request) => request.path !== "/pose_gallery/select")) {
      assert.equal(new URL(request.path, "http://localhost").searchParams.get("language"), language);
    }
    failSelection = false;
    await gallery.select();
    assert.equal(selection[2], language);
    const selectedRequest = env.requests.filter((request) => request.path === "/pose_gallery/select").at(-1);
    assert.equal(JSON.parse(selectedRequest.options.body).language, language);
    assert.equal(gallery.closed, true);
  });
}

test("taxonomy labels translate both upstream languages and make localized category searches work", () => {
  const env = environment();
  assert.equal(env.taxonomy("en", "system", "全身1人・標準系"), "Full body · Standard");
  assert.equal(env.taxonomy("ja", "category", "站姿"), "立ち");
  assert.equal(env.taxonomy("zh", "angle", "下から"), "仰视");
  assert.equal(env.taxonomy("en", "category", "膝立ち・四つん這い"), "Kneeling / All fours");
  assert.equal(env.filterItems([{ ...rows[0], angle: "俯视", search: "" }], { language: "en", query: "standing high" }).length, 1);
});

test("changing gallery language immediately persists the node setting, resets a strict source and keeps the saved pose ID", async () => {
  const env = environment(async (path) => response({ items: rows, source: new URL(path, "http://localhost").searchParams.get("language") === "ja" ? "ja" : "zh" }));
  const node = await registeredNode(env, { id: "keep_saved_front", source: "zh" });
  node.widgets.find((entry) => entry.type === "button").callback();
  await settle();
  const dialog = env.document.body.querySelector("dialog");
  const languageSelect = dialog.querySelector(".pg-language").querySelector("select");
  languageSelect.value = "ja";
  await languageSelect.fire("change");
  await settle();
  assert.equal(node.widgets.find((entry) => entry.name === "language").value, "ja");
  assert.equal(node.widgets.find((entry) => entry.name === "source").value, "auto");
  assert.equal(node.widgets.find((entry) => entry.name === "pose_id").value, "keep_saved_front");
  assert.equal(node.widgets.find((entry) => entry.type === "button").name, "ポーズを選択");
  assert.equal(dialog.querySelector("h2").textContent, "ポーズギャラリー");
  const latestCatalog = env.requests.filter((request) => request.path.startsWith("/pose_gallery/catalog")).at(-1);
  const query = new URL(latestCatalog.path, "http://localhost").searchParams;
  assert.equal(query.get("language"), "ja");
  assert.equal(query.get("source"), "auto");
  assert.equal(dialog.querySelector(".pg-source").querySelector("select").children[0].textContent, env.t("ja", "autoJa"));
  const preview = node.widgets.find((entry) => entry.name === "pose_gallery_preview").element.querySelector("img");
  assert.equal(new URL(preview.src, "http://localhost").searchParams.get("language"), "ja");
  const serialized = node.widgets.filter((entry) => entry.options?.serialize !== false && entry.serialize !== false);
  assert.deepEqual(serialized.map((entry) => entry.name), ["pose_id", "source", "language"]);
  node.onRemoved();
});

test("node language callback updates labels and previews in all languages, restores auto source, and preserves legacy Chinese defaults", async () => {
  const env = environment();
  const node = await registeredNode(env, { id: rows[0].id, source: "ja" });
  const languageField = node.widgets.find((entry) => entry.name === "language");
  for (const language of ["en", "ja", "zh"]) {
    node.widgets.find((entry) => entry.name === "source").value = "ja";
    languageField.callback(language);
    assert.equal(languageField.value, language);
    assert.equal(node.widgets.find((entry) => entry.name === "source").value, "auto");
    assert.equal(node.widgets.find((entry) => entry.type === "button").name, env.t(language, "browse"));
    assert.equal(node.widgets[0].label, env.t(language, "nodePoseId"));
    assert.equal(node.outputs[0].label, env.t(language, "outputImage"));
    const preview = node.widgets.find((entry) => entry.name === "pose_gallery_preview").element.querySelector("img");
    assert.equal(new URL(preview.src, "http://localhost").searchParams.get("language"), language);
  }
  const legacy = await registeredNode(env, { legacy: true });
  assert.equal(legacy.widgets.find((entry) => entry.type === "button").name, "选择姿势");
  legacy.widgets.find((entry) => entry.type === "button").callback();
  await settle();
  assert.equal(new URL(env.requests.at(-1).path, "http://localhost").searchParams.get("language"), "zh");
  legacy.onRemoved();
});

test("Japanese auto mode warns only when an image falls back to Chinese", async () => {
  let actual = "ja";
  const env = environment(async (path) => path.startsWith("/pose_gallery/catalog")
    ? response({ items: rows, source: "ja", preferred_source: "ja", fallback_used: false }) : response({}, { source: actual }));
  const gallery = new env.GalleryDialog(bareNode("", "auto", "ja"), () => {});
  await settle();
  await gallery.showDetail(rows[0]);
  assert.equal(gallery.warning.hidden, true);
  actual = "zh";
  await gallery.showDetail(rows[1]);
  assert.equal(gallery.warning.textContent, env.t("ja", "imageFallback", { preferred: env.t("ja", "sourceJa"), actual: env.t("ja", "sourceZh") }));
  assert.equal(gallery.warning.hidden, false);
  gallery.close();
});

test("a language change aborts an in-flight selection and rejects its late result", async () => {
  const pendingSelection = deferred();
  const env = environment(async (path) => {
    if (path.startsWith("/pose_gallery/catalog")) return response({ items: rows, source: "zh" });
    return path === "/pose_gallery/select" ? pendingSelection.promise : response({});
  });
  const node = await registeredNode(env, { id: "keep_saved_front", source: "zh" });
  node.widgets.find((entry) => entry.type === "button").callback();
  await settle();
  const dialog = env.document.body.querySelector("dialog");
  await dialog.querySelector(".pg-card").fire("click");
  const pending = dialog.querySelector(".pg-use").fire("click");
  const selectRequest = env.requests.at(-1);
  node.widgets.find((entry) => entry.name === "language").callback("ja");
  await settle();
  assert.equal(selectRequest.options.signal.aborted, true);
  pendingSelection.resolve(response({ id: rows[1].id, source: "zh", cached: true }));
  await pending;
  assert.equal(node.widgets[0].value, "keep_saved_front");
  assert.equal(node.widgets[1].value, "auto");
  assert.equal(dialog.isConnected, true);
  assert.equal(dialog.getAttribute("lang"), "ja");
  node.onRemoved();
});
