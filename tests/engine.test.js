// R15 regression suite: runs the real engine against a throwaway HOME full of
// fixtures. No network, no keychain, no real Claude CLI, no notifications:
//   CCB_TEST_USAGE_FIXTURE  canned usage-endpoint response (+ call log)
//   CCB_CLAUDE_BIN          fake claude that only records it was called
//   CCB_TEST_NOTIFY_LOG     notifications are appended here instead of shown
// Run: bun test tests/
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";

const ROOT = path.resolve(import.meta.dir, "..");
const ENGINE = path.join(ROOT, "claude-codex-battery.5s.js");
const HELPER = path.join(ROOT, "scripts", "ensure-swiftbar-visible.sh");
const SECRET_PROMPT = "TOPSECRET_PROMPT_TEXT_42";

let home, fx, copilotFx;

function write(rel, content) {
  const p = path.join(home, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content));
  return p;
}
function config(obj) { write(".config/claude-codex-battery/config.json", obj); }
function usage(status, body = {}, headers = {}) { writeFileSync(fx, JSON.stringify({ status, body, headers })); }
function calls() { return existsSync(fx + ".calls") ? readFileSync(fx + ".calls", "utf8").trim().split("\n").filter(Boolean).length : 0; }
function copilotUsage(status, body = {}, headers = {}) { writeFileSync(copilotFx, JSON.stringify({ status, body, headers })); }
function copilotCalls() { return existsSync(copilotFx + ".calls") ? readFileSync(copilotFx + ".calls", "utf8").trim().split("\n").filter(Boolean).length : 0; }
function cache(name, obj) { return write(`.cache/claude-codex-battery/${name}`, obj); }
// Node/Bun resolves os.homedir() from HOME on Unix but USERPROFILE on Windows.
// Keep every spawned engine process inside this test's throwaway home on both.
function engineEnv(overrides = {}) {
  return { ...process.env, HOME: home, USERPROFILE: home, ...overrides };
}

function run(...args) {
  const r = spawnSync(process.execPath, [ENGINE, ...args], {
    encoding: "utf8",
    timeout: 30000,
    env: engineEnv({
      CCB_COMPACT: "0",
      CCB_API: "",
      CCB_TOPICS: "",
      CCB_TEST_USAGE_FIXTURE: fx,
      CCB_TEST_COPILOT_FIXTURE: copilotFx,
      CCB_CLAUDE_BIN: path.join(home, "fake-claude"),
      CCB_TEST_NOTIFY_LOG: path.join(home, "notify.log"),
    }),
  });
  if (r.status !== 0) throw new Error(`engine exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}
const json = () => JSON.parse(run("--json"));
const notifications = () => existsSync(path.join(home, "notify.log")) ? readFileSync(path.join(home, "notify.log"), "utf8").trim().split("\n").filter(Boolean) : [];
const renewCalls = () => existsSync(path.join(home, "fake-claude.log")) ? readFileSync(path.join(home, "fake-claude.log"), "utf8").trim().split("\n").filter(Boolean) : [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(condition, description, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (condition()) return;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${description}`);
}

const okUsage = (fiveUsed = 20, weekUsed = 40) => ({
  five_hour: { utilization: fiveUsed, resets_at: new Date(Date.now() + 3 * 3600e3).toISOString() },
  seven_day: { utilization: weekUsed, resets_at: new Date(Date.now() + 3 * 86400e3).toISOString() },
});

function codexSession({ usedPercent = 40, ageMin = 1, complete = false } = {}) {
  const entries = [
    JSON.stringify({ type: "turn_context", payload: { cwd: "/tmp/demo-proj", model: "gpt-test" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "token_count",
      info: { last_token_usage: { total_tokens: 64600 }, model_context_window: 258400 },
      rate_limits: { primary: { used_percent: usedPercent, window_minutes: 10080, resets_at: Math.floor(Date.now() / 1000) + 86400 }, secondary: null, plan_type: "plus" } } }),
  ];
  if (complete) entries.push(JSON.stringify({ type: "event_msg", payload: { type: "task_complete" } }));
  const p = write(".codex/sessions/2026/10/08/rollout-2026-10-08T00-00-00-01a0aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl", entries.join("\n") + "\n");
  const t = (Date.now() - ageMin * 60000) / 1000;
  utimesSync(p, t, t);
}

