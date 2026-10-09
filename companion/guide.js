const platformHint = document.querySelector("#platform-guidance");
const fingerprint = [navigator.userAgentData?.platform, navigator.platform, navigator.userAgent].filter(Boolean).join(" ").toLowerCase();
const isMobile = /android|iphone|ipad|ipod|mobile/.test(fingerprint);
const platform = /win/.test(fingerprint) ? "windows" : /mac/.test(fingerprint) ? "mac" : "other";

if (platform === "mac" || platform === "windows") {
  document.querySelectorAll("[data-install-platform]").forEach((card) => {
    card.hidden = card.dataset.installPlatform !== platform;
  });
  platformHint.textContent = platform === "mac"
    ? "이 기기는 macOS로 확인되었습니다. 아래 메뉴바 설치 경로만 안내합니다."
    : "이 기기는 Windows로 확인되었습니다. 아래 트레이 설치 경로만 안내합니다.";
} else if (isMobile) {
  document.querySelectorAll("[data-install-platform]").forEach((card) => { card.hidden = true; });
  platformHint.textContent = "모바일에서는 Pocket만 사용할 수 있습니다. 메뉴바·트레이 설치는 Mac 또는 Windows에서 진행하세요.";
} else {
  platformHint.textContent = "운영체제를 확인하지 못했습니다. Mac 또는 Windows에 맞는 설치 경로를 직접 선택하세요.";
}
