#!/usr/bin/env bun
// <bitbar.title>Claude Codex Battery</bitbar.title>
// <bitbar.desc>Claude Code / Codex 남은 사용량을 배터리로 표시</bitbar.desc>
// <bitbar.author>easymilli</bitbar.author>
// <bitbar.dependencies>bun</bitbar.dependencies>
//
// 메뉴바에 C [88][17] X [0][76] 형태의 픽셀 배터리를 그린다.
// 배터리 숫자 = 남은 %. 초록 ≥50, 노랑 ≥20, 빨강 <20.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import zlib from "node:zlib";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const IS_MAC = process.platform === "darwin";
const CACHE_DIR = path.join(HOME, ".cache", "claude-codex-battery");
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
function loadAccounts() {
  const f = path.join(HOME, ".config", "claude-codex-battery", "accounts.json");
  try {
    const list = JSON.parse(readFileSync(f, "utf8"));
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  const accounts = [{ name: accountLabel(path.join(HOME, ".claude")) || "Claude" }];
  try {
    for (const e of readdirSync(HOME)) {
      if (!e.startsWith(".claude") || e === ".claude" || e.endsWith(".json") || e.endsWith(".backup")) continue;
      const dir = path.join(HOME, e);
      const cred = path.join(dir, ".credentials.json");
      if (existsSync(cred)) accounts.push({ name: accountLabel(dir) || e.replace(/^\.claude-?/, "") || e, credFile: cred });
    }
  } catch {}
  return accounts;
}

function readClaudeToken(acc = {}) {
  // 명시적 credFile > 플랫폼 기본
  const explicit = acc.credFile ? acc.credFile.replace(/^~/, HOME) : null;
  if (explicit) return JSON.parse(readFileSync(explicit, "utf8")).claudeAiOauth.accessToken;
  // Windows / Linux: 자격증명은 평문 파일(~/.claude/.credentials.json)
  if (!IS_MAC) {
    const p = path.join(acc.configDir || path.join(HOME, ".claude"), ".credentials.json");
    return JSON.parse(readFileSync(p, "utf8")).claudeAiOauth.accessToken;
  }
  // macOS: 키체인
  const svc = acc.keychainService || "Claude Code-credentials";
  const acct = acc.keychainAccount ? ` -a "${acc.keychainAccount}"` : "";
  const raw = execSync(`security find-generic-password -s "${svc}"${acct} -w`, {
    encoding: "utf8", timeout: 10000,
  });
  return JSON.parse(raw).claudeAiOauth.accessToken;
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
  const base = acc.configDir || path.join(HOME, ".claude");
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
      if (items.length) return { ok: true, items, at: Date.now(), source: "local" };
    } catch {}
  }
  return null;
}

// API 모드(키체인 접근)는 명시적 옵트인. 기본은 키체인을 절대 건드리지 않음.
//   켜는 법: 환경변수 CCB_API=1  또는  ~/.config/claude-codex-battery/config.json {"api": true}
function apiModeEnabled() {
  if (process.env.CCB_API === "1") return true;
  try {
    const c = JSON.parse(readFileSync(path.join(HOME, ".config", "claude-codex-battery", "config.json"), "utf8"));
    return c.api === true;
  } catch { return false; }
}

const CLAUDE_TTL_MS = 60 * 1000; // API는 최대 60초마다만 호출 (레이트리밋 보호). 세션 컨텍스트는 매 실행 실시간.
async function getClaude(acc = {}, idx = 0) {
  // 1순위: Claude Code 로컬 사용량 캐시 (원본 dennykim123 방식) — 실시간·무네트워크·키체인 X
  const local = readLocalUsageCache(acc);
  if (local) return local;

  // 로컬 캐시가 없고 API 모드도 꺼져 있으면 → 키체인을 건드리지 않고 안내만 반환
  if (!apiModeEnabled()) {
    return { ok: false, items: [], reason: "needs-api" };
  }

  // 2순위: 우리 API 캐시가 신선하면 API 스킵
  const cacheFile = path.join(CACHE_DIR, `claude-${idx}.json`);
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (cached.at && Date.now() - cached.at < CLAUDE_TTL_MS) { cached.fresh = true; return cached; }
    } catch {}
  }
  // 3순위: usage API 직접 호출 (여기서만 키체인 토큰을 읽음 — 옵트인 상태에서만 도달)
  try {
    const token = readClaudeToken(acc);
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: { Authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`usage api ${res.status}`);
    const d = await res.json();
    const items = parseUsageItems(d);
    const out = { ok: true, items, at: Date.now(), source: "api" };
    writeFileSync(cacheFile, JSON.stringify(out));
    return out;
  } catch (e) {
    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
        cached.stale = true; cached.error = String(e.message || e);
        return cached;
      } catch {}
    }
    // 클린 환경(첫 설치·미로그인·키체인 거부) → raw 에러 대신 원인 분류
    const msg = String(e.message || e);
    const reason = /find-generic-password|keychain|SecKeychain/i.test(msg)
      ? "login"      // 로그인 안 됨 / 키체인 접근 불가
      : /ENOENT|no such file/i.test(msg) ? "login" : "error";
    return { ok: false, items: [], error: msg, reason };
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