function claudeSession(model = "claude-test") {
  write(".claude/projects/-tmp-demo/aaaa1111.jsonl", [
    JSON.stringify({ type: "user", cwd: "/tmp/demo-proj", message: { role: "user", content: SECRET_PROMPT } }),
    JSON.stringify({ type: "assistant", cwd: "/tmp/demo-proj", message: { model, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 50000 } } }),
  ].join("\n") + "\n");
}

beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), "tj-test-"));
  fx = path.join(home, "usage-fixture.json");
  copilotFx = path.join(home, "copilot-fixture.json");
  const fake = write("fake-claude", `#!/bin/sh\necho "$*" >> "${path.join(home, "fake-claude.log")}"\nexit 0\n`);
  chmodSync(fake, 0o755);
  config({ api: true });
});
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

// ── R1/R2/R16 · state, timestamps, trust ────────────────────────────────
test("fresh API reading is live and provider-reported", () => {
  usage(200, okUsage(20, 40));
  const j = json();
  const c = j.claude[0];
  expect(c.state).toBe("fresh");
  expect(c.source).toBe("api");
  expect(c.kind).toBe("quota");
  expect(c.trust.level).toBe("live");
  expect(c.items.map((i) => i.used)).toEqual([20, 40]);
  expect(typeof c.lastSuccessAt).toBe("number");
  expect(j.contractVersion).toBe(2);
});

test("60s cache: a second render makes no new request", () => {
  usage(200, okUsage());
  run("--json"); run("--json");
  expect(calls()).toBe(1);
});

test("old good value after a failure is stale, never live", () => {
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 10 }, { name: "Weekly", used: 35 }] });
  usage(500);
  const c = json().claude[0];
  expect(c.stale).toBe(true);
  expect(c.state).not.toBe("fresh");
  expect(["stale", "blocked", "unavailable"]).toContain(c.trust.level);
  const text = run("--text");
  expect(text).toMatch(/C\((stale|unavailable)\)/);
  expect(text).not.toMatch(/C\((stale|unavailable)\) [█░]+ \d+%/);
});

test("value older than 2h is not shown at all", () => {
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 3 * 3600e3, items: [{ name: "5-hour", used: 10 }] });
  usage(500);
  expect(json().claude[0].items).toEqual([]);
});

test("recent Claude Desktop sample is a labelled fallback", () => {
  // Claude Desktop writes this history under macOS Library/Application
  // Support. Linux/Windows intentionally do not treat a fixture at that path
  // as a provider source, so the fallback contract is macOS-only.
  if (process.platform !== "darwin") return;
  write("Library/Application Support/Claude/plan-usage-history.json", { version: 2, samples: [{ t: Date.now() - 5 * 60000, u: { fh: 12, sd: 30 } }] });
  usage(500);
  const c = json().claude[0];
  expect(c.state).toBe("fallback");
  expect(c.source).toBe("claude-app");
  expect(c.trust.level).toBe("fallback");
});

test("multiple Claude config directories keep their own local usage cache", () => {
  config({ api: false });
  write(".config/claude-codex-battery/accounts.json", [
    { name: "Personal", configDir: "~/.claude-personal" },
    { name: "Work", configDir: "~/.claude-work" },
  ]);
  write(".claude-personal/usage-cache.json", okUsage(10, 20));
  write(".claude-work/usage-cache.json", okUsage(30, 40));
  const j = json();
  expect(j.claude.map((c) => c.account)).toEqual(["Personal", "Work"]);
  expect(j.claude.map((c) => c.items[0].used)).toEqual([10, 30]);
  expect(j.claude.every((c) => c.state === "fresh")).toBe(true);
});

