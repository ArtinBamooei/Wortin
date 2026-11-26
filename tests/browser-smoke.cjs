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

async function mockBackend(page) {
  await page.route("**/npm/@supabase/supabase-js@2.117.3", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.supabase={createClient:function(){return {auth:{onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}},getSession:async function(){return {data:{session:null},error:null}}}}}};"
    })
  );

  await page.route("**/rest/v1/vocabulary*", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(vocabularyFixture) })
  );

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

    // A long study view must extend the document and scroll above the fixed mobile navigation.
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.locator('.mobile-nav [data-view="learn"]').click();
    await mobile.locator("#view-learn.active").waitFor();
    await mobile.locator("#studyContent #flashcard").waitFor({ timeout: 5000 });
    await mobile.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await mobile.waitForTimeout(100);
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
