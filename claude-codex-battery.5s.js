#!/usr/bin/env bun
// <bitbar.title>Claude Codex Battery</bitbar.title>
// <bitbar.desc>Claude Code / Codex 남은 사용량을 배터리로 표시</bitbar.desc>
// <bitbar.author>easymilli</bitbar.author>
// <bitbar.dependencies>bun</bitbar.dependencies>
// <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
//
// 메뉴바에 C [88][17] X [0][76] 형태의 픽셀 배터리를 그린다.
// 배터리 숫자 = 남은 %. 초록 ≥50, 노랑 ≥20, 빨강 <20.

import { execFileSync, execSync, spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync, appendFileSync, realpathSync } from "node:fs";
import zlib from "node:zlib";
import { createCipheriv, pbkdf2Sync, randomBytes, createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const IS_MAC = process.platform === "darwin";
const argvHas = (flag) => process.argv.slice(2).includes(flag);

// Claude Code's config root. CLAUDE_CONFIG_DIR moves *everything* under it —
// transcripts included, not just .credentials.json — so honouring it is what
// keeps sessions visible for anyone who relocates their config.
function claudeHome() {
  const custom = process.env.CLAUDE_CONFIG_DIR;
  if (custom) return custom.replace(/^~/, HOME);
  return path.join(HOME, ".claude");
}

const CACHE_DIR = path.join(HOME, ".cache", "claude-codex-battery");
const CONFIG_DIR = path.join(HOME, ".config", "claude-codex-battery");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
try { mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

// 컴팩트 모드: 메뉴바가 실제로 뜨는 "주 디스플레이"가 노치 내장 화면이면 폭을 줄인다.
// (노치가 넓은 아이콘을 가려 안 보이는 문제 회피). 외장 모니터가 주 디스플레이면 풀버전.
// → 모니터를 바꾸면 자동 전환. SwiftBar는 화면별 다른 출력이 불가하므로 "주 디스플레이 1개" 기준.
// system_profiler가 느려서 30초 캐싱(디스플레이 연결은 드문 이벤트라 충분). 렌더는 5초 유지.
// 수동 오버라이드: CCB_COMPACT=1(항상 컴팩트) / CCB_COMPACT=0(항상 풀버전).
function shouldCompact() {
  if (process.env.CCB_COMPACT === "1") return true;
  if (process.env.CCB_COMPACT === "0") return false;
  if (!IS_MAC) return false;
  const cacheF = path.join(CACHE_DIR, "display.json");
  try {
    const c = JSON.parse(readFileSync(cacheF, "utf8"));
    if (c.at && Date.now() - c.at < 30000) return c.compact;
  } catch {}
  let compact = false;
  try {
    const out = execSync("system_profiler SPDisplaysDataType", { encoding: "utf8", timeout: 8000 });
    // 실제 구조 (system_profiler):
    //   Displays:
    //       <모니터이름>:                    ← 디스플레이 블록 헤더 (8칸 들여쓰기 + 콜론)
    //         Resolution / Main Display / Display Type / Connection Type ...
    // 주 디스플레이(Main Display: Yes) 블록이 "내장"이면 컴팩트.
    // 내장 판별: "Display Type: Built-in ..." 또는 "Connection Type: Internal".
    const lines = out.split("\n");
    const DISPLAY_HEADER = /^ {8}\S.*:\s*$/; // "        S32B80P:" 같은 모니터 이름 줄
    let curInternal = false, curMain = false, mainIsInternal = false;
    const flush = () => { if (curMain) mainIsInternal = curInternal; };
    for (const ln of lines) {
      if (DISPLAY_HEADER.test(ln)) { flush(); curInternal = false; curMain = false; } // 새 디스플레이 블록
      if (/Display Type:\s*Built-in/i.test(ln)) curInternal = true;
      if (/Connection Type:\s*Internal/i.test(ln)) curInternal = true;
      if (/Main Display:\s*Yes/i.test(ln)) curMain = true;
    }
    flush(); // 마지막 블록
    compact = mainIsInternal;
  } catch {}
  try { writeFileSync(cacheF, JSON.stringify({ compact, at: Date.now() })); } catch {}
  return compact;
}
const COMPACT = shouldCompact();

// ───────────────────────── PNG 인코더 ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
              : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

// ───────────────────────── 캔버스 ─────────────────────────
function makeCanvas(w, h) {
  return { w, h, px: Buffer.alloc(w * h * 4) };
}
function set(cv, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return;
  const i = (y * cv.w + x) * 4;
  cv.px[i] = r; cv.px[i + 1] = g; cv.px[i + 2] = b; cv.px[i + 3] = a;
}
function fillRect(cv, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(cv, xx, yy, c);
}

// 4x6 픽셀 폰트
// 5x7 픽셀 폰트 (굵고 또렷하게, 획 간 여백 확보 → 외곽선 없이도 잘 읽힘)
const FONT = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
};
const FONT_H = 7, FONT_W = 5;
function drawText(cv, x, y, text, color) {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) { cx += FONT_W + 1; continue; }
    for (let r = 0; r < FONT_H; r++)
      for (let c = 0; c < FONT_W; c++)
        if (glyph[r][c] === "1") set(cv, cx + c, y + r, color);
    cx += FONT_W + 1;
  }
  return cx - 1;
}
function textWidth(text) { return text.length * (FONT_W + 1) - 1; }

// ───────────────────────── 배터리 그리기 ─────────────────────────
const RED = [255, 69, 58];
const CLAUDE_ORANGE = [230, 126, 90]; // Anthropic 브랜드 #D97757 (약간 밝게)
const CODEX_VIOLET = [138, 124, 255]; // Codex 보라-파랑 #7C6CFF (약간 밝게)
const LETSUR_CYAN = [34, 200, 210]; // Letsur 게이트웨이 (청록)
const BATT_W = 34, BATT_H = 20; // 몸통(테두리 포함), 오른쪽에 2px 단자 추가

// 세션 구분용 팔레트: 프로젝트 이름 해시로 고정 배정 → 메뉴바/드롭다운 색 일치
const SESSION_COLORS = [
  [45, 212, 191],  // teal
  [244, 114, 182], // pink
  [56, 189, 248],  // sky
  [163, 230, 53],  // lime
  [251, 191, 36],  // amber
  [167, 139, 250], // violet
  [248, 113, 113], // red-pink
  [94, 234, 212],  // aqua
];
function rgbHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
// 밝은 배경엔 어두운 글자, 어두운 배경엔 흰 글자 (명도 기준)
function contrastInk([r, g, b]) {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b);
  return lum > 150 ? [20, 20, 24] : [255, 255, 255];
}
// 라벨을 브랜드색 알약(pill) 배지로 그림 → 메뉴바에서 확 눈에 띔
function drawBadge(cv, x, y, text, bg) {
  const tw = textWidth(text);
  const padX = 3, padY = 2;
  const bw = tw + padX * 2, bh = FONT_H + padY * 2;
  // 모서리 1px 깎은 알약
  fillRect(cv, x + 1, y, bw - 2, 1, bg);
  fillRect(cv, x + 1, y + bh - 1, bw - 2, 1, bg);
  fillRect(cv, x, y + 1, bw, bh - 2, bg);
  drawText(cv, x + padX, y + padY, text, contrastInk(bg));
  return bw;
}
function badgeWidth(text) { return textWidth(text) + 6; }

// remain: 0~100 남은 %, null이면 ? 표시. brand = 그룹 브랜드 컬러
function drawBattery(cv, x, y, remain, dark, brand) {
  const border = dark ? [235, 235, 240] : [70, 70, 75];
  const empty = dark ? [40, 40, 46] : [210, 210, 214];
  // 테두리 (모서리 1px 라운드)
  fillRect(cv, x + 1, y, BATT_W - 2, 1, border);
  fillRect(cv, x + 1, y + BATT_H - 1, BATT_W - 2, 1, border);
  fillRect(cv, x, y + 1, 1, BATT_H - 2, border);
  fillRect(cv, x + BATT_W - 1, y + 1, 1, BATT_H - 2, border);
  // 단자
  fillRect(cv, x + BATT_W, y + 6, 2, BATT_H - 12, border);
  // 내부
  const iw = BATT_W - 2, ih = BATT_H - 2;
  fillRect(cv, x + 1, y + 1, iw, ih, empty);
  const ty = y + Math.floor((BATT_H - FONT_H) / 2);
  if (remain == null) {
    drawText(cv, x + Math.floor((BATT_W - 4) / 2), ty, "?", dark ? [200, 200, 205] : [90, 90, 95]);
    return;
  }
  const r = Math.max(0, Math.min(100, Math.round(remain)));
  const fillW = Math.round((r / 100) * iw);
  const fill = r < 20 ? RED : brand; // 20% 미만은 경고용 빨강
  if (fillW > 0) fillRect(cv, x + 1, y + 1, fillW, ih, fill);
  // 숫자: 빈 영역(어두움)엔 밝은 잉크, 채운 영역(브랜드색)엔 어두운 잉크로 반반 처리
  // → 배터리가 반쯤 찼을 때도 각 픽셀이 배경과 항상 대비됨
  const label = String(r);
  const tw = textWidth(label);
  const tx = x + 1 + Math.floor((iw - tw) / 2);
  const inkOnFill = contrastInk(fill);           // 채운 색 위 잉크
  const inkOnEmpty = dark ? [245, 245, 250] : [55, 55, 60]; // 빈 색 위 잉크
  const fillEndX = x + 1 + fillW;                 // 채움 경계 x
  let cx = tx;
  for (const ch of label) {
    const glyph = FONT[ch];
    for (let rr = 0; rr < FONT_H; rr++)
      for (let cc = 0; cc < FONT_W; cc++)
        if (glyph[rr][cc] === "1") {
          const px = cx + cc;
          set(cv, px, ty + rr, px < fillEndX ? inkOnFill : inkOnEmpty);
        }
    cx += FONT_W + 1;
  }
}

// groups: [{label, color, items:[{remain}]}] → base64 PNG
function renderImage(groups, dark) {
  const PAD = 4, GAP = 4, LABEL_GAP = 3, GROUP_GAP = 8, H = 24;
  let w = PAD;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    w += badgeWidth(g.label) + LABEL_GAP;
    w += g.items.length * (BATT_W + 2) + (g.items.length - 1) * GAP;
    if (g.overflow) w += GAP + badgeWidth("+" + g.overflow); // +N 배지
    if (gi < groups.length - 1) w += GROUP_GAP;
  }
  w += PAD;
  const cv = makeCanvas(w, H);
  // 배경 필 (반투명 회색 라운드)
  const bg = dark ? [70, 70, 78, 120] : [140, 140, 148, 90];
  fillRect(cv, 1, 1, w - 2, H - 2, bg);
  fillRect(cv, 2, 0, w - 4, 1, bg);
  fillRect(cv, 2, H - 1, w - 4, 1, bg);
  let x = PAD;
  const by = Math.floor((H - BATT_H) / 2);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    drawBadge(cv, x, by + Math.floor((BATT_H - (FONT_H + 4)) / 2), g.label, g.color);
    x += badgeWidth(g.label) + LABEL_GAP;
    for (let i = 0; i < g.items.length; i++) {
      drawBattery(cv, x, by, g.items[i].remain, dark, g.items[i].color || g.color);
      x += BATT_W + 2 + GAP;
    }
    if (g.overflow) {
      // +N 배지: 나머지 세션 개수 (드롭다운에서 전부 확인 가능)
      const oby = by + Math.floor((BATT_H - (FONT_H + 4)) / 2);
      x += drawBadge(cv, x, oby, "+" + g.overflow, dark ? [90, 90, 100] : [120, 120, 128]) + GAP;
    }
    x -= GAP;
    if (gi < groups.length - 1) {
      // 플랫폼 구분 세로 점선
      const sx = x + Math.floor(GROUP_GAP / 2);
      const sep = dark ? [160, 160, 170, 160] : [90, 90, 95, 160];
      for (let yy = 4; yy < H - 4; yy += 2) set(cv, sx, yy, sep);
      x += GROUP_GAP;
    }
  }
  return encodePNG(w, H, cv.px).toString("base64");
}

