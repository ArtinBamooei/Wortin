"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HTML has one primary heading, explicit button types and labeled search inputs", () => {
  const html = read("index.html");
  assert.equal((html.match(/<h1\\b/gi) || []).length, 1);
  assert.equal((html.match(/<button\\b(?![^>]*\\btype=)[^>]*>/gi) || []).length, 0);
  assert.match(html, /id="dictSearch" type="search" aria-label=/);
  assert.match(html, /id="commandSearch" type="search" aria-label=/);
  assert.match(html, /<footer\\b/);
});

test("view navigation supports direct links and browser history", () => {
  const app = read("app.js");
  assert.match(app, /window\\.addEventListener\\("popstate"/);
  assert.match(app, /window\\.addEventListener\\("hashchange"/);
  assert.match(app, /el\\.inert=!active/);
  assert.match(app, /history\\[method\\]\\(\\{view\\}/);
});

test("word progress uses stable record codes and conservative mastery", () => {
  const app = read("app.js");
  assert.match(app, /function wordProgressKey\\(word\\)\\{return String\\(word\\.record_code\\|\\|word\\.id\\)\\}/);
  assert.match(app, /known:repetitions>=5&&interval>=21/);
  assert.match(app, /function addLocalDays/);
  assert.match(app, /date\\.setDate\\(date\\.getDate\\(\\)\\+days\\)/);
});

test("search normalization covers Persian variants, ZWNJ and German spellings", () => {
  const app = read("app.js");
  assert.match(app, /function searchForms/);
  assert.match(app, /replace\\(\\/\\[يى\\]\\//);
  assert.match(app, /replace\\(\\/ä\\/g,"ae"\\)/);
  assert.match(app, /replace\\(\\/ü\\/g,"ue"\\)/);
});

test("listening answer selection does not rebuild the entire root", () => {
  const media = read("learning-media.js");
  assert.match(media, /root\\.addEventListener\\("click"/);
  assert.match(media, /question\\.querySelectorAll\\("\\[data-answer\\]"/);
  assert.doesNotMatch(media, /state\\.answers\\[b\\.dataset\\.answer\\][^;]*;render\\(\\)/);
});
