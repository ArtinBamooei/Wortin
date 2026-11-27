"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HTML has one primary heading, explicit button types and labeled search inputs", () => {
  const html = read("index.html");
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  assert.equal((html.match(/<button\b(?![^>]*\btype=)[^>]*>/gi) || []).length, 0);
  assert.match(html, /id="dictSearch" type="search" aria-label=/);
  assert.match(html, /id="commandSearch" type="search" aria-label=/);
  assert.match(html, /<footer\b/);
});

test("home page heading levels follow a valid accessible hierarchy", () => {
  const html = read("index.html");
  const start = html.indexOf('id="view-home"');
  const end = html.indexOf('id="view-reading"', start);
  assert.ok(start >= 0 && end > start, "home view boundaries must exist");
  const home = html.slice(start, end);
  const headings = [...home.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(match => ({ level: Number(match[1]), text: match[2].replace(/<[^>]+>/g, "").trim() }));
  assert.deepEqual(headings.map(item => item.level), [1, 2, 3, 3, 3, 3]);
  assert.equal(headings[1].text, "انتخاب کن و شروع کن");
  assert.ok(headings.slice(2).every(item => item.text.length > 0));
  const css = read("styles.css");
  assert.ok(css.includes(".section-head h2,.section-head h3"));
  assert.ok(css.includes(".mode-card h3"));
  assert.ok(css.includes(".weekly-head h3"));
});

test("view navigation supports direct links and browser history", () => {
  const app = read("app.js");
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /window\.addEventListener\("hashchange"/);
  assert.match(app, /el\.inert=!active/);
  assert.match(app, /history\[method\]\(\{view\}/);
});

test("flashcard deep links wait for vocabulary and resume after cache or network load", () => {
  const app = read("app.js");
  assert.match(app, /vocabularyLoading=true/);
  assert.ok(app.includes("function resumeStudyViewAfterVocabularyLoad()"));
  assert.ok(app.includes("renderAll();resumeStudyViewAfterVocabularyLoad()"));
  assert.ok(app.includes('if(view==="learn"&&words.length&&'));
  assert.ok(app.includes('if(vocabularyLoading){changeView(mode==="quiz"?"quiz":"learn");return}'));
});

test("vocabulary loading uses a versioned local snapshot and a manifest-only freshness check", () => {
  const app = read("app.js"), html = read("index.html"), css = read("styles.css"), sw = read("sw.js");
  assert.ok(app.includes("async function fetchVocabularyManifest()"));
  assert.ok(app.includes("cachedRecord.schemaVersion===5&&cachedRecord.manifestVersion===manifest.version&&cachedRecord.rowCount===manifest.row_count"));
  assert.ok(app.includes("schemaVersion:5,manifestVersion:manifest.version,rowCount:manifest.row_count"));
  assert.ok(app.includes("Vocabulary snapshot incomplete"));
  assert.ok(app.includes("Vocabulary changed repeatedly during synchronization"));
  assert.ok(html.includes('id="vocabularyLoader"'));
  assert.ok(html.includes('id="vocabularyLoaderProgress"'));
  assert.match(css, /\.loader-orbit-ring-a[\s\S]*?animation:loader-spin-a/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*?\.loader-content[\s\S]*?animation:none/);
  assert.ok(sw.includes('wortin-shell-v13'));
});

test("word progress uses stable record codes and conservative mastery", () => {
  const app = read("app.js");
  assert.ok(app.includes("function wordProgressKey(word){return String(word.progress_key||word.record_code||word.id)}"));
  assert.match(app, /known:repetitions>=5&&interval>=21/);
  assert.ok(app.includes("progress_key,record_section"));
  assert.ok(app.includes("wortin.vocabulary.cache.v4"));
  assert.match(app, /function addLocalDays/);
  assert.match(app, /date\.setDate\(date\.getDate\(\)\+days\)/);
});

test("search normalization covers Persian variants, ZWNJ and German spellings", () => {
  const app = read("app.js");
  assert.match(app, /function searchForms/);
  assert.ok(app.includes(".replace(/[يى]/g,\"ی\""));
  assert.ok(app.includes(".replace(/ä/g,\"ae\""));
  assert.ok(app.includes(".replace(/ü/g,\"ue\""));
});

test("listening answer selection does not rebuild the entire root", () => {
  const media = read("learning-media.js");
  assert.match(media, /root\.addEventListener\("click"/);
  assert.match(media, /question\.querySelectorAll\("\[data-answer\]"/);
  assert.doesNotMatch(media, /state\.answers\[b\.dataset\.answer\][^;]*;render\(\)/);
});

test("main and listening stylesheets keep positive pixel font sizes at or above 12px", () => {
  for (const file of ["styles.css", "learning-media.css"]) {
    const css = read(file);
    const small = [];
    for (const match of css.matchAll(/font-size\s*:\s*([^;{}]+)/gi)) {
      const px = match[1].match(/^\s*(\d+(?:\.\d+)?)px\b/i);
      if (px && Number(px[1]) > 0 && Number(px[1]) < 12) small.push("font-size: " + px[1] + "px");
    }
    for (const match of css.matchAll(/\bfont\s*:\s*([^;{}]+)/gi)) {
      const px = match[1].match(/(?:^|\s)(\d+(?:\.\d+)?)px(?=\/|\s|$)/i);
      if (px && Number(px[1]) > 0 && Number(px[1]) < 12) small.push("font: " + px[1] + "px");
    }
    assert.deepEqual(small, [], file + " contains text below the 12px minimum");
  }
});

test("hover-only styles require a hover-capable fine pointer", () => {
  for (const file of ["styles.css", "learning-media.css"]) {
    const css = read(file);
    const stack = [];
    const unguarded = [];
    let start = 0;
    let quote = null;
    let comment = false;
    let escaped = false;
    for (let i = 0; i < css.length; i++) {
      const char = css[i];
      const next = css[i + 1];
      if (comment) {
        if (char === "*" && next === "/") { comment = false; i++; }
        continue;
      }
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (char === "\\") { escaped = true; continue; }
        if (char === quote) quote = null;
        continue;
      }
      if (char === "/" && next === "*") { comment = true; i++; continue; }
      if (char === "\"" || char === "'") { quote = char; continue; }
      if (char === "{") {
        const prelude = css.slice(start, i).trim();
        if (!prelude.startsWith("@") && prelude.includes(":hover")) {
          const finePointer = stack.some(item => /\(hover\s*:\s*hover\)/i.test(item) && /\(pointer\s*:\s*fine\)/i.test(item));
          const touchOverride = stack.some(item => /\(hover\s*:\s*none\)|\(pointer\s*:\s*coarse\)/i.test(item));
          if (!finePointer && !touchOverride) unguarded.push(prelude);
        }
        stack.push(prelude);
        start = i + 1;
      } else if (char === "}") {
        assert.ok(stack.length, file + " has an unmatched closing brace");
        stack.pop();
        start = i + 1;
      } else if (char === ";" && stack.length === 0) {
        start = i + 1;
      }
    }
    assert.equal(stack.length, 0, file + " has unclosed CSS blocks");
    assert.deepEqual(unguarded, [], file + " has hover styles without an input-capability guard");
  }
  const main = read("styles.css");
  const media = read("learning-media.css");
  assert.match(main, /\.mini-button\.saved\s*\{/);
  assert.match(main, /\.field:focus-within/);
  assert.match(media, /\.reading-card\.expanded\s*\{/);
});

test("theme tokens stay consolidated into one base, light and dark block", () => {
  const css = read("styles.css");
  assert.equal((css.match(/:root\s*\{/g) || []).length, 1);
  assert.equal((css.match(/:root\[data-theme=["']?light["']?\]\s*\{/g) || []).length, 1);
  assert.equal((css.match(/:root\[data-theme=["']?dark["']?\]\s*\{/g) || []).length, 1);
  assert.match(css, /--bg:\s*#111d2b/);
  assert.match(css, /:root\[data-theme="light"\][\s\S]*?--bg:\s*#f0f3f1/);
  assert.match(css, /:root\[data-theme="dark"\][\s\S]*?--bg:\s*#171a16/);
});

test("text and muted tokens meet WCAG AA contrast on all theme surfaces", () => {
  const css = read("styles.css");
  const selectors = [
    [":root", /:root\s*\{([^}]+)\}/],
    [':root[data-theme="light"]', /:root\[data-theme="light"\]\s*\{([^}]+)\}/],
    [':root[data-theme="dark"]', /:root\[data-theme="dark"\]\s*\{([^}]+)\}/]
  ];
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (first, second) => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const [label, selector] of selectors) {
    const match = css.match(selector);
    assert.ok(match, label + " theme block is missing");
    const tokens = Object.fromEntries([...match[1].matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})/gi)].map(item => [item[1], item[2]]));
    for (const foreground of ["--text", "--muted", "--muted2"]) {
      for (const background of ["--bg", "--panel", "--panel2", "--panel3"]) {
        const value = contrast(tokens[foreground], tokens[background]);
        assert.ok(value >= 4.5, label + " " + foreground + " on " + background + " = " + value.toFixed(2));
      }
    }
  }
});

test("expensive CSS blur filters are capped for rendering performance", () => {
  const css = read("styles.css");
  const backdrop = [...css.matchAll(/(?:-webkit-)?backdrop-filter\s*:\s*blur\((\d+(?:\.\d+)?)px\)/gi)];
  const filters = [...css.matchAll(/(?:^|[;{])\s*filter\s*:\s*blur\((\d+(?:\.\d+)?)px\)/gi)];
  for (const match of backdrop) assert.ok(Number(match[1]) <= 6, "backdrop blur exceeds 6px: " + match[0]);
  for (const match of filters) assert.ok(Number(match[1]) <= 12, "filter blur exceeds 12px: " + match[0]);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.auth-overlay[^}]*backdrop-filter:none/);
});

test("responsive shell uses natural document height and a full-width phone layout", () => {
  const css = read("styles.css");
  assert.match(css, /\.app\{height:auto;min-height:100svh\}/);
  assert.match(css, /#main-content\.main\{[\s\S]*?width:100%[\s\S]*?margin:0!important/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*?\.mobile-nav\{[\s\S]*?position:fixed/);
  assert.match(css, /@media\(min-width:621px\) and \(max-width:900px\)/);
});

test("interactive controls do not suppress native focus outlines", () => {
  const css = read("styles.css");
  assert.doesNotMatch(css, /outline\s*:\s*(?:none|0)\b/i);
  assert.match(css, /input:focus-visible/);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /textarea:focus-visible/);
});

test("animated UI does not keep persistent will-change compositor hints", () => {
  const css = read("styles.css");
  const active = [...css.matchAll(/will-change\s*:\s*([^;}]+)/gi)]
    .map(match => match[1].trim())
    .filter(value => value.toLowerCase() !== "auto");
  assert.deepEqual(active, [], "persistent will-change hints can retain unnecessary GPU layers");
});