test("starter config is opt-out by default and never overwrites existing settings", () => {
  rmSync(path.join(home, ".config/claude-codex-battery/config.json"), { force: true });
  const firstRun = run();
  expect(firstRun).toContain("First setup · local data, safe defaults");
  expect(firstRun).toContain("Reads ~/.claude and ~/.codex local logs");
  expect(firstRun).toContain("Keychain API, alerts, auto-renew and prompt topics are off");
  expect(firstRun).toContain("tokens, prompts and code are never stored by TokenJuice");
  expect(run("--init-config")).toContain("starter config created");
  expect(run()).not.toContain("First setup · local data, safe defaults");
  expect(JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8"))).toEqual({
    api: false, topics: false, autoRenew: false,
    notify: { enabled: false, threshold: 20, reset: true },
  });
  config({ api: true });
  expect(run("--init-config")).toContain("config already exists");
  expect(JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8"))).toEqual({ api: true });
});

test("macOS keychain lookup uses an argument vector, never a shell-built config value", () => {
  const source = readFileSync(ENGINE, "utf8");
  expect(source).toContain('execFileSync("/usr/bin/security", args');
  expect(source).not.toContain('security find-generic-password -s "${svc}"');
});

test("macOS notifications pass text to osascript without a shell", () => {
  const source = readFileSync(ENGINE, "utf8");
  expect(source).toContain('execFileSync("/usr/bin/osascript", ["-e", script]');
  expect(source).not.toContain('execSync(`osascript -e');
});

test("pace forecast is opt-in, local-only, and resets its baseline after a quota reset", () => {
  config({ api: true, forecast: { enabled: true } });
  const now = Date.now();
  cache("quota-history.json", { version: 1, observations: [
    { key: "0:Weekly", at: now - 3 * 3600e3, used: 25 },
    { key: "0:Weekly", at: now - 2 * 3600e3, used: 45 },
    { key: "0:Weekly", at: now - 1 * 3600e3, used: 65 },
  ] });
  usage(200, okUsage(10, 85));
  const weekly = json().claude[0].items.find((item) => item.name === "Weekly");
  expect(weekly.forecast.kind).toBe("local_pace_estimate");
  expect(weekly.forecast.samples).toBeGreaterThanOrEqual(3);
  expect(weekly.forecast.beforeReset).toBe(true);
  expect(weekly.forecast.usedPerHour).toBeGreaterThan(0);

  cache("quota-history.json", { version: 1, observations: [
    { key: "0:Weekly", at: now - 4 * 3600e3, used: 90 },
    { key: "0:Weekly", at: now - 3 * 3600e3, used: 10 }, // reset
    { key: "0:Weekly", at: now - 2 * 3600e3, used: 20 },
    { key: "0:Weekly", at: now - 1 * 3600e3, used: 30 },
  ] });
  usage(200, okUsage(10, 40));
  const afterReset = json().claude[0].items.find((item) => item.name === "Weekly");
  expect(afterReset.forecast.samples).toBeLessThanOrEqual(4);
  expect(afterReset.forecast.usedPerHour).toBeGreaterThan(0);
});

test("forecast history export is local, bounded to seven days, and prompt-free", () => {
  config({ forecast: { enabled: true } });
  cache("quota-history.json", { version: 1, observations: [
    { key: "0:5-hour", at: Date.now() - 2 * 86400000, used: 30 },
    { key: "0:5-hour", at: Date.now() - 8 * 86400000, used: 10 },
  ] });
  const history = JSON.parse(run("--forecast-history"));
  expect(history.format).toBe("tokenjuice-forecast-history-v1");
  expect(history.observations.length).toBe(1);
  expect(JSON.stringify(history)).not.toContain(SECRET_PROMPT);
});

// ── R4 · 429 back-off ────────────────────────────────────────────────────
test("429 honours Retry-After: no request until then, human countdown shown", () => {
  usage(429, {}, { "retry-after": "3600" });
  const j1 = json();
  expect(j1.claude[0].state).toBe("rate_limited");
  expect(j1.claude[0].retryAt - Date.now()).toBeGreaterThan(3500e3);
  for (let i = 0; i < 3; i++) run("--json");
  run();
  expect(calls()).toBe(1); // only the first render reached the endpoint
  const menu = run();
  expect(menu).toMatch(/retry in (59|60)m \(\d\d:\d\d\)|retry in 1h 00m/);
  expect(menu).toContain("그때까지 요청하지 않으며 자동으로 다시 확인합니다");
});

