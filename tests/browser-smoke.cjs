"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.WORTIN_TEST_URL || "http://127.0.0.1:4173/";

const vocabularyFixture = [{
  id: 1,
  source_number: 1,
  record_code: "e2e-lernen-verb",
  progress_key: "verb:lernen",
  record_section: "e2e",
  word: "lernen",
  word_type: "Verb",
  meaning_fa: "یاد گرفتن",
  example_de: "Ich lerne Deutsch.",
  examples_de: [],
  extra_examples_de: [],
  case_info: null,
  preposition: null,
  pdf_page: null,
  thematic_group: null,
  equivalent: null
}];

async function mockBackend(page, options = {}) {
  options.manifestRequests ??= 0;
  options.vocabularyRequests ??= 0;
  options.manifestVersion ??= "1";
  options.vocabularyFixture ??= vocabularyFixture;
  options.failManifest ??= false;

  await page.route("**/npm/@supabase/supabase-js@2.117.3", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.supabase={createClient:function(){return {auth:{onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}},getSession:async function(){return {data:{session:null},error:null}}}}}};"
    })
  );

  await page.route(url => url.pathname.endsWith("/rest/v1/vocabulary_manifest"), async route => {
    options.manifestRequests++;
    if (options.failManifest) return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        singleton: true,
        version: options.manifestVersion,
        row_count: options.vocabularyFixture.length,
        updated_at: "2026-11-27T00:00:00Z"
      }])
    });
  });

  await page.route(url => url.pathname.endsWith("/rest/v1/vocabulary"), async route => {
    options.vocabularyRequests++;
    if (options.vocabularyDelayMs) await new Promise(resolve => setTimeout(resolve, options.vocabularyDelayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.vocabularyFixture)
    });
  });

  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
}

