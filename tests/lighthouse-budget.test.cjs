"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { BUDGETS, evaluateReports } = require("../scripts/check-lighthouse.cjs");

function report(mode, overrides = {}) {
  const budget = BUDGETS[mode];
  const categories = Object.fromEntries(Object.entries(budget.scores).map(([name, score]) => [name, { score: score / 100 }]));
  const audits = Object.fromEntries(Object.entries(budget.metrics).map(([name, value]) => [name, { numericValue: value }]));
  return {
    categories: { ...categories, ...(overrides.categories || {}) },
    audits: { ...audits, ...(overrides.audits || {}) }
  };
}

test("Lighthouse budget accepts a report exactly on every measured regression boundary", () => {
  const result = evaluateReports(report("mobile"), report("desktop"));
  assert.deepEqual(result.map(item => item.failures), [[], []]);
});

test("Lighthouse budget rejects score and metric regressions", () => {
  const mobile = report("mobile", {
    categories: { performance: { score: 0.44 } },
    audits: { "largest-contentful-paint": { numericValue: 5501 } }
  });
  const desktop = report("desktop", {
    categories: { accessibility: { score: 0.94 } },
    audits: { "cumulative-layout-shift": { numericValue: 0.06 } }
  });
  const [mobileResult, desktopResult] = evaluateReports(mobile, desktop);
  assert.equal(mobileResult.failures.length, 2);
  assert.equal(desktopResult.failures.length, 2);
});

test("Lighthouse budget rejects missing audit measurements", () => {
  const missingMetric = report("mobile");
  delete missingMetric.audits["total-blocking-time"];
  const [result] = evaluateReports(missingMetric, report("desktop"));
  assert.ok(result.failures.some(message => message.includes("total-blocking-time") && message.includes("missing")));
});
