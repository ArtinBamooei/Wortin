"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "_site");
const files = ["index.html","404.html","app.js","styles.css","learning-media.js","learning-media.css","favicon.svg","manifest.webmanifest","sw.js","theme-init.js","pwa-register.js","robots.txt","sitemap.xml"];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error("Missing deployment asset: " + file);
  fs.copyFileSync(source, path.join(out, file));
}
const assets = path.join(root, "assets");
if (!fs.existsSync(assets) || !fs.statSync(assets).isDirectory()) throw new Error("Missing assets directory.");
fs.cpSync(assets, path.join(out, "assets"), { recursive: true });
console.log("Built clean GitHub Pages artifact at _site.");
