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
  "index.html", "app.js", "styles.css", "learning-media.js", "learning-media.css", "README.md", "LICENSE", "SECURITY.md", ".gitignore", "package.json", "DATA-PROVENANCE.md", "404.html", "robots.txt", "sitemap.xml", "manifest.webmanifest", "sw.js", "theme-init.js", "pwa-register.js", "scripts/build-site.cjs",
  "supabase/migrations/20261023084218_wortin_vocabulary_schema.sql",
  "supabase/migrations/20261025065829_user_progress_security.sql",
  "supabase/migrations/20261119104740_security_hardening_public_table_grants.sql", "supabase/migrations/20261125115143_user_progress_integrity.sql", "supabase/migrations/20261125115228_validate_user_progress_integrity_constraints.sql", "supabase/migrations/20261125115747_stable_vocabulary_record_codes.sql", "supabase/migrations/20261125115830_group_duplicate_vocabulary_progress.sql", "supabase/migrations/20261125120320_drop_duplicate_record_code_index.sql"
];
for (const name of requiredFiles) if (!fs.existsSync(path.join(root, name))) fail(`Required file is missing: ${name}`);
if (process.exitCode) process.exit(1);

const html = read("index.html"), app = read("app.js"), css = read("styles.css"), media = read("learning-media.js");
const csp = html.match(/<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*content="([^"]+)"/i)?.[1];
const hasNoReferrer = html.includes('<meta name="referrer" content="no-referrer">');
if (!hasNoReferrer) fail("Referrer policy must be no-referrer.");
if (csp && !csp.includes("form-action 'self';")) fail("CSP form-action must be same-origin only.");
if (csp && csp.includes("*")) fail("CSP must not contain wildcard source expressions.");
if (!app.includes('const SUPABASE_URL="https://')) fail("Supabase URL must use HTTPS.");
if (!app.includes('const SUPABASE_KEY="sb_publishable_')) fail("Browser key must be a publishable key.");
if (!app.includes("progress_key,record_section") || !app.includes("wortin.vocabulary.cache.v4")) fail("Vocabulary cache schema and stable progress key must be versioned.");
if (!app.includes('const AUTH_REDIRECT_URL="https://artinbamooei.github.io/Wortin/";')) fail("Auth redirect must use the canonical production URL.");
if (!media.includes('sandbox="allow-scripts allow-same-origin allow-presentation"')) fail("Third-party video iframe must be sandboxed.");
if (!media.includes('["aparat.com","www.aparat.com"].includes(u.hostname)')) fail("Video embeds must enforce the Aparat host allowlist.");
const grantsMigration = read("supabase/migrations/20261119104740_security_hardening_public_table_grants.sql");
const integrityMigration = read("supabase/migrations/20261125115143_user_progress_integrity.sql");
const integrityValidationMigration = read("supabase/migrations/20261125115228_validate_user_progress_integrity_constraints.sql");
const stableCodesMigration = read("supabase/migrations/20261125115747_stable_vocabulary_record_codes.sql");
const groupedProgressMigration = read("supabase/migrations/20261125115830_group_duplicate_vocabulary_progress.sql");
for (const token of ["user_progress_progress_shape_check", "user_progress_daily_shape_check", "wortin_user_progress_updated_at", "Users delete own progress", "grant delete on table public.user_progress to authenticated"]) if (!integrityMigration.toLowerCase().includes(token.toLowerCase())) fail("User progress integrity migration is missing: " + token);
for (const token of ["validate constraint user_progress_progress_shape_check", "validate constraint user_progress_daily_shape_check"]) if (!integrityValidationMigration.toLowerCase().includes(token)) fail("User progress constraint validation migration is missing: " + token);
if (!stableCodesMigration.toLowerCase().includes("alter column record_code set not null")) fail("Stable vocabulary identity migration is missing: record_code NOT NULL.");
const dropDuplicateIndexMigration = read("supabase/migrations/20261125120320_drop_duplicate_record_code_index.sql");
if (!dropDuplicateIndexMigration.toLowerCase().includes("drop index if exists public.vocabulary_record_code_uidx")) fail("Duplicate record-code index cleanup is missing.");
for (const token of ["add column if not exists progress_key", "vocabulary_progress_key_nonempty", "vocabulary_progress_key_idx"]) if (!groupedProgressMigration.toLowerCase().includes(token)) fail("Duplicate headword progress grouping migration is missing: " + token);

if (!grantsMigration.includes("revoke all privileges on table public.vocabulary")) fail("Vocabulary grants must be explicitly revoked before least-privilege grants.");
if (!grantsMigration.includes("revoke all privileges on table public.user_progress")) fail("Progress grants must be explicitly revoked before least-privilege grants.");

