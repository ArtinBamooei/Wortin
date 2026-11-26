"use strict";

const fs = require("node:fs");

const BUDGETS = {
  mobile: {
    scores: { performance: 45, accessibility: 95, "best-practices": 95, seo: 95 },
    metrics: {
      "first-contentful-paint": 4500,
      "largest-contentful-paint": 5500,
      "total-blocking-time": 1400,
      "cumulative-layout-shift": 0.05
    }
  },
  desktop: {
    scores: { performance: 90, accessibility: 95, "best-practices": 95, seo: 95 },
    metrics: {
      "first-contentful-paint": 1500,
      "largest-contentful-paint": 2000,
      "total-blocking-time": 500,
      "cumulative-layout-shift": 0.05
    }
  }
};

function evaluateReport(report, mode) {
  const budget = BUDGETS[mode];
  if (!budget) throw new TypeError("Unknown Lighthouse mode: " + mode);
  const failures = [];
  const results = [];

  for (const [name, minimum] of Object.entries(budget.scores)) {
    const actual = report?.categories?.[name]?.score;
    const score = Number.isFinite(actual) ? Math.round(actual * 100) : null;
    results.push({ kind: "score", name, actual: score, budget: minimum });
    if (score === null || score < minimum) failures.push(mode + " " + name + " score " + (score ?? "missing") + " is below " + minimum);
  }

  for (const [name, maximum] of Object.entries(budget.metrics)) {
    const actual = report?.audits?.[name]?.numericValue;
    results.push({ kind: "metric", name, actual: Number.isFinite(actual) ? actual : null, budget: maximum });
    if (!Number.isFinite(actual) || actual > maximum) {
      failures.push(mode + " " + name + " " + (Number.isFinite(actual) ? actual.toFixed(2) : "missing") + " exceeds " + maximum);
    }
  }

  return { mode, failures, results };
}

function evaluateReports(mobile, desktop) {
  return [evaluateReport(mobile, "mobile"), evaluateReport(desktop, "desktop")];
}

function main(files) {
  if (files.length !== 2) {
    console.error("Usage: node scripts/check-lighthouse.cjs <mobile-report.json> <desktop-report.json>");
    process.exitCode = 2;
    return;
  }

  try {
    const reports = files.map(file => JSON.parse(fs.readFileSync(file, "utf8")));
    const checks = evaluateReports(reports[0], reports[1]);
    let failed = false;

    for (const check of checks) {
      console.log("\nLighthouse " + check.mode.toUpperCase() + " budget");
      for (const item of check.results) {
        const actual = item.actual === null ? "missing" : item.kind === "score" ? item.actual + "/100" : item.actual.toFixed(2);
        console.log("  " + item.name + ": " + actual + " (limit " + (item.kind === "score" ? ">= " : "<= ") + item.budget + (item.kind === "score" ? "/100" : "") + ")");
      }
      for (const failure of check.failures) {
        failed = true;
        console.error("  FAIL: " + failure);
      }
    }

    if (failed) process.exitCode = 1;
    else console.log("\nAll Lighthouse regression budgets passed.");
  } catch (error) {
    console.error("Could not validate Lighthouse reports:", error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { BUDGETS, evaluateReport, evaluateReports };
