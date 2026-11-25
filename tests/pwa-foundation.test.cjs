"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("PWA manifest is scoped to the GitHub Pages project path", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});

test("service worker only handles same-origin GET requests", () => {
  const sw = read("sw.js");
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /wortin-shell-v1/);
  assert.doesNotMatch(sw, /supabase\.co|Authorization|sb_publishable/i);
});

test("deployment build is allowlist-based and never copies repository root", () => {
  const build = read("scripts/build-site.cjs");
  assert.match(build, /const files = \[/);
  assert.match(build, /fs\.cpSync\(assets/);
  assert.doesNotMatch(build, /fs\.cpSync\(root, out/);
  assert.doesNotMatch(build, /supabase\/migrations|README\.md|tests\/|scripts\//);
});

test("SEO and PWA entry points exist in the document", () => {
  const html = read("index.html");
  for (const token of ['rel="manifest"', 'rel="apple-touch-icon"', 'name="twitter:card"', 'property="og:image"', 'application/ld+json']) {
    assert.ok(html.includes(token), "missing " + token);
  }
  assert.ok(fs.existsSync(path.join(root, "robots.txt")));
  assert.ok(fs.existsSync(path.join(root, "sitemap.xml")));
  assert.ok(fs.existsSync(path.join(root, "404.html")));
});
