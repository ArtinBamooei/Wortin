"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function appFunction(name, random = () => 0) {
  const line = app.split(/\r?\n/).find((candidate) => candidate.startsWith(`function ${name}(`));
  assert.ok(line, `Expected function ${name} in app.js`);
  const testMath = Object.create(Math);
  testMath.random = random;
  return vm.runInNewContext(`(${line})`, { Math: testMath, Date });
}

test("incorrect answers schedule a short retry and reset consecutive correct repetitions", () => {
  const scheduleReview = appFunction("scheduleReview");
  const now = 1_800_000_000_000;
  const next = scheduleReview({ known: true, repetitions: 5, interval: 30 }, false, now);
  assert.equal(next.known, false);
  assert.equal(next.interval, 0);
  assert.equal(next.repetitions, 0);
  assert.equal(next.due, now + 10 * 60 * 1000);
  assert.equal(next.seen, 1);
});

test("correct answers use 1 day, 3 days, then expanding intervals capped at 180 days", () => {
  const scheduleReview = appFunction("scheduleReview");
  const now = 1_800_000_000_000;
  let state = scheduleReview({}, true, now);
  assert.equal(state.repetitions, 1);
  assert.equal(state.interval, 1);
  assert.equal(state.due, now + 24 * 60 * 60 * 1000);
  state = scheduleReview(state, true, now);
  assert.equal(state.repetitions, 2);
  assert.equal(state.interval, 3);
  assert.equal(state.known, true);
  state = scheduleReview(state, true, now);
  assert.equal(state.interval, 7);
  for (let i = 0; i < 20 && state.interval < 180; i++) state = scheduleReview(state, true, now);
  assert.equal(state.interval, 180);
  assert.ok(state.interval <= 180);
});

test("daily review samples 60% of at most the latest ten studied, eligible words", () => {
  const buildQueue = appFunction("buildDailyReviewQueue", () => 0);
  const words = Array.from({ length: 24 }, (_, i) => ({ id: String(i + 1), word: `Wort${i + 1}`, meaning_fa: `معنی ${i + 1}` }));
  const wordById = new Map(words.map((word) => [String(word.id), word]));
  const queue = buildQueue(words.map((word) => word.id), wordById, words, 10);
  assert.equal(queue.length, 6);
  assert.ok(queue.every((item) => Number(item.id) >= 15 && Number(item.id) <= 24));
  assert.ok(queue.every((item) => item.options.includes(item.id)));
});

test("daily review answer options do not repeat the same Persian meaning", () => {
  const buildQueue = appFunction("buildDailyReviewQueue", () => 0);
  const words = [
    { id: "1", word: "eins", meaning_fa: "یک" }, { id: "2", word: "uno", meaning_fa: "یک" },
    { id: "3", word: "zwei", meaning_fa: "دو" }, { id: "4", word: "drei", meaning_fa: "سه" },
    { id: "5", word: "vier", meaning_fa: "چهار" }, { id: "6", word: "fuenf", meaning_fa: "پنج" }
  ];
  const wordById = new Map(words.map((word) => [String(word.id), word]));
  const queue = buildQueue(["1", "2"], wordById, words, 10);
  assert.equal(queue.length, 1, "identical target meanings should not become duplicate questions");
  for (const item of queue) {
    const meanings = item.options.map((id) => wordById.get(id)?.meaning_fa);
    assert.equal(new Set(meanings).size, meanings.length);
  }
});

test("daily review queue is empty when there are no eligible studied words", () => {
  const buildQueue = appFunction("buildDailyReviewQueue");
  assert.equal(buildQueue([], new Map(), [], 10).length, 0);
});

test("daily review answers use the same spaced-repetition scheduler as regular practice", () => {
  assert.match(app, /saveWordState\(w,scheduleReview\(pFor\(w\),correct\)\)/);
});