function getCodex() {
  const sessDir = path.join(HOME, ".codex", "sessions");
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
      const items = [];
      if (rl.primary && rl.primary.used_percent != null) {
        items.push({
          name: rl.primary.window_minutes >= 10000 ? "Weekly" : "5-hour",
          used: rl.primary.used_percent, resets: rl.primary.resets_at,
        });
      }
      if (rl.secondary && rl.secondary.used_percent != null) {
        items.push({
          name: rl.secondary.window_minutes >= 10000 ? "Weekly" : "5-hour",
          used: rl.secondary.used_percent, resets: rl.secondary.resets_at,
        });
      }
      if (items.length === 0) continue; // null 창은 건너뛰고 더 과거 기록 탐색
      // 기록 시점 이후 리셋 시각이 지났으면 해당 창은 이미 초기화된 것
      for (const it of items) {
        const t = typeof it.resets === "number" ? it.resets * 1000 : Date.parse(it.resets);
        if (t && t < Date.now()) { it.used = 0; it.resets = null; it.wasReset = true; }
      }
      return { ok: true, items, plan: rl.plan_type, at: f.mtime };
    }
  }
  return { ok: false, items: [] };
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

function getSessions() {
  const projDir = path.join(HOME, ".claude", "projects");
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
    const cwdMatch = tail.match(/"cwd":"([^"]+)"/);
    const cwd = cwdMatch ? cwdMatch[1] : "?";
    const branchMatch = tail.match(/"gitBranch":"([^"]+)"/);
    const branch = branchMatch && branchMatch[1] !== "HEAD" ? branchMatch[1] : null;
    // 세션 주제: summary 있으면 그걸, 없으면 첫 user 메시지 요약
    const topic = extractTopic(f.p, tail);
    // 1M 컨텍스트 베타 세션: 모델명 표기 또는 사용량이 200k 초과면 1M 창으로 판정
    const win = (model && model.includes("[1m]")) || usage > CTX_WINDOW ? 1000000 : CTX_WINDOW;
    sessions.push({
      platform: "claude",
      name: path.basename(cwd),
      id: path.basename(f.p, ".jsonl").slice(0, 4),
      branch,
      topic,
      model: model ? model.replace(/^claude-/, "").replace(/-\d{8}$/, "") : null,
      used: usage,
      pct: Math.min(100, (usage / win) * 100),
      mtime: f.mtime,
      win,
    });
    if (sessions.length >= 4) break;
  }
  return sessions;
}

// Codex 세션 컨텍스트: last_token_usage.total_tokens = 현재 컨텍스트 창 점유량
const CODEX_WINDOW = 272000; // codex 기본 컨텍스트 창 (모델 따라 다를 수 있음)
function getCodexSessions() {
  const files = [];
  walkJsonl(path.join(HOME, ".codex", "sessions"), files);
  files.sort((a, b) => b.mtime - a.mtime);
  const cutoff = Date.now() - 6 * 3600 * 1000;
  const sessions = [];
  for (const f of files.slice(0, 8)) {
    if (f.mtime < cutoff) break;
    let tail;
    try { tail = readTail(f.p); } catch { continue; }
    const lines = tail.split("\n");
    let used = null, model = null;
    for (let i = lines.length - 1; i >= 0 && used == null; i--) {
      if (!lines[i].includes('"last_token_usage"')) continue;
      try {
        const o = JSON.parse(lines[i]);
        const info = o?.payload?.info ?? o?.info;
        const lu = info?.last_token_usage;
        if (lu && lu.total_tokens != null) used = lu.total_tokens;
      } catch {}
    }
    if (used == null) continue;
    const cwdMatch = tail.match(/"cwd":"([^"]+)"/);
    const mMatch = tail.match(/"model":"([^"]+)"/);
    sessions.push({
      platform: "codex",
      name: cwdMatch ? path.basename(cwdMatch[1]) : "?",
      id: path.basename(f.p, ".jsonl").split("-").pop().slice(0, 4),
      branch: null,
      topic: extractCodexTopic(tail),
      model: mMatch ? mMatch[1] : null,
      used,
      pct: Math.min(100, (used / CODEX_WINDOW) * 100),
      mtime: f.mtime,
      win: CODEX_WINDOW,
    });
    if (sessions.length >= 3) break;
  }
  return sessions;
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
function fmtK(n) { return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n); }

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