// ───────────────────────── 데이터: Claude ─────────────────────────
// 멀티 계정 전략 (best-effort 자동 감지 → 수동 오버라이드):
//  1) ~/.config/claude-codex-battery/accounts.json 이 있으면 그걸 그대로 사용 (완전 수동)
//  2) 없으면 자동 감지: ~/.claude 및 CLAUDE_CONFIG_DIR 방식으로 분리한 ~/.claude-* 폴더를
//     각각 하나의 계정으로 잡고, 각 폴더의 .claude.json → oauthAccount 에서
//     조직명/이메일을 읽어 라벨을 자동 생성한다.
//  ※ 맥 키체인은 서비스명당 계정 1개만 저장하므로, "키체인만으로 계정을 스위칭"하는
//     사용자는 현재 로그인된 1개만 보인다. 진짜 동시 표시는 CLAUDE_CONFIG_DIR 분리가 전제.
function accountLabel(configDir) {
  try {
    const j = JSON.parse(readFileSync(path.join(configDir, ".claude.json"), "utf8"));
    const a = j.oauthAccount || {};
    if (a.organizationName) return a.organizationName;
    if (a.emailAddress) return a.emailAddress.split("@")[0];
    if (a.displayName) return a.displayName;
  } catch {}
  return null;
}
function expandHomePath(value) {
  if (typeof value !== "string") return value;
  if (value === "~") return HOME;
  return value.startsWith("~/") ? path.join(HOME, value.slice(2)) : value;
}
function loadAccounts() {
  const f = path.join(CONFIG_DIR, "accounts.json");
  try {
    const list = JSON.parse(readFileSync(f, "utf8"));
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  const accounts = [{ name: accountLabel(claudeHome()) || "Claude" }];
  try {
    for (const e of readdirSync(HOME)) {
      if (!e.startsWith(".claude") || e === ".claude" || e.endsWith(".json") || e.endsWith(".backup")) continue;
      const dir = path.join(HOME, e);
      const cred = path.join(dir, ".credentials.json");
      if (existsSync(cred)) accounts.push({
        name: accountLabel(dir) || e.replace(/^\.claude-?/, "") || e,
        configDir: dir,
        credFile: cred,
      });
    }
  } catch {}
  return accounts;
}

function readClaudeToken(acc = {}) {
  // 명시적 credFile > 플랫폼 기본
  const explicit = expandHomePath(acc.credFile);
  if (explicit) return JSON.parse(readFileSync(explicit, "utf8")).claudeAiOauth.accessToken;
  // Windows / Linux: 자격증명은 평문 파일(~/.claude/.credentials.json)
  if (!IS_MAC) {
    const p = path.join(expandHomePath(acc.configDir) || claudeHome(), ".credentials.json");
    return JSON.parse(readFileSync(p, "utf8")).claudeAiOauth.accessToken;
  }
  // macOS: 키체인
  const svc = acc.keychainService || "Claude Code-credentials";
  // Claude Code stores the item under the macOS user name. Without -a,
  // `security` returns whichever item matches first, and a stray item (e.g.
  // account "unknown", written by a CLI run without $USER) shadows the real
  // login with empty tokens. Try the exact account first, then any match.
  const accounts = acc.keychainAccount ? [acc.keychainAccount] : [os.userInfo().username, null];
  for (const a of accounts) {
    try {
      // Never interpolate config values into a shell command. `keychainService`
      // and `keychainAccount` are user-editable fields in accounts.json, so
      // invoke the macOS binary with an argument vector instead.
      const args = ["find-generic-password", "-s", String(svc)];
      if (a) args.push("-a", String(a));
      args.push("-w");
      const raw = execFileSync("/usr/bin/security", args, {
        encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"],
      });
      const token = JSON.parse(raw)?.claudeAiOauth?.accessToken;
      if (token) return token;
    } catch {}
  }
  throw new Error("keychain: no Claude Code login with a token (find-generic-password)");
}

// 사용량 JSON → items 배열 (로컬 캐시 파일과 API 응답이 같은 스키마라 공용)
function parseUsageItems(d) {
  const items = [];
  if (d.five_hour) items.push({ name: "5-hour", used: d.five_hour.utilization, resets: d.five_hour.resets_at });
  if (d.seven_day) items.push({ name: "Weekly", used: d.seven_day.utilization, resets: d.seven_day.resets_at });
  for (const [k, label] of [["seven_day_opus", "Weekly Opus"], ["seven_day_sonnet", "Weekly Sonnet"], ["seven_day_cowork", "Weekly Cowork"]]) {
    if (d[k] && d[k].utilization != null) items.push({ name: label, used: d[k].utilization, resets: d[k].resets_at });
  }
  return items;
}

// Claude Code가 스스로 갱신하는 로컬 사용량 캐시 (버전에 따라 경로가 다르거나 없을 수 있음)
// → 있으면 네트워크 없이 진짜 실시간. 없으면 null 반환하고 API로 폴백.
function readLocalUsageCache(acc = {}) {
  const base = expandHomePath(acc.configDir) || claudeHome();
  const candidates = [
    path.join(base, "MEMORY", "STATE", "usage-cache.json"),
    path.join(base, "usage-cache.json"),
    path.join(base, "cache", "usage-cache.json"),
    path.join(base, "STATE", "usage-cache.json"),
  ];
  for (const f of candidates) {
    try {
      if (!existsSync(f)) continue;
      const d = JSON.parse(readFileSync(f, "utf8"));
      const items = parseUsageItems(d);
      if (items.length) {
        let at = Date.now();
        try { at = statSync(f).mtimeMs; } catch {}
        const stale = Date.now() - at > 30 * 60 * 1000;
        return {
          ok: true, items, at, observedAt: at, lastSuccessAt: at,
          source: "local", state: stale ? "stale" : "fresh", stale,
        };
      }
    } catch {}
  }
  return null;
}

// Claude desktop app records the plan meter separately from Claude Code.
// `fh` is the rolling five-hour usage percentage and `sd` is the seven-day
// usage percentage. Prefer a recent app sample so the battery matches what
// the desktop app shows; API/local Claude Code data remains the fallback.
function readClaudeAppUsage() {
  const f = path.join(HOME, "Library", "Application Support", "Claude", "plan-usage-history.json");
  try {
    const j = JSON.parse(readFileSync(f, "utf8"));
    const samples = Array.isArray(j.samples) ? j.samples : [];
    const valid = samples.filter((x) => {
      const age = Date.now() - Number(x?.t);
      return age >= 0 && age < 2 * 60 * 60 * 1000 && x?.u &&
        Number.isFinite(Number(x.u.fh)) && Number.isFinite(Number(x.u.sd));
    });
    const s = [...valid].reverse()[0];
    if (!s) {
      // Claude desktop only polls while its tray usage view was opened in the
      // last 24h; otherwise samples just stop. Report that instead of nothing,
      // with the last sample for context (never used as a live value).
      const last = [...samples].reverse().find((x) => x?.u && Number.isFinite(Number(x.u.fh)));
      return last ? {
        ok: false,
        items: [],
        reason: "app-stale",
        appLast: { at: Number(last.t), fh: Number(last.u.fh), sd: Number(last.u.sd) },
        ...usageState({
          state: "stale",
          source: "claude-app",
          at: Number(last.t),
          observedAt: Number(last.t),
          lastSuccessAt: Number(last.t),
          stale: true,
        }),
      } : null;
    }
    const clamp = (n) => Math.max(0, Math.min(100, Number(n)));
    const fh = clamp(s.u.fh), sd = clamp(s.u.sd);

    // A 0% sample is taken at face value. On large plans (e.g. Team) real use
    // rounds to 0-2% for hours, so "stuck at zero" cannot be told apart from
    // light use; freshness (the 2h window above) is the only staleness check.

    // The app sample has no reset times; borrow them from the last API answer,
    // but only while they are still in the future (a past reset is meaningless).
    const apiReset = (name) => {
      try {
        const c = JSON.parse(readFileSync(path.join(CACHE_DIR, "claude-0.json"), "utf8"));
        const r = c.items?.find((i) => i.name === name)?.resets;
        return r && Date.parse(r) > Date.now() ? r : null;
      } catch { return null; }
    };
    const at = Number(s.t);
    return {
      ok: true,
      items: [
        { name: "5-hour", used: fh, resets: apiReset("5-hour") },
        { name: "Weekly", used: sd, resets: apiReset("Weekly") },
      ],
      ...usageState({
        state: "fallback",
        source: "claude-app",
        at,
        observedAt: at,
        lastSuccessAt: at,
      }),
    };
  } catch {}
  return null;
}

// API 모드(키체인 접근)는 명시적 옵트인. 기본은 키체인을 절대 건드리지 않음.
//   켜는 법: 환경변수 CCB_API=1  또는  ~/.config/claude-codex-battery/config.json {"api": true}
function apiModeEnabled() {
  // Read-only support and diagnostics commands must be able to guarantee that
  // a persisted {"api":true} setting cannot re-enable Keychain/API access.
  if (process.env.CCB_DISABLE_API === "1") return false;
  if (process.env.CCB_API === "1") return true;
  try {
    const c = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return c.api === true;
  } catch { return false; }
}

// v1.1 신뢰성 계층: 숫자와 함께 "얼마나 믿을 수 있는가"를 전달한다.
// state는 UI/트레이가 공통으로 소비하고, source는 실제 데이터 경로를 뜻한다.
function usageState({ state, source, at, observedAt, lastSuccessAt, retryAt, errorCode, error, stale, refreshing } = {}) {
  const successAt = lastSuccessAt ?? observedAt ?? at ?? null;
  return {
    state: state || (stale ? "stale" : "fresh"),
    source: source ?? null,
    at: at ?? observedAt ?? successAt ?? null,
    observedAt: observedAt ?? at ?? null,
    lastSuccessAt: successAt,
    retryAt: retryAt ?? null,
    errorCode: errorCode ?? null,
    error: error ?? null,
    stale: !!stale,
    refreshing: !!refreshing,
  };
}

function usageStateForHttp(status) {
  if (status === 401 || status === 403) return "auth_expired";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

function sourceLabel(source) {
  return source === "api" ? "Anthropic usage API"
    : source === "local" ? "Claude local cache"
    : source === "claude-app" ? "Claude Desktop history"
    : source === "codex-jsonl" ? "Codex session JSONL"
    : source === "external-local-file" ? "user-selected local usage file"
    : source || "unknown";
}

// R16 trust badge: one place that says how far a number can be trusted.
// "provider-reported" = the provider's own quota numbers (Anthropic usage
// endpoint, Claude Code cache, Claude Desktop history, Codex's logged
// rate_limits). "local estimate" = our arithmetic on transcripts (session
// context), never a quota. Endpoints behind these are undocumented; see
// docs/DATA_CONTRACT.md.
function trustBadge({ state, source, kind } = {}) {
  if (kind === "context") return { level: "estimate", icon: "📐", text: "local estimate · transcript tokens, not quota" };
  const via = sourceLabel(source);
  if (state === "fresh") return { level: "live", icon: "✅", text: `provider-reported · live · ${via}` };
  if (state === "fallback") return { level: "fallback", icon: "🟡", text: `provider-reported · fallback · ${via} (sampled, may lag)` };
  if (state === "stale") return { level: "stale", icon: "⚠️", text: `stale · not live · ${via}` };
  if (state === "auth_expired") return { level: "blocked", icon: "🔐", text: "login expired · not live" };
  if (state === "rate_limited") return { level: "blocked", icon: "⏳", text: "rate limited · not live" };
  return { level: "unavailable", icon: "⛔", text: "unavailable" };
}

function stateLabel(state) {
  return state === "fresh" ? "fresh"
    : state === "fallback" ? "fallback"
    : state === "stale" ? "stale"
    : state === "auth_expired" ? "auth expired"
    : state === "rate_limited" ? "rate limited"
    : state === "unavailable" ? "unavailable"
    : state || "unknown";
}

// 기계 소비자(--json/--text)에는 안정적인 영문 state를 그대로 제공한다. 이 함수는
// 메뉴에서만 쓰는 사람 중심 언어다. PWA·macOS·Windows가 같은 상태 의미를 보여 준다.
function stateDisplayLabel(state) {
  return state === "fresh" ? "방금 확인됨"
    : state === "fallback" ? "대체 정보"
    : state === "stale" ? "업데이트 필요"
    : state === "auth_expired" ? "다시 연결 필요"
    : state === "rate_limited" ? "제공자 제한 중"
    : state === "unavailable" ? "확인할 수 없음"
    : "상태 확인 필요";
}

function stateRecoveryHint(state) {
  return state === "fallback" ? "대체 경로에서 가져온 값입니다"
    : state === "stale" ? "현재 값이 아니므로 헤더에 숫자를 표시하지 않습니다"
    : state === "auth_expired" ? "Claude Code에서 다시 로그인하세요"
    : state === "rate_limited" ? "다음 확인 가능 시각까지 기다립니다"
    : state === "unavailable" ? "다음 수집 때 다시 확인합니다"
    : "";
}

// A failure panel must make one next step obvious.  This is intentionally a
// plain instruction, never an automatic retry, credential operation, or
// provider-specific action when we cannot establish the cause.
function recoveryActionFor({ state, reason, stale } = {}) {
  if (reason === "needs-api") return "Claude usage API 모드 켜기";
  if (reason === "app-stale") return "Claude 메뉴 막대 아이콘에서 사용량 화면 열기";
  if (state === "auth_expired" || reason === "auth") return "Claude Code에서 다시 로그인";
  if (reason === "login") return "터미널에서 claude를 실행해 로그인";
  if (state === "rate_limited" || reason === "rate-limit") return "다음 확인 가능 시각까지 기다리기";
  if (state === "stale" || stale) return "메뉴를 다시 열어 최신 상태 확인";
  return "";
}

function checkpointHandoffLabel(pct) {
  return pct >= 90
    ? "컨텍스트 임박 · 새 세션 전환 전 checkpoint용 로컬 스냅샷 내보내기"
    : "checkpoint 권장 · checkpoint용 로컬 스냅샷 내보내기";
}

function fmtRetryAt(retryAt) {
  if (!retryAt || !Number.isFinite(Number(retryAt))) return "";
  const t = new Date(Number(retryAt));
  if (isNaN(t)) return "";
  const now = new Date();
  const hm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const at = t.toDateString() === now.toDateString() ? hm : `${t.getMonth() + 1}/${t.getDate()} ${hm}`;
  return `retry ${fmtCountdown(Number(retryAt) - Date.now())} (${at})`;
}

// R4: a human countdown for back-off windows ("in 42m", "in 1h 05m", "now").
function fmtCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `in ${totalMin}m`;
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `in ${h}h ${String(m).padStart(2, "0")}m`;
}

// 세션 "주제"는 프롬프트 원문이다 → 화면공유·스크린샷으로 새면 곤란하므로 기본 숨김.
//   보고 싶으면 옵트인: CCB_TOPICS=1  또는  config.json {"topics": true}
//   (--topics / --no-topics 플래그가 있으면 그게 최우선)
function topicsEnabled() {
  if (argvHas("--no-topics")) return false;
  if (argvHas("--topics")) return true;
  if (process.env.CCB_TOPICS === "1") return true;
  if (process.env.CCB_TOPICS === "0") return false;
  try {
    const c = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return c.topics === true;
  } catch { return false; }
}

// ───────────────────────── 설정 · 테스트 연결점 ─────────────────────────
// ~/.config/claude-codex-battery/config.json — the only user-facing settings file.
//   api        (bool)  read Claude limits via the usage endpoint (keychain token)
//   topics     (bool)  show prompt topics in the dropdown
//   autoRenew  (bool)  opt in to background renewal after an expired login (default false)
//   notify     (obj)   opt-in alerts: { "enabled": true, "threshold": 20, "reset": true }
//   forecast   (obj)   opt-in local pace estimate: { "enabled": true }
//   sessionStatus (obj) opt-in local session-state hints: { "enabled": true }
//   copilot    (obj)   opt-in GitHub Copilot Premium-request spend reader.
//                       token is named by tokenEnv and is never written here.
//   providers  (arr)   opt-in local quota-file adapters. No command, cookie,
//                       token, browser session, or network request is used.
function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) || {};
  } catch { return {}; }
}

// Explicit local profiles, not login switching or credential discovery. A bad
// manifest/selection must never silently show a different account's quota.
function invalidCodexProfile(reason) { return { id: null, name: "Codex", configDir: null, reason }; }
function loadCodexProfiles() {
  const list = readConfig().codexAccounts;
  if (list === undefined) return [{ id: "default", name: "Codex", configDir: path.join(HOME, ".codex"), legacy: true }];
  if (!Array.isArray(list) || !list.length || list.length > 8) return [invalidCodexProfile("invalid_profiles")];
  const ids = new Set(), roots = new Set(), profiles = [];
  for (const entry of list) {
    const dir = expandHomePath(entry?.configDir);
    if (typeof entry?.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(entry.id) || entry.id === "default"
      || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 64 || /[|\x00-\x1f\x7f]/.test(entry.name)
      || typeof dir !== "string" || !path.isAbsolute(dir) || /[\x00-\x1f\x7f]/.test(dir)) return [invalidCodexProfile("invalid_profiles")];
    const root = path.resolve(dir);
    let canonical = root;
    try { canonical = realpathSync(root); } catch {}
    if (process.platform === "win32") canonical = canonical.toLowerCase();
    if (ids.has(entry.id) || roots.has(canonical)) return [invalidCodexProfile("invalid_profiles")];
    ids.add(entry.id); roots.add(canonical);
    profiles.push({ id: entry.id, name: entry.name.trim(), configDir: root, legacy: false });
  }
  return profiles;
}
function selectedCodexProfile(profiles = loadCodexProfiles()) {
  const selected = readConfig().codexSelectedAccount;
  return selected == null ? profiles[0] : profiles.find((profile) => profile.id === selected) || invalidCodexProfile("invalid_selection");
}
function codexAccountLabel(reading) { return reading.profile?.legacy ? "Codex" : `Codex ${reading.profile?.name || "unknown"}`; }
function publicCodexAccount(reading) {
  return {
    id: reading.profile?.id ?? null, account: reading.profile?.name ?? "Codex",
    selected: reading.profile?.id === selectedProfile.id && !!selectedProfile.configDir,
    items: reading.items, reason: reading.reason ?? null,
    source: reading.source ?? "codex-jsonl", state: reading.state ?? "unavailable",
    observedAt: reading.observedAt ?? null, lastSuccessAt: reading.lastSuccessAt ?? null,
    kind: "quota", trust: trustBadge({ state: reading.state ?? "unavailable", source: "codex-jsonl" }),
  };
}

// R18: pace is deliberately opt-in. We keep a compact, local-only series of
// percentages; no prompt, token, account name, or credential is recorded.
const FORECAST_HISTORY_FILE = path.join(CACHE_DIR, "quota-history.json");
const FORECAST_MIN_INTERVAL_MS = 10 * 60 * 1000;
const FORECAST_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
const FORECAST_MAX_OBSERVATIONS = 320;
function forecastEnabled() { return readConfig().forecast?.enabled === true; }
function codexForecastEnabled() { return readConfig().codexForecast?.enabled === true; }
function sessionStatusEnabled() { return readConfig().sessionStatus?.enabled === true; }
function readForecastHistory() {
  try {
    const rows = JSON.parse(readFileSync(FORECAST_HISTORY_FILE, "utf8"))?.observations;
    return Array.isArray(rows) ? rows.filter((r) => Number.isFinite(r?.at) && Number.isFinite(r?.used)) : [];
  } catch { return []; }
}
function recordForecastObservations(claudeAccounts) {
  if (!forecastEnabled()) return;
  const now = Date.now();
  const rows = readForecastHistory().filter((r) => now - r.at <= FORECAST_MAX_AGE_MS);
  for (let accountIndex = 0; accountIndex < claudeAccounts.length; accountIndex++) {
    const account = claudeAccounts[accountIndex];
    if (account.state !== "fresh") continue;
    for (const item of account.items || []) {
      const key = `${accountIndex}:${item.name}`;
      const last = [...rows].reverse().find((r) => r.key === key);
      if (!last || now - last.at >= FORECAST_MIN_INTERVAL_MS || Math.abs(last.used - Number(item.used)) >= 1) {
        rows.push({ key, at: now, used: Number(item.used) });
      }
    }
  }
  try { writeFileSync(FORECAST_HISTORY_FILE, JSON.stringify({ version: 1, observations: rows.slice(-FORECAST_MAX_OBSERVATIONS) })); } catch {}
}
function forecastForItem(accountIndex, item, state) {
  if (!forecastEnabled() || state !== "fresh") return null;
  const now = Date.now();
  const key = `${accountIndex}:${item.name}`;
  const observations = readForecastHistory()
    .filter((r) => r.key === key && now - r.at <= FORECAST_MAX_AGE_MS)
    .sort((a, b) => a.at - b.at);
  return paceEstimate(observations, item);
}
function paceEstimate(observations, item) {
  // A decreasing used percentage means the provider reset the window. Only use
  // the monotonic segment after the newest reset, not a previous quota period.
  let start = 0;
  for (let i = 1; i < observations.length; i++) if (observations[i].used + 0.1 < observations[i - 1].used) start = i;
  const segment = observations.slice(start);
  if (segment.length < 2) return null;
  const first = segment[0], last = segment[segment.length - 1];
  const elapsedHours = (last.at - first.at) / 3600000;
  const usedPerHour = (last.used - first.used) / elapsedHours;
  if (!Number.isFinite(usedPerHour) || usedPerHour <= 0 || elapsedHours < 1 / 6) return null;
  const exhaustionAt = last.at + ((100 - Number(item.used)) / usedPerHour) * 3600000;
  const resetAt = typeof item.resets === "number" ? item.resets * 1000 : Date.parse(item.resets);
  return {
    kind: "local_pace_estimate",
    observedAt: last.at,
    samples: segment.length,
    usedPerHour: Number(usedPerHour.toFixed(2)),
    exhaustionAt: Number.isFinite(exhaustionAt) ? Math.round(exhaustionAt) : null,
    beforeReset: !Number.isFinite(resetAt) || exhaustionAt < resetAt,
  };
}

