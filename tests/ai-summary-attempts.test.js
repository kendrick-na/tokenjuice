import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDailySummaryAttempts } from "../scripts/ai-summary-attempts.mjs";
const hostTest = process.platform === "win32" ? test.skip : test;

hostTest("attempt counts persist independently of price and lower limits never reset the day", () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-attempt-test-"));
  const now = () => Date.parse("2026-10-12T12:00:00Z");
  try {
    const ledger = createDailySummaryAttempts({ directory, dailyLimit: 2, now });
    expect(ledger.snapshot().remaining).toBe(2);
    expect(ledger.reserve()).toMatchObject({ used: 1, remaining: 1 });
    const reopened = createDailySummaryAttempts({ directory, dailyLimit: 2, now });
    expect(reopened.snapshot()).toMatchObject({ used: 1, remaining: 1 });
    const lower = createDailySummaryAttempts({ directory, dailyLimit: 1, now });
    expect(lower.snapshot().remaining).toBe(0);
    expect(() => lower.reserve()).toThrow("daily_summary_attempts_exceeded");
    expect(reopened.reserve().remaining).toBe(0);
    expect(() => reopened.reserve()).toThrow("daily_summary_attempts_exceeded");
    const raw = readFileSync(join(directory, "daily-attempts.json"), "utf8");
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["attempts", "day", "lastAt", "version"]);
    expect(raw).not.toMatch(/model|price|prompt|subject/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

hostTest("attempt rollover is UTC and same-day clock rollback fails closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-attempt-test-"));
  let stamp = Date.parse("2026-10-12T23:59:59Z");
  try {
    const ledger = createDailySummaryAttempts({ directory, dailyLimit: 1, now: () => stamp });
    expect(ledger.reserve().resetsAt).toBe(Date.parse("2026-10-13T00:00:00Z"));
    stamp -= 1; expect(() => ledger.snapshot()).toThrow("attempt_clock_rollback");
    stamp = Date.parse("2026-10-13T00:00:00Z");
    expect(ledger.snapshot()).toMatchObject({ used: 0, remaining: 1, day: "2026-10-13" });
    expect(ledger.reserve().remaining).toBe(0);
    stamp = NaN; expect(() => ledger.snapshot()).toThrow("invalid_attempt_clock");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

hostTest("corrupt, locked, symlink, public and legacy money-only storage cannot show a fake allowance", () => {
  for (const mode of ["corrupt", "lock", "symlink", "public", "legacy"]) {
    const directory = mkdtempSync(join(tmpdir(), "tokenjuice-attempt-test-"));
    try {
      const ledger = createDailySummaryAttempts({ directory, dailyLimit: 2 });
      if (mode === "corrupt") writeFileSync(join(directory, "daily-attempts.json"), "null", { mode: 0o600 });
      if (mode === "lock") writeFileSync(join(directory, "daily-attempts.lock"), "", { mode: 0o600 });
      if (mode === "symlink") { writeFileSync(join(directory, "target"), "{}", { mode: 0o600 }); symlinkSync(join(directory, "target"), join(directory, "daily-attempts.json")); }
      if (mode === "public") chmodSync(directory, 0o755);
      if (mode === "legacy") writeFileSync(join(directory, "daily-budget.json"), "{}", { mode: 0o600 });
      expect(() => ledger.snapshot()).toThrow(mode === "legacy" ? "attempt_migration_required" : "attempt_ledger_unavailable");
      expect(() => ledger.reserve()).toThrow(mode === "legacy" ? "attempt_migration_required" : "attempt_ledger_unavailable");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

hostTest("independent OS processes cannot overcommit one attempt counter", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-attempt-test-"));
  const moduleURL = new URL("../scripts/ai-summary-attempts.mjs", import.meta.url).href;
  const source = `import {createDailySummaryAttempts} from ${JSON.stringify(moduleURL)};
    try {createDailySummaryAttempts({directory:process.argv[1],dailyLimit:3}).reserve();process.exit(0);}catch{process.exit(2);}`;
  try {
    const results = await Promise.all(Array.from({ length: 12 }, async () => {
      const child = Bun.spawn([process.execPath, "--eval", source, directory], { stdout: "ignore", stderr: "ignore" });
      return child.exited;
    }));
    expect(results.filter(code => code === 0).length).toBeLessThanOrEqual(3);
    expect(results.filter(code => code === 0).length).toBeGreaterThan(0);
    const snapshot = createDailySummaryAttempts({ directory, dailyLimit: 3 }).snapshot();
    expect(snapshot.used).toBe(results.filter(code => code === 0).length);
    expect(snapshot.remaining).toBe(3 - snapshot.used);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