if (!csp) fail("A Content-Security-Policy meta policy is required.");
if (csp && !/default-src\s+'self'/.test(csp)) fail("CSP must retain default-src 'self'.");
const scriptPolicy = csp?.match(/(?:^|;)\s*script-src\s+([^;]+)/i)?.[1] || "";
if (!scriptPolicy.includes("'self'") || !scriptPolicy.includes("https://cdn.jsdelivr.net")) fail("CSP script-src must allow same-origin scripts and the Supabase CDN.");
if (/\bunsafe-(?:inline|eval)\b/.test(scriptPolicy)) fail("CSP script-src must not allow unsafe-inline or unsafe-eval.");
if (/\b(?:eval|Function)\s*\(/.test(app)) fail("Dynamic code execution sink detected in app.js.");
if (/service_role|sb_secret_[A-Za-z0-9_]+/i.test(html + app)) fail("A server-side Supabase secret appears in public source.");

for (const match of html.matchAll(/<script\b([^>]*)>/gi)) { const attrs = match[1]; const jsonLd = /\btype=["']application\/ld\+json["']/i.test(attrs); if (!/\bsrc\s*=/.test(attrs) && !jsonLd) fail("Executable inline script tags are incompatible with the current CSP."); }
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

const manifest = JSON.parse(read("manifest.webmanifest"));
if (manifest.start_url !== "./" || manifest.scope !== "./" || manifest.display !== "standalone") fail("PWA manifest must use the GitHub Pages project scope and standalone display.");
if (!html.includes('rel="manifest"') || !html.includes('rel="apple-touch-icon"')) fail("PWA manifest and Apple touch icon links are required.");
for (const token of ['name="twitter:card"', 'property="og:image"', 'property="og:locale"', 'property="og:site_name"']) if (!html.includes(token)) fail("Required social metadata is missing: " + token);
if (!read("robots.txt").includes("Sitemap: https://artinbamooei.github.io/Wortin/sitemap.xml")) fail("robots.txt must advertise the canonical sitemap.");
if (!read("sitemap.xml").includes("https://artinbamooei.github.io/Wortin/")) fail("Sitemap must contain the canonical site URL.");
if (!read("sw.js").includes('const CACHE_NAME = "wortin-shell-v2"')) fail("A versioned offline shell cache is required.");
const workflow = read(".github/workflows/pages.yml");
if (!workflow.includes("node scripts/build-site.cjs") || !/path:\s*_site/.test(workflow)) fail("GitHub Pages must deploy the curated _site artifact, not the repository root.");

const views = [...html.matchAll(/\bdata-view=["']([^"']+)["']/g)].map((match) => match[1]);
for (const view of new Set(views)) if (!html.includes(`id="view-${view}"`) && !html.includes(`id='view-${view}'`)) fail(`Navigation target has no view container: ${view}`);

for (const token of [
  "function buildDailyReviewQueue(", "function beginDailyReview(", "function renderDailyReview(",
  "function scheduleReview(", "function saveWordState(", "function renderSaved(",
  "const SAVED_PAGE_SIZE=100", 'data-saved-page="next"',
  "saveWordState(w,scheduleReview(pFor(w),correct))"
]) if (!app.includes(token)) fail(`Expected learning or pagination behavior is missing: ${token}`);
if (media.split("function renderListening(){").length - 1 !== 1) fail("Listening renderer must be defined exactly once.");
if (!media.includes("Array.isArray(v.questions)")) fail("Listening renderer must retain question rendering for future lessons.");
if (!css.includes("prefers-reduced-motion:reduce")) fail("Reduced-motion support is required.");
const cardIntegrity = css.slice(css.lastIndexOf("/* Flashcard display integrity — single source of truth for both faces. */"));
for (const selector of [
  "#view-learn #flashcard:not(.flipped) .flash-front",
  "#view-learn #flashcard:not(.flipped) .flash-back",
  "#view-learn #flashcard.flipped .flash-front",
  "#view-learn #flashcard.flipped .flash-back"
]) if (!cardIntegrity.includes(selector)) fail("Flashcard face state rule is missing: " + selector);
if (!cardIntegrity.includes("visibility:visible!important")) fail("Flashcard faces must remain visible while cross-fading.");
if (!cardIntegrity.includes("opacity:1")) fail("Flashcard active face must be fully opaque.");
if (!cardIntegrity.includes("transform:none!important")) fail("Flashcard contents must not be pushed into a separate 3D text layer.");
if (!cardIntegrity.includes("content:none!important;display:none!important")) fail("Decorative stacked card pseudo-layers must remain disabled.");
if (!css.includes(":focus-visible")) fail("Visible keyboard focus styles are required.");
if (!html.includes('href="#main-content"')) fail("A skip link to main content is required.");

const readme = read("README.md");
if (readme.includes("20261023120000_wortin_vocabulary_schema.sql")) fail("README references a migration file that does not exist.");
if (readme.includes("not a multi-user account system")) fail("README describes the old pre-authentication architecture.");

if (process.exitCode) process.exit(1);
console.log("Wortin source/security/accessibility smoke checks passed.");
