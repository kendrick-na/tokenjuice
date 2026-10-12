// Persistent request-attempt count, independent of model/token prices.
// Private POSIX single-volume candidate; never stores conversation or IDs.
import { mkdirSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync,
  fsyncSync, renameSync, unlinkSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { randomBytes } from "node:crypto";

export function createDailySummaryAttempts({ directory, dailyLimit, now = Date.now } = {}) {
  if (process.platform === "win32") throw Error("attempt_storage_platform_unsupported");
  if (typeof directory !== "string" || !isAbsolute(directory) || !Number.isInteger(dailyLimit)
    || dailyLimit < 1 || dailyLimit > 100 || typeof now !== "function") throw Error("invalid_attempt_config");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, "daily-attempts.json"), lock = join(directory, "daily-attempts.lock");
  function operate(reserve) {
    const parent = lstatSync(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077)) throw Error("attempt_ledger_unavailable");
    let fd;
    try { fd = openSync(lock, "wx", 0o600); } catch { throw Error("attempt_ledger_unavailable"); }
    let temp;
    try {
      const stamp = now();
      if (!Number.isSafeInteger(stamp) || stamp < 0 || stamp > 253402300799999) throw Error("invalid_attempt_clock");
      const day = new Date(stamp).toISOString().slice(0, 10);
      let previous = { version: 1, day, attempts: 0, lastAt: stamp };
      try {
        const stat = lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) || stat.size > 1024) throw Error("attempt_ledger_unavailable");
        previous = JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw Error("attempt_ledger_unavailable");
        // Existing money-only account ledgers cannot prove a request count.
        // Fail closed instead of silently granting a fresh allowance.
        try { lstatSync(join(directory, "daily-budget.json")); throw Error("attempt_migration_required"); }
        catch (legacy) { if (legacy.code !== "ENOENT") throw Error("attempt_migration_required"); }
      }
      if (!previous || typeof previous !== "object" || Array.isArray(previous)
        || previous.version !== 1 || Object.keys(previous).length !== 4
        || !Number.isSafeInteger(previous.attempts) || previous.attempts < 0 || previous.attempts > 1000000
        || !Number.isSafeInteger(previous.lastAt) || previous.lastAt < 0 || previous.lastAt > 253402300799999
        || typeof previous.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(previous.day)
        || new Date(previous.lastAt).toISOString().slice(0, 10) !== previous.day)
        throw Error("attempt_ledger_unavailable");
      if (previous.lastAt > stamp || previous.day > day) throw Error("attempt_clock_rollback");
      const used = previous.day === day ? previous.attempts : 0;
      if (reserve && used >= dailyLimit) throw Error("daily_summary_attempts_exceeded");
      const next = { version: 1, day, attempts: used + (reserve ? 1 : 0), lastAt: stamp };
      if (reserve) {
        temp = join(directory, `daily-attempts.${randomBytes(16).toString("hex")}.tmp`);
        const writeFD = openSync(temp, "wx", 0o600);
        try { writeFileSync(writeFD, JSON.stringify(next)); fsyncSync(writeFD); } finally { closeSync(writeFD); }
        renameSync(temp, file); temp = null;
        const dirFD = openSync(directory, "r");
        try { fsyncSync(dirFD); } finally { closeSync(dirFD); }
      }
      return { day, limit: dailyLimit, used: next.attempts, remaining: Math.max(0, dailyLimit - next.attempts),
        resetsAt: Date.parse(`${day}T00:00:00.000Z`) + 86400000, observedAt: stamp };
    } finally {
      if (temp) { try { unlinkSync(temp); } catch {} }
      closeSync(fd); unlinkSync(lock);
    }
  }
  return { snapshot: () => operate(false), reserve: () => operate(true) };
}