test("429 without Retry-After still backs off at least 5 minutes", () => {
  usage(429);
  const j = json();
  expect(j.claude[0].retryAt - Date.now()).toBeGreaterThan(4.5 * 60e3);
  run("--json");
  expect(calls()).toBe(1);
});

// ── R3 · login renewal policy ────────────────────────────────────────────
test("401 with autoRenew on: renews once in the background, never in a loop", async () => {
  if (process.platform !== "darwin") return; // 갱신 CLI는 macOS 키체인 흐름 전용
  config({ api: true, autoRenew: true });
  usage(401);
  const j = json();
  expect(j.claude[0].state).toBe("auth_expired");
  // spawn() is intentionally detached. Wait for its observable result instead
  // of assuming the test runner has scheduled the child within 500ms.
  await waitFor(() => renewCalls().length === 1, "the background login renewal");
  expect(renewCalls().length).toBe(1);
  expect(renewCalls()[0]).toContain("-p /usage");
  expect(renewCalls()[0]).toContain("--no-session-persistence");
  // after the short retry window, another 401 must not start a second renew
  cache("claude-0.fail.json", { until: 0 });
  run("--json");
  await sleep(300);
  expect(renewCalls().length).toBe(1);
  const menu = run();
  expect(menu).toContain("Login renewal: auto");
  expect(menu).toMatch(/auto run .* · ok/);
});

test("401 with autoRenew off: nothing runs, manual action is offered", async () => {
  if (process.platform !== "darwin") return;
  config({ api: true, autoRenew: false });
  usage(401);
  const menu = run();
  await sleep(300);
  expect(renewCalls().length).toBe(0);
  expect(menu).toContain("Login renewal: manual");
  expect(menu).toContain("param1=--renew-login");
});

test("--renew-login runs on demand but not twice within a minute", async () => {
  if (process.platform !== "darwin") return;
  config({ api: true, autoRenew: false });
  expect(run("--renew-login").trim()).toBe("renew started");
  await sleep(300);
  expect(renewCalls().length).toBe(1);
  const r = spawnSync(process.execPath, [ENGINE, "--renew-login"], { encoding: "utf8", env: engineEnv({ CCB_CLAUDE_BIN: path.join(home, "fake-claude"), CCB_COMPACT: "0" }) });
  expect(r.stdout).toContain("skipped");
  expect(renewCalls().length).toBe(1);
});

// ── R6 · opt-in notifications ────────────────────────────────────────────
test("notifications are off by default", () => {
  usage(200, okUsage(95, 95));
  run();
  expect(notifications()).toEqual([]);
});

test("notification policy can be changed through explicit local menu commands", () => {
  const on = run("--notify-on");
  expect(on).toContain("enabled=true");
  expect(run("--notify-threshold=30")).toContain("threshold=30");
  expect(run("--notify-reset-off")).toContain("reset=false");
  const cfg = JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8"));
  expect(cfg.notify).toEqual({ enabled: true, threshold: 30, reset: false });
  expect(run("--notify-off")).toContain("enabled=false");
});

test("notification overrides inherit global policy and target-specific threshold", () => {
  config({ api: true, notify: { enabled: true, threshold: 20, reset: true } });
  usage(200, okUsage());
  expect(run("--notify-target-threshold=claude:0:5-hour=10")).toContain("threshold=10");
  expect(run("--notify-target-reset=claude:0:5-hour=off")).toContain("reset=false");
  const cfg = JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8"));
  expect(cfg.notify.overrides["claude:0:5-hour"]).toEqual({ threshold: 10, reset: false });
  expect(run()).toContain("claude:0:5-hour");
});

test("threshold alert fires once, reset alert fires once", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  usage(200, okUsage(85, 10));
  run(); run();
  expect(notifications().filter((n) => n.includes("5-hour")).length).toBe(1);
  expect(notifications()[0]).toContain("15% left");
  // limit resets → 5-hour back to 95% left
  cache("claude-0.json", {});
  usage(200, okUsage(5, 10));
  run(); run();
  const back = notifications().filter((n) => n.includes("is back"));
  expect(back.length).toBe(1);
});