// Separate consent and file: do not extend existing Claude history opt-in.
// Opaque keys identify a local profile/window/period, never a session path or
// authenticated account identifier.
const CODEX_FORECAST_HISTORY_FILE = path.join(CACHE_DIR, "codex-quota-history.json");
function codexWindowKey(role, window, profile) {
  if (!Number.isInteger(window?.window_minutes) || window.window_minutes <= 0
    || !Number.isFinite(window.resets_at) || window.resets_at * 1000 <= Date.now()) return null;
  const scope = profile?.legacy ? role : `${profile?.id}:${role}`;
  return `cw_${createHash("sha256").update(`${scope}:${window.window_minutes}:${window.resets_at}`).digest("hex")}`;
}
function readCodexForecastHistory() {
  try {
    const rows = JSON.parse(readFileSync(CODEX_FORECAST_HISTORY_FILE, "utf8"))?.observations;
    return Array.isArray(rows) ? rows.filter((r) => /^cw_[a-f0-9]{64}$/.test(r?.key)
      && Number.isFinite(r.at) && r.at > 0 && r.at <= Date.now()
      && Number.isFinite(r.used) && r.used >= 0 && r.used <= 100)
      .map(({ key, at, used }) => ({ key, at, used })) : [];
  } catch { return []; }
}
function recordCodexForecastObservations(codex) {
  const now = Date.now(), at = codex.paceObservedAt;
  if (!codexForecastEnabled() || codex.state !== "fresh" || !Number.isFinite(at)
    || at > now || now - at > 15 * 60000) return;
  const rows = readCodexForecastHistory().filter((r) => now - r.at <= FORECAST_MAX_AGE_MS);
  for (const item of codex.items) {
    if (!item.paceKey || !Number.isFinite(item.used) || item.used < 0 || item.used > 100) continue;
    const last = [...rows].reverse().find((r) => r.key === item.paceKey);
    if (last && at <= last.at) continue; // polling the same event is not a new sample
    if (!last || at - last.at >= FORECAST_MIN_INTERVAL_MS || Math.abs(last.used - item.used) >= 1) rows.push({ key: item.paceKey, at, used: item.used });
  }
  try { writeFileSync(CODEX_FORECAST_HISTORY_FILE, JSON.stringify({ version: 1, observations: rows.slice(-FORECAST_MAX_OBSERVATIONS) })); } catch {}
}
function codexForecastForItem(codex, item) {
  const at = codex.paceObservedAt;
  if (!codexForecastEnabled() || codex.state !== "fresh" || !item.paceKey
    || !Number.isFinite(item.used) || item.used < 0 || item.used > 100
    || !Number.isFinite(at) || at > Date.now() || Date.now() - at > 15 * 60000) return null;
  return paceEstimate(readCodexForecastHistory().filter((r) => r.key === item.paceKey
    && Date.now() - r.at <= FORECAST_MAX_AGE_MS).sort((a, b) => a.at - b.at), item);
}

// v1.2 온보딩: 메뉴에서 사용자가 직접 실행할 때만 안전한 기본 설정을 만든다.
// API·알림·자동 갱신·프롬프트 주제는 모두 꺼진 채로 시작하며 기존 파일은 절대 덮어쓰지 않는다.
function createStarterConfig() {
  if (existsSync(CONFIG_FILE)) return { created: false, path: CONFIG_FILE };
  mkdirSync(CONFIG_DIR, { recursive: true });
  const starter = {
    api: false,
    topics: false,
    autoRenew: false,
    notify: { enabled: false, threshold: 20, reset: true },
  };
  writeFileSync(CONFIG_FILE, `${JSON.stringify(starter, null, 2)}\n`, { flag: "wx" });
  return { created: true, path: CONFIG_FILE };
}
function updateNotifyConfig(patch) {
  const current = readConfig();
  const next = { ...current, notify: { ...(current.notify || {}), ...patch } };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next.notify;
}
function updateNotifyTarget(key, patch) {
  const current = readConfig();
  const notify = current.notify || {};
  const next = { ...current, notify: { ...notify, overrides: { ...(notify.overrides || {}), [key]: { ...(notify.overrides?.[key] || {}), ...patch } } } };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next.notify.overrides[key];
}

// The usage call. CCB_TEST_USAGE_FIXTURE=<file> (tests only) replaces the
// keychain read and the network with a canned {status, headers, body} and logs
// each call to <file>.calls, so tests can prove "no request during back-off".
async function fetchClaudeUsage(acc) {
  const fx = process.env.CCB_TEST_USAGE_FIXTURE;
  if (fx) {
    appendFileSync(fx + ".calls", `${Date.now()}\n`);
    const f = JSON.parse(readFileSync(fx, "utf8"));
    return new Response(JSON.stringify(f.body ?? {}), { status: f.status ?? 200, headers: f.headers ?? {} });
  }
  const token = readClaudeToken(acc);
  return fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: { Authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" },
    signal: AbortSignal.timeout(15000),
  });
}

// ───────────────────────── R3 · Claude 로그인 갱신 정책 ─────────────────────────
// The keychain OAuth token expires every ~8h and only the Claude CLI renews it;
// desktop-app users never run the CLI, so the usage API starts returning 401.
// Policy (explicit, visible, reversible):
//   • What runs: `claude -p /usage --max-turns 1 --tools "" --no-session-persistence`.
//     /usage reads the usage endpoint; no model call, no transcript (verified
//     2026-10-05 on CLI 2.1.238 — re-verify when the CLI changes).
//   • When: on 401/403 only if the user explicitly sets autoRenew:true, at most
//     once per 10 min; otherwise only on demand from the menu item.
//     or on demand from the "Renew Claude login now" menu item.
//   • Never: env -i or a missing $USER (that writes a stray keychain item),
//     keychain writes by this plugin, or retries in a loop.
//   • Shown: the dropdown always states the policy, the last run and its result;
//     The default is manual. autoRenew:true is an explicit opt-in.
const CLAUDE_REFRESH_FILE = path.join(CACHE_DIR, "claude-refresh.json");
const CLAUDE_REFRESH_RESULT = path.join(CACHE_DIR, "claude-refresh.result");
const RENEW_MIN_GAP_MS = 10 * 60 * 1000;
function autoRenewEnabled() { return readConfig().autoRenew === true; }
function findClaudeBin() {
  return [
    process.env.CCB_CLAUDE_BIN,
    path.join(HOME, ".npm-global", "bin", "claude"),
    path.join(HOME, ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ].find((p) => p && existsSync(p)) || null;
}
function readRenewStatus() {
  let r = null;
  try { r = JSON.parse(readFileSync(CLAUDE_REFRESH_FILE, "utf8")); } catch {}
  if (!r) return null;
  let exitCode = null, finishedAt = null;
  try {
    const st = statSync(CLAUDE_REFRESH_RESULT);
    if (st.mtimeMs >= Number(r.at)) {
      exitCode = Number(readFileSync(CLAUDE_REFRESH_RESULT, "utf8").trim());
      finishedAt = st.mtimeMs;
    }
  } catch {}
  return { at: Number(r.at), trigger: r.trigger || "auto", exitCode, finishedAt };
}
function triggerClaudeTokenRefresh({ trigger = "auto", minGapMs = RENEW_MIN_GAP_MS } = {}) {
  if (!IS_MAC) return false;
  if (trigger === "auto" && !autoRenewEnabled()) return false;
  const last = readRenewStatus();
  if (last && Date.now() - last.at < minGapMs) return false;
  const bin = findClaudeBin();
  if (!bin) return false;
  try {
    const user = os.userInfo().username;
    writeFileSync(CLAUDE_REFRESH_FILE, JSON.stringify({ at: Date.now(), trigger }));
    // Run through sh so the exit code lands in a file the next render can show.
    spawn("/bin/sh", ["-c", 'b="$1"; shift; "$b" "$@" >/dev/null 2>&1; echo "$?" > "$TJ_RESULT"', "sh",
      bin, "-p", "/usage", "--max-turns", "1", "--tools", "", "--no-session-persistence"], {
      cwd: CACHE_DIR, detached: true, stdio: "ignore",
      // Without $USER the CLI saves the renewed login under account "unknown",
      // a separate keychain item, instead of updating the real one.
      env: { ...process.env, HOME, USER: user, LOGNAME: user, TJ_RESULT: CLAUDE_REFRESH_RESULT },
    }).unref();
    return true;
  } catch { return false; }
}
function renewStatusLine() {
  const r = readRenewStatus();
  if (!r) return "never run";
  // A run normally finishes in ~3s; no result after 2 min means it was never
  // recorded (older plugin version) or the process was killed.
  const res = r.exitCode != null ? (r.exitCode === 0 ? "ok" : `failed (exit ${r.exitCode})`)
    : Date.now() - r.at < 2 * 60 * 1000 ? "running…" : "result not recorded";
  return `${r.trigger === "manual" ? "manual" : "auto"} run ${fmtAgo(r.at)} · ${res}`;
}

const CLAUDE_TTL_MS = 60 * 1000; // API는 최대 60초마다만 호출 (레이트리밋 보호). 세션 컨텍스트는 매 실행 실시간.
const CLAUDE_CACHE_MAX_STALE_MS = 2 * 60 * 60 * 1000;
const CLAUDE_APP_LIVE_MS = 30 * 60 * 1000; // app samples every ~15 min while it polls
async function getClaude(acc = {}, idx = 0) {
  // Claude desktop's meter is a fallback only: it samples irregularly and stops
  // entirely unless its tray usage view was opened in the last 24h, so
  // preferring it froze the battery on one old sample. The API answer is live.
  const app = IS_MAC && idx === 0 ? readClaudeAppUsage() : null;
  // 1순위: Claude Code 로컬 사용량 캐시 (원본 dennykim123 방식) — 실시간·무네트워크·키체인 X
  const local = readLocalUsageCache(acc);
  if (local?.state === "fresh") return local;

  // API 모드가 꺼져 있으면 → 키체인을 건드리지 않고 앱 값 또는 안내만 반환
  if (!apiModeEnabled()) {
    if (app?.ok) return app;
    if (local) return local;
    return {
      ok: false,
      items: [],
      reason: "needs-api",
      ...usageState({ state: "unavailable", source: "local" }),
    };
  }

  // 2순위: 우리 API 캐시가 신선하면 API 스킵
  const cacheFile = path.join(CACHE_DIR, `claude-${idx}.json`);
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (cached.at && Date.now() - cached.at < CLAUDE_TTL_MS) {
        return {
          ...cached,
          ...usageState({
            state: "fresh",
            source: cached.source || "api",
            at: cached.at,
            observedAt: cached.observedAt ?? cached.at,
            lastSuccessAt: cached.lastSuccessAt ?? cached.at,
          }),
          ok: true,
          fresh: true,
          stale: false,
        };
      }
    } catch {}
  }
  // 3순위: usage API 직접 호출 (여기서만 키체인 토큰을 읽음 — 옵트인 상태에서만 도달)
  // 실패하면 대기시간을 기록해 둔다. 안 그러면 5초 실행마다 API를 두드려 429가 풀리지 않는다.
  const failFile = path.join(CACHE_DIR, `claude-${idx}.fail.json`);
  let refreshing = false;
  let failStatus = null;
  let retryAt = null;
  try {
    let fail = null;
    try { fail = JSON.parse(readFileSync(failFile, "utf8")); } catch {}
    if (fail && Date.now() < Number(fail.until)) {
      refreshing = !!fail.refreshing;
      failStatus = Number(fail.status) || null;
      retryAt = Number(fail.until) || null;
      throw new Error(`usage api ${fail.status} (waiting)`);
    }
    const res = await fetchClaudeUsage(acc);
    if (!res.ok) {
      failStatus = res.status;
      const authFail = res.status === 401 || res.status === 403;
      // Expired login: renew in the background and retry soon instead of
      // waiting out the full back-off.
      if (authFail && idx === 0) refreshing = triggerClaudeTokenRefresh();
      const retryS = Number(res.headers.get("retry-after"));
      const minMs = refreshing ? 20 * 1000 : authFail ? 10 * 60 * 1000 : 5 * 60 * 1000;
      const waitMs = Math.max(minMs, Number.isFinite(retryS) ? retryS * 1000 : 0);
      retryAt = Date.now() + waitMs;
      try { writeFileSync(failFile, JSON.stringify({ status: res.status, at: Date.now(), until: retryAt, refreshing })); } catch {}
      throw new Error(`usage api ${res.status}`);
    }
    const d = await res.json();
    const items = parseUsageItems(d);
    const now = Date.now();
    const out = {
      ok: true,
      items,
      ...usageState({ state: "fresh", source: "api", at: now, observedAt: now, lastSuccessAt: now }),
    };
    writeFileSync(cacheFile, JSON.stringify(out));
    try { writeFileSync(failFile, JSON.stringify({ until: 0 })); } catch {}
    return out;
  } catch (e) {
    const msg = String(e.message || e);
    const failureState = failStatus ? usageStateForHttp(failStatus) : null;
    // A recent desktop sample is the next-best live value.
    if (app?.ok && Date.now() - app.at < CLAUDE_APP_LIVE_MS) {
      return {
        ...app,
        ...usageState({
          state: "fallback",
          source: app.source || "claude-app",
          at: app.at,
          observedAt: app.observedAt ?? app.at,
          lastSuccessAt: app.lastSuccessAt ?? app.at,
          retryAt,
          errorCode: failStatus,
          error: msg,
          refreshing,
        }),
      };
    }
    // Otherwise show the last good number, flagged stale: the menu bar shows
    // "?" for it and the dropdown says how old it is.
    const cached = (() => { try { return JSON.parse(readFileSync(cacheFile, "utf8")); } catch { return null; } })();
    for (const c of [local, app?.ok ? app : null, cached]
      .filter((c) => c?.ok && (c.lastSuccessAt ?? c.at) && Date.now() - (c.lastSuccessAt ?? c.at) <= CLAUDE_CACHE_MAX_STALE_MS)
      .sort((a, b) => (b.lastSuccessAt ?? b.at) - (a.lastSuccessAt ?? a.at))) {
      const at = c.lastSuccessAt ?? c.at;
      return {
        ...c,
        ...usageState({
          state: failureState || "stale",
          source: c.source || "unknown",
          at: c.at ?? at,
          observedAt: c.observedAt ?? c.at ?? at,
          lastSuccessAt: at,
          retryAt,
          errorCode: failStatus,
          error: msg,
          stale: true,
          refreshing,
        }),
        stale: true,
      };
    }
    // 클린 환경(첫 설치·미로그인·키체인 거부) → raw 에러 대신 원인 분류
    const reason = failStatus === 401 || failStatus === 403 || /401|403|unauthorized|invalid.*token/i.test(msg)
      ? "auth"
      : failStatus === 429 || /429|rate limit/i.test(msg)
      ? "rate-limit"
      : /find-generic-password|keychain|SecKeychain/i.test(msg)
      ? "login"      // 로그인 안 됨 / 키체인 접근 불가
      : /ENOENT|no such file/i.test(msg) ? "login" : "error";
    // Both sources are down: report the API cause and keep the app's last
    // sample for the dropdown note. Never show an old number as live.
    return {
      ok: false,
      items: [],
      error: msg,
      reason,
      refreshing,
      appLast: app?.appLast ?? null,
      ...usageState({
        state: failureState || "unavailable",
        source: app?.source || local?.source || "api",
        at: app?.at ?? local?.at ?? null,
        observedAt: app?.observedAt ?? local?.observedAt ?? null,
        lastSuccessAt: app?.lastSuccessAt ?? local?.lastSuccessAt ?? null,
        retryAt,
        errorCode: failStatus,
        error: msg,
        refreshing,
      }),
    };
  }
}

// ───────────────────────── 데이터: Codex ─────────────────────────
function walkJsonl(dir, out, depth = 0) {
  if (depth > 4) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(p, out, depth + 1);
    else if (e.name.endsWith(".jsonl")) {
      try { out.push({ p, mtime: statSync(p).mtimeMs }); } catch {}
    }
  }
}

function getCodex(profile = selectedCodexProfile()) {
  if (!profile.configDir) return { ok: false, items: [], reason: profile.reason, ...usageState({ state: "unavailable", source: "codex-jsonl" }) };
  const sessDir = path.join(profile.configDir, "sessions");
  const files = [];
  walkJsonl(sessDir, files);
  files.sort((a, b) => b.mtime - a.mtime);
  for (const f of files.slice(0, 5)) {
    let text;
    try { text = readFileSync(f.p, "utf8"); } catch { continue; }
    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"rate_limits"')) continue;
      let obj;
      try { obj = JSON.parse(lines[i]); } catch { continue; }
      const rl = obj?.payload?.rate_limits ?? obj?.rate_limits;
      if (!rl) continue;
      const windows = [rl.primary, rl.secondary].filter((window) => window?.used_percent != null);
      if (windows.some((window) => !Number.isFinite(window.used_percent) || window.used_percent < 0 || window.used_percent > 100)) {
        // Reject at the source, before reset inference or Number() in consumers.
        // Do not turn an older reading into "fresh" after a malformed newest one.
        return {
          ok: false, items: [], reason: "invalid_quota",
          ...usageState({ state: "unavailable", source: "codex-jsonl" }),
          // A failed observation is not a successful quota reading.
          observedAt: f.mtime,
        };
      }
      const items = [];
      if (rl.primary && rl.primary.used_percent != null) {
        items.push({
          name: rl.primary.window_minutes >= 10000 ? "Weekly" : "5-hour",
          role: "primary", used: rl.primary.used_percent, resets: rl.primary.resets_at, paceKey: codexWindowKey("primary", rl.primary, profile),
        });
      }
      if (rl.secondary && rl.secondary.used_percent != null) {
        items.push({
          name: rl.secondary.window_minutes >= 10000 ? "Weekly" : "5-hour",
          role: "secondary", used: rl.secondary.used_percent, resets: rl.secondary.resets_at, paceKey: codexWindowKey("secondary", rl.secondary, profile),
        });
      }
      if (items.length === 0) continue; // null 창은 건너뛰고 더 과거 기록 탐색
      // 기록 시점 이후 리셋 시각이 지났으면 해당 창은 이미 초기화된 것
      for (const it of items) {
        const t = typeof it.resets === "number" ? it.resets * 1000 : Date.parse(it.resets);
        if (t && t < Date.now()) { it.used = 0; it.resets = null; it.wasReset = true; }
      }
      const stale = Date.now() - f.mtime > 60 * 60 * 1000;
      return {
        ok: true,
        items,
        plan: rl.plan_type,
        // Only an explicit timestamp with timezone can anchor pace. File mtime
        // may refer to a later unrelated event, so it must not become a sample.
        paceObservedAt: typeof obj.timestamp === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(obj.timestamp) ? Date.parse(obj.timestamp) : null,
        ...usageState({
          state: stale ? "stale" : "fresh",
          source: "codex-jsonl",
          at: f.mtime,
          observedAt: f.mtime,
          lastSuccessAt: f.mtime,
          stale,
        }),
      };
    }
  }
  return {
    ok: false,
    items: [],
    ...usageState({ state: "unavailable", source: "codex-jsonl" }),
  };
}

