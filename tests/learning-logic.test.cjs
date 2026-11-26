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

test("incorrect answers apply a partial lapse, preserve ease factor and schedule a short retry", () => {
  const addLocalDays = appFunction("addLocalDays");
  const scheduleReview = appFunction("scheduleReview", () => 0, { addLocalDays });
  const now = 1_800_000_000_000;
  const next = scheduleReview({ known: true, repetitions: 5, interval: 30, easeFactor: 2.5, seen: 4 }, false, now);
  assert.equal(next.known, false);
  assert.equal(next.interval, 6);
  assert.equal(next.repetitions, 0);
  assert.equal(next.easeFactor, 2.3);
  assert.equal(next.lapses, 1);
  assert.equal(next.due, now + 10 * 60 * 1000);
  assert.equal(next.seen, 5);
});

test("mastery requires five correct reviews and intervals expand with a 180-day cap", () => {
  const addLocalDays = appFunction("addLocalDays");
  const scheduleReview = appFunction("scheduleReview", () => 0, { addLocalDays });
  const now = 1_800_000_000_000;
  let state = scheduleReview({}, true, now);
  assert.equal(state.repetitions, 1);
  assert.equal(state.interval, 1);
  assert.equal(state.due, addLocalDays(now, 1));
  assert.equal(state.known, false);
  state = scheduleReview(state, true, now);
  assert.equal(state.repetitions, 2);
  assert.equal(state.interval, 3);
  assert.equal(state.known, false);
  state = scheduleReview(state, true, now);
  assert.equal(state.interval, 7);
  assert.equal(state.known, false);
  state = scheduleReview(state, true, now);
  assert.equal(state.interval, 18);
  assert.equal(state.known, false);
  state = scheduleReview(state, true, now);
  assert.equal(state.interval, 45);
  assert.equal(state.known, true);
  for (let i = 0; i < 20 && state.interval < 180; i++) state = scheduleReview(state, true, now);
  assert.equal(state.interval, 180);
  assert.ok(state.interval <= 180);
});

test("progress status classification uses a precomputed progress object", () => {
  const statusForProgress = appFunction("statusForProgress");
  const now = 1_800_000_000_000;
  assert.equal(statusForProgress({ seen: 0, known: false, due: 0 }, now), "new");
  assert.equal(statusForProgress({ seen: 2, known: false, due: 0 }, now), "due");
  assert.equal(statusForProgress({ seen: 2, known: false, due: now - 1 }, now), "due");
  assert.equal(statusForProgress({ seen: 2, known: false, due: now + 1 }, now), "learning");
  assert.equal(statusForProgress({ seen: 5, known: true, due: now + 1 }, now), "mastered");
});

test("vocabulary search indexes build in bounded batches without losing records", async () => {
  const words = Array.from({ length: 3400 }, (_, index) => ({
    id: index + 1,
    word: "Wort" + (index + 1),
    meaning_fa: "معنی " + (index + 1),
    examples_de: ["Beispiel " + (index + 1)],
    extra_examples_de: [],
    example_de: "",
    thematic_group: "Gruppe"
  }));
  const { fn: rebuildWordIndexes, context } = appFunctionWithContext("rebuildWordIndexes", {
    words,
    wordById: new Map(),
    wordSearchIndex: new Map(),
    searchForms: value => [String(value).toLocaleLowerCase("de")],
    setTimeout: callback => callback()
  });

  await rebuildWordIndexes();
  assert.equal(context.wordById.size, 3400);
  assert.equal(context.wordSearchIndex.size, 3400);
  assert.equal(context.wordById.get("250").word, "Wort250");
  assert.match(context.wordSearchIndex.get("3400"), /beispiel 3400/);
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


test("legacy ID and record-code progress is merged into a shared lexical key", () => {
  const mergeWordProgress = appFunction("mergeWordProgress");
  const { fn, context } = appFunctionWithContext("migrateProgressKeys", {
    words: [
      { id: "1", record_code: "A1", progress_key: "A" },
      { id: "2", record_code: "A2", progress_key: "A" }
    ],
    progress: {
      words: {
        "1": { saved: false, repetitions: 2, interval: 3, _updatedAt: 10 },
        A1: { saved: true, repetitions: 4, interval: 18, _updatedAt: 20 },
        "2": { repetitions: 1, interval: 1, _updatedAt: 15 },
        A2: { saved: false, repetitions: 5, interval: 45, _updatedAt: 30 }
      }
    },
    wordProgressKey: word => String(word.progress_key || word.record_code || word.id),
    mergeWordProgress,
    persistProgress: () => {}
  });
  fn();
  assert.deepEqual(Object.keys(context.progress.words), ["A"]);
  assert.equal(context.progress.words.A.saved, true);
  assert.equal(context.progress.words.A.repetitions, 5);
  assert.equal(context.progress.words.A.known, true);
});

test("UTC day keys do not shift when the local timezone changes", () => {
  const dayKey = appFunction("dayKey");
  assert.equal(dayKey(new Date("2026-11-25T23:30:00.000Z")), "2026-11-25");
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
    progress: { words: {} },
    daily: {},
    migrateProgressKeys: () => {},
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
  assert.equal(media.split("function renderListening(){").length - 1, 1);
  assert.match(media, /Array\.isArray\(v\.questions\)/);
  assert.match(media, /data-answer=/);
});


test("new account passwords require at least ten characters including letters and numbers", () => {
  const isStrongPassword = appFunction("isStrongPassword");
  assert.equal(isStrongPassword("Abcdef1234"), true);
  assert.equal(isStrongPassword("1234567890"), false);
  assert.equal(isStrongPassword("abcdefghij"), false);
  assert.equal(isStrongPassword("Abc123"), false);
  assert.equal(isStrongPassword("Abcdef123"), false);
});


test("auth trigger keeps its visible text as its accessible name", () => {
  assert.doesNotMatch(app, /\$\("authOpen"\)\.setAttribute\("aria-label"/);
});
