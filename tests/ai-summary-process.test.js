// Real child processes, synthetic amounts, fresh private directories only.
import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const processTest = process.platform === "win32" ? test.skip : test;
const moduleUrl = new URL("../scripts/ai-summary-budget.mjs", import.meta.url).href;
const stamp = Date.UTC(2026, 9, 11, 12);

function bounded(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("child_timeout")), 5000);
  })]).finally(() => clearTimeout(timer));
}
async function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-budget-process-"));
  const children = [];
  function worker(amount, mode = "reserve", limit = 0.03) {
    const code = `
      import { createDailySummaryBudget } from ${JSON.stringify(moduleUrl)};
      import { openSync } from "node:fs";
      const config = ${JSON.stringify({ directory, dailyMaxUSD: limit })};
      const ledger = createDailySummaryBudget({...config, now: () => ${stamp}});
      if (${JSON.stringify(mode)} === "hold") openSync(config.directory + "/daily-budget.lock", "wx", 0o600);
      console.log("ready");
      await Bun.stdin.stream().getReader().read();
      try { console.log(JSON.stringify({ok:true, ...ledger.reserve(${amount})})); }
      catch (error) { console.log(JSON.stringify({ok:false, error:error.message})); }
      if (${JSON.stringify(mode)} === "park") await new Promise(() => setInterval(() => {}, 1000));
      process.exit(0);
    `;
    const child = spawn(process.execPath, ["--eval", code], { stdio: ["pipe", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    let stderr = "";
    child.stderr.on("data", value => { stderr += value; });
    const exit = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({code, signal}));
    });
    const record = { child, exit,
      async line() {
        const result = await bounded(lines.next());
        if (result.done) throw new Error(`child ended before output: ${stderr}`);
        return result.value;
      },
      go() { child.stdin.end("go\n"); },
    };
    children.push(record);
    return record;
  }
  async function reserve(amount, limit = 0.03) {
    const child = worker(amount, "reserve", limit);
    expect(await child.line()).toBe("ready");
    child.go();
    const result = JSON.parse(await child.line());
    expect(await bounded(child.exit)).toEqual({code:0, signal:null});
    return result;
  }
  try { await run({ directory, worker, reserve }); }
  finally {
    // Kill only handles created by this fixture, never a PID discovered globally.
    for (const {child} of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await Promise.allSettled(children.map(({exit}) => bounded(exit)));
    rmSync(directory, {recursive:true, force:true});
  }
}

processTest("fresh OS processes retain reservations after a killed process and restart", async () => fixture(async ({directory, worker, reserve}) => {
  const child = worker(0.02, "park");
  expect(await child.line()).toBe("ready"); child.go();
  expect(JSON.parse(await child.line()).remainingUSD).toBe(0.01);
  child.child.kill("SIGKILL");
  expect((await bounded(child.exit)).signal).toBe("SIGKILL");
  expect(existsSync(join(directory,"daily-budget.lock"))).toBe(false);
  expect(await reserve(0.02)).toEqual({ok:false,error:"daily_summary_budget_exceeded"});
  expect((await reserve(0.01)).remainingUSD).toBe(0);
  expect(JSON.parse(readFileSync(join(directory,"daily-budget.json"),"utf8")).reservedMicros).toBe(30000);
}), 15000);

processTest("synchronized competing OS processes cannot overcommit one private ledger", async () => fixture(async ({directory, worker, reserve}) => {
  const contenders = Array.from({length:12}, () => worker(0.01, "reserve", 0.02));
  await Promise.all(contenders.map(async child => expect(await child.line()).toBe("ready")));
  for (const child of contenders) child.go();
  const results = await Promise.all(contenders.map(async child => JSON.parse(await child.line())));
  for (const child of contenders) expect(await bounded(child.exit)).toEqual({code:0,signal:null});
  const success = results.filter(result => result.ok).length;
  expect(success).toBeGreaterThanOrEqual(1); expect(success).toBeLessThanOrEqual(2);
  for (const result of results.filter(result => !result.ok))
    expect(["budget_lock_unavailable","daily_summary_budget_exceeded"]).toContain(result.error);
  expect(JSON.parse(readFileSync(join(directory,"daily-budget.json"),"utf8")).reservedMicros).toBe(success * 10000);
  if (success === 1) expect((await reserve(0.01,0.02)).remainingUSD).toBe(0);
  expect(await reserve(0.000001,0.02)).toEqual({ok:false,error:"daily_summary_budget_exceeded"});
}), 15000);

processTest("a killed lock holder blocks new processes without erasing reservations or the crash lock", async () => fixture(async ({directory, worker, reserve}) => {
  expect((await reserve(0.01)).ok).toBe(true);
  const before = readFileSync(join(directory,"daily-budget.json"),"utf8");
  const holder = worker(0.01,"hold"); expect(await holder.line()).toBe("ready");
  holder.child.kill("SIGKILL"); expect((await bounded(holder.exit)).signal).toBe("SIGKILL");
  expect(existsSync(join(directory,"daily-budget.lock"))).toBe(true);
  expect(await reserve(0.01)).toEqual({ok:false,error:"budget_lock_unavailable"});
  expect(readFileSync(join(directory,"daily-budget.json"),"utf8")).toBe(before);
  expect(existsSync(join(directory,"daily-budget.lock"))).toBe(true);
}), 15000);
