import { test, expect } from "bun:test";
import { normalizeCheckpoint, resumeBrief } from "../companion/resume.js";
const checkpoint = () => ({ format:"tokenjuice-checkpoint-v1",privacy:"metadata_only",
  createdAt:1700003600000,sourceGeneratedAt:1700000000000,platform:"claude",project:"synthetic",
  branch:"main",model:"synthetic",status:null,context:{used:168000,window:200000,pct:84} });

test("checkpoint preserves source-file time separately from save time without copying raw or advice", () => {
  const source={...checkpoint(),topic:"PRIVATE_PROMPT",code:"PRIVATE_CODE",nextAction:"PRIVATE_ADVICE"};
  const normalized=normalizeCheckpoint(source);
  expect(normalized.sourceGeneratedAt).toBe(source.sourceGeneratedAt);
  expect(normalized.createdAt).toBe(source.createdAt);
  expect(JSON.stringify(normalized)).not.toContain("PRIVATE");
  const brief=resumeBrief(normalized);
  expect(brief).toContain("원본 스냅샷 파일 생성 시각:");
  expect(brief).toContain("실제 세션 관측 시각이나 현재 상태의 증거가 아닙니다");
  expect(brief).toContain("파일에 담긴 컨텍스트: 84%");
});
test("legacy checkpoint without provenance stays readable but save time cannot stand in for source time", () => {
  const legacy=checkpoint();delete legacy.sourceGeneratedAt;
  const normalized=normalizeCheckpoint(legacy);
  expect(Object.hasOwn(normalized,"sourceGeneratedAt")).toBe(false);
  expect(resumeBrief(normalized)).toContain("정보 없음 · 저장 시각으로 대신하지 않습니다");
  expect(Object.hasOwn(normalizeCheckpoint({...legacy,sourceGeneratedAt:null}),"sourceGeneratedAt")).toBe(false);
});
test("invalid source-file time is rejected rather than converted to a fabricated observation", () => {
  for(const sourceGeneratedAt of ["1700000000000",NaN,Infinity,0,-1,1e20,{},[]])
    expect(()=>normalizeCheckpoint({...checkpoint(),sourceGeneratedAt})).toThrow("invalid_checkpoint");
});