async function waitForVocabulary(page) {
  await page.waitForFunction(() => document.querySelector("#dbStatus")?.classList.contains("ok"), null, { timeout: 15000 });
  await page.locator("#statTotal").waitFor({ timeout: 5000 });
  assert.match(await page.locator("#statTotal").innerText(), /^[۱1]$/,
    "The loaded vocabulary count should be one.");
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const failures = [];

  try {
    const cacheCounters = { manifestRequests: 0, vocabularyRequests: 0, manifestVersion: "1", vocabularyFixture: vocabularyFixture.map(word => ({ ...word })), vocabularyDelayMs: 900 };
    const coldStart = await browser.newPage({ viewport: { width: 390, height: 844 } });
    coldStart.on("pageerror", error => failures.push("Cold-start page error: " + error.message));
    await mockBackend(coldStart, cacheCounters);
    await coldStart.goto(BASE_URL + "#learn", { waitUntil: "domcontentloaded" });
    await coldStart.locator("#view-learn.active").waitFor();
    await coldStart.locator("#vocabularyLoader.is-visible").waitFor();
    await coldStart.waitForFunction(() => document.querySelector("#dbStatus")?.classList.contains("loading"));
    assert.equal(await coldStart.locator("#flashcard").count(), 0,
      "A flashcard must not be rendered from an empty vocabulary list while the first snapshot is downloading.");
    await coldStart.waitForFunction(() => document.querySelector("#flashcard .flash-word")?.textContent.trim() === "lernen", null, { timeout: 15000 });
    await coldStart.waitForFunction(() => !document.querySelector("#vocabularyLoader")?.classList.contains("is-visible"));
    assert.equal(cacheCounters.manifestRequests, 2, "A cold start checks the manifest before and after downloading to verify snapshot consistency.");
    assert.equal(cacheCounters.vocabularyRequests, 1, "A cold start should download the vocabulary snapshot once.");

    // A reload with an unchanged manifest must use IndexedDB and must not re-download vocabulary rows.
    await coldStart.reload({ waitUntil: "domcontentloaded" });
    await coldStart.waitForFunction(() => document.querySelector("#flashcard .flash-word")?.textContent.trim() === "lernen", null, { timeout: 15000 });
    await coldStart.waitForFunction(() => !document.querySelector("#vocabularyLoader")?.classList.contains("is-visible"));
    assert.equal(cacheCounters.manifestRequests, 3, "A warm reload checks only the tiny version manifest.");
    assert.equal(cacheCounters.vocabularyRequests, 1,
      "An unchanged database version must not trigger a vocabulary download after reload.");

    // A changed manifest downloads one complete replacement and then becomes cache-stable.
    cacheCounters.manifestVersion = "2";
    cacheCounters.vocabularyFixture = [{ ...vocabularyFixture[0], word: "spielen", meaning_fa: "بازی کردن" }];
    await coldStart.reload({ waitUntil: "domcontentloaded" });
    await coldStart.waitForFunction(() => document.querySelector("#flashcard .flash-word")?.textContent.trim() === "spielen", null, { timeout: 15000 });
    await coldStart.waitForFunction(() => !document.querySelector("#vocabularyLoader")?.classList.contains("is-visible"));
    assert.equal(cacheCounters.manifestRequests, 5, "A changed-version reload verifies the manifest before and after its replacement download.");
    assert.equal(cacheCounters.vocabularyRequests, 2,
      "A changed manifest version must trigger one replacement snapshot download.");

    // A temporary manifest outage must keep the usable cache and must not start a full download.
    cacheCounters.failManifest = true;
    await coldStart.reload({ waitUntil: "domcontentloaded" });
    await coldStart.waitForFunction(() => document.querySelector("#flashcard .flash-word")?.textContent.trim() === "spielen", null, { timeout: 15000 });
    await coldStart.waitForFunction(() => !document.querySelector("#vocabularyLoader")?.classList.contains("is-visible"));
    assert.equal(cacheCounters.vocabularyRequests, 2,
      "Manifest failure with a valid local snapshot must not cause a full database download.");
    await coldStart.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    desktop.on("pageerror", error => failures.push("Desktop page error: " + error.message));
    await mockBackend(desktop);
    await desktop.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await waitForVocabulary(desktop);

    assert.equal(await desktop.locator("#view-home").evaluate(el => el.classList.contains("active")), true,
      "The home view should be active on first load.");

    await desktop.locator('.sidebar [data-view="dictionary"]').click();
    await desktop.locator("#view-dictionary.active").waitFor();
    await desktop.locator("#wordList .word-row").first().waitFor();
    assert.match(await desktop.locator("#wordList").innerText(), /lernen/,
      "The dictionary should display the mocked vocabulary record.");

    await desktop.locator("#dictSearch").fill("lernen");
    assert.equal(await desktop.locator("#wordList .word-row").count(), 1,
      "Dictionary search should retain the matching record.");
    await desktop.locator("#dictSearch").fill("not-a-real-word");
    await desktop.locator("#wordList .empty").waitFor({ timeout: 2000 });
    assert.equal(await desktop.locator("#wordList .word-row").count(), 0,
      "Dictionary search should return no rows for an unmatched query.");

    const themeBefore = await desktop.locator("html").getAttribute("data-theme");
    await desktop.locator("#themeToggle").click();
    const themeAfter = await desktop.locator("html").getAttribute("data-theme");
    assert.notEqual(themeAfter, themeBefore, "The theme toggle should change the active theme.");
    assert.ok(["light", "dark"].includes(themeAfter), "The active theme must be light or dark.");

    await desktop.locator("#authOpen").click();
    await desktop.locator("#authOverlay.open").waitFor();
    assert.equal(await desktop.locator("#authOverlay").getAttribute("aria-hidden"), "false");
    await desktop.locator("#authClose").click();
    assert.equal(await desktop.locator("#authOverlay").evaluate(el => el.classList.contains("open")), false,
      "Closing the authentication dialog should remove its open state.");
    assert.equal(await desktop.locator("#authOverlay").getAttribute("aria-hidden"), "true",
      "Closing the authentication dialog should restore its hidden state.");

    await desktop.locator('.sidebar [data-view="stats"]').click();
    await desktop.locator("#view-stats.active").waitFor();
    await desktop.goBack();
    await desktop.locator("#view-dictionary.active").waitFor();
    assert.equal(new URL(desktop.url()).hash, "#dictionary",
      "Browser Back should restore the previously selected view.");

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    mobile.on("pageerror", error => failures.push("Mobile page error: " + error.message));
    await mockBackend(mobile);
    await mobile.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await waitForVocabulary(mobile);
    await mobile.locator("#mobileMoreToggle").click();
    assert.equal(await mobile.locator("#mobileMoreToggle").getAttribute("aria-expanded"), "true",
      "The mobile More menu should expose its expanded state.");
    await mobile.locator("#mobileMorePanel [data-view='stats']").click();
    await mobile.locator("#view-stats.active").waitFor();
    assert.equal(new URL(mobile.url()).hash, "#stats",
      "Mobile More navigation should open the selected view.");

    // Verify the complete responsive shell at phone, tablet and compact desktop widths.
    const responsiveWidths = [320, 360, 390, 430, 520, 620, 621, 768, 900, 1024];
    for (const width of responsiveWidths) {
      await mobile.setViewportSize({ width, height: 844 });
      const layout = await mobile.evaluate(() => {
        const main = document.querySelector("#main-content");
        const rect = main.getBoundingClientRect();
        const nav = document.querySelector(".mobile-nav");
        const sidebar = document.querySelector(".sidebar");
        return {
          viewport: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          mainLeft: rect.left,
          mainRight: rect.right,
          mainWidth: rect.width,
          navDisplay: getComputedStyle(nav).display,
          sidebarDisplay: getComputedStyle(sidebar).display
        };
      });
      assert.ok(layout.documentWidth <= layout.viewport + 1,
        "Horizontal page overflow at " + width + "px: " + JSON.stringify(layout));
      const allowedGutter = 16;
      assert.ok(layout.mainLeft >= -1 && layout.mainLeft <= allowedGutter,
        "Main content has an unexpected left gutter at " + width + "px: " + JSON.stringify(layout));
      assert.ok(layout.mainRight <= layout.viewport + 1,
        "Main content exceeds the viewport at " + width + "px: " + JSON.stringify(layout));
      if (width <= 620) {
        assert.ok(layout.mainRight >= width - 16 && layout.mainWidth >= width - 32,
          "Phone content must span the viewport with only normal inner padding at " + width + "px: " + JSON.stringify(layout));
        assert.equal(layout.navDisplay, "flex", "The mobile navigation must be visible at " + width + "px.");
        assert.equal(layout.sidebarDisplay, "none", "The desktop sidebar must be hidden at " + width + "px.");
      } else if (width <= 900) {
        assert.ok(layout.mainWidth >= width - 110 && layout.mainRight <= width - 74,
          "Tablet content must use the space beside the compact sidebar at " + width + "px: " + JSON.stringify(layout));
        assert.equal(layout.navDisplay, "none", "The mobile navigation must be hidden on tablets.");
        assert.notEqual(layout.sidebarDisplay, "none", "The compact tablet sidebar must remain available.");
      }
    }

    // Check every primary and secondary view at narrow and standard phone widths.
    const primaryViews = ["home", "learn", "daily", "listening"];
    const secondaryViews = ["dictionary", "reading", "quiz", "review", "stats", "official-exams"];
    for (const width of [320, 390]) {
      await mobile.setViewportSize({ width, height: 844 });
      const verifyActiveView = async view => {
        await mobile.locator("#view-" + view + ".active").waitFor({ timeout: 5000 });
        await mobile.waitForTimeout(120);
        const geometry = await mobile.evaluate(viewId => {
          const node = document.getElementById("view-" + viewId);
          const rect = node.getBoundingClientRect();
          return {
            viewport: document.documentElement.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            viewWidth: node.scrollWidth,
            left: rect.left,
            right: rect.right
          };
        }, view);
        assert.ok(geometry.pageWidth <= geometry.viewport + 1,
          "Horizontal document overflow in " + view + " at " + width + "px: " + JSON.stringify(geometry));
        assert.ok(geometry.viewWidth <= geometry.viewport + 1,
          "Section content overflow in " + view + " at " + width + "px: " + JSON.stringify(geometry));
        assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1,
          "Section exceeds viewport in " + view + " at " + width + "px: " + JSON.stringify(geometry));
      };
      for (const view of primaryViews) {
        await mobile.locator('.mobile-nav [data-view="' + view + '"]').click();
        await verifyActiveView(view);
      }
      for (const view of secondaryViews) {
        await mobile.locator("#mobileMoreToggle").click();
        await mobile.locator("#mobileMorePanel [data-view='" + view + "']").click();
        await verifyActiveView(view);
      }
    }

    // Reset study state after checking all views so the flashcard clearance test starts a fresh flash session.
    await mobile.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await waitForVocabulary(mobile);

    // A long study view must extend the document and scroll above the fixed mobile navigation.
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.locator('.mobile-nav [data-view="learn"]').click();
    await mobile.locator("#view-learn.active").waitFor();
    await mobile.locator("#studyContent #flashcard").waitFor({ timeout: 5000 });
    await mobile.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await mobile.waitForFunction(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max <= 0 || window.scrollY >= max - 2;
    }, null, { timeout: 3000 });
    const studyScroll = await mobile.evaluate(() => {
      const action = document.querySelector("#study-card-actions, .study-card-actions");
      const nav = document.querySelector(".mobile-nav");
      const actionRect = action?.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        actionBottom: actionRect?.bottom ?? null,
        navTop: navRect.top
      };
    });
    assert.ok(studyScroll.maxScroll >= 0, "The study page must have a valid document scroll range.");
    assert.ok(studyScroll.actionBottom !== null && studyScroll.actionBottom <= studyScroll.navTop + 1,
      "Study actions must be reachable above the fixed mobile navigation: " + JSON.stringify(studyScroll));


    assert.deepEqual(failures, [], "The application must not emit uncaught browser errors.");
    console.log("Browser smoke tests passed: desktop load, vocabulary fetch, dictionary search, theme toggle, auth dialog, browser history, mobile navigation, and uncaught-error check.");
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
