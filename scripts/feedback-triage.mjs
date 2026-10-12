import { execFileSync } from "node:child_process";

const REPO = "kendrick-na/tokenjuice";
const AREAS = ["install", "data", "ux", "feature"];
const STAGES = ["needs-info", "ready-to-fix", "in-progress", "verify"];
const PRIORITIES = ["p0", "p1", "p2"];
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Only a metadata projection is accepted. Unknown fields are never copied.
export function triageIssues(input, now = Date.now()) {
  if (!Array.isArray(input) || input.length > 201 || !Number.isSafeInteger(now) || now <= 0)
    throw new Error("invalid_metadata");
  const seen = new Set();
  const projected = input.map(issue => {
    if (!record(issue) || !Number.isSafeInteger(issue.number) || issue.number <= 0
      || seen.has(issue.number) || issue.state !== "OPEN"
      || issue.url !== `https://github.com/${REPO}/issues/${issue.number}`
      || !Array.isArray(issue.labels) || issue.labels.length > 50)
      throw new Error("invalid_metadata");
    seen.add(issue.number);
    const names = issue.labels.map(label => {
      if (!record(label) || typeof label.name !== "string" || label.name.length > 100)
        throw new Error("invalid_metadata");
      return label.name;
    });
    const choose = (prefix, values) => {
      const found = values.filter(value => names.includes(`${prefix}:${value}`));
      return found.length === 1 ? found[0] : null;
    };
    const updated = Date.parse(issue.updatedAt);
    if (!Number.isFinite(updated) || updated > now || updated <= 0) throw new Error("invalid_metadata");
    const area = choose("area", AREAS), priority = choose("priority", PRIORITIES), stage = choose("status", STAGES);
    return {
      number: issue.number, url: issue.url, area: area ?? "unclassified",
      priority: priority ?? "review", stage: stage ?? "review",
      updatedAt: new Date(updated).toISOString(),
      needsClassification: !area || !priority || !stage,
      daysSinceUpdate: Math.floor((now - updated) / 86400000),
    };
  });
  const rank = priority => PRIORITIES.includes(priority) ? PRIORITIES.indexOf(priority) : 3;
  projected.sort((a, b) => rank(a.priority) - rank(b.priority) || a.number - b.number);
  const truncated = input.length === 201;
  const issues = projected.slice(0, 200);
  return {
    format: "tokenjuice-feedback-triage-v1", repository: REPO,
    observedAt: new Date(now).toISOString(), truncated,
    coverage: truncated ? "조회 상한 도달 · 전체 이슈 판단 불가" : "이번 조회 시 GitHub가 반환한 열린 이슈",
    issueCount: issues.length,
    needsClassification: issues.filter(issue => issue.needsClassification).length,
    overdueReview: issues.filter(issue => issue.daysSinceUpdate >= 7).map(issue => issue.number),
    issues,
    limits: ["Issue counts are not unique users or confirmed reproductions.",
      "No titles, bodies, authors, comments, credentials or diagnostics are requested.",
      "Labels are operator decisions, not automated severity or resolution evidence.",
      "No issues, labels, comments, releases or schedules are changed."],
  };
}

export function readFeedback(run = execFileSync, now = Date.now()) {
  const raw = run("gh", ["issue", "list", "--repo", REPO, "--state", "open", "--limit", "201",
    "--json", "number,url,labels,state,updatedAt"], {encoding:"utf8", timeout:30000, maxBuffer:1024*1024, stdio:["ignore","pipe","pipe"]});
  return triageIssues(JSON.parse(raw), now);
}

if (import.meta.main) {
  try {
    if (process.argv.slice(2).join(" ") !== "--live") throw new Error("usage");
    console.log(JSON.stringify(readFeedback(), null, 2));
  } catch {
    console.error("피드백 조회 실패. 사용법: bun scripts/feedback-triage.mjs --live. gh 인증·네트워크·메타데이터를 확인하세요. 빈 결과로 처리하지 않았습니다.");
    process.exitCode = 1;
  }
}