// ───────────────────────── 데이터: 세션 컨텍스트 ─────────────────────────
// ~/.claude/projects/*/*.jsonl 트랜스크립트의 마지막 usage로 컨텍스트 사용량 계산
import { openSync, readSync, closeSync } from "node:fs";
const CTX_WINDOW = 200000;

function readTail(file, bytes = 131072) {
  const st = statSync(file);
  const size = Math.min(bytes, st.size);
  const buf = Buffer.alloc(size);
  const fd = openSync(file, "r");
  try { readSync(fd, buf, 0, size, st.size - size); } finally { closeSync(fd); }
  return buf.toString("utf8");
}
function readHead(file, bytes = 32768) {
  const buf = Buffer.alloc(bytes);
  const fd = openSync(file, "r");
  let n = 0;
  try { n = readSync(fd, buf, 0, bytes, 0); } finally { closeSync(fd); }
  return buf.subarray(0, n).toString("utf8");
}
// 세션 한 줄 주제: 대화 summary 우선, 없으면 첫 user 메시지 앞부분
function extractTopic(file, tail) {
  const clean = (s) => s
    .replace(/<command-[^>]*>[\s\S]*?<\/command-[^>]*>/g, "")
    .replace(/<ide_[^>]*>[\s\S]*?<\/ide_[^>]*>/g, "")   // IDE 컨텍스트 주입 제거
    .replace(/<[^>]+>/g, "")
    .replace(/Caveat:[\s\S]*?unless the user explicitly asks[^.]*\./gi, "")
    .replace(/^\s*The messages below[^.]*\.\s*/i, "")
    .replace(/The user opened the file[^\n]*/gi, "")     // IDE "파일 열림" 알림 제거
    .replace(/^\s*(Set model to|Set reasoning|stdout|stderr)[^\n]*/i, "") // 로컬 커맨드 출력 제거
    .replace(/\s+/g, " ").trim();
  // 슬래시 커맨드/커맨드 출력/시스템 알림만 있는 메시지는 주제로 부적합 → 스킵
  const isCommandOnly = (t) => /^(loop|model|clear|compact|Set model|Set reasoning|This session|The user)/i.test(t) || t.length < 3;
  // summary 타입 (전체 파일 어디에나 있을 수 있어 head+tail 둘 다 훑음)
  const sm = (tail.match(/"type":"summary"[^\n]*/g) || []).pop();
  if (sm) {
    try {
      const o = JSON.parse(sm.slice(sm.indexOf("{")));
      if (o.summary) return clean(o.summary).slice(0, 40);
    } catch {}
  }
  // 첫 user 메시지
  const head = readHead(file);
  for (const line of head.split("\n")) {
    if (!line.includes('"type":"user"')) continue;
    try {
      const o = JSON.parse(line);
      const c = o?.message?.content;
      const txt = typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x?.text || "").join(" ") : "";
      const t = clean(txt);
      if (t && !isCommandOnly(t)) return t.slice(0, 40);
    } catch {}
  }
  return null;
}
function sessionStatusLabel(status) {
  return status === "working" ? "working"
    : status === "waiting_for_input" ? "waiting for input"
    : status === "completed" ? "completed"
    : status === "needs_attention" ? "needs attention"
    : "unknown";
}
function claudeSessionStatus(lines) {
  if (!sessionStatusEnabled()) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      // Claude Code assistant records do not consistently include message.role.
      if (entry?.type === "assistant") return "waiting_for_input";
      if (entry?.type === "user" && entry?.message?.role === "user") return "working";
    } catch {}
  }
  return "unknown";
}

