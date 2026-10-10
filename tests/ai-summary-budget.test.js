import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDailySummaryBudget } from "../scripts/ai-summary-budget.mjs";
const budgetTest = process.platform === "win32" ? test.skip : test;

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-budget-test-"));
  try { run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
budgetTest("daily reservations survive restart and share the limit between instances", () => fixture(directory => {
  const config = { directory, dailyMaxUSD: 0.03 };
  const first = createDailySummaryBudget(config);
  expect(first.reserve(0.02).remainingUSD).toBe(0.01);
  const restarted = createDailySummaryBudget(config);
  expect(() => restarted.reserve(0.02)).toThrow("daily_summary_budget_exceeded");
  expect(restarted.reserve(0.01).remainingUSD).toBe(0);
  expect(() => first.reserve(0.000001)).toThrow("daily_summary_budget_exceeded");
  expect(lstatSync(join(directory, "daily-budget.json")).mode & 0o777).toBe(0o600);
  expect(Object.keys(JSON.parse(readFileSync(join(directory, "daily-budget.json"), "utf8"))).sort())
    .toEqual(["day", "reservedMicros", "version"]);
}));
budgetTest("UTC rollover resets reservations but clock rollback fails closed", () => fixture(directory => {
  let clock = Date.UTC(2026, 9, 11, 23, 59);
  const ledger = createDailySummaryBudget({ directory, dailyMaxUSD: 0.01, now: () => clock });
  ledger.reserve(0.01);
  clock += 60000;
  expect(ledger.reserve(0.01).day).toBe("2026-10-12");
  clock -= 60000;
  expect(() => ledger.reserve(0.01)).toThrow("budget_clock_rollback");
}));
budgetTest("locked or corrupt ledgers never permit spend and do not erase evidence", () => fixture(directory => {
  const ledger = createDailySummaryBudget({ directory, dailyMaxUSD: 0.1 });
  const lock = join(directory, "daily-budget.lock");
  writeFileSync(lock, "existing process", { mode: 0o600 });
  expect(() => ledger.reserve(0.01)).toThrow("budget_lock_unavailable");
  expect(readFileSync(lock, "utf8")).toBe("existing process");
  rmSync(lock);
  const file = join(directory, "daily-budget.json");
  writeFileSync(file, "corrupt", { mode: 0o600 });
  expect(() => ledger.reserve(0.01)).toThrow("invalid_budget_file");
  expect(readFileSync(file, "utf8")).toBe("corrupt");
}));
budgetTest("public directories and symlink ledger files are rejected", () => fixture(directory => {
  chmodSync(directory, 0o755);
  expect(() => createDailySummaryBudget({ directory, dailyMaxUSD: 0.1 })).toThrow("budget_directory_not_private");
  chmodSync(directory, 0o700);
  const target = join(directory, "target.json");
  writeFileSync(target, "private", { mode: 0o600 });
  symlinkSync(target, join(directory, "daily-budget.json"));
  const ledger = createDailySummaryBudget({ directory, dailyMaxUSD: 0.1 });
  expect(() => ledger.reserve(0.01)).toThrow("invalid_budget_file");
  expect(readFileSync(target, "utf8")).toBe("private");
}));