// ───────────────────────── 메인 ─────────────────────────
const accounts = loadAccounts();
const claudes = await Promise.all(accounts.map((a, i) => getClaude(a, i)));
const [codex, sessions, letsur] = [getCodex(), getAllSessions(), getLetsur()];
const dark = isDarkMode();
const asJson = argv.includes("--json");
const asText = argv.includes("--text");

// 노치 맥북(COMPACT): 메뉴바 아이콘이 노치에 가려 안 보이므로 폭을 최소화.
//   한도는 첫 항목(5시간)만, 세션은 위험순 1개만. 드롭다운은 그대로 전부 표시.
const groups = [];
for (let ai = 0; ai < accounts.length; ai++) {
  const label = accounts.length > 1 ? (accounts[ai].name || "C")[0].toUpperCase() : "C";
  const cl = claudes[ai];
  if (cl.items.length) {
    const items = (COMPACT ? cl.items.slice(0, 1) : cl.items).map((i) => ({ remain: 100 - i.used }));
    groups.push({ label, color: CLAUDE_ORANGE, items });
  } else groups.push({ label, color: CLAUDE_ORANGE, items: [{ remain: null }] });
}
// 세션: 메뉴바 표시 개수 (컴팩트=1, 일반=3). 드롭다운은 개수 제한 없이 전부.
const MENUBAR_MAX = COMPACT ? 1 : 3;
const activeSessions = sessions.filter((s) => Date.now() - s.mtime < 15 * 60 * 1000);
const liveSessions = activeSessions.slice(0, 2); // "곧 컴팩트" 경고용(2개)은 별개로 유지
if (activeSessions.length) {
  // 메뉴바엔 "가장 위험한(적게 남은)" 세션 우선 노출 → 놓치면 안 되는 걸 항상 보이게
  const byRisk = [...activeSessions].sort((a, b) => b.pct - a.pct);
  const shown = byRisk.slice(0, MENUBAR_MAX);
  const items = shown.map((s) => ({ remain: 100 - s.pct, color: s.color }));
  const overflow = activeSessions.length - shown.length;
  groups.push({ label: "S", color: CLAUDE_ORANGE, items, overflow });
}
if (codex.items.length) {
  const cxItems = (COMPACT ? codex.items.slice(0, 1) : codex.items).map((i) => ({ remain: 100 - i.used }));
  groups.push({ label: "X", color: CODEX_VIOLET, items: cxItems });
}
if (letsur) groups.push({ label: "L", color: LETSUR_CYAN, items: [{ remain: 100 - letsur.pct }] });

// ─ CLI 출력 모드 (윈도우/리눅스/터미널용) ─
if (asJson) {
  console.log(JSON.stringify({
    claude: claudes.map((c, i) => ({ account: accounts[i]?.name, items: c.items })),
    sessions, codex: codex.items, letsur,
  }, null, 2));
  process.exit(0);
}
if (asText) {
  const line = (label, r) => `${label} ${textBar(Math.round(r), 10)} ${Math.round(r)}%`;
  const parts = [];
  for (const c of claudes) for (const i of c.items) parts.push(line("C", 100 - i.used));
  for (const s of sessions.slice(0, 3)) parts.push(line(s.platform === "codex" ? "s·X" : "s·C", 100 - s.pct));
  for (const i of codex.items) parts.push(line("X", 100 - i.used));
  if (letsur) parts.push(line("L", 100 - letsur.pct));
  console.log(parts.join("\n"));
  process.exit(0);
}

const out = [];
out.push(`| image=${renderImage(groups, dark)}`);
out.push("---");

