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
