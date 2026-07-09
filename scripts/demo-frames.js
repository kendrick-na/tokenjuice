#!/usr/bin/env bun
// 홍보용 데모 프레임 생성기 — 본 플러그인의 렌더 로직을 복제해 애니메이션 PNG 시퀀스를 만든다.
// 실데이터 대신 값을 시간에 따라 변화시켜 "배터리가 차고 빠지는" 모습을 연출.
// 출력: scripts/frames/frame_000.png ...
import zlib from "node:zlib";
import { mkdirSync } from "node:fs";
import { writeFileSync } from "node:fs";

const OUT = decodeURIComponent(new URL("./frames/", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });

// ── PNG 인코더 (플러그인과 동일) ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ── 캔버스 + 폰트 (플러그인과 동일) ──
function cvNew(w, h) { return { w, h, px: Buffer.alloc(w * h * 4) }; }
function set(cv, x, y, [r, g, b, a = 255]) { if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return; const i = (y * cv.w + x) * 4; cv.px[i] = r; cv.px[i + 1] = g; cv.px[i + 2] = b; cv.px[i + 3] = a; }
function rect(cv, x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(cv, xx, yy, c); }
const FONT = { "0": ["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],"2":["01110","10001","00001","00110","01000","10000","11111"],"3":["11111","00010","00100","00010","00001","10001","01110"],"4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","11110","00001","00001","10001","01110"],"6":["00110","01000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],"8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00010","01100"],"C":["01110","10001","10000","10000","10000","10001","01110"],"X":["10001","10001","01010","00100","01010","10001","10001"],"S":["01111","10000","10000","01110","00001","00001","11110"],"L":["10000","10000","10000","10000","10000","10000","11111"] };
const FH = 7, FW = 5;
function text(cv, x, y, s, col) { let cx = x; for (const ch of s) { const g = FONT[ch]; if (!g) { cx += FW + 1; continue; } for (let r = 0; r < FH; r++) for (let c = 0; c < FW; c++) if (g[r][c] === "1") set(cv, cx + c, y + r, col); cx += FW + 1; } return cx - 1; }
function tw(s) { return s.length * (FW + 1) - 1; }
function ink(bg) { return (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) > 150 ? [20, 20, 24] : [255, 255, 255]; }

const RED = [255, 69, 58], ORANGE = [230, 126, 90], VIOLET = [138, 124, 255], CYAN = [34, 200, 210];
const SESS = [[45, 212, 191], [244, 114, 182], [56, 189, 248]];
const BW = 34, BH = 20;
function badge(cv, x, y, s, bg) { const w = tw(s) + 6; rect(cv, x + 1, y, w - 2, 1, bg); rect(cv, x + 1, y + FH + 3, w - 2, 1, bg); rect(cv, x, y + 1, w, FH + 2, bg); text(cv, x + 3, y + 2, s, ink(bg)); return w; }
function batt(cv, x, y, remain, brand) {
  const border = [235, 235, 240], empty = [40, 40, 46];
  rect(cv, x + 1, y, BW - 2, 1, border); rect(cv, x + 1, y + BH - 1, BW - 2, 1, border); rect(cv, x, y + 1, 1, BH - 2, border); rect(cv, x + BW - 1, y + 1, 1, BH - 2, border);
  rect(cv, x + BW, y + 6, 2, BH - 12, border);
  const iw = BW - 2, ih = BH - 2; rect(cv, x + 1, y + 1, iw, ih, empty);
  const r = Math.max(0, Math.min(100, Math.round(remain))); const fw = Math.round(r / 100 * iw);
  const fill = r < 20 ? RED : brand; if (fw > 0) rect(cv, x + 1, y + 1, fw, ih, fill);
  const label = String(r), ty = y + Math.floor((BH - FH) / 2), tx = x + 1 + Math.floor((iw - tw(label)) / 2);
  const onFill = ink(fill), onEmpty = [245, 245, 250], endX = x + 1 + fw; let cx = tx;
  for (const ch of label) { const g = FONT[ch]; for (let rr = 0; rr < FH; rr++) for (let cc = 0; cc < FW; cc++) if (g[rr][cc] === "1") { const px = cx + cc; set(cv, px, ty + rr, px < endX ? onFill : onEmpty); } cx += FW + 1; }
}
function render(groups) {
  const PAD = 4, GAP = 4, LG = 3, GG = 8, H = 24;
  let w = PAD; for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi]; w += tw(g.label) + 6 + LG; w += g.items.length * (BW + 2) + (g.items.length - 1) * GAP; if (gi < groups.length - 1) w += GG; }
  w += PAD; const cv = cvNew(w, H); const bg = [70, 70, 78, 120]; rect(cv, 1, 1, w - 2, H - 2, bg); rect(cv, 2, 0, w - 4, 1, bg); rect(cv, 2, H - 1, w - 4, 1, bg);
  let x = PAD; const by = Math.floor((H - BH) / 2);
  for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi]; badge(cv, x, by + Math.floor((BH - (FH + 4)) / 2), g.label, g.color); x += tw(g.label) + 6 + LG;
    for (let i = 0; i < g.items.length; i++) { batt(cv, x, by, g.items[i].remain, g.items[i].color || g.color); x += BW + 2 + GAP; } x -= GAP;
    if (gi < groups.length - 1) { const sx = x + Math.floor(GG / 2); for (let yy = 4; yy < H - 4; yy += 2) set(cv, sx, yy, [160, 160, 170, 160]); x += GG; } }
  return encodePNG(w, H, cv.px);
}

// ── 애니메이션: 세션이 점점 차오르다(컨텍스트 소진) 리셋, 한도는 서서히 감소 ──
const N = 48;
for (let f = 0; f < N; f++) {
  const t = f / N;
  const c1 = 95 - t * 20;                       // Claude 5h: 95→75 감소
  const c2 = 99 - t * 8;                         // Claude weekly: 완만
  const s1 = 90 - ((t * 1.6) % 1) * 85;          // 세션1: 컨텍스트 소진 후 리셋 반복
  const s2 = 60 - ((t * 1.1 + 0.3) % 1) * 55;
  const x1 = 100, x2 = 83 - t * 5;
  const l1 = 63 - t * 10;
  const groups = [
    { label: "C", color: ORANGE, items: [{ remain: c1 }, { remain: c2 }] },
    { label: "S", color: ORANGE, items: [{ remain: s1, color: SESS[0] }, { remain: s2, color: SESS[1] }] },
    { label: "X", color: VIOLET, items: [{ remain: x1 }, { remain: x2 }] },
    { label: "L", color: CYAN, items: [{ remain: l1 }] },
  ];
  writeFileSync(`${OUT}frame_${String(f).padStart(3, "0")}.png`, render(groups));
}
console.log(`${N} frames → ${OUT}`);