// R20: prices are never guessed or downloaded. A user may opt in by supplying
// their own USD-per-million-token schedule in config.json. We then sum only
// Claude's recorded usage objects; prompt text and raw transcript lines never
// leave this function. Sessions with an unpriced model/token class remain
// explicitly partial or unavailable instead of receiving a made-up total.
const PROJECT_COST_MAX_FILE_BYTES = 12 * 1024 * 1024;
function pricingForModel(model, all) {
  if (!all || typeof all !== "object" || !model) return null;
  const raw = String(model);
  const withoutDate = raw.replace(/-\d{8}$/, "");
  const normalized = withoutDate.replace(/^claude-/, "");
  // Claude Code normally logs a dated model id; humans generally configure
  // the stable, date-free id shown in provider pricing pages.
  const rate = all[raw] ?? all[withoutDate] ?? all[normalized] ?? null;
  if (!rate || typeof rate !== "object") return null;
  const keys = ["inputUsdPerM", "outputUsdPerM", "cacheCreationUsdPerM", "cacheReadUsdPerM"];
  const out = {};
  for (const key of keys) {
    const value = Number(rate[key]);
    if (Number.isFinite(value) && value >= 0) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}
function costForClaudeUsage(usage, model, pricing) {
  const rates = pricingForModel(model, pricing);
  if (!rates) return null;
  const classes = [
    ["input_tokens", "inputUsdPerM"],
    ["output_tokens", "outputUsdPerM"],
    ["cache_creation_input_tokens", "cacheCreationUsdPerM"],
    ["cache_read_input_tokens", "cacheReadUsdPerM"],
  ];
  let amount = 0;
  for (const [tokensKey, priceKey] of classes) {
    const tokens = Number(usage?.[tokensKey] || 0);
    if (!Number.isFinite(tokens) || tokens < 0) return null;
    if (tokens > 0 && !Number.isFinite(rates[priceKey])) return null;
    amount += tokens * (rates[priceKey] || 0) / 1_000_000;
  }
  return amount;
}
function claudeSessionCost(file) {
  // Avoid adding a periodic full-transcript scan unless pricing was explicitly
  // configured. A cost report is optional; the live context meter stays cheap.
  const pricing = readConfig().pricing;
  if (!pricing || typeof pricing !== "object") return { state: "unavailable", reason: "pricing-not-configured" };
  let text;
  try {
    if (statSync(file).size > PROJECT_COST_MAX_FILE_BYTES) return { state: "unavailable", reason: "session-file-too-large" };
    text = readFileSync(file, "utf8");
  } catch { return { state: "unavailable", reason: "session-file-unreadable" }; }
  let amount = 0, pricedTurns = 0, unpricedTurns = 0;
  for (const line of text.split("\n")) {
    if (!line.includes('"usage":{') || !line.includes('"input_tokens"')) continue;
    try {
      const entry = JSON.parse(line);
      const usage = entry?.message?.usage;
      if (!usage || usage.input_tokens == null) continue;
      const cost = costForClaudeUsage(usage, entry?.message?.model, pricing);
      if (cost == null) unpricedTurns++;
      else { amount += cost; pricedTurns++; }
    } catch {}
  }
  if (!pricedTurns && !unpricedTurns) return { state: "unavailable", reason: "no-priced-usage" };
  return {
    state: unpricedTurns ? "partial" : "available", currency: "USD",
    amountUsd: Number(amount.toFixed(8)), pricedTurns, unpricedTurns,
  };
}

function getSessions() {
  const projDir = path.join(claudeHome(), "projects");
  const files = [];
  let dirs;
  try { dirs = readdirSync(projDir); } catch { return []; }
  const cutoff = Date.now() - 6 * 3600 * 1000;
  for (const d of dirs) {
    let entries;
    try { entries = readdirSync(path.join(projDir, d)); } catch { continue; }
    for (const e of entries) {
      if (!e.endsWith(".jsonl")) continue;
      const p = path.join(projDir, d, e);
      try {
        const m = statSync(p).mtimeMs;
        if (m > cutoff) files.push({ p, mtime: m });
      } catch {}
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  const sessions = [];
  for (const f of files.slice(0, 8)) {
    let tail;
    try { tail = readTail(f.p); } catch { continue; }
    const lines = tail.split("\n");
    let usage = null, model = null;
    for (let i = lines.length - 1; i >= 0 && !usage; i--) {
      if (!lines[i].includes('"usage":{') || !lines[i].includes('"input_tokens"')) continue;
      try {
        const obj = JSON.parse(lines[i]);
        const u = obj?.message?.usage;
        if (u && u.input_tokens != null) {
          usage = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
          model = obj?.message?.model || null;
        }
      } catch {}
    }
    if (usage == null) continue;
    const cwdMatch = [...tail.matchAll(/"cwd":"([^"]+)"/g)].pop(); // latest cwd: sessions can change folders
    const cwd = cwdMatch ? cwdMatch[1] : "?";
    const branchMatch = tail.match(/"gitBranch":"([^"]+)"/);
    const branch = branchMatch && branchMatch[1] !== "HEAD" ? branchMatch[1] : null;
    // 세션 주제: summary 있으면 그걸, 없으면 첫 user 메시지 요약
    const topic = extractTopic(f.p, tail);
    // 1M 컨텍스트 베타 세션: 모델명 표기 또는 사용량이 200k 초과면 1M 창으로 판정
    const win = (model && model.includes("[1m]")) || usage > CTX_WINDOW ? 1000000 : CTX_WINDOW;
    sessions.push({
      platform: "claude",
      name: safeDecode(path.basename(cwd)).normalize("NFC"),
      id: path.basename(f.p, ".jsonl").slice(0, 4),
      branch,
      topic,
      status: claudeSessionStatus(lines),
      model: model ? model.replace(/^claude-/, "").replace(/-\d{8}$/, "") : null,
      used: usage,
      pct: Math.min(100, (usage / win) * 100),
      mtime: f.mtime,
      win,
      cost: claudeSessionCost(f.p),
    });
    if (sessions.length >= 4) break;
  }
  return sessions;
}

// Codex 세션 컨텍스트:
// - last_token_usage.total_tokens = 현재 컨텍스트 창 점유량
// - model_context_window = 실제 창 크기(로그에 있으면 우선 사용)
const CODEX_WINDOW_FALLBACK = 272000; // 로그에 창 크기가 없을 때만 쓰는 안전한 기본값
function readLatestCodexTokenSnapshot(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"token_count"') && !lines[i].includes('"last_token_usage"')) continue;
    try {
      const o = JSON.parse(lines[i]);
      const payload = o?.payload ?? o;
      const lu = payload?.last_token_usage ?? payload?.info?.last_token_usage;
      if (!lu || lu.total_tokens == null) continue;
      const win = payload?.model_context_window ?? payload?.info?.model_context_window ?? CODEX_WINDOW_FALLBACK;
      return {
        used: lu.total_tokens,
        win: Number.isFinite(win) && win > 0 ? win : CODEX_WINDOW_FALLBACK,
      };
    } catch {}
  }
  return null;
}
function getCodexSessions() {
  const profile = selectedCodexProfile();
  if (!profile.configDir) return [];
  const files = [];
  walkJsonl(path.join(profile.configDir, "sessions"), files);
  files.sort((a, b) => b.mtime - a.mtime);
  const cutoff = Date.now() - 6 * 3600 * 1000;
  const sessions = [];
  for (const f of files.slice(0, 8)) {
    if (f.mtime < cutoff) break;
    let tail;
    try { tail = readTail(f.p); } catch { continue; }
    const lines = tail.split("\n");
    const snap = readLatestCodexTokenSnapshot(lines);
    if (!snap) continue;
    const { used, win } = snap;
    let cwdMatch = [...tail.matchAll(/"cwd":"([^"]+)"/g)].pop(); // latest cwd: sessions can change folders
    if (!cwdMatch) { try { cwdMatch = readHead(f.p).match(/"cwd":"([^"]+)"/); } catch {} }
    // model is only written on turn_context lines; a long tool-heavy turn can
    // push the last one out of the tail, so fall back to the file head.
    const mAll = [...tail.matchAll(/"model":"([^"]+)"/g)];
    let mMatch = mAll.length ? mAll[mAll.length - 1] : null;
    if (!mMatch) { try { mMatch = readHead(f.p).match(/"model":"([^"]+)"/); } catch {} }
    sessions.push({
      platform: "codex",
      name: cwdMatch ? safeDecode(path.basename(cwdMatch[1])).normalize("NFC") : "?",
      id: path.basename(f.p, ".jsonl").split("-").pop().slice(0, 4),
      branch: null,
      topic: extractCodexTopic(tail),
      status: codexSessionStatus(lines),
      model: mMatch ? mMatch[1] : null,
      used,
      pct: Math.min(100, (used / win) * 100),
      mtime: f.mtime,
      win,
    });
    if (sessions.length >= 3) break;
  }
  return sessions;
}
function codexSessionStatus(lines) {
  if (!sessionStatusEnabled()) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      const payload = entry?.payload ?? entry;
      const type = payload?.type || "";
      if (type === "task_complete") return "completed";
      if (/approval|request_user_input|needs_input/i.test(type)) return "needs_attention";
      if (entry?.type === "response_item" && type === "message" && payload?.role === "assistant") return "waiting_for_input";
      if (type === "reasoning" || type === "custom_tool_call" || type === "item_started") return "working";
    } catch {}
  }
  return "unknown";
}
function extractCodexTopic(tail) {
  const m = tail.match(/"type":"user"[^\n]*?"text":"([^"]{4,})"/) || tail.match(/"role":"user"[^\n]*?"text":"([^"]{4,})"/);
  if (m) return m[1].replace(/\\n/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return null;
}

// 데모 모드: CCB_DEMO=1 이면 세션명·주제를 예시로 치환 → 스크린샷용 (프라이버시 보호)
const DEMO = process.env.CCB_DEMO === "1";
const DEMO_SESSIONS = [
  { name: "my-web-app", topic: "add dark mode toggle to settings" },
  { name: "api-server", topic: "fix rate limiter edge case" },
  { name: "landing-page", topic: "refactor hero section" },
  { name: "cli-tool", topic: "write tests for parser" },
];
function anonymize(sessions) {
  if (!DEMO) return sessions;
  return sessions.map((s, i) => ({ ...s, ...DEMO_SESSIONS[i % DEMO_SESSIONS.length] }));
}

// Claude + Codex 세션을 최근순 병합, 팔레트 배정 (드롭다운은 최대 8개까지 전부 나열)
function getAllSessions() {
  const all = anonymize([...getSessions(), ...getCodexSessions()].sort((a, b) => b.mtime - a.mtime).slice(0, 8));
  all.forEach((s, i) => { s.color = SESSION_COLORS[i % SESSION_COLORS.length]; });
  return all;
}

function fmtAgo(mtime) {
  const min = Math.round((Date.now() - mtime) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}
function fmtUntil(timestamp) {
  const min = Math.max(0, Math.ceil((Number(timestamp) - Date.now()) / 60000));
  if (min < 1) return "now";
  if (min < 60) return `in ${min}m`;
  const hours = Math.floor(min / 60), rest = min % 60;
  return `in ${hours}h${rest ? ` ${rest}m` : ""}`;
}
function fmtK(n) { return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n); }
function safeDecode(value) {
  if (!value) return value;
  try { return decodeURIComponent(value); } catch { return value; }
}

// ───────────────────────── 데이터: Letsur (월 한도 대비 누적) ─────────────────────────
// Letsur는 "남은 잔액" API가 없고, 호출 응답마다 estimated_cost(unit)만 준다.
// 전략: 사용자가 config에 monthlyLimit을 적어두면, 누적 사용액을 로컬 원장에 쌓아
//       (한도 - 누적)/한도 를 배터리로 표시한다. 매월 1일 자동 리셋.
// 누적 입력 경로 2가지:
//   1) CLI로 직접 적립:  ccbattery letsur add <cost>        (프록시/래퍼 스크립트가 호출)
//   2) 사용량 파일 폴링:  config.usageFile 의 JSON { spent: <unit> } 를 그대로 읽음
const LETSUR_CONFIG = path.join(HOME, ".config", "claude-codex-battery", "letsur.json");
const LETSUR_LEDGER = path.join(CACHE_DIR, "letsur-ledger.json");
function ymNow() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }
function loadLetsurConfig() {
  try { return JSON.parse(readFileSync(LETSUR_CONFIG, "utf8")); } catch { return null; }
}
function loadLedger() {
  try {
    const l = JSON.parse(readFileSync(LETSUR_LEDGER, "utf8"));
    if (l.month !== ymNow()) return { month: ymNow(), spent: 0 }; // 월 바뀌면 리셋
    return l;
  } catch { return { month: ymNow(), spent: 0 }; }
}
function saveLedger(l) { try { writeFileSync(LETSUR_LEDGER, JSON.stringify(l)); } catch {} }
function letsurAdd(cost) {
  const l = loadLedger();
  l.spent = (l.spent || 0) + Number(cost || 0);
  saveLedger(l);
  return l;
}
function getLetsur() {
  const cfg = loadLetsurConfig();
  if (!cfg || !cfg.monthlyLimit) return null; // 설정 안 하면 표시 안 함
  let spent;
  if (cfg.usageFile) {
    try { spent = JSON.parse(readFileSync(cfg.usageFile.replace(/^~/, HOME), "utf8")).spent; } catch {}
  }
  if (spent == null) spent = loadLedger().spent || 0;
  const limit = cfg.monthlyLimit;
  const pct = Math.min(100, (spent / limit) * 100);
  return { spent, limit, pct, remain: Math.max(0, limit - spent), currency: cfg.currency || "unit", label: cfg.label || "Letsur" };
}

// R13: GitHub documents a personal Premium-request usage endpoint. This is a
// *spend report*, not a Copilot quota API: do not turn its dollar amount into a
// fabricated "remaining requests" percentage. It is deliberately disabled
// until the user supplies all three explicit settings below. In particular we
// never scan the keychain, git credential helper, or existing GH_TOKENs.
const COPILOT_CACHE_FILE = path.join(CACHE_DIR, "copilot-premium-usage.json");
const COPILOT_TTL_MS = 15 * 60 * 1000;
function copilotConfig() {
  const c = readConfig().copilot || {};
  return {
    enabled: c.enabled === true,
    username: typeof c.username === "string" ? c.username.trim() : "",
    tokenEnv: typeof c.tokenEnv === "string" ? c.tokenEnv.trim() : "",
    monthlyBudgetUsd: Number.isFinite(Number(c.monthlyBudgetUsd)) && Number(c.monthlyBudgetUsd) > 0 ? Number(c.monthlyBudgetUsd) : null,
  };
}
async function fetchCopilotPremiumUsage(cfg) {
  const fixture = process.env.CCB_TEST_COPILOT_FIXTURE;
  if (fixture) {
    appendFileSync(`${fixture}.calls`, `${Date.now()}\n`);
    const f = JSON.parse(readFileSync(fixture, "utf8"));
    return new Response(JSON.stringify(f.body ?? {}), { status: f.status ?? 200, headers: f.headers ?? {} });
  }
  const token = process.env[cfg.tokenEnv];
  if (!token) throw new Error("token environment variable is not set");
  return fetch(`https://api.github.com/users/${encodeURIComponent(cfg.username)}/settings/billing/premium_request/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });
}
function copilotAmount(body) {
  // GitHub's report is monetary. Keep the field mapping small and explicit so
  // an API schema change becomes unavailable, never a misleading zero.
  for (const key of ["total_amount", "gross_amount", "amount"]) {
    const value = Number(body?.[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}
async function getCopilotPremiumUsage() {
  const cfg = copilotConfig();
  const base = { kind: "cost", provider: "github-copilot", currency: "USD", budgetUsd: cfg.monthlyBudgetUsd };
  if (!cfg.enabled) return { ...base, enabled: false, state: "unavailable", reason: "disabled" };
  if (!cfg.username || !cfg.tokenEnv) return { ...base, enabled: true, state: "unavailable", reason: "needs-config" };
  try {
    const cached = JSON.parse(readFileSync(COPILOT_CACHE_FILE, "utf8"));
    if (Date.now() - Number(cached.at) < COPILOT_TTL_MS) return { ...base, ...cached, state: "fresh", source: "github-api" };
  } catch {}
  try {
    const res = await fetchCopilotPremiumUsage(cfg);
    if (!res.ok) throw new Error(`github api ${res.status}`);
    const amount = copilotAmount(await res.json());
    if (amount == null) throw new Error("github usage response has no recognized monetary total");
    const at = Date.now();
    const out = { ...base, enabled: true, state: "fresh", source: "github-api", at, observedAt: at, lastSuccessAt: at, amountUsd: amount,
      usedPct: cfg.monthlyBudgetUsd ? Math.min(100, amount / cfg.monthlyBudgetUsd * 100) : null };
    writeFileSync(COPILOT_CACHE_FILE, JSON.stringify(out));
    return out;
  } catch (e) {
    return { ...base, enabled: true, state: "unavailable", source: "github-api", reason: "request-failed", errorCode: String(e.message || e).match(/\b(401|403|404|429|5\d\d)\b/)?.[1] || null };
  }
}

// R13 local-file adapter. Cursor, Antigravity, or another tool can be added
// only when the user deliberately points at a file they own. This avoids the
// tempting but unsafe alternatives (scraping a browser cookie, reusing an
// unrelated access token, or executing arbitrary config text every 5 seconds).
// File schema: { "items": [{ "name": "Weekly", "used": 42, "resets": "..." }], "observedAt": <unix-ms optional> }
const EXTERNAL_PROVIDER_FRESH_MS = 15 * 60 * 1000;
const EXTERNAL_PROVIDER_MAX_STALE_MS = 2 * 60 * 60 * 1000;
function localProviderConfigs() {
  const list = readConfig().providers;
  if (!Array.isArray(list)) return [];
  return list.map((p, index) => ({
    id: typeof p?.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(p.id) ? p.id : `provider-${index + 1}`,
    label: typeof p?.label === "string" && p.label.trim() ? p.label.trim().slice(0, 48) : `Provider ${index + 1}`,
    usageFile: typeof p?.usageFile === "string" ? expandHomePath(p.usageFile) : "",
  })).filter((p) => p.usageFile);
}
function getExternalProviders() {
  return localProviderConfigs().map((cfg) => {
    try {
      const stat = statSync(cfg.usageFile);
      const payload = JSON.parse(readFileSync(cfg.usageFile, "utf8"));
      const rawItems = Array.isArray(payload?.items) ? payload.items : [];
      const items = rawItems
        .filter((item) => typeof item?.name === "string" && Number.isFinite(Number(item?.used)) && Number(item.used) >= 0 && Number(item.used) <= 100)
        .slice(0, 8)
        .map((item) => ({ name: item.name.slice(0, 64), used: Number(item.used), resets: item.resets ?? null }));
      const observedAt = Number.isFinite(Number(payload?.observedAt)) ? Number(payload.observedAt) : stat.mtimeMs;
      const age = Date.now() - observedAt;
      if (!items.length || age > EXTERNAL_PROVIDER_MAX_STALE_MS) {
        return { ...cfg, items: [], reason: !items.length ? "invalid-file" : "too-old", ...usageState({ state: "unavailable", source: "external-local-file", observedAt, lastSuccessAt: observedAt, stale: age > EXTERNAL_PROVIDER_MAX_STALE_MS }) };
      }
      const state = age <= EXTERNAL_PROVIDER_FRESH_MS ? "fresh" : "stale";
      return { ...cfg, items, ...usageState({ state, source: "external-local-file", observedAt, lastSuccessAt: observedAt, stale: state === "stale" }) };
    } catch {
      return { ...cfg, items: [], reason: "unreadable-file", ...usageState({ state: "unavailable", source: "external-local-file" }) };
    }
  });
}

// ───────────────────────── 포맷 유틸 ─────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function fmtReset(resets) {
  if (resets == null) return "";
  const t = typeof resets === "number" ? new Date(resets * 1000) : new Date(resets);
  if (isNaN(t)) return "";
  const now = new Date();
  const hm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const sameDay = t.toDateString() === now.toDateString();
  if (sameDay) return `resets ${hm} today`;
  return `resets ${t.getMonth() + 1}/${t.getDate()} (${DAYS[t.getDay()]}) ${hm}`;
}
function textBar(remain, len = 14) {
  const filled = Math.round((remain / 100) * len);
  return "█".repeat(filled) + "░".repeat(len - filled);
}
function heatHex(remain) {
  if (remain >= 50) return "#34c759";
  if (remain >= 20) return "#ffcc00";
  return "#ff453a";
}
function isDarkMode() {
  if (!IS_MAC) return true; // 비-macOS는 다크 가정 (메뉴바 호스트 앱마다 다름)
  try {
    execSync("defaults read -g AppleInterfaceStyle", { stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch { return false; }
}

// ───────────────────────── CLI 서브커맨드 ─────────────────────────
// ccbattery letsur add <cost>   → 이번 달 Letsur 사용액 누적 (프록시/래퍼가 호출)
// ccbattery letsur reset        → 이번 달 원장 초기화
const argv = process.argv.slice(2);
if (argv[0] === "letsur") {
  if (argv[1] === "add") { const l = letsurAdd(argv[2]); console.log(`total: ${l.spent} (${l.month})`); process.exit(0); }
  if (argv[1] === "reset") { saveLedger({ month: ymNow(), spent: 0 }); console.log("ledger reset"); process.exit(0); }
  if (argv[1] === "status") { console.log(JSON.stringify(getLetsur())); process.exit(0); }
}
if (argv[0] === "--init-config") {
  try {
    const result = createStarterConfig();
    console.log(result.created ? `starter config created: ${result.path}` : `config already exists: ${result.path}`);
    process.exit(0);
  } catch (e) {
    console.error(`could not create starter config: ${String(e.message || e)}`);
    process.exit(1);
  }
}
if (argv[0]?.startsWith("--select-codex-account=")) {
  const id = argv[0].slice("--select-codex-account=".length);
  const profile = loadCodexProfiles().find((entry) => entry.id === id && entry.configDir);
  if (!profile) { console.error("Codex selection unchanged: choose a configured profile ID"); process.exit(1); }
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, `${JSON.stringify({ ...readConfig(), codexSelectedAccount: id }, null, 2)}\n`);
    console.log(`selected local Codex profile: ${profile.name} (no login or credential changes)`);
    process.exit(0);
  } catch { console.error("Could not save Codex profile selection"); process.exit(1); }
}
if (["--notify-on", "--notify-off", "--notify-reset-on", "--notify-reset-off", "--notify-forecast-on", "--notify-forecast-off", "--notify-codex-forecast-on", "--notify-codex-forecast-off"].includes(argv[0]) || argv[0]?.startsWith("--notify-threshold=") || argv[0]?.startsWith("--notify-reset-soon=")) {
  try {
    const patch = argv[0] === "--notify-on" ? { enabled: true }
      : argv[0] === "--notify-off" ? { enabled: false }
      : argv[0] === "--notify-reset-on" ? { reset: true }
      : argv[0] === "--notify-reset-off" ? { reset: false }
      : argv[0] === "--notify-forecast-on" ? { forecast: true }
      : argv[0] === "--notify-forecast-off" ? { forecast: false }
      : argv[0] === "--notify-codex-forecast-on" ? { codexForecast: true }
      : argv[0] === "--notify-codex-forecast-off" ? { codexForecast: false }
      : argv[0].startsWith("--notify-reset-soon=") ? { resetSoonMinutes: Number(argv[0].split("=")[1]) }
      : { threshold: Number(argv[0].split("=")[1]) };
    if (patch.threshold != null && (!Number.isFinite(patch.threshold) || patch.threshold <= 0 || patch.threshold >= 100)) throw new Error("threshold must be between 1 and 99");
    if (patch.resetSoonMinutes != null && (!Number.isInteger(patch.resetSoonMinutes) || patch.resetSoonMinutes < 0 || patch.resetSoonMinutes > 60)) throw new Error("reset-soon minutes must be an integer from 0 to 60 (0 disables)");
    const notify = updateNotifyConfig(patch);
    console.log(`notifications updated: enabled=${notify.enabled === true} threshold=${notify.threshold ?? 20} reset=${notify.reset !== false} resetSoonMinutes=${notify.resetSoonMinutes ?? 0} forecast=${notify.forecast === true} codexForecast=${notify.codexForecast === true}`);
    process.exit(0);
  } catch (e) {
    console.error(`could not update notifications: ${String(e.message || e)}`);
    process.exit(1);
  }
}
if (argv[0]?.startsWith("--notify-target-threshold=") || argv[0]?.startsWith("--notify-target-reset=") || argv[0]?.startsWith("--notify-target-on=") || argv[0]?.startsWith("--notify-target-off=") || argv[0]?.startsWith("--notify-account-reconnect=")) {
  try {
    const prefix = argv[0].startsWith("--notify-target-threshold=") ? "--notify-target-threshold="
      : argv[0].startsWith("--notify-target-reset=") ? "--notify-target-reset="
      : argv[0].startsWith("--notify-target-on=") ? "--notify-target-on="
      : argv[0].startsWith("--notify-target-off=") ? "--notify-target-off=" : "--notify-account-reconnect=";
    const payload = argv[0].slice(prefix.length);
    const split = payload.lastIndexOf("=");
    const key = split < 1 ? payload : payload.slice(0, split);
    const value = split < 1 ? null : payload.slice(split + 1);
    if (!key) throw new Error("target is required");
    const patch = prefix.includes("threshold") ? { threshold: Number(value) }
      : prefix.includes("reset") ? { reset: value === "on" }
      : prefix.includes("reconnect") ? { reconnect: value === "on" }
      : { enabled: prefix.includes("-on=") };
    if (patch.threshold != null && (!Number.isFinite(patch.threshold) || patch.threshold <= 0 || patch.threshold >= 100)) throw new Error("threshold must be between 1 and 99");
    const override = updateNotifyTarget(key, patch);
    console.log(`notification target updated: ${key} enabled=${override.enabled == null ? "global" : override.enabled} threshold=${override.threshold ?? "global"} reset=${override.reset == null ? "global" : override.reset} reconnect=${override.reconnect == null ? "off" : override.reconnect}`);
    process.exit(0);
  } catch (e) {
    console.error(`could not update notification target: ${String(e.message || e)}`);
    process.exit(1);
  }
}
if (argv[0] === "--codex-forecast-history") {
  console.log(JSON.stringify({ format: "tokenjuice-codex-forecast-history-v1", scope: "local Codex pace observations, last 7 days",
    observations: readCodexForecastHistory().filter((r) => Date.now() - r.at <= 7 * 86400e3) }, null, 2));
  process.exit(0);
}
if (argv[0] === "--forecast-history") {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  console.log(JSON.stringify({
    format: "tokenjuice-forecast-history-v1",
    scope: "local pace observations, last 7 days",
    observations: readForecastHistory().filter((row) => row.at >= cutoff).map((row) => ({ key: row.key, at: row.at, used: row.used })),
  }, null, 2));
  process.exit(0);
}
// --renew-login: the dropdown's "Renew Claude login now" (user-initiated, so it
// ignores autoRenew:false but still refuses to run twice within a minute).
if (argv[0] === "--renew-login") {
  const started = triggerClaudeTokenRefresh({ trigger: "manual", minGapMs: 60 * 1000 });
  // Clear the back-off so the next render retries right after the renew.
  if (started) { try { writeFileSync(path.join(CACHE_DIR, "claude-0.fail.json"), JSON.stringify({ status: 401, at: Date.now(), until: Date.now() + 20 * 1000, refreshing: true })); } catch {} }
  console.log(started ? "renew started" : findClaudeBin() ? "renew skipped (ran less than a minute ago)" : "claude CLI not found");
  process.exit(started ? 0 : 1);
}

// ───────────────────────── 메인 ─────────────────────────
const accounts = loadAccounts();
const claudes = await Promise.all(accounts.map((a, i) => getClaude(a, i)));
recordForecastObservations(claudes);
for (let accountIndex = 0; accountIndex < claudes.length; accountIndex++) {
  const account = claudes[accountIndex];
  const state = account.state ?? (account.items.length ? "fresh" : "unavailable");
  account.items = (account.items || []).map((item) => ({ ...item, forecast: forecastForItem(accountIndex, item, state) }));
}
const codexProfiles = loadCodexProfiles();
const codexReadings = codexProfiles.map((profile) => ({ ...getCodex(profile), profile }));
for (const reading of codexReadings) {
  recordCodexForecastObservations(reading);
  reading.items = reading.items.map((item) => ({ ...item, forecast: codexForecastForItem(reading, item) }));
}
const selectedProfile = selectedCodexProfile(codexProfiles);
const codex = codexReadings.find((reading) => reading.profile.id === selectedProfile.id) || { ...getCodex(selectedProfile), profile: selectedProfile };
const [sessions, letsur, copilot, providers] = [getAllSessions(), getLetsur(), await getCopilotPremiumUsage(), getExternalProviders()];
const dark = isDarkMode();
const asJson = argv.includes("--json");
const asText = argv.includes("--text");
const SHOW_TOPICS = topicsEnabled();

// Developer mode is explicit and read-only. It exposes evidence behind local
// estimates without exposing prompt/topic text, transcript lines, credentials,
// or changing the normal menu/JSON contract.
if (argv.includes("--developer")) {
  const line = (label, value) => `${label}: ${String(value ?? "unavailable")}`;
  const out = [
    "TokenJuice developer mode · local read-only evidence",
    line("platform", process.platform),
    line("engine", "local files only; no prompt/topic output"),
    line("forecast", forecastEnabled() ? "enabled · local pace estimate" : "disabled"),
  ];
  claudes.forEach((account, index) => {
    out.push(`Claude[${index}] state=${account.state ?? "unavailable"} source=${sourceLabel(account.source)} lastSuccess=${account.lastSuccessAt ? new Date(account.lastSuccessAt).toISOString() : "never"}`);
    for (const item of account.items || []) {
      const f = item.forecast;
      out.push(`  ${item.name}: used=${item.used}% reset=${item.resets ?? "unknown"} forecast=${f ? `samples=${f.samples}, pace=${f.usedPerHour}%/h, exhaustion=${f.exhaustionAt ? new Date(f.exhaustionAt).toISOString() : "unknown"}, beforeReset=${f.beforeReset}` : "unavailable"}`);
    }
  });
  for (const reading of codexReadings) {
    out.push(`${codexAccountLabel(reading)} state=${reading.state ?? "unavailable"} source=${sourceLabel(reading.source || "codex-jsonl")} lastSuccess=${reading.lastSuccessAt ? new Date(reading.lastSuccessAt).toISOString() : "never"}`);
    for (const item of reading.items) if (item.forecast) out.push(`  ${codexAccountLabel(reading)} ${item.name}: local pace estimate · samples=${item.forecast.samples} · pace=${item.forecast.usedPerHour}%/h`);
  }
  for (const session of sessions) {
    out.push(`session ${session.platform}/${session.name}/${session.id}: status=${session.status || "unknown"} model=${session.model || "unknown"} context=${Math.round(session.pct || 0)}% (${session.used}/${session.win}) mtime=${session.mtime ? new Date(session.mtime).toISOString() : "unknown"}`);
  }
  console.log(out.join("\n"));
  process.exit(0);
}

// Compact, opt-in shell/statusline output. It is deliberately one line,
// prompt-free, and reuses the same local/provider reads as the normal render.
if (argv.includes("--statusline")) {
  const quota = claudes.flatMap((account, accountIndex) => (account.items || []).map((item) => {
    const prefix = accounts.length > 1 ? `${accounts[accountIndex]?.name || "Claude"} ` : "Claude ";
    return `${prefix}${item.name}: ${Math.max(0, Math.round(100 - item.used))}% left`;
  })).slice(0, 3);
  const active = sessions.filter((session) => Date.now() - session.mtime < 15 * 60 * 1000)
    .sort((a, b) => (b.pct || 0) - (a.pct || 0))[0];
  const parts = ["TokenJuice", ...quota];
  if (active) parts.push(`context ${Math.round(active.pct || 0)}%`);
  console.log(parts.join(" | "));
  process.exit(0);
}

// 노치 맥북(COMPACT): 메뉴바 아이콘이 노치에 가려 안 보이므로 폭을 최소화.
//   한도는 첫 항목(5시간)만, 세션은 위험순 1개만. 드롭다운은 그대로 전부 표시.
const groups = [];
for (let ai = 0; ai < accounts.length; ai++) {
  const label = accounts.length > 1 ? (accounts[ai].name || "C")[0].toUpperCase() : "C";
  const cl = claudes[ai];
  if (cl.items.length && !cl.stale) { // stale = last good number, not live → "?"
    const items = (COMPACT ? cl.items.slice(0, 1) : cl.items).map((i) => ({ remain: 100 - i.used }));
    groups.push({ label, color: CLAUDE_ORANGE, items });
  } else groups.push({ label, color: CLAUDE_ORANGE, items: [{ remain: null }] });
}
// 세션: 메뉴바 표시 개수 (컴팩트=1, 일반=3). 드롭다운은 개수 제한 없이 전부.
const MENUBAR_MAX = COMPACT ? 1 : 3;
const activeClaudeSessions = sessions.filter((s) => s.platform === "claude" && Date.now() - s.mtime < 15 * 60 * 1000);
const activeCodexSessions = sessions.filter((s) => s.platform === "codex" && Date.now() - s.mtime < 15 * 60 * 1000);
const liveClaudeSessions = activeClaudeSessions.slice(0, 2); // "곧 컴팩트" 경고용(2개)은 별개로 유지
const liveCodexSessions = activeCodexSessions.slice(0, 2);
if (activeClaudeSessions.length) {
  // 메뉴바엔 "가장 위험한(적게 남은)" 세션 우선 노출 → 놓치면 안 되는 걸 항상 보이게
  const byRisk = [...activeClaudeSessions].sort((a, b) => b.pct - a.pct);
  const shown = byRisk.slice(0, MENUBAR_MAX);
  const items = shown.map((s) => ({ remain: 100 - s.pct, color: s.color }));
  const overflow = activeClaudeSessions.length - shown.length;
  groups.push({ label: "S", color: CLAUDE_ORANGE, items, overflow });
}
if (codex.items.length && codex.state === "fresh") {
  const cxItems = (COMPACT ? codex.items.slice(0, 1) : codex.items).map((i) => ({ remain: 100 - i.used }));
  groups.push({ label: "X", color: CODEX_VIOLET, items: cxItems });
} else if (codex.items.length) groups.push({ label: "X", color: CODEX_VIOLET, items: [{ remain: null }] });
if (activeCodexSessions.length) {
  const byRisk = [...activeCodexSessions].sort((a, b) => b.pct - a.pct);
  const shown = byRisk.slice(0, MENUBAR_MAX);
  const items = shown.map((s) => ({ remain: 100 - s.pct, color: s.color }));
  const overflow = activeCodexSessions.length - shown.length;
  groups.push({ label: "S", color: CODEX_VIOLET, items, overflow });
}
if (letsur) groups.push({ label: "L", color: LETSUR_CYAN, items: [{ remain: 100 - letsur.pct }] });

// ─ CLI 출력 모드 (윈도우/리눅스/터미널용) ─
// ───────────────────────── R8 · 진단 보고서 (비밀값 없음) ─────────────────────────
// Plain lines a user can paste into an issue. Never includes tokens, account
// e-mails, prompt topics, or response bodies — only states, sources, times.
function buildDiagnostics() {
  const lines = [];
  lines.push(`TokenJuice diagnostics · ${new Date().toISOString()}`);
  lines.push(`platform: ${process.platform} · bun ${process.versions?.bun || "?"} · compact ${COMPACT}`);
  lines.push(`config: api=${apiModeEnabled()} · autoRenew=${autoRenewEnabled()} · notify=${notifyConfig().enabled ? "on" : "off"} · forecast=${forecastEnabled() ? "on" : "off"} · sessionStatus=${sessionStatusEnabled() ? "on" : "off"} · topics=${SHOW_TOPICS}`);
  claudes.forEach((cl, i) => {
    const state = cl.state ?? (cl.stale ? "stale" : cl.items.length ? "fresh" : "unavailable");
    const b = trustBadge({ state, source: cl.source });
    const last = cl.lastSuccessAt ?? cl.at;
    const retry = fmtRetryAt(cl.retryAt);
    lines.push(`claude[${i}]: ${stateLabel(state)} · trust ${b.level} · ${sourceLabel(cl.source)} · last success ${last ? fmtAgo(last) : "never"}${retry ? ` · ${retry}` : ""}${cl.errorCode ? ` · http ${cl.errorCode}` : ""}${cl.reason ? ` · reason ${cl.reason}` : ""}`);
  });
  if (IS_MAC && apiModeEnabled()) lines.push(`claude login renewal: ${autoRenewEnabled() ? "auto" : "manual"} · ${renewStatusLine()} · cli ${findClaudeBin() ? "found" : "not found"}`);
  codexReadings.forEach((reading, index) => {
    if (reading.items.length || !reading.profile.legacy || existsSync(reading.profile.configDir)) {
      const last = reading.lastSuccessAt ?? reading.at;
      lines.push(`${reading.profile.legacy ? "codex" : `codex[${index}]`}: ${stateLabel(reading.state)} · trust ${trustBadge({ state: reading.state, source: "codex-jsonl" }).level} · ${sourceLabel("codex-jsonl")} · last success ${last ? fmtAgo(last) : "never"}${reading.reason ? ` · reason ${reading.reason}` : ""}`);
    }
  });
  if (selectedProfile.reason) lines.push(`codex selection: ${selectedProfile.reason} · no fallback account`);
  if (copilot.enabled) {
    const last = copilot.lastSuccessAt ?? copilot.at;
    lines.push(`copilot: ${stateLabel(copilot.state)} · ${copilot.state === "fresh" ? "GitHub Premium-request spend" : copilot.reason || "unavailable"} · last success ${last ? fmtAgo(last) : "never"}${copilot.errorCode ? ` · http ${copilot.errorCode}` : ""}`);
  }
  for (const provider of providers) {
    const last = provider.lastSuccessAt ?? provider.observedAt;
    lines.push(`provider:${provider.id}: ${stateLabel(provider.state)} · ${sourceLabel(provider.source)} · last success ${last ? fmtAgo(last) : "never"}${provider.reason ? ` · reason ${provider.reason}` : ""}`);
  }
  lines.push(`sessions: ${sessions.filter((s) => s.platform === "claude").length} claude · ${sessions.filter((s) => s.platform === "codex").length} codex (context estimates)`);
  return lines;
}

// ───────────────────────── R6 · 임계치·리셋 알림 (opt-in) ─────────────────────────
// Off unless config.json has {"notify": {"enabled": true}}. Fires a macOS
// notification once when a fresh limit drops to the threshold, and once when it
// comes back (reset). Stale/fallback/blocked numbers never trigger anything.
function resetSoonMinutes(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 && value <= 60 ? value : fallback;
}
function notifyConfig() {
  const n = readConfig().notify || {};
  const threshold = Number(n.threshold);
  return {
    enabled: n.enabled === true,
    threshold: Number.isFinite(threshold) && threshold > 0 && threshold < 100 ? threshold : 20,
    reset: n.reset !== false,
    resetSoonMinutes: resetSoonMinutes(n.resetSoonMinutes),
    forecast: n.forecast === true,
    codexForecast: n.codexForecast === true,
    overrides: n.overrides && typeof n.overrides === "object" ? n.overrides : {},
  };
}
function notificationPolicyFor(entry) {
  const global = notifyConfig();
  const override = global.overrides[entry.key] || {};
  const threshold = Number(override.threshold);
  return {
    enabled: override.enabled == null ? global.enabled : override.enabled === true,
    threshold: Number.isFinite(threshold) && threshold > 0 && threshold < 100 ? threshold : global.threshold,
    reset: override.reset == null ? global.reset : override.reset !== false,
    resetSoonMinutes: resetSoonMinutes(override.resetSoonMinutes, global.resetSoonMinutes),
    forecast: override.forecast == null ? global.forecast : override.forecast === true,
    codexForecast: override.codexForecast == null ? global.codexForecast : override.codexForecast === true,
  };
}
function notificationPolicyForAccount(accountIndex) {
  const override = notifyConfig().overrides[`claude:${accountIndex}`] || {};
  return { reconnect: override.reconnect === true };
}
const NOTIFY_STATE_FILE = path.join(CACHE_DIR, "notify-state.json");
const NOTIFY_HYSTERESIS = 5; // percent points above the threshold before "back"
function sendNotification(title, body) {
  const log = process.env.CCB_TEST_NOTIFY_LOG; // tests only
  if (log) { appendFileSync(log, `${title}\t${body}\n`); return; }
  if (!IS_MAC) return;
  // Notification text can include provider-facing labels. Pass it as one
  // osascript argument rather than placing it in shell double quotes, where
  // `$()` and backticks would otherwise be interpreted before AppleScript.
  const appleString = (s) => String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, " ");
  const script = `display notification "${appleString(body)}" with title "${appleString(title)}"`;
  try { execFileSync("/usr/bin/osascript", ["-e", script], { stdio: "ignore", timeout: 5000 }); } catch {}
}
function runNotifications(entries) {
  let st = {};
  try { st = JSON.parse(readFileSync(NOTIFY_STATE_FILE, "utf8")) || {}; } catch {}
  let changed = false;
  for (const e of entries) {
    if (e.kind === "reconnect") {
      const cfg = notificationPolicyForAccount(e.accountIndex);
      const prev = st[e.key] || { active: false };
      const active = cfg.reconnect && e.state === "auth_expired" && !e.stale;
      if (active && !prev.active) {
        const last = e.lastSuccessAt ? ` · last success ${fmtAgo(e.lastSuccessAt)}` : " · last success never";
        const retry = e.retryAt ? ` · ${fmtRetryAt(e.retryAt)}` : "";
        sendNotification("TokenJuice", `reconnect required · ${e.label} · reason login expired · next action: run claude login${last}${retry}`);
        st[e.key] = { active: true, at: Date.now() }; changed = true;
      } else if (!active && prev.active) {
        st[e.key] = { active: false, at: Date.now() }; changed = true;
      }
      continue;
    }
    const cfg = notificationPolicyFor(e);
    if (!cfg.enabled || e.state !== "fresh" || !Number.isFinite(e.remain)) continue;
    const prev = st[e.key] || { low: false };
    if (!prev.low && e.remain <= cfg.threshold) {
      sendNotification("TokenJuice", `threshold alert · ${e.label}: ${Math.round(e.remain)}% left${e.resets ? ` · ${fmtReset(e.resets)}` : ""}`);
      st[e.key] = { ...prev, low: true, at: Date.now() }; changed = true;
    } else if (prev.low && e.remain > cfg.threshold + NOTIFY_HYSTERESIS) {
      if (cfg.reset) sendNotification("TokenJuice", `reset alert · ${e.label} is back: ${Math.round(e.remain)}% left`);
      st[e.key] = { ...prev, low: false, at: Date.now() }; changed = true;
    }
    // Separately opted in: warn once per provider-supplied reset timestamp.
    // Missing/past reset times are never inferred, and a wake does not replay
    // a missed warning. Preserve threshold hysteresis alongside this marker.
    const resetAt = typeof e.resets === "number" ? e.resets * 1000 : Date.parse(e.resets);
    const untilReset = resetAt - Date.now();
    const current = st[e.key] || prev;
    if (cfg.resetSoonMinutes > 0 && Number.isFinite(resetAt) && untilReset > 0
      && untilReset <= cfg.resetSoonMinutes * 60000 && current.resetSoonAt !== resetAt) {
      sendNotification("TokenJuice", `reset soon · ${e.label} · ${fmtReset(e.resets)} · next action: wait for the reset, then check fresh quota`);
      st[e.key] = { ...current, resetSoonAt: resetAt, at: Date.now() }; changed = true;
    }
    const forecast = e.forecast;
    const forecastKey = e.forecastKey || e.key;
    const forecastState = st[forecastKey] || prev;
    const now = Date.now();
    // Showing a pace estimate does not opt the user in to notifications. A
    // known future reset and recent, sufficient observations are required;
    // unknown reset times must not turn "beforeReset" into a false claim.
    if ((e.provider === "codex" ? cfg.codexForecast : cfg.forecast) && forecast?.kind === "local_pace_estimate" && forecast.samples >= 2
      && Number.isFinite(forecast.observedAt) && forecast.observedAt <= now && now - forecast.observedAt <= 15 * 60000
      && Number.isFinite(resetAt) && resetAt > now
      && Number.isFinite(forecast.exhaustionAt) && forecast.exhaustionAt > now && forecast.exhaustionAt < resetAt
      && forecastState.forecastResetAt !== resetAt) {
      sendNotification("TokenJuice", `forecast alert · ${e.label} · local pace estimate (${forecast.samples} samples): may run out before reset · next action: save a checkpoint or wait`);
      st[forecastKey] = { ...forecastState, forecastResetAt: resetAt, at: now }; changed = true;
    }
  }
  if (changed) { try { writeFileSync(NOTIFY_STATE_FILE, JSON.stringify(st)); } catch {} }
}
function notificationEntries() {
  const out = [];
  claudes.forEach((cl, i) => {
    const state = cl.state ?? (cl.items.length ? "fresh" : "unavailable");
    out.push({
      key: `claude:${i}:reconnect`, kind: "reconnect", accountIndex: i,
      label: accounts[i]?.name || `Claude account ${i + 1}`, state, stale: !!cl.stale,
      lastSuccessAt: cl.lastSuccessAt ?? cl.at ?? null, retryAt: cl.retryAt ?? null,
    });
    for (const it of cl.items) out.push({ key: `claude:${i}:${it.name}`, label: `Claude ${it.name}`, remain: 100 - Number(it.used), resets: it.resets, forecast: it.forecast, state });
  });
  for (const reading of codexReadings) for (const it of reading.items) out.push({ key: reading.profile.legacy ? `codex:${it.name}` : `codex:${reading.profile.id}:${it.role}`, provider: "codex", forecastKey: it.paceKey ? `codex:forecast:${it.paceKey}` : null, label: `${codexAccountLabel(reading)} ${it.name}`, remain: 100 - Number(it.used), resets: it.resets, forecast: it.forecast, state: reading.state ?? "fresh" });
  return out;
}

// R12/R14 foundation: a companion never receives a credential, raw transcript,
// prompt, or diagnostics. Export is explicit and local-only; synchronization is
// intentionally not implemented until its encryption/privacy design is approved.
const WIDGET_SNAPSHOT_FILE = path.join(CACHE_DIR, "widget-snapshot.json");
const ENCRYPTED_SYNC_BUNDLE_FILE = path.join(CACHE_DIR, "widget-sync.tokenjuice");
function buildWidgetSnapshot() {
  const quota = (item) => ({
    name: item.name,
    used: Number(item.used),
    resets: item.resets ?? null,
    state: item.state ?? null,
    forecast: item.forecast ? {
      kind: "local_pace_estimate",
      beforeReset: !!item.forecast.beforeReset,
      exhaustionAt: item.forecast.exhaustionAt ?? null,
      samples: Number(item.forecast.samples) || 0,
      usedPerHour: Number(item.forecast.usedPerHour) || 0,
    } : null,
  });
  return {
    contractVersion: 1,
    generatedAt: Date.now(),
    transport: "local_export_only",
    claude: claudes.map((account, index) => ({
      account: accounts[index]?.name || "Claude",
      state: account.state ?? "unavailable",
      source: account.source ?? null,
      lastSuccessAt: account.lastSuccessAt ?? account.at ?? null,
      retryAt: account.retryAt ?? null,
      items: (account.items || []).map(quota),
    })),
    codex: {
      account: codex.profile?.name ?? "Codex",
      state: codex.state ?? "unavailable",
      source: codex.source ?? "codex-jsonl",
      lastSuccessAt: codex.lastSuccessAt ?? codex.at ?? null,
      items: (codex.items || []).map((item) => quota({ ...item, name: codex.profile?.legacy ? item.name : `${codex.profile?.name} · ${item.name}` })),
    },
    providers: providers.map((provider) => ({
      id: provider.id, label: provider.label, state: provider.state ?? "unavailable",
      source: provider.source ?? "external-local-file", lastSuccessAt: provider.lastSuccessAt ?? null,
      items: (provider.items || []).map(quota),
    })),
    // Context is metadata-only: never export topic/prompt text or transcripts.
    sessions: sessions.map((session) => ({
      platform: session.platform,
      name: session.name,
      id: session.id,
      branch: session.branch ?? null,
      status: session.status ?? null,
      model: session.model ?? null,
      used: Number(session.used) || 0,
      pct: Number(Number(session.pct || 0).toFixed(1)),
      mtime: session.mtime ?? null,
      win: Number(session.win) || null,
      kind: "context",
    })),
  };
}

// R14: an optional, encrypted hand-off for another one of the user's devices.
// It is intentionally *not* an automatic cloud sync: no account, endpoint,
// credential, or plaintext snapshot leaves this process. The passphrase comes
// from a one-shot environment variable and is never written to config/cache.
const SYNC_BUNDLE_AAD = "tokenjuice-sync-v1";
const SYNC_BUNDLE_ITERATIONS = 310000;
function buildEncryptedSyncBundle(snapshot, passphrase) {
  if (!passphrase) throw new Error("TOKENJUICE_SYNC_PASSPHRASE is required for encrypted export");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(passphrase, salt, SYNC_BUNDLE_ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(SYNC_BUNDLE_AAD));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return {
    format: SYNC_BUNDLE_AAD,
    contractVersion: 1,
    transport: "encrypted_manual_transfer",
    generatedAt: Date.now(),
    crypto: {
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations: SYNC_BUNDLE_ITERATIONS,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
  };
}

// R20: report only facts available in local session logs. A configured Claude
// price table can make a subset available; Codex and unpriced/partial sessions
// remain explicit instead of receiving an inferred provider price.
function buildProjectReport() {
  const projects = new Map();
  for (const session of sessions) {
    const key = `${session.platform}:${session.name}`;
    const current = projects.get(key) || {
      project: session.name,
      platform: session.platform,
      sessions: 0,
      newestAt: 0,
      highestContextPct: 0,
      contextTokens: 0,
      contextWindow: 0,
      models: new Set(),
      costUsd: 0,
      pricedTurns: 0,
      unpricedTurns: 0,
      costReasons: new Set(),
    };
    current.sessions++;
    current.newestAt = Math.max(current.newestAt, session.mtime || 0);
    current.highestContextPct = Math.max(current.highestContextPct, Number(session.pct) || 0);
    current.contextTokens += Number(session.used) || 0;
    current.contextWindow = Math.max(current.contextWindow, Number(session.win) || 0);
    if (session.model) current.models.add(session.model);
    if (session.cost?.state === "available" || session.cost?.state === "partial") {
      current.costUsd += Number(session.cost.amountUsd) || 0;
      current.pricedTurns += Number(session.cost.pricedTurns) || 0;
      current.unpricedTurns += Number(session.cost.unpricedTurns) || 0;
    } else {
      current.unpricedTurns++;
      if (session.cost?.reason) current.costReasons.add(session.cost.reason);
      else if (session.platform === "codex") current.costReasons.add("codex-token-split-or-pricing-not-configured");
    }
    projects.set(key, current);
  }
  const projectRows = [...projects.values()].map((project) => {
    const { models, costReasons, costUsd, pricedTurns, unpricedTurns, ...base } = project;
    const hasKnownCost = pricedTurns > 0;
    return {
      ...base, highestContextPct: Number(base.highestContextPct.toFixed(1)), models: [...models],
      cost: hasKnownCost
        ? { state: unpricedTurns ? "partial" : "available", currency: "USD", amountUsd: Number(costUsd.toFixed(8)), pricedTurns, unpricedTurns }
        : { state: "unavailable", reason: [...costReasons][0] || "provider-pricing-or-token-split-not-configured" },
    };
  });
  const available = projectRows.filter((project) => project.cost.state === "available");
  const partial = projectRows.filter((project) => project.cost.state === "partial");
  const unavailable = projectRows.filter((project) => project.cost.state === "unavailable");
  return {
    contractVersion: 1,
    generatedAt: Date.now(),
    scope: "local sessions touched in the last 6 hours",
    cost: available.length || partial.length
      ? { state: partial.length || unavailable.length ? "partial" : "available", currency: "USD", projectCount: available.length + partial.length, unavailableProjectCount: unavailable.length }
      : { state: "unavailable", reason: "provider pricing and complete token splits are not configured" },
    projects: projectRows.sort((a, b) => b.newestAt - a.newestAt),
  };
}

if (argv.includes("--diagnostics") || argv.includes("--copy-diagnostics")) {
  const text = buildDiagnostics().join("\n");
  if (argv.includes("--copy-diagnostics") && IS_MAC) {
    try { execSync("pbcopy", { input: text }); } catch {}
  }
  console.log(text);
  process.exit(0);
}

if (argv.includes("--widget-snapshot") || argv.includes("--export-widget-snapshot") || argv.includes("--open-pocket") || argv.includes("--export-sync-bundle")) {
  const snapshot = buildWidgetSnapshot();
  if (argv.includes("--export-sync-bundle")) {
    try {
      const bundle = buildEncryptedSyncBundle(snapshot, process.env.TOKENJUICE_SYNC_PASSPHRASE);
      writeFileSync(ENCRYPTED_SYNC_BUNDLE_FILE, `${JSON.stringify(bundle, null, 2)}\n`);
      console.log(`encrypted sync bundle exported locally: ${ENCRYPTED_SYNC_BUNDLE_FILE}`);
    } catch (e) {
      console.error(`could not export encrypted sync bundle: ${String(e.message || e)}`);
      process.exit(1);
    }
  } else if (argv.includes("--export-widget-snapshot") || argv.includes("--open-pocket")) {
    try {
      writeFileSync(WIDGET_SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
      console.log(`widget snapshot exported locally: ${WIDGET_SNAPSHOT_FILE}`);
      // 메뉴에서 명시적으로 누른 경우에만 Pocket을 연다. 스냅샷은 로컬 파일로만
      // 남고 URL·클립보드·네트워크 요청에 포함하지 않는다.
      if (argv.includes("--open-pocket") && IS_MAC && process.env.CCB_TEST_NO_OPEN !== "1") {
        execFileSync("open", ["https://kendrick-na.github.io/tokenjuice/"]);
        console.log("TokenJuice Pocket opened; choose the exported local snapshot to import it.");
      }
    } catch (e) {
      console.error(`could not export widget snapshot: ${String(e.message || e)}`);
      process.exit(1);
    }
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
  process.exit(0);
}

if (argv.includes("--project-report")) {
  console.log(JSON.stringify(buildProjectReport(), null, 2));
  process.exit(0);
}

if (asJson) {
  // 기본은 topic(프롬프트 원문) 제거. 트레이 앱·외부 위젯이 이 출력을 그대로 렌더하므로
  // 여기서 빼는 게 유일하게 확실한 차단 지점이다.
  const safeSessions = SHOW_TOPICS ? sessions : sessions.map(({ topic, ...rest }) => rest);
  console.log(JSON.stringify({
    // `reason` matters to consumers: without it a tray cannot tell "not logged
    // in" from "API mode is off" and ends up printing the wrong fix.
    claude: claudes.map((c, i) => ({
      account: accounts[i]?.name, items: c.items, reason: c.reason ?? null,
      source: c.source ?? null, sourceLabel: sourceLabel(c.source),
      state: c.state ?? (c.stale ? "stale" : c.items.length ? "fresh" : "unavailable"),
      observedAt: c.observedAt ?? c.at ?? null,
      lastSuccessAt: c.lastSuccessAt ?? c.at ?? null,
      retryAt: c.retryAt ?? null,
      errorCode: c.errorCode ?? null,
      error: c.error ?? null, stale: !!c.stale,
      kind: "quota",
      trust: trustBadge({ state: c.state ?? (c.stale ? "stale" : c.items.length ? "fresh" : "unavailable"), source: c.source }),
    })),
    sessions: safeSessions.map((s) => ({ ...s, kind: "context" })),
    codex: codex.items,
    codexAccounts: codexReadings.map(publicCodexAccount),
    codexStatus: {
      account: codex.profile?.name ?? "Codex",
      accountId: codex.profile?.id ?? null,
      reason: codex.reason ?? null,
      source: codex.source ?? "codex-jsonl",
      sourceLabel: sourceLabel(codex.source || "codex-jsonl"),
      state: codex.state ?? (codex.items.length ? "fresh" : "unavailable"),
      observedAt: codex.observedAt ?? codex.at ?? null,
      lastSuccessAt: codex.lastSuccessAt ?? codex.at ?? null,
      kind: "quota",
      trust: trustBadge({ state: codex.state ?? (codex.items.length ? "fresh" : "unavailable"), source: codex.source || "codex-jsonl" }),
    },
    providers: providers.map((provider) => ({
      id: provider.id, label: provider.label, items: provider.items,
      source: provider.source, sourceLabel: sourceLabel(provider.source), reason: provider.reason ?? null,
      state: provider.state, observedAt: provider.observedAt ?? null, lastSuccessAt: provider.lastSuccessAt ?? null,
      kind: "quota", trust: trustBadge({ state: provider.state, source: provider.source }),
    })),
    renew: IS_MAC && apiModeEnabled() ? { auto: autoRenewEnabled(), last: readRenewStatus() } : null,
    notify: notifyConfig(),
    contractVersion: 2,
    letsur,
    copilot,
    topicsIncluded: SHOW_TOPICS,
  }, null, 2));
  process.exit(0);
}
if (asText) {
  const line = (label, r) => `${label} ${textBar(Math.round(r), 10)} ${Math.round(r)}%`;
  const parts = [];
  for (const c of claudes) {
    const state = c.state ?? (c.items.length ? "fresh" : "unavailable");
    // A text consumer cannot render the detailed stale/fallback note from the
    // SwiftBar menu. Never let stale, rate-limited, or expired values look live.
    if (state === "fresh" || state === "fallback") {
      const label = state === "fallback" ? "C(fallback)" : "C";
      for (const i of c.items) parts.push(line(label, 100 - i.used));
    } else {
      parts.push(`C(${stateLabel(state)})`);
    }
  }
  for (const s of activeClaudeSessions.slice(0, 3)) parts.push(line("s·C", 100 - s.pct));
  const codexState = codex.state ?? (codex.items.length ? "fresh" : "unavailable");
  if (codexState === "fresh" || codexState === "fallback") {
    for (const i of codex.items) parts.push(line(codexState === "fallback" ? "X(fallback)" : "X", 100 - i.used));
  } else if (codex.items.length || codexState !== "unavailable") {
    parts.push(`X(${stateLabel(codexState)})`);
  }
  for (const s of activeCodexSessions.slice(0, 3)) parts.push(line("s·X", 100 - s.pct));
  if (letsur) parts.push(line("L", 100 - letsur.pct));
  for (const provider of providers) {
    if (provider.state === "fresh") for (const item of provider.items) parts.push(line(provider.label, 100 - item.used));
    else parts.push(`${provider.label}(${stateLabel(provider.state)})`);
  }
  console.log(parts.join("\n"));
  process.exit(0);
}

const out = [];
const priorityCandidates = [];
claudes.forEach((cl, accountIndex) => {
  const state = cl.state ?? (cl.stale ? "stale" : cl.items.length ? "fresh" : "unavailable");
  const accountLabel = accounts.length > 1 ? `Claude ${accounts[accountIndex]?.name || accountIndex + 1}` : "Claude";
  // A non-fresh reading is always more urgent than a number: it must not be
  // displaced by a lower but trustworthy quota from another account.
  if (state !== "fresh" && state !== "fallback") priorityCandidates.push({ score: 300, text: `NOW · ${accountLabel} · ${stateDisplayLabel(state)} · ${stateRecoveryHint(state)}` });
  // Larger used-percent means higher depletion risk, just like context pct.
  // Remaining-percent is only presentation text; sorting it descending would
  // put the healthiest quota above the most depleted one.
  for (const item of cl.items || []) priorityCandidates.push({ score: Number(item.used), text: `NOW · ${accountLabel} · ${item.name} · ${Math.round(100 - Number(item.used))}% left` });
});
for (const reading of codexReadings) {
  const state = reading.state ?? "unavailable", label = codexAccountLabel(reading);
  if ((reading.items.length || !reading.profile.legacy || existsSync(reading.profile.configDir)) && state !== "fresh" && state !== "fallback") priorityCandidates.push({ score: 300, text: `NOW · ${label} · ${stateDisplayLabel(state)} · ${reading.reason === "invalid_profiles" ? "fix codexAccounts in config.json" : stateRecoveryHint(state)}` });
  for (const item of reading.items) priorityCandidates.push({ score: Number(item.used), text: `NOW · ${label} · ${item.name} · ${Math.round(100 - Number(item.used))}% left` });
}
if (selectedProfile.reason === "invalid_selection") priorityCandidates.push({ score: 301, text: "NOW · Codex selection unavailable · choose a configured local profile below" });
for (const session of [...activeClaudeSessions, ...activeCodexSessions]) priorityCandidates.push({ score: Number(session.pct) || 0, text: `NOW · ${session.platform === "claude" ? "Claude" : "Codex"} context · ${Math.round(Number(session.pct) || 0)}% used · local estimate` });
const priority = priorityCandidates.sort((a, b) => b.score - a.score)[0];
// Pixel-battery header. Sleep/wake staleness is handled outside the plugin:
// ensure-swiftbar-visible.sh forces swiftbar://refreshallplugins, so the image
// is re-issued right after wake. A Claude value we can't trust shows as "?".
out.push(`| image=${renderImage(groups, dark)}`);
out.push("---");
if (priority) out.push(`${priority.text} | size=13 color=#ffcc00`);
out.push("---");

// A compact/notch header can only show lettered batteries. Put an explicit
// text legend at the very top of the click panel so C/S/X never becomes the
// only way to learn provider, freshness, or context meaning.
if (COMPACT) {
  const claudeStates = claudes.map((cl) => stateDisplayLabel(cl.state ?? (cl.stale ? "stale" : cl.items.length ? "fresh" : "unavailable"))).join(", ");
  const codexState = stateDisplayLabel(codex.state ?? (codex.items.length ? "fresh" : "unavailable"));
  const sessionState = activeClaudeSessions.length || activeCodexSessions.length ? "local context estimate" : "no active context";
  out.push(`Compact header key · C = Claude (${claudeStates || "unavailable"}) · S = ${sessionState} · X = Codex (${codexState}) | size=11 color=#8b949e`);
  out.push("---");
}

const SELF = path.resolve(process.argv[1] || "");
for (let ai = 0; ai < accounts.length; ai++) {
  const cl = claudes[ai];
  // R7: this block is the account quota; session context has its own section.
  const title = accounts.length > 1 ? `Claude plan limits — ${accounts[ai].name}` : "Claude plan limits · account quota";
  const state = cl.state ?? (cl.stale ? "stale" : cl.items.length ? "fresh" : "unavailable");
  const badge = trustBadge({ state, source: cl.source });
  const recoveryAction = recoveryActionFor({ state, reason: cl.reason, stale: cl.stale });
  const reconnectPolicy = notificationPolicyForAccount(ai);
  if (ai > 0) out.push("---");
  out.push(`${title}  ${badge.icon} ${badge.level} | size=13 color=#8b949e`);
  out.push(`--Reconnect alerts: ${reconnectPolicy.reconnect ? "on" : "off"} · only for fresh auth expiry | bash='${SELF}' param1='--notify-account-reconnect=claude:${ai}=${reconnectPolicy.reconnect ? "off" : "on"}' terminal=false refresh=true`);
  out.push(`--${badge.icon} ${badge.text} | size=11 color=#8b949e`);
  if (cl.items.length) {
    for (const i of cl.items) {
      const r = Math.round(100 - i.used);
      out.push(`${i.name}  ▕${textBar(r)}▏ ${r}% left · ${fmtReset(i.resets)} | font=Menlo size=12 color=${state === "fresh" ? heatHex(r) : "#8b949e"}`);
      if (i.forecast) {
        const when = i.forecast.exhaustionAt ? fmtUntil(i.forecast.exhaustionAt) : "unknown";
        const verdict = i.forecast.beforeReset ? `may run out ${when}` : "reset is expected first";
        out.push(`--Pace estimate (local, ${i.forecast.samples} samples): ${verdict} · +${i.forecast.usedPerHour}%/h | size=11 color=#8b949e`);
      }
    }
    if (state !== "fresh") {
      const last = cl.lastSuccessAt ?? cl.at;
      const when = last ? `last success ${fmtAgo(last)}` : "no successful reading";
      const retry = fmtRetryAt(cl.retryAt);
      const note = `${stateDisplayLabel(state)} · ${stateRecoveryHint(state)}`;
      out.push(`${state === "fallback" ? "↪" : "⚠️"} ${note} · ${when}${retry ? ` · ${retry}` : ""} | size=11 color=#ffcc00`);
    }
  } else if (cl.reason === "needs-api") {
    // 로컬 캐시 없음 + API 옵트인 꺼짐 → 키체인 안 건드리고 켜는 법만 안내
    out.push("ⓘ Claude limits need API mode | size=12 color=#8b949e");
    out.push("--No local usage cache on this Claude version. | size=11 color=#8b949e");
    out.push("--API mode is an opt-in setting; it reads a keychain token read-only. | size=11 color=#8b949e");
    out.push("--Sessions & Codex work without this. | size=11 color=#8b949e");
  } else if (cl.reason === "app-stale") {
    out.push("⏸ 업데이트 필요 · Claude 앱의 사용량 수집이 멈췄습니다 | size=12 color=#ffcc00");
  } else if (cl.reason === "auth" || state === "auth_expired") {
    out.push("🔐 다시 연결 필요 · Claude 로그인 만료 (실시간 숫자 없음) | size=12 color=#ff453a");
    if (cl.appLast) {
      out.push(`--Claude app stopped sampling (last ${fmtAgo(cl.appLast.at)}: 5-hour ${100 - cl.appLast.fh}% · weekly ${100 - cl.appLast.sd}% left) | size=11 color=#8b949e`);
    }
    const retry = fmtRetryAt(cl.retryAt);
    if (retry) out.push(`--Next try ${retry.replace(/^retry /, "")} | size=11 color=#8b949e`);
  } else if (cl.reason === "login") {
    out.push("🔑 Log in to Claude Code first | size=12 color=#ffcc00");
  } else if (state === "rate_limited" || cl.reason === "rate-limit") {
    // R4: the usage endpoint asked us to back off (Retry-After); we obey it and
    // make no request until then.
    const retry = fmtRetryAt(cl.retryAt);
    out.push(`⏳ 제공자 제한 중 · ${stateRecoveryHint("rate_limited")}${retry ? ` — ${retry}` : ""} | size=12 color=#ffcc00`);
    out.push("--그때까지 요청하지 않으며 자동으로 다시 확인합니다 | size=11 color=#8b949e");
  } else {
    out.push("⚠️ Couldn't load usage | size=12 color=#ff453a");
    out.push(`--${(cl.error || "").slice(0, 60)} | size=11 color=#8b949e`);
  }
  if (recoveryAction) out.push(`--NEXT · ${recoveryAction} | size=11 color=#ffcc00`);
  // R3: the login-renewal policy is always visible while API mode is on.
  // Error panels keep a single recovery action above; the policy controls
  // remain available for healthy readings without competing with that action.
  if (ai === 0 && IS_MAC && apiModeEnabled() && !recoveryAction) {
    const auto = autoRenewEnabled();
    const bin = findClaudeBin();
    out.push(`Login renewal: ${auto ? "auto" : "manual"} · ${renewStatusLine()} | size=11 color=#8b949e`);
    out.push(`--What runs: claude -p /usage (reads usage only, no model call, no transcript) | size=11 color=#8b949e`);
    out.push(`--${auto ? "Auto: on login expiry (401), at most once per 10 min" : "Auto is off by default — renew from here when the login expires"} | size=11 color=#8b949e`);
    out.push(`--${auto ? 'Disable: config.json {"autoRenew": false}' : 'Optional opt-in: config.json {"autoRenew": true}'} · ~/.config/claude-codex-battery/ | size=11 color=#6b7280`);
    if (bin) out.push(`--Renew Claude login now | bash='${SELF}' param1=--renew-login terminal=false refresh=true`);
    else out.push("--Claude CLI not found — run  claude  in a terminal to renew | size=11 color=#ffcc00");
  }
}

if (activeClaudeSessions.length) {
  out.push("---");
  // R7: context window per conversation — a different quantity from plan quota.
  out.push("Claude session context · per conversation, not quota  (■ = menu bar S) | size=13 color=#8b949e");
  { const b = trustBadge({ kind: "context" }); out.push(`--${b.icon} ${b.text} | size=11 color=#8b949e`); }
  if (!SHOW_TOPICS && activeClaudeSessions.some((s) => s.topic)) {
    out.push('--Prompt topics hidden · show with  export CCB_TOPICS=1 | size=11 color=#6b7280');
  }
  activeClaudeSessions.forEach((s) => {
    const r = Math.round(100 - s.pct);
    const isLive = liveClaudeSessions.includes(s);
    const dot = isLive ? "🟢" : "⚪";
    const warn = s.pct >= 80 ? "  ⚠️compaction soon" : "";
    // 1행: 색 스와치 + 플랫폼 + 프로젝트명 + 진행 배터리 + %
    out.push(`■ ${dot} 🟠 Claude · ${s.name}  ▕${textBar(r)}▏ ${r}%${warn} | font=Menlo size=13 color=${rgbHex(s.color)}`);
    // 2행: 주제 (있으면)
    if (s.topic && SHOW_TOPICS) out.push(`--${s.topic} | size=11 color=#8b949e`);
    if (s.status) out.push(`--Status: ${sessionStatusLabel(s.status)} · local heuristic, not provider state | size=11 color=#8b949e`);
    // 3행: 브랜치 · 모델 · 토큰 · 경과
    const meta = [
      s.branch ? `⑂ ${s.branch}` : null,
      s.model,
      `${fmtK(s.used)}/${fmtK(s.win)}`,
      fmtAgo(s.mtime),
      `id ${s.id}`,
    ].filter(Boolean).join("  ·  ");
    out.push(`--${meta} | font=Menlo size=11 color=#6b7280`);
    if (s.pct >= 80) out.push(`--${checkpointHandoffLabel(s.pct)} (로컬 파일만 생성) | bash='${SELF}' param1=--export-widget-snapshot terminal=false`);
  });
}

// Default remains hidden without Codex. Explicit profiles always show their
// individual state. Selecting a profile changes local display, never login.
for (const codex of codexReadings) {
  if (!codex.items.length && codex.profile.legacy && !existsSync(codex.profile.configDir)) continue;
  out.push("---");
  const cxState = codex.state ?? (codex.items.length ? "fresh" : "unavailable");
  const cxBadge = trustBadge({ state: cxState, source: codex.source || "codex-jsonl" });
  const selected = codex.profile.id === selectedProfile.id && !!selectedProfile.configDir;
  out.push(`${codexAccountLabel(codex)} plan limits · account quota${codex.plan ? ` (${codex.plan})` : ""}  ${cxBadge.icon} ${cxBadge.level} | size=13 color=#8b949e`);
  if (!codex.profile.legacy && codex.profile.configDir) {
    out.push(`--${selected ? "Selected for X header, Windows and Pocket export" : "Use this local profile for X header, Windows and Pocket export"}${selected ? " | size=11 color=#8b949e" : ` | bash='${SELF}' param1=--select-codex-account=${codex.profile.id} terminal=false refresh=true`}`);
    out.push("--Display selection only · does not change Codex login | size=11 color=#8b949e");
  }
  out.push(`--${cxBadge.icon} ${cxBadge.text} · Codex writes these numbers into its own session log | size=11 color=#8b949e`);
  if (codex.items.length) {
    for (const i of codex.items) {
      const r = Math.round(100 - i.used);
      const tail = i.wasReset ? "reset done" : fmtReset(i.resets);
      out.push(`${i.name}  ▕${textBar(r)}▏ ${r}% left · ${tail} | font=Menlo size=12 color=${cxState === "fresh" ? heatHex(r) : "#8b949e"}`);
      if (i.forecast) {
        const when = i.forecast.exhaustionAt ? fmtUntil(i.forecast.exhaustionAt) : "unknown";
        const verdict = i.forecast.beforeReset ? `may run out ${when}` : "reset is expected first";
        out.push(`--Pace estimate (local, ${i.forecast.samples} samples): ${verdict} · +${i.forecast.usedPerHour}%/h | size=11 color=#8b949e`);
      }
    }
    const ageMin = Math.round((Date.now() - codex.at) / 60000);
    if (ageMin > 60) out.push(`ℹ️ from your last session (${Math.round(ageMin / 60)}h ago) | size=11 color=#8b949e`);
    if (codex.state && codex.state !== "fresh") {
      const last = codex.lastSuccessAt ?? codex.at;
      out.push(`⚠️ Codex ${stateLabel(codex.state)} · last success ${last ? fmtAgo(last) : "unknown"} | size=11 color=#ffcc00`);
    }
  } else {
    out.push(`${codex.reason === "invalid_profiles" ? "Invalid codexAccounts · fix unique IDs, names and absolute local roots in config.json" : "No session data yet (shows after you run Codex in this profile)"} | size=11 color=#8b949e`);
  }
  if (selected && activeCodexSessions.length) {
    out.push("---");
    out.push("Codex session context · per conversation, not quota  (■ = menu bar S) | size=13 color=#8b949e");
    { const b = trustBadge({ kind: "context" }); out.push(`--${b.icon} ${b.text} | size=11 color=#8b949e`); }
    if (!SHOW_TOPICS && activeCodexSessions.some((s) => s.topic)) {
      out.push('--Prompt topics hidden · show with  export CCB_TOPICS=1 | size=11 color=#6b7280');
    }
    activeCodexSessions.forEach((s) => {
      const r = Math.round(100 - s.pct);
      const isLive = liveCodexSessions.includes(s);
      const dot = isLive ? "🟢" : "⚪";
      const warn = s.pct >= 80 ? "  ⚠️compaction soon" : "";
      out.push(`■ ${dot} 🟣 Codex · ${s.name}  ▕${textBar(r)}▏ ${r}%${warn} | font=Menlo size=13 color=${rgbHex(s.color)}`);
      if (s.topic && SHOW_TOPICS) out.push(`--${s.topic} | size=11 color=#8b949e`);
      if (s.status) out.push(`--Status: ${sessionStatusLabel(s.status)} · local heuristic, not provider state | size=11 color=#8b949e`);
      const meta = [
        s.branch ? `⑂ ${s.branch}` : null,
        s.model,
        `${fmtK(s.used)}/${fmtK(s.win)}`,
        fmtAgo(s.mtime),
        `id ${s.id}`,
      ].filter(Boolean).join("  ·  ");
      out.push(`--${meta} | font=Menlo size=11 color=#6b7280`);
      if (s.pct >= 80) out.push(`--${checkpointHandoffLabel(s.pct)} (로컬 파일만 생성) | bash='${SELF}' param1=--export-widget-snapshot terminal=false`);
    });
  }
}

if (letsur) {
  out.push("---");
  out.push(`${letsur.label}  (vs monthly limit) | size=13 color=#8b949e`);
  const r = Math.round(100 - letsur.pct);
  out.push(`This month  ▕${textBar(r)}▏ ${r}% left | font=Menlo size=12 color=${heatHex(r)}`);
  out.push(`--${letsur.spent} / ${letsur.limit} ${letsur.currency} used  ·  ${letsur.remain} ${letsur.currency} left | font=Menlo size=11 color=#6b7280`);
  out.push(`--auto-resets on the 1st  ·  ⚠️ check your Letsur dashboard for what a unit is worth | size=11 color=#6b7280`);
}

// Local-file providers intentionally live in the dropdown, not the compact
// header: a user-selected file may be stale and is never allowed to crowd out
// provider-reported Claude/Codex status.
for (const provider of providers) {
  out.push("---");
  const badge = trustBadge({ state: provider.state, source: provider.source });
  out.push(`${provider.label} plan limits · local adapter  ${badge.icon} ${badge.level} | size=13 color=#8b949e`);
  out.push(`--${badge.icon} ${badge.text} · no token, cookie, browser session, command, or network access | size=11 color=#8b949e`);
  if (provider.state === "fresh") {
    for (const item of provider.items) {
      const remain = Math.round(100 - item.used);
      out.push(`${item.name}  ▕${textBar(remain)}▏ ${remain}% left · ${fmtReset(item.resets)} | font=Menlo size=12 color=${heatHex(remain)}`);
    }
  } else if (provider.state === "stale") {
    out.push(`⚠️ Local file is stale · last success ${provider.lastSuccessAt ? fmtAgo(provider.lastSuccessAt) : "unknown"} · no header number | size=11 color=#ffcc00`);
  } else {
    out.push(`ⓘ Local usage file unavailable (${provider.reason || "unknown"}) | size=11 color=#ffcc00`);
  }
}

// R13: this is deliberately outside the battery header because a Copilot
// Premium-request bill is money, not a plan quota. A configured budget is a
// user-owned guardrail, never a provider-reported limit.
if (copilot.enabled) {
  out.push("---");
  out.push("GitHub Copilot Premium requests · monthly spend, not quota | size=13 color=#8b949e");
  if (copilot.state === "fresh") {
    const amount = Number(copilot.amountUsd).toFixed(2);
    if (copilot.budgetUsd) {
      const remain = Math.max(0, 100 - Number(copilot.usedPct || 0));
      out.push(`This month  ▕${textBar(Math.round(remain))}▏ ${Math.round(remain)}% budget left | font=Menlo size=12 color=${heatHex(remain)}`);
      out.push(`--$${amount} / $${Number(copilot.budgetUsd).toFixed(2)} voluntary budget · GitHub does not report this as a quota | size=11 color=#6b7280`);
    } else {
      out.push(`This month  $${amount} billed · no local budget set | font=Menlo size=12 color=#8b949e`);
      out.push("--Set copilot.monthlyBudgetUsd only if you want a personal budget meter | size=11 color=#6b7280");
    }
    out.push("--Official GitHub API · explicit token environment variable only · cached 15 min | size=11 color=#6b7280");
  } else if (copilot.reason === "needs-config") {
    out.push("Configure copilot.username and copilot.tokenEnv; no credential is discovered automatically | size=11 color=#ffcc00");
  } else {
    out.push(`Usage unavailable${copilot.errorCode ? ` (HTTP ${copilot.errorCode})` : ""} · no prior number is shown | size=11 color=#ffcc00`);
  }
}

out.push("---");
out.push("Data diagnostics  (no secrets) | size=13 color=#8b949e");
for (const line of buildDiagnostics().slice(2)) out.push(`--${line} | font=Menlo size=11 color=#6b7280`);
out.push(`--Copy diagnostics to clipboard | bash='${SELF}' param1=--copy-diagnostics terminal=false`);
if (IS_MAC) {
  out.push(`--Pocket으로 내보내고 열기 (로컬 파일만 생성) | bash='${SELF}' param1=--open-pocket terminal=false`);
}
const notificationPolicy = notifyConfig();
out.push("---");
out.push(`Alert settings · ${notificationPolicy.enabled ? "on" : "off"} · threshold ${notificationPolicy.threshold}% · reset ${notificationPolicy.reset ? "on" : "off"} | size=13 color=#8b949e`);
out.push(`--${notificationPolicy.enabled ? "Turn alerts off" : "Turn alerts on"} | bash='${SELF}' param1=--notify-${notificationPolicy.enabled ? "off" : "on"} terminal=false refresh=true`);
out.push(`--Set alert threshold: 10% | bash='${SELF}' param1=--notify-threshold=10 terminal=false refresh=true`);
out.push(`--Set alert threshold: 20% | bash='${SELF}' param1=--notify-threshold=20 terminal=false refresh=true`);
out.push(`--Set alert threshold: 30% | bash='${SELF}' param1=--notify-threshold=30 terminal=false refresh=true`);
out.push(`--Reset alerts: ${notificationPolicy.reset ? "off" : "on"} | bash='${SELF}' param1=--notify-reset-${notificationPolicy.reset ? "off" : "on"} terminal=false refresh=true`);
out.push(`--Reset soon alerts: ${notificationPolicy.resetSoonMinutes ? `${notificationPolicy.resetSoonMinutes} min` : "off"} (fresh only) | size=11 color=#8b949e`);
out.push(`----${notificationPolicy.resetSoonMinutes ? "Disable reset soon alerts" : "Enable 10-minute reset soon alerts"} | bash='${SELF}' param1=--notify-reset-soon=${notificationPolicy.resetSoonMinutes ? 0 : 10} terminal=false refresh=true`);
out.push(`--Forecast alerts: ${notificationPolicy.forecast ? "on" : "off"} · Claude local estimate only · requires forecast.enabled=true | size=11 color=#8b949e`);
out.push(`----Turn forecast alerts ${notificationPolicy.forecast ? "off" : "on"} | bash='${SELF}' param1=--notify-forecast-${notificationPolicy.forecast ? "off" : "on"} terminal=false refresh=true`);
out.push(`--Codex forecast alerts: ${notificationPolicy.codexForecast ? "on" : "off"} · local estimate · requires codexForecast.enabled=true | size=11 color=#8b949e`);
out.push(`----Turn Codex forecast alerts ${notificationPolicy.codexForecast ? "off" : "on"} | bash='${SELF}' param1=--notify-codex-forecast-${notificationPolicy.codexForecast ? "off" : "on"} terminal=false refresh=true`);
if (codexForecastEnabled()) out.push(`--Export local Codex pace history (7 days) | bash='${SELF}' param1=--codex-forecast-history terminal=false`);
const notificationTargets = notificationEntries().slice(0, 8);
if (notificationTargets.length) {
  out.push("--Per quota window overrides (otherwise global policy applies) | size=11 color=#6b7280");
  for (const target of notificationTargets) {
    const targetPolicy = notificationPolicyFor(target);
    out.push(`--${target.label}: alerts ${targetPolicy.enabled ? "on" : "off"} · threshold ${targetPolicy.threshold}% · reset ${targetPolicy.reset ? "on" : "off"} · next ${fmtReset(target.resets) || "unknown"} | size=11 color=#8b949e`);
    out.push(`----${target.label} alerts ${targetPolicy.enabled ? "off" : "on"} | bash='${SELF}' param1='--notify-target-${targetPolicy.enabled ? "off" : "on"}=${target.key}' terminal=false refresh=true`);
    out.push(`----${target.label} threshold 10% | bash='${SELF}' param1='--notify-target-threshold=${target.key}=10' terminal=false refresh=true`);
    out.push(`----${target.label} threshold 30% | bash='${SELF}' param1='--notify-target-threshold=${target.key}=30' terminal=false refresh=true`);
    out.push(`----${target.label} reset ${targetPolicy.reset ? "off" : "on"} | bash='${SELF}' param1='--notify-target-reset=${target.key}=${targetPolicy.reset ? "off" : "on"}' terminal=false refresh=true`);
  }
}
if (forecastEnabled()) out.push(`--Export local pace history (7 days) | bash='${SELF}' param1=--forecast-history terminal=false`);
if (!existsSync(CONFIG_FILE)) {
  // v1.2 first-run disclosure. It is deliberately visible in the product,
  // rather than being only a README promise. Creating the config below does
  // not enable any of these optional capabilities.
  out.push("---");
  out.push("First setup · local data, safe defaults | size=13 color=#8b949e");
  out.push("--Reads ~/.claude and ~/.codex local logs. Keychain API, alerts, auto-renew and prompt topics are off | size=11 color=#6b7280");
  out.push("--API mode is optional and calls Anthropic directly; tokens, prompts and code are never stored by TokenJuice | size=11 color=#6b7280");
  out.push(`--Create safe starter config (API, alerts, auto-renew off) | bash='${SELF}' param1=--init-config terminal=false refresh=true`);
}
out.push("---");
out.push("Refresh now | refresh=true");
out.push("Open Claude usage page | href=https://claude.ai/settings/usage");
if (letsur) out.push("Open Letsur dashboard | href=https://platform.letsur.ai");
// R6: alerts run only in the menu bar render (not --json/--text consumers).
runNotifications(notificationEntries());
console.log(out.join("\n"));
