const platformHint = document.querySelector("#platform-guidance");
const fingerprint = [navigator.userAgentData?.platform, navigator.platform, navigator.userAgent].filter(Boolean).join(" ").toLowerCase();
// Browser hints are not hardware verification. Mobile wins over "Mac OS X".
const isMobile = /android|iphone|ipad|ipod|mobile/.test(fingerprint)
  || (/mac/.test(fingerprint) && navigator.maxTouchPoints > 1);
const inferred = isMobile ? "mobile" : /win/.test(fingerprint) ? "windows" : /mac/.test(fingerprint) ? "mac" : "other";
const choices = new Set(["mac", "windows", "mobile", "other"]);
function selectPlatform(platform, manual = false) {
  if (!choices.has(platform)) return;
  document.querySelectorAll("[data-install-platform],[data-download-platform]").forEach(card => {
    card.hidden = platform !== "other" && (card.dataset.installPlatform || card.dataset.downloadPlatform) !== platform;
  });
  document.querySelectorAll("[data-platform-choice]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.platformChoice === platform));
  });
  platformHint.textContent = platform === "mobile"
    ? "모바일에서는 Pocket만 사용할 수 있습니다. 메뉴바·트레이 설치는 Mac 또는 Windows에서 진행하세요. 다른 기기의 안내를 보려면 직접 선택하세요."
    : platform === "other" ? "운영체제를 확인하지 못했거나 모두 보기를 선택했습니다. 설치할 기기에 맞는 경로를 직접 선택하세요."
    : manual ? `직접 선택한 ${platform === "mac" ? "macOS 메뉴바" : "Windows 트레이"} 설치 경로입니다. 선택만으로 다운로드·설치하지 않습니다.`
    : `브라우저 정보 기반 ${platform === "mac" ? "macOS 메뉴바" : "Windows 트레이"} 권장 경로입니다. 다르면 설치할 기기를 직접 선택하세요.`;
}
document.querySelectorAll("[data-platform-choice]").forEach(button => {
  button.addEventListener("click", () => selectPlatform(button.dataset.platformChoice, true));
});
selectPlatform(inferred);
