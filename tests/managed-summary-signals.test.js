import { test, expect } from "bun:test";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { attachManagedSummarySignals } from "../scripts/managed-summary-signals.mjs";

async function waitFor(predicate) {
  const end = performance.now() + 2500;
  while (!predicate()) {
    if (performance.now() >= end) throw Error("synthetic_signal_event_timeout");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return predicate();
}
test("signal wiring is explicit, coalesces pending signals, and removes only owned listeners", async () => {
  const target = new EventEmitter(); let calls = 0, release, reports = [];
  const original = () => {};
  target.on("SIGTERM", original);
  const config = { target, host: { stop: timeout => { expect(timeout).toBe(100); calls++;
    return new Promise(resolve => { release = resolve; }); } }, timeoutMs: 100, onOutcome: value => reports.push(value) };
  for (const invalid of [0, 120001, "100"])
    expect(() => attachManagedSummarySignals({ ...config, timeoutMs: invalid })).toThrow("invalid_managed_signal_config");
  const attached = attachManagedSummarySignals(config);
  expect(() => attachManagedSummarySignals(config)).toThrow("invalid_managed_signal_config");
  target.emit("SIGTERM", "PRIVATE_EXTRA"); target.emit("SIGINT");
  expect(calls).toBe(1); expect(reports).toHaveLength(0);
  release({ stopped: true }); await waitFor(() => reports.length === 1);
  expect(reports).toEqual([{ signal: "SIGTERM", stopped: true }]); expect(Object.isFrozen(reports[0])).toBe(true);
  attached.dispose(); attached.dispose();
  expect(target.listeners("SIGTERM")).toEqual([original]); expect(target.listenerCount("SIGINT")).toBe(0);
  target.emit("SIGTERM"); expect(calls).toBe(1);
});

test("timeout/failure is unknown and a later explicit signal can recheck; detach cannot cancel accepted stop", async () => {
  const target = new EventEmitter(); let calls = 0, reports = [];
  const attached = attachManagedSummarySignals({ target, host: { stop: async () => {
    calls++; if (calls === 1) throw Error("PRIVATE_PROVIDER_KEY"); return { stopped: true };
  } }, onOutcome: value => reports.push(value) });
  target.emit("SIGTERM"); await waitFor(() => reports.length === 1);
  expect(reports[0]).toEqual({ signal: "SIGTERM", stopped: false });
  target.emit("SIGTERM"); await waitFor(() => reports.length === 2);
  expect(reports[1].stopped).toBe(true); expect(JSON.stringify(reports)).not.toContain("PRIVATE"); attached.dispose();
  let release, completed = false, observed = false;
  const pending = attachManagedSummarySignals({ target, host: { stop: () => new Promise(resolve => {
    release = () => { completed = true; resolve({ stopped: true }); };
  }) }, onOutcome: () => { observed = true; } });
  target.emit("SIGTERM"); pending.dispose(); release();
  await Promise.resolve(); expect(completed).toBe(true); expect(observed).toBe(false);
});

const posixTest = process.platform === "win32" ? test.skip : test;
test("failed installation rolls back only its listeners; observer failures do not expose shutdown errors", async () => {
  const target = new EventEmitter(), original = () => {};
  target.on("SIGINT", original);
  const on = target.on.bind(target);
  target.on = (signal, listener) => { if (signal === "SIGTERM") throw Error("PRIVATE_INSTALL_ERROR"); return on(signal, listener); };
  expect(() => attachManagedSummarySignals({ target, host: { stop: async () => ({ stopped: true }) } }))
    .toThrow("managed_signal_install_failed");
  expect(target.listeners("SIGINT")).toEqual([original]);
  target.on = on;
  let calls = 0;
  const attached = attachManagedSummarySignals({ target, host: { stop: async () => { calls++; return { stopped: true }; } },
    onOutcome: () => Promise.reject(Error("PRIVATE_OBSERVER_ERROR")) });
  target.emit("SIGTERM"); await waitFor(() => calls === 1); await Promise.resolve();
  attached.dispose(); expect(target.listeners("SIGINT")).toEqual([original]);
});

posixTest.each(["idle", "hold"])("actual owned child SIGTERM: %s", async mode => {
  const child = Bun.spawn([process.execPath, fileURLToPath(new URL("./fixtures/managed-host-signal-child.mjs", import.meta.url)), mode],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const events = []; let inFlight;
  const read = (async () => {
    const reader = child.stdout.getReader(), decoder = new TextDecoder(); let text = "";
    try { while (true) {
      const part = await reader.read(); if (part.done) break;
      text += decoder.decode(part.value, { stream: true });
      const lines = text.split("\n"); text = lines.pop();
      for (const line of lines) if (line) events.push(JSON.parse(line));
    } } finally { reader.releaseLock(); }
  })().catch(() => {});
  try {
    const ready = await waitFor(() => events.find(e => e.event === "ready"));
    const base = `http://127.0.0.1:${ready.port}`;
    const headers = { host: "summary.example.test", origin: "https://summary.example.test", "content-type": "application/json" };
    if (mode === "hold") {
      inFlight = fetch(`${base}/api/summary/generate`, { method: "POST", headers, body: "{}" });
      inFlight.catch(() => {});
      await waitFor(() => events.find(e => e.event === "generation_started"));
    }
    child.kill("SIGTERM");
    const first = await waitFor(() => events.find(e => e.event === "shutdown"));
    expect(first.stopped).toBe(mode === "idle");
    if (mode === "hold") {
      expect(child.exitCode).toBeNull(); expect(events.filter(e => e.event === "cleanup")).toHaveLength(0);
      const health = await fetch(`${base}/healthz`, { headers }); expect(health.status).toBe(503); await health.text();
      child.stdin.write("release\n"); child.stdin.flush();
      expect(await (await inFlight).json()).toEqual({ syntheticDraft: true });
      child.kill("SIGTERM");
      await waitFor(() => events.some(e => e.event === "shutdown" && e.stopped));
    }
    expect(await child.exited).toBe(0); await read;
    expect(events.filter(e => e.event === "cleanup")).toHaveLength(1);
    expect(await new Response(child.stderr).text()).toBe("");
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited; if (inFlight) await inFlight.catch(() => {}); await read;
  }
});
