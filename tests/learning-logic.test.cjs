"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function appFunction(name, random = () => 0, extraContext = {}) {
  const line = app.split(/\r?\n/).find((candidate) => candidate.startsWith(`function ${name}(`));
  assert.ok(line, `Expected function ${name} in app.js`);
  const testMath = Object.create(Math);
  testMath.random = random;
  return vm.runInNewContext(`(${line})`, { Math: testMath, Date, ...extraContext });
}

function appFunctionWithContext(name, extraContext = {}) {
  const line = app.split(/\r?\n/).find((candidate) => candidate.startsWith(`function ${name}(`));
  assert.ok(line, `Expected function ${name} in app.js`);
  const context = { Math, Date, ...extraContext };
  vm.createContext(context);
  return { fn: vm.runInContext(`(${line})`, context), context };
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


test("progress merge preserves the newest per-word state and unions independent words", () => {
  const merge = appFunction("mergeProgressData");
  const remote = {
    words: {
      olderLocalEdit: { saved: true, repetitions: 4, _updatedAt: 200 },
      remoteOnly: { seen: 1, due: 500, _updatedAt: 400 }
    },
    days: { "2026-10-26": { count: 3, words: ["a", "b"] } },
    sessions: 7,
    reviewCount: 12,
    quizTotal: 20,
    quizCorrect: 15,
    lastActive: "2026-10-26"
  };
  const local = {
    words: {
      olderLocalEdit: { saved: false, repetitions: 1, _updatedAt: 100 },
      localOnly: { seen: 1, due: 600, _updatedAt: 500 }
    },
    days: { "2026-10-26": { count: 2, words: ["b", "c"] } },
    sessions: 4,
    reviewCount: 15,
    quizTotal: 18,
    quizCorrect: 17,
    lastActive: "2026-10-27"
  };
  const merged = merge(remote, local);
  assert.equal(merged.words.olderLocalEdit.saved, true, "the newer remote word state wins");
  assert.ok(merged.words.remoteOnly);
  assert.ok(merged.words.localOnly);
  assert.equal(merged.sessions, 7);
  assert.equal(merged.reviewCount, 15);
  assert.equal(merged.quizTotal, 20);
  assert.equal(merged.quizCorrect, 17);
  assert.deepEqual([...merged.days["2026-10-26"].words].sort(), ["a", "b", "c"]);
  assert.equal(merged.days["2026-10-26"].count, 3);
  assert.equal(merged.lastActive, "2026-10-27");
});

test("daily progress merge unions studied word IDs and same-day activity", () => {
  const merge = appFunction("mergeDailyData");
  const merged = merge(
    { studied: ["1", "2"], days: { "2026-10-27": ["1", "2"] }, cursor: 8, mode: "learn" },
    { studied: ["2", "3"], days: { "2026-10-27": ["2", "4"] }, cursor: 5, mode: "review" }
  );
  assert.deepEqual(Array.from(merged.studied), ["1", "2", "3"]);
  assert.deepEqual(Array.from(merged.days["2026-10-27"]), ["1", "2", "4"]);
  assert.equal(merged.cursor, 8);
  assert.equal(merged.mode, "review");
});

test("local progress, daily state and dirty markers are isolated by authenticated user ID", () => {
  const { fn: setScope, context } = appFunctionWithContext("setLocalUserScope", {
    PROGRESS_BASE_KEY: "wortin_progress",
    DAILY_BASE_KEY: "wortin_daily",
    LOCAL_CHANGE_BASE_KEY: "wortin_dirty",
    PROGRESS_KEY: "",
    DAILY_KEY: "",
    LOCAL_CHANGE_KEY: "",
    progress: {},
    daily: {},
    progressRevision: 0,
    derivedWordSets: null,
    loadProgress: () => ({ scope: "progress" }),
    loadDaily: () => ({ scope: "daily" })
  });
  setScope("user-a");
  assert.equal(context.PROGRESS_KEY, "wortin_progress.user-a");
  assert.equal(context.DAILY_KEY, "wortin_daily.user-a");
  assert.equal(context.LOCAL_CHANGE_KEY, "wortin_dirty.user-a");
  setScope("user-b");
  assert.equal(context.PROGRESS_KEY, "wortin_progress.user-b");
  assert.equal(context.DAILY_KEY, "wortin_daily.user-b");
  assert.equal(context.LOCAL_CHANGE_KEY, "wortin_dirty.user-b");
  setScope(null);
  assert.equal(context.PROGRESS_KEY, "wortin_progress.anon");
  assert.equal(context.DAILY_KEY, "wortin_daily.anon");
  assert.equal(context.LOCAL_CHANGE_KEY, "wortin_dirty.anon");
});

test("the shipped database migration enforces authenticated row ownership for progress", () => {
  const migration = fs.readFileSync(path.resolve(__dirname, "..", "supabase/migrations/20261025065829_user_progress_security.sql"), "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /Users read own progress[\s\S]*?using\s*\(\s*\(select auth\.uid\(\)\)\s*=\s*user_id\s*\)/i);
  assert.match(migration, /Users insert own progress[\s\S]*?with check\s*\(\s*\(select auth\.uid\(\)\)\s*=\s*user_id\s*\)/i);
  assert.match(migration, /Users update own progress[\s\S]*?with check\s*\(\s*\(select auth\.uid\(\)\)\s*=\s*user_id\s*\)/i);
  assert.match(migration, /revoke all on table public\.user_progress from anon, public/i);
});


test("listening renderer preserves lesson questions and has exactly one active definition", () => {
  const media = fs.readFileSync(path.resolve(__dirname, "..", "learning-media.js"), "utf8");
  assert.equal([...media.matchAll(/function renderListening\\(\\)\\{/g)].length, 1);
  assert.match(media, /Array\.isArray\(v\.questions\)/);
  assert.match(media, /data-answer=/);
});