test("stale numbers never trigger an alert", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 99 }] });
  usage(500);
  run();
  expect(notifications()).toEqual([]);
});

test("--json and --text never send notifications", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  usage(200, okUsage(99, 99));
  run("--json"); run("--text");
  expect(notifications()).toEqual([]);
});

// ── R7 · quota vs context ────────────────────────────────────────────────
test("session context is labelled separately from plan quota", () => {
  usage(200, okUsage());
  claudeSession();
  codexSession();
  const j = json();
  expect(j.claude[0].kind).toBe("quota");
  expect(j.codexStatus.kind).toBe("quota");
  expect(j.sessions.length).toBeGreaterThan(0);
  for (const s of j.sessions) expect(s.kind).toBe("context");
  const menu = run();
  expect(menu).toContain("Claude plan limits · account quota");
  expect(menu).toContain("Claude session context · per conversation, not quota");
  expect(menu).toContain("Codex plan limits · account quota");
  expect(menu).toContain("local estimate · transcript tokens, not quota");
});

test("session status is opt-in and explicitly marked as a local heuristic", () => {
  config({ api: true, sessionStatus: { enabled: true } });
  usage(200, okUsage());
  claudeSession();
  codexSession({ complete: true });
  const j = json();
  expect(j.sessions.find((s) => s.platform === "claude").status).toBe("waiting_for_input");
  expect(j.sessions.find((s) => s.platform === "codex").status).toBe("completed");
  expect(run()).toContain("local heuristic, not provider state");
});

test("widget snapshot is an explicit local-only export with no prompt content", () => {
  usage(200, okUsage());
  claudeSession();
  const snapshot = JSON.parse(run("--widget-snapshot"));
  expect(snapshot.contractVersion).toBe(1);
  expect(snapshot.transport).toBe("local_export_only");
  expect(snapshot.claude[0].items.length).toBeGreaterThan(0);
  expect(snapshot.claude[0].items[0]).toHaveProperty("forecast");
  expect(snapshot.sessions.every((session) => session.kind === "context")).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain('"topic"');
  expect(JSON.stringify(snapshot)).not.toContain(SECRET_PROMPT);
  expect(run("--export-widget-snapshot")).toContain("widget snapshot exported locally");
  const stored = JSON.parse(readFileSync(path.join(home, ".cache/claude-codex-battery/widget-snapshot.json"), "utf8"));
  expect(stored.transport).toBe("local_export_only");
  expect(JSON.stringify(stored)).not.toContain(SECRET_PROMPT);
  const pocket = spawnSync(process.execPath, [ENGINE, "--open-pocket"], {
    encoding: "utf8", timeout: 30000,
    env: engineEnv({ CCB_COMPACT: "0", CCB_TEST_USAGE_FIXTURE: fx, CCB_TEST_NO_OPEN: "1" }),
  });
  expect(pocket.status).toBe(0);
  expect(pocket.stdout).toContain("widget snapshot exported locally");
});

test("encrypted sync bundle needs a one-shot passphrase and contains no plaintext snapshot", () => {
  usage(200, okUsage());
  claudeSession();
  const passphrase = "test-only sync passphrase";
  const r = spawnSync(process.execPath, [ENGINE, "--export-sync-bundle"], {
    encoding: "utf8", timeout: 30000,
    env: engineEnv({ CCB_COMPACT: "0", CCB_API: "", CCB_TEST_USAGE_FIXTURE: fx, TOKENJUICE_SYNC_PASSPHRASE: passphrase }),
  });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("encrypted sync bundle exported locally");
  expect(r.stdout).not.toContain(passphrase);
  const bundle = JSON.parse(readFileSync(path.join(home, ".cache/claude-codex-battery/widget-sync.tokenjuice"), "utf8"));
  expect(bundle.format).toBe("tokenjuice-sync-v1");
  expect(bundle.transport).toBe("encrypted_manual_transfer");
  expect(JSON.stringify(bundle)).not.toContain(SECRET_PROMPT);
  expect(JSON.stringify(bundle)).not.toContain('"used":20');
  const crypto = bundle.crypto;
  const key = pbkdf2Sync(passphrase, Buffer.from(crypto.salt, "base64"), crypto.iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(crypto.iv, "base64"));
  decipher.setAAD(Buffer.from("tokenjuice-sync-v1"));
  decipher.setAuthTag(Buffer.from(crypto.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(crypto.ciphertext, "base64")), decipher.final()]);
  const snapshot = JSON.parse(plaintext.toString("utf8"));
  expect(snapshot.transport).toBe("local_export_only");
  expect(JSON.stringify(snapshot)).not.toContain(SECRET_PROMPT);

  const noPassphrase = spawnSync(process.execPath, [ENGINE, "--export-sync-bundle"], {
    encoding: "utf8", timeout: 30000,
    env: engineEnv({ CCB_COMPACT: "0", CCB_API: "", CCB_TEST_USAGE_FIXTURE: fx }),
  });
  expect(noPassphrase.status).toBe(1);
  expect(noPassphrase.stderr).toContain("TOKENJUICE_SYNC_PASSPHRASE is required");
});