for (let ai = 0; ai < accounts.length; ai++) {
  const cl = claudes[ai];
  const title = accounts.length > 1 ? `Claude Code — ${accounts[ai].name}` : "Claude Code";
  const src = cl.source === "local" ? "🟢 live (local)" : cl.source === "api" ? "🌐 API · up to 60s" : "";
  if (ai > 0) out.push("---");
  out.push(`${title}  ${src} | size=13 color=#8b949e`);
  if (cl.items.length) {
    for (const i of cl.items) {
      const r = Math.round(100 - i.used);
      out.push(`${i.name}  ▕${textBar(r)}▏ ${r}% left · ${fmtReset(i.resets)} | font=Menlo size=12 color=${heatHex(r)}`);
    }
    if (cl.stale) out.push(`⚠️ refresh failed — showing cache | size=11 color=#8b949e`);
  } else if (cl.reason === "needs-api") {
    // 로컬 캐시 없음 + API 옵트인 꺼짐 → 키체인 안 건드리고 켜는 법만 안내
    out.push("ⓘ Claude limits need API mode | size=12 color=#8b949e");
    out.push("--No local usage cache on this Claude version. | size=11 color=#8b949e");
    out.push("--Enable it (reads a keychain token, read-only): | size=11 color=#8b949e");
    out.push('--  export CCB_API=1   — or  ~/.config/claude-codex-battery/config.json {"api":true} | font=Menlo size=11 color=#8b949e');
    out.push("--Sessions & Codex work without this. | size=11 color=#8b949e");
  } else if (cl.reason === "login") {
    out.push("🔑 Log in to Claude Code first | size=12 color=#ffcc00");
    out.push("--Run  claude  in a terminal and sign in — it shows up automatically | size=11 color=#8b949e");
  } else {
    out.push("⚠️ Couldn't load usage | size=12 color=#ff453a");
    out.push(`--${(cl.error || "").slice(0, 60)} | size=11 color=#8b949e`);
  }
}

if (sessions.length) {
  out.push("---");
  out.push("Session context  (■ = menu bar battery) | size=13 color=#8b949e");
  sessions.forEach((s) => {
    const r = Math.round(100 - s.pct);
    const isLive = liveSessions.includes(s);
    const dot = isLive ? "🟢" : "⚪";
    const plat = s.platform === "codex" ? "🟣 Codex" : "🟠 Claude";
    const warn = s.pct >= 80 ? "  ⚠️compaction soon" : "";
    // 1행: 색 스와치 + 플랫폼 + 프로젝트명 + 진행 배터리 + %
    out.push(`■ ${dot} ${plat} · ${s.name}  ▕${textBar(r)}▏ ${r}%${warn} | font=Menlo size=13 color=${rgbHex(s.color)}`);
    // 2행: 주제 (있으면)
    if (s.topic) out.push(`--${s.topic} | size=11 color=#8b949e`);
    // 3행: 브랜치 · 모델 · 토큰 · 경과
    const meta = [
      s.branch ? `⑂ ${s.branch}` : null,
      s.model,
      `${fmtK(s.used)}/${fmtK(s.win)}`,
      fmtAgo(s.mtime),
      `id ${s.id}`,
    ].filter(Boolean).join("  ·  ");
    out.push(`--${meta} | font=Menlo size=11 color=#6b7280`);
  });
}

out.push("---");
out.push(`Codex${codex.plan ? ` (${codex.plan})` : ""} | size=13 color=#8b949e`);
if (codex.items.length) {
  for (const i of codex.items) {
    const r = Math.round(100 - i.used);
    const tail = i.wasReset ? "reset done" : fmtReset(i.resets);
    out.push(`${i.name}  ▕${textBar(r)}▏ ${r}% left · ${tail} | font=Menlo size=12 color=${heatHex(r)}`);
  }
  const ageMin = Math.round((Date.now() - codex.at) / 60000);
  if (ageMin > 60) out.push(`ℹ️ from your last session (${Math.round(ageMin / 60)}h ago) | size=11 color=#8b949e`);
} else {
  out.push("No session data yet (shows after you run Codex) | size=11 color=#8b949e");
}

if (letsur) {
  out.push("---");
  out.push(`${letsur.label}  (vs monthly limit) | size=13 color=#8b949e`);
  const r = Math.round(100 - letsur.pct);
  out.push(`This month  ▕${textBar(r)}▏ ${r}% left | font=Menlo size=12 color=${heatHex(r)}`);
  out.push(`--${letsur.spent} / ${letsur.limit} ${letsur.currency} used  ·  ${letsur.remain} ${letsur.currency} left | font=Menlo size=11 color=#6b7280`);
  out.push(`--auto-resets on the 1st  ·  ⚠️ check your Letsur dashboard for what a unit is worth | size=11 color=#6b7280`);
}

out.push("---");
out.push("Refresh now | refresh=true");
out.push("Open Claude usage page | href=https://claude.ai/settings/usage");
if (letsur) out.push("Open Letsur dashboard | href=https://platform.letsur.ai");
console.log(out.join("\n"));
