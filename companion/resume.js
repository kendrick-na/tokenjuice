// Read-only continuation of the existing metadata-only checkpoint contract.
// Never retain raw import fields, interpret nextAction, or launch an agent.
const MAX_FILE_BYTES = 64 * 1024;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => value == null || (typeof value === "string" && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value));
const positive = (value) => Number.isFinite(value) && value > 0;
const nonnegative = (value) => Number.isFinite(value) && value >= 0;

export function normalizeCheckpoint(value) {
  if (!isRecord(value) || value.format !== "tokenjuice-checkpoint-v1" || value.privacy !== "metadata_only"
    || !["claude", "codex"].includes(value.platform) || !positive(value.createdAt)
    || !Number.isFinite(new Date(value.createdAt).getTime())
    || ![value.project, value.branch, value.model, value.status].every(text)
    || !isRecord(value.context) || !nonnegative(value.context.used) || !nonnegative(value.context.pct)
    || !(value.context.window == null || positive(value.context.window))) throw new Error("invalid_checkpoint");
  // Unknown fields (including topic/code/nextAction) are not shown or copied.
  return { format: value.format, privacy: value.privacy, createdAt: value.createdAt, platform: value.platform,
    project: value.project || null, branch: value.branch || null, model: value.model || null,
    context: { used: value.context.used, window: value.context.window ?? null, pct: value.context.pct },
    status: value.status || null };
}

export function resumeBrief(checkpoint) {
  return [
    "TokenJuice · 메타데이터 재개 안내 (작업 내용 요약 아님)",
    `checkpoint 저장 시각: ${new Date(checkpoint.createdAt).toLocaleString("ko-KR")}`,
    `이전 도구: ${checkpoint.platform === "claude" ? "Claude" : "Codex"}`,
    `프로젝트: ${checkpoint.project || "정보 없음"}`,
    `브랜치: ${checkpoint.branch || "정보 없음"}`,
    `이전 모델: ${checkpoint.model || "정보 없음"}`,
    `저장 당시 컨텍스트: ${checkpoint.context.pct}% 사용 · 로컬 추정, 현재 값 아님`,
    "",
    "재개 전 직접 확인할 것:",
    "1. 실제 프로젝트·브랜치와 변경 파일을 확인하세요. 이 파일은 코드를 복원하지 않습니다.",
    "2. 현재 한도·로그인·컨텍스트를 사용 중인 도구에서 다시 확인하세요.",
    "3. 마지막 목표·완료한 일·다음 할 일을 직접 정리하고 원하는 세션에서 이어가세요.",
    "작업 의도·최근 파일·프롬프트·코드는 포함되지 않습니다. 자동 세션 실행/전환은 하지 않습니다.",
  ].join("\n");
}

export function initResume() {
  const get = (id) => document.getElementById(id);
  const panel = get("resume-panel"), fileInput = get("checkpoint-file");
  const feedback = get("resume-feedback"), brief = get("resume-brief");
  let current = null;
  const announce = (message) => { feedback.textContent = message; };
  function show(value, source = "기기에서 선택한 checkpoint") {
    const checkpoint = normalizeCheckpoint(value);
    current = checkpoint;
    get("resume-source").textContent = `${source} · ${new Date(checkpoint.createdAt).toLocaleString("ko-KR")} 저장`;
    const metadata = get("resume-metadata");
    metadata.replaceChildren();
    for (const [label, value] of [["프로젝트", checkpoint.project], ["브랜치", checkpoint.branch],
      ["이전 도구", checkpoint.platform === "claude" ? "Claude" : "Codex"], ["이전 모델", checkpoint.model],
      ["저장 당시 컨텍스트", `${checkpoint.context.pct}% 사용 · 로컬 추정`]]) {
      const term = document.createElement("dt"), description = document.createElement("dd");
      term.textContent = label; description.textContent = value || "정보 없음";
      metadata.append(term, description);
    }
    brief.value = resumeBrief(checkpoint);
    get("resume-content").hidden = false;
    panel.open = true;
    announce("checkpoint를 열었습니다. 저장 당시 메타데이터이며 현재 상태가 아닙니다.");
    get("resume-title").focus();
  }
  get("resume-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    get("resume-import").disabled = true;
    announce("checkpoint 형식을 확인하는 중입니다.");
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("too_large");
      show(JSON.parse(await file.text()));
    } catch {
      announce("열 수 없는 checkpoint입니다. TokenJuice metadata-only checkpoint v1 (64 KiB 이하)을 선택하세요. 기존 재개 안내는 유지했습니다.");
    } finally { fileInput.value = ""; get("resume-import").disabled = false; }
  });
  get("resume-copy").addEventListener("click", async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(brief.value);
      announce("재개 안내를 복사했습니다. 붙여넣을 위치와 실제 작업 내용을 직접 확인하세요.");
    } catch {
      brief.focus(); brief.select();
      announce("클립보드에 접근할 수 없습니다. 선택된 안내를 직접 복사하거나 텍스트 파일로 저장하세요.");
    }
  });
  get("resume-download").addEventListener("click", () => {
    if (!current) return;
    const url = URL.createObjectURL(new Blob([`${brief.value}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "tokenjuice-resume.txt";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    announce("재개 안내를 로컬 텍스트 파일로 저장했습니다.");
  });
  get("resume-clear").addEventListener("click", () => {
    current = null; brief.value = ""; get("resume-metadata").replaceChildren(); get("resume-source").textContent = "";
    get("resume-content").hidden = true;
    announce("화면의 checkpoint를 지웠습니다. 다운로드한 파일과 저장된 한도 스냅샷은 그대로입니다.");
    get("resume-import").focus();
  });
  return show;
}
