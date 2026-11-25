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

test("view navigation supports direct links and browser history", () => {
  const app = read("app.js");
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /window\.addEventListener\("hashchange"/);
  assert.match(app, /el\.inert=!active/);
  assert.match(app, /history\[method\]\(\{view\}/);
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
    [":root", /:root\s*\{/],
    [':root[data-theme="light"]', /:root\[data-theme="light"\]\s*\{/],
    [':root[data-theme="dark"]', /:root\[data-theme="dark"\]\s*\{/]
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
    const match = css.match(new RegExp(selector.source + "([^}]+)\\}"));
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