test("project report groups local context without inventing provider cost", () => {
  usage(200, okUsage());
  claudeSession();
  codexSession();
  const report = JSON.parse(run("--project-report"));
  expect(report.contractVersion).toBe(1);
  expect(report.scope).toContain("local sessions");
  expect(report.cost.state).toBe("unavailable");
  expect(report.projects.length).toBeGreaterThanOrEqual(2);
  expect(report.projects.every((project) => project.contextTokens > 0)).toBe(true);
  expect(JSON.stringify(report)).not.toContain(SECRET_PROMPT);
});

test("project report prices Claude turns only from an explicit local rate table", () => {
  usage(200, okUsage());
  // The fixture contains 10 input + 50,000 cache-read tokens for claude-test.
  config({ api: true, pricing: { "claude-test": { inputUsdPerM: 10, cacheReadUsdPerM: 1 } } });
  claudeSession();
  codexSession();
  const report = JSON.parse(run("--project-report"));
  expect(report.cost.state).toBe("partial"); // Codex remains intentionally unpriced.
  const claude = report.projects.find((project) => project.platform === "claude");
  expect(claude.cost.state).toBe("available");
  expect(claude.cost.currency).toBe("USD");
  expect(claude.cost.amountUsd).toBeCloseTo(0.0501, 6);
  const codex = report.projects.find((project) => project.platform === "codex");
  expect(codex.cost.state).toBe("unavailable");
  expect(JSON.stringify(report)).not.toContain(SECRET_PROMPT);
});

test("project pricing accepts the stable Claude model id when logs include a date suffix", () => {
  usage(200, okUsage());
  config({ api: true, pricing: { "claude-sonnet-4": { inputUsdPerM: 10, cacheReadUsdPerM: 1 } } });
  claudeSession("claude-sonnet-4-20250514");
  const report = JSON.parse(run("--project-report"));
  const claude = report.projects.find((project) => project.platform === "claude");
  expect(claude.cost.state).toBe("available");
  expect(claude.cost.amountUsd).toBeCloseTo(0.0501, 6);
});

test("Copilot spend reader is explicit, credential-free by default, and never calls it a quota", () => {
  usage(200, okUsage());
  copilotUsage(200, { total_amount: 12.5 });
  // A fixture exists, but a default configuration must not even call it.
  let j = json();
  expect(j.copilot.enabled).toBe(false);
  expect(copilotCalls()).toBe(0);

  config({ api: true, copilot: { enabled: true, username: "octo-user", tokenEnv: "TOKENJUICE_TEST_COPILOT", monthlyBudgetUsd: 20 } });
  j = json();
  expect(j.copilot.kind).toBe("cost");
  expect(j.copilot.provider).toBe("github-copilot");
  expect(j.copilot.state).toBe("fresh");
  expect(j.copilot.amountUsd).toBe(12.5);
  expect(j.copilot.usedPct).toBe(62.5);
  expect(copilotCalls()).toBe(1);
  const menu = run();
  expect(menu).toContain("monthly spend, not quota");
  expect(menu).toContain("voluntary budget");
  // The widget intentionally stays quota-only and never exports this token-backed source.
  expect(JSON.stringify(JSON.parse(run("--widget-snapshot")))).not.toContain("github-copilot");
});

