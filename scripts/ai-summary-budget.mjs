// Conservative local-service spend reservations, not a provider billing cap.
// Failed/uncertain requests retain their full reservation. Never stores prompts.
import { mkdirSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync,
  fsyncSync, renameSync, unlinkSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { randomBytes } from "node:crypto";

export function createDailySummaryBudget({ directory, dailyMaxUSD, now = Date.now } = {}) {
  // POSIX mode bits do not prove Windows ACL privacy. Fail closed until an
  // ACL-aware storage implementation is available; never pretend 0600 does.
  if (process.platform === "win32") throw new Error("budget_storage_platform_unsupported");
  if (typeof directory !== "string" || !isAbsolute(directory)
    || !Number.isFinite(dailyMaxUSD) || dailyMaxUSD <= 0 || dailyMaxUSD > 100) throw new Error("invalid_daily_budget");
  const limit = Math.floor(dailyMaxUSD * 1000000);
  if (limit < 1) throw new Error("invalid_daily_budget");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const parent = lstatSync(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077)) throw new Error("budget_directory_not_private");
  const file = join(directory, "daily-budget.json");
  const lock = join(directory, "daily-budget.lock");
  return {
    reserve(maxUSD) {
      if (!Number.isFinite(maxUSD) || maxUSD <= 0 || maxUSD > 1) throw new Error("invalid_reservation");
      const amount = Math.ceil(maxUSD * 1000000);
      let lockFd;
      try { lockFd = openSync(lock, "wx", 0o600); }
      catch { throw new Error("budget_lock_unavailable"); }
      let temp;
      try {
        const stamp = now();
        if (!Number.isFinite(stamp)) throw new Error("invalid_budget_clock");
        const day = new Date(stamp).toISOString().slice(0, 10);
        let previous = { version: 1, day, reservedMicros: 0 };
        try {
          const stat = lstatSync(file);
          if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) || stat.size > 1024) throw new Error("invalid_budget_file");
          previous = JSON.parse(readFileSync(file, "utf8"));
        } catch (error) { if (error.code !== "ENOENT") throw new Error("invalid_budget_file"); }
        if (previous.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(previous.day)
          || !Number.isSafeInteger(previous.reservedMicros) || previous.reservedMicros < 0) throw new Error("invalid_budget_file");
        if (previous.day > day) throw new Error("budget_clock_rollback");
        const used = previous.day === day ? previous.reservedMicros : 0;
        if (used + amount > limit) throw new Error("daily_summary_budget_exceeded");
        const next = { version: 1, day, reservedMicros: used + amount };
        temp = join(directory, `daily-budget.${randomBytes(16).toString("hex")}.tmp`);
        const fd = openSync(temp, "wx", 0o600);
        try { writeFileSync(fd, JSON.stringify(next)); fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(temp, file); temp = null;
        const dirFd = openSync(directory, "r");
        try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
        return { day, reservedUSD: amount / 1000000, remainingUSD: (limit - next.reservedMicros) / 1000000 };
      } finally {
        if (temp) { try { unlinkSync(temp); } catch {} }
        closeSync(lockFd); unlinkSync(lock);
      }
    },
  };
}
