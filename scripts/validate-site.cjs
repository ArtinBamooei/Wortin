"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const fail = (message) => {
  console.error(`Site validation failed: ${message}`);
  process.exitCode = 1;
};

const requiredFiles = [
  "index.html", "app.js", "styles.css", "learning-media.js", "learning-media.css", "README.md",
  "supabase/migrations/20261023084218_wortin_vocabulary_schema.sql",
  "supabase/migrations/20261025065829_user_progress_security.sql"
];
for (const name of requiredFiles) if (!fs.existsSync(path.join(root, name))) fail(`Required file is missing: ${name}`);
if (process.exitCode) process.exit(1);

const html = read("index.html"), app = read("app.js"), css = read("styles.css");
const csp = html.match(/<meta\\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*content="([^"]+)"/i)?.[1];
if (!csp) fail("A Content-Security-Policy meta policy is required.");
if (csp && !/default-src\s+'self'/.test(csp)) fail("CSP must retain default-src 'self'.");
const scriptPolicy = csp?.match(/(?:^|;)\s*script-src\s+([^;]+)/i)?.[1] || "";
if (!scriptPolicy.includes("'self'") || !scriptPolicy.includes("https://cdn.jsdelivr.net")) fail("CSP script-src must allow same-origin scripts and the Supabase CDN.");
if (/\bunsafe-(?:inline|eval)\b/.test(scriptPolicy)) fail("CSP script-src must not allow unsafe-inline or unsafe-eval.");
if (/\b(?:eval|Function)\s*\(/.test(app)) fail("Dynamic code execution sink detected in app.js.");
if (/service_role|sb_secret_[A-Za-z0-9_]+/i.test(html + app)) fail("A server-side Supabase secret appears in public source.");

for (const match of html.matchAll(/<script\b([^>]*)>/gi)) if (!/\bsrc\s*=/.test(match[1])) fail("Inline script tags are incompatible with the current CSP.");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicateIds.length) fail("Duplicate HTML id(s): " + [...new Set(duplicateIds)].join(", "));

for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const asset = match[0].match(/\b(?:src|href)=["'](\.\/[^"'?#]+)(?:\?[^"']*)?["']/i)?.[1];
  if (asset && !fs.existsSync(path.join(root, asset.slice(2)))) fail(`Referenced local asset does not exist: ${asset}`);
}
const jsVersion = html.match(/<script\b[^>]*\bsrc=["']\.\/app\.js\?([^"']+)["']/i)?.[1];
if (!jsVersion || !new URLSearchParams(jsVersion).get("v")) fail("app.js must have a non-empty cache version.");
const cssVersion = html.match(/<link\b[^>]*\bhref=["']\.\/styles\.css\?([^"']+)["']/i)?.[1];
if (!cssVersion || !new URLSearchParams(cssVersion).get("v")) fail("styles.css must have a non-empty cache version.");

const views = [...html.matchAll(/\bdata-view=["']([^"']+)["']/g)].map((match) => match[1]);
for (const view of new Set(views)) if (!html.includes(`id="view-${view}"`) && !html.includes(`id='view-${view}'`)) fail(`Navigation target has no view container: ${view}`);

for (const token of [
  "function buildDailyReviewQueue(", "function beginDailyReview(", "function renderDailyReview(",
  "function scheduleReview(", "function saveWordState(", "function renderSaved(",
  "const SAVED_PAGE_SIZE=100", 'data-saved-page="next"',
  "saveWordState(w,scheduleReview(pFor(w),correct))"
]) if (!app.includes(token)) fail(`Expected learning or pagination behavior is missing: ${token}`);
if (!css.includes("prefers-reduced-motion:reduce")) fail("Reduced-motion support is required.");
if (!css.includes(":focus-visible")) fail("Visible keyboard focus styles are required.");
if (!html.includes('href="#main-content"')) fail("A skip link to main content is required.");

const readme = read("README.md");
if (readme.includes("20261023120000_wortin_vocabulary_schema.sql")) fail("README references a migration file that does not exist.");
if (readme.includes("not a multi-user account system")) fail("README describes the old pre-authentication architecture.");

if (process.exitCode) process.exit(1);
console.log("Wortin source/security/accessibility smoke checks passed.");