test("local provider adapter reads only an explicit quota file and marks stale files", () => {
  usage(200, okUsage());
  const providerFile = write("exports/cursor-usage.json", {
    observedAt: Date.now(),
    items: [{ name: "Monthly", used: 42, resets: "2026-10-31T00:00:00.000Z" }],
  });
  config({ api: true, providers: [{ id: "cursor", label: "Cursor", usageFile: providerFile }] });
  let j = json();
  expect(j.providers).toHaveLength(1);
  expect(j.providers[0].state).toBe("fresh");
  expect(j.providers[0].items[0].used).toBe(42);
  expect(j.providers[0].source).toBe("external-local-file");
  expect(run()).toContain("no token, cookie, browser session, command, or network access");
  const snapshot = JSON.parse(run("--widget-snapshot"));
  expect(snapshot.providers[0].label).toBe("Cursor");

  const old = (Date.now() - 30 * 60000) / 1000;
  utimesSync(providerFile, old, old);
  // observedAt also controls freshness, so rewrite it old without changing the file schema.
  writeFileSync(providerFile, JSON.stringify({ observedAt: Date.now() - 30 * 60000, items: [{ name: "Monthly", used: 42 }] }));
  j = json();
  expect(j.providers[0].state).toBe("stale");
  expect(run("--text")).toContain("Cursor(stale)");
});

test("compact mode is an explicit safe layout override", () => {
  usage(200, okUsage());
  const r = spawnSync(process.execPath, [ENGINE, "--diagnostics"], {
    encoding: "utf8", timeout: 30000,
    env: engineEnv({ CCB_COMPACT: "1", CCB_API: "", CCB_TEST_USAGE_FIXTURE: fx }),
  });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("compact true");
});

// ── Codex states ─────────────────────────────────────────────────────────
test("Codex limits: fresh log is live, a 2h-old log is stale", () => {
  usage(200, okUsage());
  codexSession({ usedPercent: 40, ageMin: 1 });
  let j = json();
  expect(j.codex[0].used).toBe(40);
  expect(j.codexStatus.state).toBe("fresh");
  codexSession({ usedPercent: 40, ageMin: 120 });
  j = json();
  expect(j.codexStatus.state).toBe("stale");
  expect(j.codexStatus.trust.level).toBe("stale");
});

// ── R8 · diagnostics, privacy ────────────────────────────────────────────
test("diagnostics and every output stay free of prompt text", () => {
  usage(200, okUsage());
  claudeSession();
  const outs = [run(), run("--json"), run("--text"), run("--diagnostics")];
  for (const o of outs) expect(o).not.toContain(SECRET_PROMPT);
  const d = outs[3];
  expect(d).toContain("claude[0]: fresh · trust live");
  expect(d).toContain("config: api=true");
});

// ── R5 · wake helper debounce ────────────────────────────────────────────
function helper(now, running) {
  const r = spawnSync("/bin/sh", [HELPER], { encoding: "utf8", env: { ...process.env, TJ_STATE_DIR: path.join(home, "tj"), TJ_DRY_RUN: "1", TJ_NOW: String(now), TJ_SWIFTBAR_RUNNING: running ? "1" : "0" } });
  return r.stdout;
}
const refreshes = (o) => (o.match(/refreshallplugins/g) || []).length;

const macOnlyTest = process.platform === "win32" ? test.skip : test;
macOnlyTest("wake helper: idle ticks do nothing, one refresh per wake, debounced", () => {
  expect(refreshes(helper(1000, true))).toBe(1);   // first run
  expect(refreshes(helper(1015, true))).toBe(0);   // normal tick
  expect(refreshes(helper(1030, true))).toBe(0);
  expect(refreshes(helper(1600, true))).toBe(1);   // wake (570s gap)
  expect(refreshes(helper(1615, true))).toBe(0);
  const restarted = helper(1625, false);           // SwiftBar died 25s after a refresh
  expect(restarted).toContain("open -a /Applications/SwiftBar.app");
  expect(refreshes(restarted)).toBe(0);            // debounced
  expect(refreshes(helper(1700, false))).toBe(1);  // later restart refreshes
});
