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
const SECRET_EMAIL = "private.user@example.test";

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

function runWithEnv(overrides, ...args) {
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
      ...overrides,
    }),
  });
  if (r.status !== 0) throw new Error(`engine exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}
function run(...args) { return runWithEnv({}, ...args); }
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
  return p;
}

function claudeSession(model = "claude-test", contextTokens = 50000) {
  write(".claude/projects/-tmp-demo/aaaa1111.jsonl", [
    JSON.stringify({ type: "user", cwd: "/tmp/demo-proj", message: { role: "user", content: `${SECRET_PROMPT} ${SECRET_EMAIL}` } }),
    JSON.stringify({ type: "assistant", cwd: "/tmp/demo-proj", message: { model, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: contextTokens } } }),
  ].join("\n") + "\n");
}

function codexPaceSample({ at, primaryUsed = 10, secondaryUsed = 20, reset, secondaryReset = reset, minutes = 300, timestamp = true }) {
  const file = codexSession();
  const rows = readFileSync(file, "utf8").trim().split("\n").map((row) => JSON.parse(row));
  const event = rows.find((row) => row.payload?.rate_limits);
  if (timestamp) event.timestamp = new Date(at).toISOString();
  event.payload.rate_limits.primary = { used_percent: primaryUsed, window_minutes: minutes, resets_at: reset };
  event.payload.rate_limits.secondary = { used_percent: secondaryUsed, window_minutes: 10080, resets_at: secondaryReset };
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return file;
}
function codexProfileSample(dir, options, ageMin = 0) {
  const original = codexPaceSample(options);
  const rows = readFileSync(original, "utf8").trim().split("\n").map((row) => JSON.parse(row));
  rows[0].payload.model = `gpt-${dir.replace(/[^a-z]/g, "")}`;
  const file = write(`${dir}/sessions/fixture.jsonl`, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  utimesSync(file, (Date.now() - ageMin * 60000) / 1000, (Date.now() - ageMin * 60000) / 1000);
  return file;
}
const codexProfileList = () => [
  { id: "personal", name: "Personal", configDir: "~/.codex-personal" },
  { id: "work", name: "Work", configDir: "~/.codex-work" },
];

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
  expect(run()).toContain("NOW · Claude · Weekly · 60% left");
  expect(c.items.map((i) => i.used)).toEqual([20, 40]);
  expect(typeof c.lastSuccessAt).toBe("number");
  expect(j.contractVersion).toBe(2);
});

test("NOW ranks quota depletion and context occupancy in the same risk direction", () => {
  usage(200, okUsage(10, 85));
  expect(run().split("\n").find((line) => line.startsWith("NOW ·"))).toContain("Claude · Weekly · 15% left");
  cache("claude-0.json", {});
  usage(200, okUsage(95, 20));
  expect(run().split("\n").find((line) => line.startsWith("NOW ·"))).toContain("Claude · 5-hour · 5% left");
  codexSession({ usedPercent: 98 });
  const codexNow = run().split("\n").find((line) => line.startsWith("NOW ·"));
  expect(codexNow).toContain("Codex");
  expect(codexNow).toContain("2% left");
});

test("NOW shows high context before healthy quota but untrusted data before context", () => {
  usage(200, okUsage(10, 20));
  claudeSession("claude-test", 170000);
  expect(run().split("\n").find((line) => line.startsWith("NOW ·"))).toContain("Claude context · 85% used");
  config({ api: false });
  const local = write(".claude/usage-cache.json", okUsage(10, 20));
  const old = (Date.now() - 31 * 60000) / 1000;
  utimesSync(local, old, old);
  expect(run().split("\n").find((line) => line.startsWith("NOW ·"))).toContain("Claude · 업데이트 필요");
  config({ api: true });
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 10 }] });
  usage(500);
  expect(run().split("\n").find((line) => line.startsWith("NOW ·"))).toContain("Claude · 확인할 수 없음");
});

test("read-only API guard overrides persisted API configuration", () => {
  usage(200, okUsage(20, 40));
  runWithEnv({ CCB_DISABLE_API: "1" }, "--text");
  expect(calls()).toBe(0);
});

test("macOS doctor stays read-only and labels an update as a deliberate change", () => {
  const installer = readFileSync(path.join(ROOT, "install.sh"), "utf8");
  expect(installer).toContain('CCB_DISABLE_API=1 bun "$SELF_DIR/$SOURCE_PLUGIN" --text');
  expect(installer).toContain("doctor는 읽기 전용입니다");
  expect(installer).toContain("CCB_YES=1 ./install.sh");
  expect(installer).toContain("플러그인 교체·SwiftBar 실행·로그인/절전 에이전트 등록");
});

test("60s cache: a second render makes no new request", () => {
  usage(200, okUsage());
  run("--json"); run("--json");
  expect(calls()).toBe(1);
});

test("Claude API cache rejects future or invalid observations instead of fake fresh success", () => {
  config({ api: true, forecast: { enabled: true }, notify: { enabled: true, threshold: 20 } });
  usage(500);
  for (const field of ["at", "observedAt", "lastSuccessAt"]) {
    for (const value of [Date.now() + 60000, "99", true, [], {}, 0, -1, 1e20]) {
      cache("claude-0.fail.json", {});
      const reading = { ok: true, source: "api", at: Date.now() - 1000, items: [{ name: "5-hour", used: 99 }] };
      reading[field] = value;
      cache("claude-0.json", reading);
      const c = json().claude[0];
      expect(c.state).toBe("unavailable");
      expect(c.items).toEqual([]);
      expect(c.lastSuccessAt).toBeNull();
      expect(JSON.parse(run("--widget-snapshot")).claude[0].lastSuccessAt).toBeNull();
      run();
    }
  }
  expect(notifications()).toEqual([]);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
  expect(calls()).toBe(24);
  cache("claude-0.fail.json", {});
  cache("claude-0.json", '{"ok":true,"source":"api","at":1e999,"items":[{"name":"5-hour","used":99}]}');
  expect(json().claude[0].items).toEqual([]);
  expect(json().claude[0].lastSuccessAt).toBeNull();
  // A real successful refresh can replace rejected cached metadata.
  cache("claude-0.fail.json", {});
  usage(200, okUsage(20, 40));
  expect(json().claude[0].state).toBe("fresh");
  expect(json().claude[0].items.map((item) => item.used)).toEqual([20, 40]);
});

test("Claude local future mtime is unavailable and never becomes a successful observation", () => {
  config({ api: false, forecast: { enabled: true }, notify: { enabled: true } });
  const file = write(".claude/usage-cache.json", okUsage(99, 99));
  const future = (Date.now() + 60000) / 1000;
  utimesSync(file, future, future);
  write(".claude/cache/usage-cache.json", okUsage(20, 40));
  const c = json().claude[0];
  expect(c.state).toBe("unavailable");
  expect(c.reason).toBe("invalid_timestamp");
  expect(c.items).toEqual([]);
  expect(c.lastSuccessAt).toBeNull();
  expect(c.observedAt).toBeLessThanOrEqual(Date.now());
  expect(run()).toContain("사용량 기록 시각을 확인할 수 없어 숫자를 표시하지 않습니다");
  expect(notifications()).toEqual([]);
  expect(calls()).toBe(0);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
});

test("Claude observation validation preserves freshness boundaries and legacy nullable fields", () => {
  const items = [{ name: "5-hour", used: 20 }];
  usage(500);
  for (const age of [59000, 61000, 119 * 60000, 121 * 60000]) {
    cache("claude-0.fail.json", {});
    const at = Date.now() - age;
    cache("claude-0.json", { ok: true, source: "api", at, observedAt: null, lastSuccessAt: null, items });
    const c = json().claude[0];
    expect(c.state).toBe(age < 60000 ? "fresh" : "unavailable");
    expect(c.items.map(({ name, used }) => ({ name, used }))).toEqual(age < 120 * 60000 ? items : []);
    expect(c.lastSuccessAt).toBe(age < 120 * 60000 ? at : null);
  }
  cache("claude-0.fail.json", {});
  const earlier = Date.now() - 61000;
  cache("claude-0.json", { ok: true, source: "api", at: Date.now(), observedAt: earlier, lastSuccessAt: earlier, items });
  expect(json().claude[0].state).toBe("unavailable");
  expect(json().claude[0].lastSuccessAt).toBe(earlier);
  config({ api: false });
  const file = write(".claude/usage-cache.json", okUsage(20, 40));
  for (const age of [29 * 60000, 31 * 60000]) {
    const at = (Date.now() - age) / 1000;
    utimesSync(file, at, at);
    expect(json().claude[0].state).toBe(age < 30 * 60000 ? "fresh" : "stale");
  }
});

test("Claude bad API timestamps do not suppress valid fallback or promote failed Desktop reads", () => {
  usage(500);
  const old = Date.now() - 31 * 60000;
  const local = write(".claude/usage-cache.json", okUsage(20, 40));
  utimesSync(local, old / 1000, old / 1000);
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() + 60000, items: [{ name: "5-hour", used: 99 }] });
  const c = json().claude[0];
  expect(c.state).toBe("unavailable");
  expect(c.source).toBe("local");
  expect(c.items.map((item) => item.used)).toEqual([20, 40]);
  expect(Math.abs(c.lastSuccessAt - old)).toBeLessThan(2);
  if (process.platform !== "darwin") return;
  rmSync(path.join(home, ".claude"), { recursive: true });
  write("Library/Application Support/Claude/plan-usage-history.json", { samples: [{ t: Date.now() - 60000, u: { fh: 12, sd: 30 } }] });
  expect(json().claude[0].state).toBe("fallback");
  expect(json().claude[0].items.map((item) => item.used)).toEqual([12, 30]);
  write("Library/Application Support/Claude/plan-usage-history.json", { samples: [{ t: Date.now() + 60000, u: { fh: 12, sd: 30 } }] });
  const failed = json().claude[0];
  expect(failed.state).toBe("unavailable");
  expect(failed.lastSuccessAt).toBeNull();
  expect(failed.items).toEqual([]);
});

test("Claude rejects malformed API utilization without promoting old quota or emitting alerts", () => {
  config({ api: true, forecast: { enabled: true }, notify: { enabled: true, threshold: 20, forecast: true } });
  const previous = { ok: true, source: "api", at: Date.now() - 120000, items: [{ name: "5-hour", used: 20 }] };
  cache("claude-0.json", previous);
  for (const used of ["99", true, false, [], {}, -1, 101, "", SECRET_PROMPT, null]) {
    cache("claude-0.fail.json", {});
    usage(200, okUsage(used, 40));
    run();
    const c = json().claude[0];
    expect(c.state).toBe("unavailable");
    expect(c.reason).toBe("invalid_quota");
    expect(c.lastSuccessAt).toBeNull();
    expect(c.items).toEqual([]);
    expect(JSON.parse(run("--widget-snapshot")).claude[0].items).toEqual([]);
    expect(JSON.parse(readFileSync(path.join(home, ".cache/claude-codex-battery/claude-0.json"), "utf8"))).toEqual(previous);
  }
  for (const body of [null, true, [], "99", {}, { five_hour: [] }, { seven_day: 99 }, { five_hour: {} }, { five_hour: { utilization: 10 }, seven_day_opus: { utilization: "99" } }]) {
    cache("claude-0.fail.json", {});
    usage(200, body);
    expect(json().claude[0].reason).toBe("invalid_quota");
  }
  cache("claude-0.fail.json", {});
  writeFileSync(fx, '{"status":200,"body":{"five_hour":{"utilization":1e999}}}');
  expect(json().claude[0].reason).toBe("invalid_quota");
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
  expect(notifications()).toEqual([]);
  expect(run("--diagnostics")).not.toContain(SECRET_PROMPT);
});

test("Claude rejects malformed local and normalized caches before fallback or credential access", () => {
  config({ api: true, forecast: { enabled: true }, notify: { enabled: true } });
  usage(200, okUsage());
  cache("claude-0.json", { ok: true, source: "api", at: Date.now(), items: [{ name: "Weekly", used: 30 }] });
  const local = write(".claude/usage-cache.json", okUsage("99", 40));
  // A newer malformed cache must not fall through to a different local candidate.
  write(".claude/cache/usage-cache.json", okUsage(20, 40));
  for (const used of ["99", true, false, [], {}, -1, 101, "", null]) {
    write(".claude/usage-cache.json", okUsage(used, 40));
    const c = json().claude[0];
    expect(c.reason).toBe("invalid_quota");
    expect(c.items).toEqual([]);
    expect(c.lastSuccessAt).toBeNull();
  }
  const old = (Date.now() - 31 * 60000) / 1000;
  utimesSync(local, old, old);
  expect(json().claude[0].reason).toBe("invalid_quota");
  expect(calls()).toBe(0);
  rmSync(path.join(home, ".claude"), { recursive: true });
  for (const used of ["99", true, {}, -1, 101, null]) {
    cache("claude-0.json", { ok: true, source: "api", at: Date.now(), items: [{ name: "5-hour", used }] });
    const c = json().claude[0];
    expect(c.reason).toBe("invalid_quota");
    expect(c.lastSuccessAt).toBeNull();
    expect(c.items).toEqual([]);
  }
  // A bad old normalized cache is not a successful fallback after a real HTTP failure.
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 120000, items: [{ name: "5-hour", used: "99" }] });
  usage(500);
  expect(json().claude[0].lastSuccessAt).toBeNull();
  expect(json().claude[0].items).toEqual([]);
  run();
  expect(notifications()).toEqual([]);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
});

test("Claude malformed response backoff avoids repeated fetch and recovers only after retry", () => {
  usage(200, okUsage("99", 40));
  const first = json().claude[0];
  expect(first.reason).toBe("invalid_quota");
  expect(first.retryAt).toBeGreaterThan(Date.now());
  expect(run()).toContain("잘못된 사용량 형식으로 숫자를 표시하지 않습니다");
  usage(200, okUsage(0, 100));
  expect(json().claude[0].reason).toBe("invalid_quota");
  expect(calls()).toBe(1);
  cache("claude-0.fail.json", { reason: "invalid_quota", at: Date.now() - 61000, until: Date.now() - 1000 });
  expect(json().claude[0].items.map((item) => item.used)).toEqual([0, 100]);
  expect(json().claude[0].state).toBe("fresh");
  expect(calls()).toBe(2);
});

test("Claude numeric boundaries, optional windows and account isolation remain compatible", () => {
  config({ api: false });
  const valid = okUsage(0, 100);
  valid.seven_day_opus = null;
  valid.seven_day_sonnet = { utilization: null };
  write(".claude/usage-cache.json", valid);
  expect(json().claude[0].items.map((item) => item.used)).toEqual([0, 100]);
  write(".config/claude-codex-battery/accounts.json", [
    { name: "Personal", configDir: "~/.claude-personal" },
    { name: "Work", configDir: "~/.claude-work" },
  ]);
  write(".claude-personal/usage-cache.json", okUsage("99", 40));
  write(".claude-work/usage-cache.json", valid);
  expect(json().claude.map((account) => account.state)).toEqual(["unavailable", "fresh"]);
  expect(json().claude[1].items.map((item) => item.used)).toEqual([0, 100]);
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

test("each actionable Claude error presents one honest NEXT recovery", () => {
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 10 }] });
  usage(500);
  json(); // record the failed refresh before rendering its stale recovery panel
  const stale = run();
  expect(stale.match(/--NEXT · /g) || []).toHaveLength(1);
  expect(stale).toContain("NEXT · 메뉴를 다시 열어 최신 상태 확인");

  rmSync(path.join(home, ".cache/claude-codex-battery"), { recursive: true, force: true });
  config({ api: true, autoRenew: false });
  usage(401);
  const auth = run();
  expect(auth.match(/--NEXT · /g) || []).toHaveLength(1);
  expect(auth).toContain("NEXT · Claude Code에서 다시 로그인");
  expect(auth).not.toContain("Renew Claude login now");

  rmSync(path.join(home, ".cache/claude-codex-battery"), { recursive: true, force: true });
  usage(429, {}, { "retry-after": "3600" });
  const limited = run();
  expect(limited.match(/--NEXT · /g) || []).toHaveLength(1);
  expect(limited).toContain("NEXT · 다음 확인 가능 시각까지 기다리기");

  rmSync(path.join(home, ".cache/claude-codex-battery"), { recursive: true, force: true });
  config({ api: false });
  const missing = run();
  expect(missing.match(/--NEXT · /g) || []).toHaveLength(1);
  expect(missing).toContain("NEXT · Claude usage API 모드 켜기");

  config({ api: true });
  usage(500);
  const unavailable = run();
  expect(unavailable).not.toContain("--NEXT ·");
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

test("Claude Desktop rejects coerced or out-of-range samples without fake success", () => {
  if (process.platform !== "darwin") return;
  config({ api: false, forecast: { enabled: true }, notify: { enabled: true } });
  const file = "Library/Application Support/Claude/plan-usage-history.json";
  for (const used of [true, false, null, "", "  ", [], [99], {}, -1, 101, "101", SECRET_PROMPT]) {
    write(file, { samples: [{ t: Date.now() - 60000, u: { fh: used, sd: 30 } }] });
    const c = json().claude[0];
    expect(c.state).toBe("unavailable");
    expect(c.reason).toBe("invalid_quota");
    expect(c.lastSuccessAt).toBeNull();
    expect(c.items).toEqual([]);
    expect(JSON.parse(run("--widget-snapshot")).claude[0].items).toEqual([]);
  }
  write(file, '{"samples":[{"t":' + (Date.now() - 60000) + ',"u":{"fh":10,"sd":1e999}}]}');
  expect(json().claude[0].reason).toBe("invalid_quota");
  for (const history of [null, [], { samples: {} }, { samples: [null] }, { samples: [{ t: Date.now(), u: {} }] }]) {
    write(file, history);
    expect(json().claude[0].reason).toBe("invalid_quota");
  }
  run();
  expect(notifications()).toEqual([]);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
  expect(run("--diagnostics")).not.toContain(SECRET_PROMPT);
});

test("Claude Desktop invalid observation times cannot become last-success timestamps", () => {
  if (process.platform !== "darwin") return;
  config({ api: false });
  const file = "Library/Application Support/Claude/plan-usage-history.json";
  for (const at of [Date.now() + 60000, "bad time", null, true, [], 0, -1, 1e20]) {
    write(file, { samples: [{ t: at, u: { fh: 10, sd: 20 } }] });
    const c = json().claude[0];
    expect(c.state).toBe("unavailable");
    expect(c.reason).toBe("invalid_quota");
    expect(c.lastSuccessAt).toBeNull();
    expect(c.items).toEqual([]);
  }
  const oldAt = Date.now() - 3 * 3600000;
  config({ api: true });
  usage(500);
  write(file, { samples: [{ t: oldAt, u: { fh: 10, sd: 20 } }, { t: Date.now() + 60000, u: { fh: 99, sd: 99 } }] });
  const old = json().claude[0];
  // Preserve HTTP-failure precedence; only the valid historic success is retained.
  expect(old.state).toBe("unavailable");
  expect(old.lastSuccessAt).toBe(oldAt);
  expect(old.items).toEqual([]);
});

test("Claude Desktop preserves valid boundaries, numeric strings and source priority", () => {
  if (process.platform !== "darwin") return;
  config({ api: false });
  const file = "Library/Application Support/Claude/plan-usage-history.json";
  const at = Date.now() - 5 * 60000;
  write(file, { samples: [{ t: String(at), u: { fh: "0", sd: "100" } }] });
  const valid = json().claude[0];
  expect(valid.state).toBe("fallback");
  expect(valid.items.map((item) => item.used)).toEqual([0, 100]);
  expect(valid.lastSuccessAt).toBe(at);
  // Invalid rows are ignored; the existing valid-sample selection is preserved.
  write(file, { samples: [{ t: at, u: { fh: 12, sd: 30 } }, { t: Date.now(), u: { fh: null, sd: 99 } }] });
  expect(json().claude[0].items.map((item) => item.used)).toEqual([12, 30]);
  expect(json().claude[0].lastSuccessAt).toBe(at);
  write(file, { samples: [{ t: Date.now(), u: { fh: false, sd: 99 } }] });
  write(".claude/usage-cache.json", okUsage(20, 40));
  expect(json().claude[0].source).toBe("local");
  rmSync(path.join(home, ".claude"), { recursive: true });
  config({ api: true });
  usage(200, okUsage(30, 50));
  expect(json().claude[0].source).toBe("api");
  expect(json().claude[0].items.map((item) => item.used)).toEqual([30, 50]);
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

test("developer mode is explicit, read-only, and excludes prompt topics", () => {
  config({ api: true, forecast: { enabled: true }, sessionStatus: { enabled: true } });
  usage(200, okUsage());
  claudeSession();
  const details = run("--developer");
  expect(details).toContain("developer mode");
  expect(details).toContain("local pace estimate");
  expect(details).toContain("session claude");
  expect(details).not.toContain(SECRET_PROMPT);
  expect(details).not.toContain("implement the secret prompt");
});

test("statusline is opt-in, compact, and prompt-free", () => {
  config({ api: true, sessionStatus: { enabled: true } });
  usage(200, okUsage(20, 40));
  claudeSession();
  const statusline = run("--statusline").trim();
  expect(statusline).toContain("TokenJuice");
  expect(statusline).toContain("5-hour: 80% left");
  expect(statusline).toContain("context 25%");
  expect(statusline).not.toContain(SECRET_PROMPT);
  expect(statusline).not.toContain("\n");
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
  expect(menu).toContain("claude login renewal: auto");
  expect(menu).toMatch(/auto run .* · ok/);
});

test("401 with autoRenew off: nothing runs and the panel keeps one login action", async () => {
  if (process.platform !== "darwin") return;
  config({ api: true, autoRenew: false });
  usage(401);
  const menu = run();
  await sleep(300);
  expect(renewCalls().length).toBe(0);
  expect(menu).toContain("NEXT · Claude Code에서 다시 로그인");
  expect(menu).not.toContain("Renew Claude login now");
});

test("--renew-login runs on demand but not twice within a minute", async () => {
  if (process.platform !== "darwin") return;
  config({ api: true, autoRenew: false });
  expect(run("--renew-login").trim()).toBe("renew started");
  await waitFor(() => renewCalls().length === 1, "the manual background login renewal");
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
  expect(run("--notify-target-off=claude:0:5-hour")).toContain("enabled=false");
  expect(run("--notify-target-threshold=claude:0:5-hour=10")).toContain("threshold=10");
  expect(run("--notify-target-reset=claude:0:5-hour=off")).toContain("reset=false");
  const cfg = JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8"));
  expect(cfg.notify.overrides["claude:0:5-hour"]).toEqual({ enabled: false, threshold: 10, reset: false });
  const menu = run();
  expect(menu).toContain("Claude 5-hour: alerts off");
  expect(menu).toContain("Claude 5-hour threshold 10%");
  expect(menu).toContain("Claude 5-hour alerts on");
  expect(menu).toContain("next resets");
  expect(run("--notify-target-on=claude:0:5-hour")).toContain("enabled=true");
});

test("reconnect alert is account opt-in, transition-safe, and prompt-free", () => {
  config({ api: true, autoRenew: false, notify: { enabled: false } });
  usage(401);
  expect(run("--notify-account-reconnect=claude:0=on")).toContain("reconnect=true");
  run(); run();
  expect(notifications().length).toBe(1);
  expect(notifications()[0]).toContain("reconnect required");
  expect(notifications()[0]).toContain("reason login expired");
  expect(notifications()[0]).toContain("next action: run claude login");
  expect(notifications()[0]).toContain("last success never");
  expect(notifications()[0]).not.toContain(SECRET_PROMPT);
  expect(JSON.stringify(JSON.parse(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8")))).toContain("reconnect");
});

test("threshold alert fires once, reset alert fires once", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  usage(200, okUsage(85, 10));
  run(); run();
  expect(notifications().filter((n) => n.includes("5-hour")).length).toBe(1);
  expect(notifications()[0]).toContain("threshold alert");
  // limit resets → 5-hour back to 95% left
  cache("claude-0.json", {});
  usage(200, okUsage(5, 10));
  run(); run();
  const back = notifications().filter((n) => n.includes("is back"));
  expect(back.length).toBe(1);
  expect(back[0]).toContain("reset alert");
});

test("stale numbers never trigger an alert", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 99 }] });
  usage(500);
  run();
  expect(notifications()).toEqual([]);
});

test("reset-soon alert is explicit, once per known reset, and preserves threshold state", () => {
  config({ api: true, notify: { enabled: true, threshold: 20 } });
  expect(run("--notify-reset-soon=10")).toContain("resetSoonMinutes=10");
  const resets = new Date(Date.now() + 5 * 60000).toISOString();
  usage(200, { ...okUsage(85, 10), five_hour: { utilization: 85, resets_at: resets } });
  run(); run();
  expect(notifications().filter((n) => n.includes("reset soon"))).toHaveLength(1);
  expect(notifications().filter((n) => n.includes("threshold alert"))).toHaveLength(1);
  expect(notifications().find((n) => n.includes("reset soon"))).toContain("next action: wait for the reset");
  cache("claude-0.json", {});
  usage(200, { ...okUsage(5, 10), five_hour: { utilization: 5, resets_at: resets } });
  run(); run();
  expect(notifications().filter((n) => n.includes("reset soon"))).toHaveLength(1);
  expect(notifications().filter((n) => n.includes("reset alert"))).toHaveLength(1);
  cache("claude-0.json", {});
  usage(200, { ...okUsage(5, 10), five_hour: { utilization: 5, resets_at: new Date(Date.now() + 7 * 60000).toISOString() } });
  run(); run();
  expect(notifications().filter((n) => n.includes("reset soon"))).toHaveLength(2);
  const menu = run();
  expect(menu).toContain("Reset soon alerts: 10 min");
  expect(run("--notify-reset-soon=0")).toContain("resetSoonMinutes=0");
});

test("reset-soon ignores disabled, unknown, past, distant and non-fresh windows", () => {
  const sample = (resets) => ({ ...okUsage(50, 10), five_hour: { utilization: 50, resets_at: resets } });
  usage(200, sample(new Date(Date.now() + 5 * 60000).toISOString()));
  config({ api: true, notify: { enabled: true } });
  run(); // Global alerts do not opt the user in to the new alert.
  config({ api: true, notify: { enabled: false, resetSoonMinutes: 10 } });
  run();
  config({ api: true, notify: { enabled: true, resetSoonMinutes: 10 } });
  for (const resets of [null, "not a date", new Date(Date.now() - 60000).toISOString(), new Date(Date.now() + 60 * 60000).toISOString()]) {
    cache("claude-0.json", {}); usage(200, sample(resets)); run();
  }
  for (const status of [500, 401, 429]) {
    cache("claude-0.json", { ok: true, source: "api", at: Date.now() - 30 * 60000, items: [{ name: "5-hour", used: 50, resets: new Date(Date.now() + 5 * 60000).toISOString() }] });
    usage(status); run();
  }
  expect(notifications()).toEqual([]);
});

test("reset-soon window overrides can opt out and Codex Unix resets are supported", () => {
  config({ api: true, notify: { enabled: true, resetSoonMinutes: 10, overrides: { "claude:0:5-hour": { resetSoonMinutes: 0 } } } });
  usage(200, { ...okUsage(50, 10), five_hour: { utilization: 50, resets_at: new Date(Date.now() + 5 * 60000).toISOString() } });
  const codexPath = codexSession();
  const lines = readFileSync(codexPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const event = lines.find((line) => line.payload?.rate_limits);
  event.payload.rate_limits.primary.resets_at = Math.floor(Date.now() / 1000) + 5 * 60;
  writeFileSync(codexPath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
  run(); run();
  expect(notifications().filter((n) => n.includes("reset soon") && n.includes("Claude"))).toHaveLength(0);
  expect(notifications().filter((n) => n.includes("reset soon") && n.includes("Codex"))).toHaveLength(1);
});

test("invalid reset-soon settings leave config unchanged and read-only exports never alert", () => {
  config({ api: false, notify: { enabled: false } });
  const cfgFile = path.join(home, ".config/claude-codex-battery/config.json");
  const before = readFileSync(cfgFile, "utf8");
  for (const value of ["-1", "61", "1.5", "not-a-number"]) {
    const result = spawnSync(process.execPath, [ENGINE, `--notify-reset-soon=${value}`], { encoding: "utf8", env: engineEnv() });
    expect(result.status).toBe(1);
    expect(readFileSync(cfgFile, "utf8")).toBe(before);
  }
  config({ api: true, notify: { enabled: true, resetSoonMinutes: 10 } });
  usage(200, { ...okUsage(50, 10), five_hour: { utilization: 50, resets_at: new Date(Date.now() + 5 * 60000).toISOString() } });
  run("--json"); run("--text"); run("--widget-snapshot");
  expect(notifications()).toEqual([]);
});

test("forecast alert is separately opted in, labelled as an estimate, and once per quota reset", () => {
  config({ api: true, forecast: { enabled: true }, notify: { enabled: true, threshold: 1 } });
  const now = Date.now();
  cache("quota-history.json", { version: 1, observations: [
    { key: "0:Weekly", at: now - 2 * 3600e3, used: 45 },
    { key: "0:Weekly", at: now - 3600e3, used: 65 },
  ] });
  usage(200, okUsage(10, 85));
  run();
  expect(notifications()).toEqual([]); // Showing forecast does not opt in to alerts.
  expect(run("--notify-forecast-on")).toContain("forecast=true");
  run(); run();
  const alerts = notifications().filter((n) => n.includes("forecast alert"));
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain("local pace estimate");
  expect(alerts[0]).toContain("next action: save a checkpoint or wait");
  expect(alerts[0]).not.toContain(SECRET_PROMPT);
  expect(run()).toContain("Forecast alerts: on");
  expect(run("--notify-forecast-off")).toContain("forecast=false");
  run();
  expect(notifications().filter((n) => n.includes("forecast alert"))).toHaveLength(1);
  run("--notify-forecast-on");
  cache("claude-0.json", {});
  usage(200, { ...okUsage(10, 85), seven_day: { utilization: 85, resets_at: new Date(now + 4 * 86400e3).toISOString() } });
  run(); run();
  expect(notifications().filter((n) => n.includes("forecast alert"))).toHaveLength(2);
});

test("forecast alert requires history opt-in, enough samples, fresh data and a known future reset", () => {
  const now = Date.now();
  const history = { version: 1, observations: [
    { key: "0:Weekly", at: now - 2 * 3600e3, used: 45 },
    { key: "0:Weekly", at: now - 3600e3, used: 65 },
  ] };
  config({ api: true, notify: { enabled: true, threshold: 1, forecast: true } });
  cache("quota-history.json", history); usage(200, okUsage(10, 85)); run();
  config({ api: true, forecast: { enabled: true }, notify: { enabled: true, threshold: 1, forecast: true } });
  cache("quota-history.json", { version: 1, observations: [] }); run();
  for (const resets of [null, "not a date", new Date(now - 60000).toISOString(), new Date(now + 60000).toISOString()]) {
    cache("claude-0.json", {}); cache("quota-history.json", history);
    usage(200, { ...okUsage(10, 85), seven_day: { utilization: 85, resets_at: resets } }); run();
  }
  for (const status of [500, 401, 429]) {
    cache("quota-history.json", history);
    cache("claude-0.json", { ok: true, source: "api", at: now - 30 * 60000, items: [{ name: "Weekly", used: 85, resets: new Date(now + 3 * 86400e3).toISOString() }] });
    usage(status); run();
  }
  expect(notifications()).toEqual([]);
});

test("forecast target override and read-only exports cannot accidentally alert", () => {
  const now = Date.now();
  const settings = { api: true, forecast: { enabled: true }, notify: { enabled: true, threshold: 1, forecast: true, overrides: { "claude:0:Weekly": { forecast: false } } } };
  config(settings);
  cache("quota-history.json", { version: 1, observations: [
    { key: "0:Weekly", at: now - 2 * 3600e3, used: 45 },
    { key: "0:Weekly", at: now - 3600e3, used: 65 },
  ] });
  usage(200, okUsage(10, 85)); run();
  expect(notifications()).toEqual([]);
  config({ ...settings, notify: { ...settings.notify, overrides: {} } });
  run("--json"); run("--text"); run("--widget-snapshot");
  expect(notifications()).toEqual([]);
  run(); run();
  expect(notifications().filter((n) => n.includes("forecast alert"))).toHaveLength(1);
});

test("Codex pace needs separate consent and exports no session or account identifiers", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, forecast: { enabled: true }, notify: { enabled: true, forecast: true } });
  codexPaceSample({ at: now, reset });
  expect(json().codex.every((item) => item.forecast === null)).toBe(true);
  expect(existsSync(path.join(home, ".cache/claude-codex-battery/codex-quota-history.json"))).toBe(false);
  const claudeHistoryBefore = readFileSync(path.join(home, ".cache/claude-codex-battery/quota-history.json"), "utf8");
  config({ api: false, codexForecast: { enabled: true }, notify: { enabled: true, threshold: 1, forecast: true } });
  codexPaceSample({ at: now - 12 * 60000, reset });
  expect(json().codex.every((item) => item.forecast === null)).toBe(true);
  codexPaceSample({ at: now, reset, primaryUsed: 40, secondaryUsed: 50 });
  const output = json();
  expect(output.codex.map((item) => item.forecast.samples)).toEqual([2, 2]);
  expect(output.codex.every((item) => item.forecast.kind === "local_pace_estimate" && item.forecast.beforeReset)).toBe(true);
  expect(run()).toContain("Pace estimate (local, 2 samples)");
  expect(run("--developer")).toContain("Codex 5-hour: local pace estimate · samples=2");
  expect(JSON.parse(run("--widget-snapshot")).codex.items.every((item) => item.forecast.samples === 2)).toBe(true);
  run(); // Claude alert opt-in does not enable Codex forecast alerts.
  expect(notifications()).toEqual([]);
  expect(run("--notify-codex-forecast-on")).toContain("codexForecast=true");
  run("--json"); run("--text"); run("--widget-snapshot");
  expect(notifications()).toEqual([]);
  run(); run();
  expect(notifications().filter((n) => n.includes("forecast alert") && n.includes("Codex"))).toHaveLength(2);
  const history = JSON.parse(run("--codex-forecast-history"));
  expect(history.observations).toHaveLength(4);
  expect(new Set(history.observations.map((row) => row.key)).size).toBe(2);
  expect(history.observations.every((row) => /^cw_[a-f0-9]{64}$/.test(row.key) && Object.keys(row).sort().join(",") === "at,key,used")).toBe(true);
  expect(JSON.stringify(history)).not.toContain(home);
  expect(JSON.stringify(history)).not.toContain(SECRET_PROMPT);
  expect(JSON.stringify(history)).not.toContain(SECRET_EMAIL);
  expect(readFileSync(path.join(home, ".cache/claude-codex-battery/quota-history.json"), "utf8")).toBe(claudeHistoryBefore);
});

test("Codex pace rejects unknown, expired and stale reset samples, not file mtime", () => {
  const now = Date.now();
  config({ api: false, codexForecast: { enabled: true }, notify: { enabled: true, threshold: 1, codexForecast: true } });
  for (const options of [
    { at: now, reset: null }, { at: now, reset: 0 }, { at: now, reset: Math.floor(now / 1000) - 60 },
    { at: now, reset: Math.floor(now / 1000) + 7200, timestamp: false },
    { at: now - 30 * 60000, reset: Math.floor(now / 1000) + 7200 },
    { at: now + 60000, reset: Math.floor(now / 1000) + 7200 },
    { at: now, reset: Math.floor(now / 1000) + 7200, minutes: null, secondaryReset: null },
  ]) {
    codexPaceSample(options);
    expect(json().codex.every((item) => item.forecast === null)).toBe(true);
    run();
  }
  expect(JSON.parse(run("--codex-forecast-history")).observations).toEqual([]);
  expect(notifications()).toEqual([]);
});

test("Codex pace isolates reset periods and role keys even with identical display labels", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexForecast: { enabled: true }, notify: { enabled: true, threshold: 1, codexForecast: true } });
  codexPaceSample({ at: now - 12 * 60000, reset, minutes: 10080 }); json();
  codexPaceSample({ at: now, reset, minutes: 10080, primaryUsed: 40, secondaryUsed: 50 });
  expect(json().codex.map((item) => item.forecast.samples)).toEqual([2, 2]);
  run(); run();
  expect(notifications().filter((n) => n.includes("forecast alert"))).toHaveLength(2);
  codexPaceSample({ at: now, reset, minutes: 10080, primaryUsed: "40", secondaryUsed: 101 });
  expect(json().codex.every((item) => item.forecast === null)).toBe(true);
  codexPaceSample({ at: now + 1, reset: reset + 7200, minutes: 10080, primaryUsed: 5, secondaryUsed: 10 });
  expect(json().codex.every((item) => item.forecast === null)).toBe(true);
  const file = codexPaceSample({ at: now, reset, primaryUsed: 40, secondaryUsed: 50 });
  utimesSync(file, (now - 2 * 3600e3) / 1000, (now - 2 * 3600e3) / 1000);
  expect(json().codex.every((item) => item.forecast === null)).toBe(true);
});

test("Codex profiles keep the legacy view selected, export aliases safely and select without login", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  usage(200, okUsage(20, 20));
  config({ api: true, codexAccounts: codexProfileList(), codexSelectedAccount: "work", notify: { enabled: false } });
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: 90 });
  codexProfileSample(".codex-work", { at: now, reset, primaryUsed: 45 });
  const output = json();
  expect(output.codexAccounts.map((account) => [account.id, account.selected])).toEqual([["personal", false], ["work", true]]);
  expect(output.codex[0].used).toBe(45);
  expect(output.codexStatus.account).toBe("Work");
  expect(output.sessions.filter((session) => session.platform === "codex").map((session) => session.model)).toEqual(["gpt-codexwork"]);
  expect(JSON.stringify(output.codexAccounts)).not.toContain(home);
  expect(run()).toContain("NOW · Codex Personal · 5-hour · 10% left");
  expect(run()).toContain("param1=--select-codex-account=personal");
  expect(run()).toContain("Selected for X header, Windows and Pocket export");
  expect(JSON.parse(run("--widget-snapshot")).codex.items[0].name).toBe("Work · 5-hour");
  expect(run("--select-codex-account=personal")).toContain("no login or credential changes");
  expect(json().codex[0].used).toBe(90);
  const settings = readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8");
  expect(JSON.parse(settings).notify.enabled).toBe(false);
  expect(() => run("--select-codex-account=missing")).toThrow("engine exit 1");
  expect(readFileSync(path.join(home, ".config/claude-codex-battery/config.json"), "utf8")).toBe(settings);
  expect(renewCalls()).toEqual([]);
  expect(notifications()).toEqual([]);
});

test("Codex profile notification keys survive reordering and renaming without cross-account suppression", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200, profiles = codexProfileList();
  const settings = { api: false, codexAccounts: profiles, codexSelectedAccount: "work", notify: { enabled: true, threshold: 20 } };
  config(settings);
  for (const dir of [".codex-personal", ".codex-work"]) codexProfileSample(dir, { at: now, reset, minutes: 10080, primaryUsed: 99, secondaryUsed: 99 });
  run(); run();
  expect(notifications()).toHaveLength(4);
  config({ ...settings, codexAccounts: [{ ...profiles[1], name: "Office" }, profiles[0]] });
  run();
  expect(notifications()).toHaveLength(4);
  expect(json().codexStatus.account).toBe("Office");
  const state = JSON.parse(readFileSync(path.join(home, ".cache/claude-codex-battery/notify-state.json"), "utf8"));
  expect(Object.keys(state).filter((key) => key.startsWith("codex:")).sort()).toEqual(["codex:personal:primary", "codex:personal:secondary", "codex:work:primary", "codex:work:secondary"]);
});

test("Codex profile pace and overrides isolate identical windows while history stays opaque", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexAccounts: codexProfileList(), codexForecast: { enabled: true }, notify: { enabled: true, threshold: 1, codexForecast: true, overrides: { "codex:personal:primary": { enabled: false } } } });
  for (const dir of [".codex-personal", ".codex-work"]) codexProfileSample(dir, { at: now - 12 * 60000, reset });
  json();
  for (const dir of [".codex-personal", ".codex-work"]) codexProfileSample(dir, { at: now, reset, primaryUsed: 40, secondaryUsed: 50 });
  const output = json();
  expect(output.codexAccounts.flatMap((account) => account.items.map((item) => item.forecast.samples))).toEqual([2, 2, 2, 2]);
  run(); run();
  expect(notifications().filter((row) => row.includes("forecast alert"))).toHaveLength(3);
  expect(notifications().some((row) => row.includes("Personal 5-hour"))).toBe(false);
  const history = JSON.parse(run("--codex-forecast-history"));
  expect(history.observations).toHaveLength(8);
  expect(new Set(history.observations.map((row) => row.key)).size).toBe(4);
  expect(JSON.stringify(history)).not.toMatch(/personal|work|configDir|sessions|gpt-/);
  expect(JSON.stringify(history)).not.toContain(home);
});

test("invalid Codex manifests and selections fail closed without reading the healthy default account", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200, profiles = codexProfileList();
  codexSession({ usedPercent: 99 });
  for (const list of [[], {}, [profiles[0], profiles[0]], [profiles[0], { ...profiles[1], configDir: profiles[0].configDir }], [{ ...profiles[0], id: 1 }], [{ ...profiles[0], id: "default" }], [{ ...profiles[0], configDir: "relative" }], [{ ...profiles[0], name: "unsafe|bash=oops" }], Array.from({ length: 9 }, (_, index) => ({ id: `p${index}`, name: "P", configDir: `~/p${index}` }))]) {
    config({ api: false, codexAccounts: list });
    expect(json().codex).toEqual([]);
    expect(json().codexStatus.reason).toBe("invalid_profiles");
  }
  config({ api: false, codexAccounts: profiles, codexSelectedAccount: "missing" });
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: 90 });
  const output = json();
  expect(output.codex).toEqual([]);
  expect(output.codexStatus.reason).toBe("invalid_selection");
  expect(output.codexAccounts.every((account) => !account.selected)).toBe(true);
  expect(output.sessions.filter((session) => session.platform === "codex")).toEqual([]);
  expect(run()).toContain("choose a configured local profile below");
  expect(notifications()).toEqual([]);
});

test("Codex profiles preserve independent fresh, stale and unavailable states for alert gating", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexAccounts: [...codexProfileList(), { id: "empty", name: "Empty", configDir: "~/.codex-empty" }], notify: { enabled: true, threshold: 20 } });
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: 99, secondaryUsed: 99 });
  codexProfileSample(".codex-work", { at: now, reset, primaryUsed: 99, secondaryUsed: 99 }, 120);
  expect(json().codexAccounts.map((account) => account.state)).toEqual(["fresh", "stale", "unavailable"]);
  run();
  expect(notifications()).toHaveLength(2);
  expect(notifications().every((row) => row.includes("Personal"))).toBe(true);
});

test("Codex future quota mtime is not fresh or a successful observation", () => {
  config({ api: false, codexForecast: { enabled: true }, notify: { enabled: true, threshold: 20 } });
  const file = codexSession({ usedPercent: 99, ageMin: -1 });
  const older = write(".codex/sessions/older.jsonl", JSON.stringify({ rate_limits: { primary: { used_percent: 20 } } }));
  const old = (Date.now() - 120000) / 1000;
  utimesSync(older, old, old);
  const c = json();
  expect(c.codexStatus.state).toBe("unavailable");
  expect(c.codexStatus.reason).toBe("invalid_timestamp");
  expect(c.codexStatus.lastSuccessAt).toBeNull();
  expect(c.codexStatus.at).toBeUndefined(); // Existing status export has no at field.
  expect(c.codexStatus.observedAt).toBeLessThanOrEqual(Date.now());
  expect(c.codex).toEqual([]);
  expect(JSON.parse(run("--widget-snapshot")).codex.items).toEqual([]);
  expect(run()).toContain("사용량 기록 시각을 확인할 수 없어 숫자를 표시하지 않습니다");
  expect(notifications()).toEqual([]);
  expect(JSON.parse(run("--codex-forecast-history")).observations).toEqual([]);
  // A subsequent real, valid file observation recovers without changing quota.
  const now = (Date.now() - 1000) / 1000;
  utimesSync(file, now, now);
  expect(json().codexStatus.state).toBe("fresh");
  expect(json().codex[0].used).toBe(99);
});

test("Codex quota mtime validation keeps profile isolation and the one-hour boundary", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexAccounts: codexProfileList(), notify: { enabled: true, threshold: 20 } });
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: 99 }, -1);
  codexProfileSample(".codex-work", { at: now, reset, primaryUsed: 99, secondaryUsed: 99 });
  expect(json().codexAccounts.map((account) => account.state)).toEqual(["unavailable", "fresh"]);
  run();
  expect(notifications()).toHaveLength(2);
  expect(notifications().every((row) => row.includes("Work"))).toBe(true);
  config({ api: false });
  for (const ageMin of [59, 61]) {
    codexSession({ ageMin, usedPercent: 40 });
    expect(json().codexStatus.state).toBe(ageMin < 60 ? "fresh" : "stale");
    expect(json().codex[0].used).toBe(40);
  }
});

test("Codex rejects malformed quota percentages before reset inference, export and alerts", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexForecast: { enabled: true }, notify: { enabled: true, threshold: 20, codexForecast: true } });
  for (const used of ["99", true, false, [], {}, -1, 101, "", SECRET_PROMPT]) {
    codexPaceSample({ at: now, reset, primaryUsed: used, secondaryUsed: 50 });
    run();
    expect(notifications()).toEqual([]);
    const output = json();
    expect(output.codexStatus.state).toBe("unavailable");
    expect(output.codexStatus.reason).toBe("invalid_quota");
    expect(output.codexStatus.lastSuccessAt).toBeNull();
    expect(output.codex).toEqual([]);
    const snapshot = JSON.parse(run("--widget-snapshot"));
    expect(snapshot.codex.state).toBe("unavailable");
    expect(snapshot.codex.items).toEqual([]);
    run();
  }
  codexPaceSample({ at: now, reset: Math.floor(now / 1000) - 60, primaryUsed: "99" });
  expect(json().codexStatus.reason).toBe("invalid_quota"); // not inferred as reset/0% used
  expect(JSON.parse(run("--codex-forecast-history")).observations).toEqual([]);
  expect(run("--diagnostics")).not.toContain(SECRET_PROMPT);
  expect(notifications()).toEqual([]);
});

test("Codex does not fall back to an older good quota after a malformed newest reading", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, notify: { enabled: true } });
  const file = codexPaceSample({ at: now - 60000, reset, primaryUsed: 20 });
  const rows = readFileSync(file, "utf8").trim().split("\n");
  const invalid = JSON.parse(rows[1]);
  invalid.timestamp = new Date(now).toISOString();
  invalid.payload.rate_limits.secondary.used_percent = 101;
  writeFileSync(file, `${rows.join("\n")}\n${JSON.stringify(invalid)}\n`);
  expect(json().codexStatus.reason).toBe("invalid_quota");
  expect(json().codex).toEqual([]);
  // JSON allows a large numeric exponent; reject Infinity instead of exporting null/live.
  writeFileSync(file, `${rows.join("\n")}\n${JSON.stringify(invalid).replace('"used_percent":101', '"used_percent":1e999')}\n`);
  expect(json().codexStatus.reason).toBe("invalid_quota");
  run();
  expect(notifications()).toEqual([]);
});

test("invalid Codex quota is isolated per profile and valid 0/100 boundaries remain provider values", () => {
  const now = Date.now(), reset = Math.floor(now / 1000) + 7200;
  config({ api: false, codexAccounts: codexProfileList(), notify: { enabled: true, threshold: 20 } });
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: "99" });
  codexProfileSample(".codex-work", { at: now, reset, primaryUsed: 99, secondaryUsed: 99 });
  expect(json().codexAccounts.map((account) => account.state)).toEqual(["unavailable", "fresh"]);
  run();
  expect(notifications()).toHaveLength(2);
  expect(notifications().every((row) => row.includes("Work"))).toBe(true);
  codexProfileSample(".codex-personal", { at: now, reset, primaryUsed: 0, secondaryUsed: 100 });
  const output = json();
  expect(output.codexStatus.state).toBe("fresh");
  expect(output.codex.map((item) => item.used)).toEqual([0, 100]);
});

test("Codex malformed quota panel explains failure instead of claiming no session", () => {
  config({ api: false });
  codexSession({ usedPercent: "99" });
  const menu = run();
  expect(menu).toContain("잘못된 사용량 형식으로 숫자를 표시하지 않습니다");
  expect(menu).not.toContain("No session data yet");
  expect(menu).not.toContain("% left");
  expect(json().codexStatus.lastSuccessAt).toBeNull();
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

test("high context offers one explicit local checkpoint handoff", () => {
  usage(200, okUsage());
  claudeSession("claude-test", 168000); // 84% of the 200k Claude context window
  const menu = run();
  expect(menu).toContain("checkpoint 권장 · checkpoint용 로컬 스냅샷 내보내기");
  expect(menu).toContain("param1=--export-widget-snapshot");
  expect(menu).toContain("로컬 파일만 생성");
  expect(menu).not.toContain("자동으로 새 세션");
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

test("local provider invalid chosen observation never becomes fresh quota or last success", () => {
  const bad = write("exports/bad.json", {});
  const good = write("exports/good.json", { items: [{ name: "Monthly", used: 20 }] });
  config({ api: false, forecast: { enabled: true }, notify: { enabled: true }, providers: [
    { id: "bad", label: "Bad", usageFile: bad }, { id: "good", label: "Good", usageFile: good },
  ] });
  for (const observedAt of [Date.now() + 60000, String(Date.now() + 60000), 1e20, 0, -1]) {
    writeFileSync(bad, JSON.stringify({ observedAt, items: [{ name: "Monthly", used: 99 }] }));
    const c = json().providers[0];
    expect(c.state).toBe("unavailable");
    expect(c.reason).toBe("invalid_timestamp");
    expect(c.items).toEqual([]);
    expect(c.lastSuccessAt).toBeNull();
    expect(c.observedAt).toBeLessThanOrEqual(Date.now());
    const snapshot = JSON.parse(run("--widget-snapshot"));
    expect(snapshot.providers[0].items).toEqual([]);
    expect(snapshot.providers[0].lastSuccessAt).toBeNull();
    expect(snapshot.providers[1].state).toBe("fresh");
  }
  writeFileSync(bad, JSON.stringify({ items: [{ name: "Monthly", used: 99 }] }));
  const future = (Date.now() + 60000) / 1000;
  utimesSync(bad, future, future);
  expect(json().providers[0].reason).toBe("invalid_timestamp");
  expect(json().providers[0].items).toEqual([]);
  expect(json().providers[0].lastSuccessAt).toBeNull();
  run();
  expect(notifications()).toEqual([]);
  expect(calls()).toBe(0);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
});

test("local provider observation guard preserves conversion, mtime fallback and age boundaries", () => {
  const file = write("exports/local.json", {});
  config({ api: false, providers: [{ id: "local", label: "Local", usageFile: file }] });
  for (const age of [14, 16, 119, 121]) {
    const at = Date.now() - age * 60000;
    writeFileSync(file, JSON.stringify({ observedAt: String(at), items: [{ name: "Monthly", used: "42" }] }));
    const c = json().providers[0];
    expect(c.state).toBe(age < 15 ? "fresh" : age < 120 ? "stale" : "unavailable");
    expect(c.items.map((item) => item.used)).toEqual(age < 120 ? [42] : []);
    expect(c.lastSuccessAt).toBe(at);
  }
  for (const payload of [{}, { observedAt: "not-a-time" }]) {
    writeFileSync(file, JSON.stringify({ ...payload, items: [{ name: "Monthly", used: 42 }] }));
    expect(json().providers[0].state).toBe("fresh"); // Existing selected-mtime fallback.
  }
  expect(json().providers[0].source).toBe("external-local-file");
});

test("local provider invalid-file cannot manufacture a successful read", () => {
  const bad = write("exports/bad.json", {});
  const goodAt = Date.now() - 60000;
  const good = write("exports/good.json", { observedAt: goodAt, items: [{ name: "Monthly", used: 20 }] });
  config({ api: false, forecast: { enabled: true }, notify: { enabled: true }, providers: [
    { id: "bad", label: "Bad", usageFile: bad }, { id: "good", label: "Good", usageFile: good },
  ] });
  for (const age of [1, 121]) {
    const at = Date.now() - age * 60000;
    for (const items of [undefined, null, {}, [], [{ name: 42, used: 99 }], [{ name: "Monthly", used: 101 }]]) {
      writeFileSync(bad, JSON.stringify({ observedAt: at, items, topic: SECRET_PROMPT }));
      const c = json().providers[0];
      expect(c.reason).toBe("invalid-file");
      expect(c.state).toBe("unavailable");
      expect(c.items).toEqual([]);
      expect(c.lastSuccessAt).toBeNull();
      expect(c.observedAt).toBe(at); // File observation is not a successful quota read.
      const snapshot = JSON.parse(run("--widget-snapshot"));
      expect(snapshot.providers[0].items).toEqual([]);
      expect(snapshot.providers[0].lastSuccessAt).toBeNull();
      expect(snapshot.providers[1].lastSuccessAt).toBe(goodAt);
      expect(snapshot.providers[1].state).toBe("fresh");
      expect(run("--diagnostics")).toContain("provider:bad: unavailable · user-selected local usage file · last success never · reason invalid-file");
      expect(JSON.stringify(snapshot)).not.toContain(SECRET_PROMPT);
    }
  }
  run();
  expect(calls()).toBe(0);
  expect(notifications()).toEqual([]);
  expect(JSON.parse(run("--forecast-history")).observations).toEqual([]);
});

test("local provider success diagnostics preserve old valid observations but never failed ones", () => {
  const file = write("exports/local.json", {});
  config({ api: false, providers: [{ id: "local", label: "Local", usageFile: file }] });
  for (const age of [1, 16, 121]) {
    const at = Date.now() - age * 60000;
    writeFileSync(file, JSON.stringify({ observedAt: at, items: [{ name: "Monthly", used: "42" }] }));
    const c = json().providers[0];
    expect(c.lastSuccessAt).toBe(at);
    expect(c.reason ?? null).toBe(age > 120 ? "too-old" : null);
    expect(run("--diagnostics")).not.toContain("last success never · reason too-old");
    // A failed replacement cannot reuse that observation as success.
    writeFileSync(file, JSON.stringify({ observedAt: at, items: [] }));
    expect(json().providers[0].lastSuccessAt).toBeNull();
    expect(run("--diagnostics")).toContain("last success never · reason invalid-file");
  }
  writeFileSync(file, JSON.stringify({ observedAt: Date.now() + 60000, items: [{ name: "Monthly", used: 42 }] }));
  expect(run("--diagnostics")).toContain("last success never · reason invalid_timestamp");
  writeFileSync(file, "not-json");
  expect(json().providers[0].lastSuccessAt).toBeNull();
  expect(run("--diagnostics")).toContain("last success never · reason unreadable-file");
});

test("compact mode is an explicit safe layout override", () => {
  usage(200, okUsage());
  const r = spawnSync(process.execPath, [ENGINE, "--diagnostics"], {
    encoding: "utf8", timeout: 30000,
    env: engineEnv({ CCB_COMPACT: "1", CCB_API: "", CCB_TEST_USAGE_FIXTURE: fx }),
  });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("compact true");
  const menu = spawnSync(process.execPath, [ENGINE], { encoding: "utf8", env: engineEnv({ CCB_COMPACT: "1", CCB_API: "", CCB_TEST_USAGE_FIXTURE: fx }) });
  expect(menu.stdout).toContain("Compact header key · C = Claude");
  expect(menu.stdout).toContain("S = no active context");
  expect(menu.stdout).toContain("X = Codex");
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
  for (const o of outs) {
    expect(o).not.toContain(SECRET_PROMPT);
    expect(o).not.toContain(SECRET_EMAIL);
  }
  const d = outs[3];
  expect(d).toContain("claude[0]: fresh · trust live");
  expect(d).toContain("config: api=true");
});

// ── R5 · wake helper debounce ────────────────────────────────────────────
function helper(now, running) {
  const r = spawnSync("/bin/sh", [HELPER], { encoding: "utf8", env: { ...process.env, TJ_STATE_DIR: path.join(home, "tj"), TJ_DRY_RUN: "1", TJ_NOW: String(now), TJ_SWIFTBAR_RUNNING: running ? "1" : "0" } });
  if (r.status !== 0) throw new Error(`wake helper exit ${r.status}: ${r.stderr}`);
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

macOnlyTest("wake helper repairs malformed tick state without losing a valid refresh debounce", () => {
  for (const value of ["not a timestamp", "", "1000\n1001", "1+1", "0x20", "08", "-5", "999999999999999999999999999999", SECRET_PROMPT]) {
    write("tj/last-tick", value);
    write("tj/last-refresh", "990");
    expect(refreshes(helper(1000, true))).toBe(0);
    expect(readFileSync(path.join(home, "tj/last-tick"), "utf8").trim()).toBe("1000");
    expect(readFileSync(path.join(home, "tj/last-refresh"), "utf8").trim()).toBe("990");
    expect(refreshes(helper(1015, true))).toBe(0);
  }
  expect(refreshes(helper(1600, true))).toBe(1);
  expect(refreshes(helper(1615, true))).toBe(0);
});

macOnlyTest("installed source check is read-only and catches stale wake helpers independently", () => {
  const plugin = write("installed files/plugin.js", readFileSync(ENGINE, "utf8").replace(/^.*\n/, "#!/synthetic/bun\n"));
  const wake = write("installed files/wake.sh", readFileSync(HELPER, "utf8"));
  const check = () => spawnSync("/bin/bash", [path.join(ROOT, "scripts/check-installed-sources.sh"), plugin, wake], { encoding: "utf8" });
  expect(check().status).toBe(0);
  const marker = path.join(home, "should-not-execute");
  writeFileSync(wake, `#!/bin/sh\ntouch '${marker}'\n`);
  const stale = check();
  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain("절전 복구 스크립트 불일치");
  expect(stale.stdout).toContain("SwiftBar 설치본이 소스와 일치");
  expect(existsSync(marker)).toBe(false);
  writeFileSync(wake, readFileSync(HELPER, "utf8"));
  writeFileSync(plugin, `#!/bin/sh\ntouch '${marker}'\n`);
  expect(check().status).toBe(1);
  expect(check().stderr).toContain("플러그인 본문 불일치");
  expect(existsSync(marker)).toBe(false);
  rmSync(plugin); rmSync(wake);
  const absent = check();
  expect(absent.status).toBe(0); // Missing installs remain an explicit external gate.
  expect(absent.stdout).toContain("신규 설치·실기기 검증은 별도");
  expect(absent.stdout).toContain("절전 복귀 검증은 미완료");
});

macOnlyTest("wake helper reinitializes malformed refresh state once and restores idle suppression", () => {
  for (const value of ["not a timestamp", "", "1000\n1001", "1+1", "0x20", "08", "-5", "999999999999999999999999999999", SECRET_PROMPT]) {
    write("tj/last-tick", "900");
    write("tj/last-refresh", value);
    const output = helper(1000, true);
    expect(refreshes(output)).toBe(1);
    expect(output).not.toContain(SECRET_PROMPT);
    expect(readFileSync(path.join(home, "tj/last-refresh"), "utf8").trim()).toBe("1000");
    expect(refreshes(helper(1015, true))).toBe(0);
    expect(refreshes(helper(1620, true))).toBe(1);
    expect(refreshes(helper(1630, true))).toBe(0);
  }
});
