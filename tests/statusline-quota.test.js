import { test, expect } from "bun:test";
import { normalizeStatuslineQuota } from "../scripts/collect-claude-quota.mjs";
import { mkdtempSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const now = Date.now();
test("release verifier includes the real quota bridge regression suite", () => {
  const verifier = readFileSync(path.resolve(import.meta.dir, "../scripts/release-verify.sh"), "utf8");
  expect(verifier).toMatch(/^bun test tests\/$/m);
  expect(verifier).toContain("--require-browser");
  for (const name of ["engine-verify.yml", "windows-build.yml"]) {
    expect(readFileSync(path.resolve(import.meta.dir, "../.github/workflows", name), "utf8")).toMatch(/run: bun test tests\/\s*\n/);
  }
});
const window = (used = 28, reset = now / 1000 + 3600) => ({ used_percentage: used, resets_at: reset });
test("statusline collector persists only provider quota, not context or private input", () => {
  const result = normalizeStatuslineQuota({ rate_limits: { five_hour: window(), seven_day: window(17) }, context_window: { used_percentage: 99 }, prompt: "SECRET", session_id: "PRIVATE" }, now);
  expect(result.five_hour.utilization).toBe(28);
  expect(result.seven_day.utilization).toBe(17);
  expect(result.observedAt).toBe(now);
  expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE|context_window/);
});
test("missing or invalid quota cannot become zero or overwrite a good observation", () => {
  for (const input of [{}, {context_window: {used_percentage: 28}}, {rate_limits: {five_hour: window(null)}}, {rate_limits: {five_hour: window("28")}}, {rate_limits: {five_hour: window(101)}}, {rate_limits: {five_hour: window(28, now / 1000 - 1)}}]) {
    expect(normalizeStatuslineQuota(input, now)).toBeNull();
  }
  expect(normalizeStatuslineQuota({rate_limits: {five_hour: window(0)}}, now).five_hour.utilization).toBe(0);
});

test("bridge writes privately and leaves timestamps unchanged for missing or repeated payloads", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "tokenjuice-quota-test-"));
  const script = path.resolve(import.meta.dir, "../scripts/collect-claude-quota.mjs");
  const file = path.join(base, "tokenjuice-statusline-quota.json");
  const run = (input) => spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: "utf8", env: {...process.env, CLAUDE_CONFIG_DIR: base} });
  try {
    run({context_window: {used_percentage: 90}});
    expect(existsSync(file)).toBe(false);
    const input = {rate_limits: {five_hour: window()}, prompt: "SECRET"};
    expect(run(input).stdout).toBe("");
    const content = readFileSync(file, "utf8"), at = statSync(file).mtimeMs;
    expect(content).not.toContain("SECRET");
    if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
    run(input);
    run({});
    expect(readFileSync(file, "utf8")).toBe(content);
    expect(statSync(file).mtimeMs).toBe(at);
  } finally { rmSync(base, {recursive: true, force: true}); }
});
