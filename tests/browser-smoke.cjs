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
  await page.locator("#dbStatus.ok").waitFor({ timeout: 15000 });
  await page.locator("#statTotal").waitFor({ timeout: 5000 });
  assert.match(await page.locator("#statTotal").innerText(), /1/,
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
    await desktop.locator("#authOverlay").waitFor({ state: "hidden" });
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
