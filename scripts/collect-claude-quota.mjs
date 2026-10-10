// Local-only Claude Code statusLine bridge. Never fetches, reads credentials,
// stores prompts, or emits output into the user's existing status line.
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function normalizeStatuslineQuota(input, now = Date.now()) {
  const result = { collector: "claude-code-statusline-v1", observedAt: now };
  let count = 0;
  for (const key of ["five_hour", "seven_day"]) {
    const value = input?.rate_limits?.[key];
    if (value == null) continue;
    const used = value.used_percentage, reset = value.resets_at;
    if (!Number.isFinite(used) || used < 0 || used > 100 || !Number.isFinite(reset)
      || reset * 1000 <= now || !Number.isFinite(new Date(reset * 1000).getTime())) return null;
    result[key] = { utilization: used, resets_at: new Date(reset * 1000).toISOString() };
    count++;
  }
  return count ? result : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = readFileSync(0, "utf8");
    if (input.length > 1024 * 1024) process.exit(0);
    const quota = normalizeStatuslineQuota(JSON.parse(input));
    if (!quota) process.exit(0);
    const base = process.env.CLAUDE_CONFIG_DIR?.replace(/^~/, os.homedir()) || path.join(os.homedir(), ".claude");
    const file = path.join(base, "tokenjuice-statusline-quota.json");
    // Claude may redraw a cached payload. Identical values are not evidence of
    // a new provider observation; do not keep an old sample fresh indefinitely.
    try {
      const old = JSON.parse(readFileSync(file, "utf8"));
      if (JSON.stringify([old.five_hour, old.seven_day]) === JSON.stringify([quota.five_hour, quota.seven_day])) process.exit(0);
    } catch {}
    mkdirSync(base, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(quota), { mode: 0o600, flag: "wx" });
    renameSync(tmp, file);
  } catch { /* optional bridge must never break the existing status line */ }
}
