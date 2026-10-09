#!/usr/bin/env python3
"""브라우저에서 TokenJuice Pocket의 스냅샷 가져오기·로컬 보관을 검증한다."""

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


SNAPSHOT = {
    "contractVersion": 1,
    "generatedAt": 1791390000000,
    "transport": "local_export_only",
    "claude": [{
        "account": "Personal",
        "state": "fresh",
        "source": "local",
        "lastSuccessAt": 1791390000000,
        "retryAt": None,
        "items": [{"name": "5-hour", "used": 35, "resets": "2026-10-08T19:00:00.000Z", "forecast": {"kind": "local_pace_estimate", "beforeReset": True, "samples": 4, "usedPerHour": 8.5}}],
    }],
    "codex": {"state": "rate_limited", "source": "codex-jsonl", "lastSuccessAt": None, "retryAt": 1791393600000, "items": []},
    "providers": [{"id": "cursor", "label": "Cursor", "state": "fresh", "source": "external-local-file", "items": [{"name": "Monthly", "used": 10, "resets": None}]}],
    "sessions": [{"platform": "claude", "name": "tokenjuice", "id": "abcd", "branch": "main", "status": "waiting_for_input", "model": "sonnet-4", "used": 168000, "pct": 84, "mtime": 1791390000000, "win": 200000, "kind": "context"}],
}


def contrast_ratio(foreground: str, background: str) -> float:
    def luminance(value: str) -> float:
        channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        channels = [channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    first, second = luminance(foreground), luminance(background)
    return (max(first, second) + 0.05) / (min(first, second) + 0.05)


def assert_no_horizontal_overflow(page) -> None:
    dimensions = page.evaluate("({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })")
    if dimensions["scrollWidth"] > dimensions["innerWidth"]:
        dimensions["overflowing"] = page.locator("body *:visible").evaluate_all("els => els.map(el => ({tag: el.tagName, id: el.id, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right})).filter(el => el.right > window.innerWidth)")
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions


def visible_target_heights(page) -> list[float]:
    return page.locator("button:visible, .primary-action:visible, footer a:visible, .snapshot-toolbar button:visible, .account-detail summary:visible").evaluate_all(
        "els => els.map(el => ({ id: el.id, text: (el.innerText || '').trim(), height: el.getBoundingClientRect().height }))"
    )


def assert_theme_contrast(page) -> None:
    theme = page.evaluate("""() => {
      const styles = getComputedStyle(document.documentElement);
      return Object.fromEntries(['--ink', '--muted', '--faint', '--teal', '--panel-2'].map(name => [name, styles.getPropertyValue(name).trim()]));
    }""")
    for foreground in ("--ink", "--muted", "--faint", "--teal"):
        assert contrast_ratio(theme[foreground], theme["--panel-2"]) >= 4.5, (foreground, theme)


def check_resume(browser, directory: str) -> None:
    page = browser.new_page(viewport={"width": 375, "height": 812})
    errors: list[str] = []
    requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: requests.append(request))
    page.goto("http://127.0.0.1:4173", wait_until="networkidle")
    summary = page.locator("#resume-panel > summary")
    summary.focus()
    page.keyboard.press("Enter")
    assert page.locator("#resume-panel").get_attribute("open") is not None
    assert page.get_by_role("button", name="checkpoint 파일 열기").is_visible()
    assert page.locator("#resume-content").is_hidden()
    checkpoint = {"format": "tokenjuice-checkpoint-v1", "privacy": "metadata_only",
                  "createdAt": 1791390000000, "platform": "codex", "project": "tokenjuice",
                  "branch": "feature/" + "long-branch-" * 15, "model": "coding-model", "status": None,
                  "context": {"used": 168000, "window": 200000, "pct": 84},
                  "topic": "SECRET_PROMPT", "code": "SECRET_CODE", "nextAction": "SECRET_ACTION"}
    checkpoint_path = Path(directory) / "checkpoint.json"
    checkpoint_path.write_text(json.dumps(checkpoint), encoding="utf-8")
    page.locator("#checkpoint-file").set_input_files(str(checkpoint_path))
    page.locator("#resume-content").wait_for(state="visible")
    assert page.locator("#empty-state").is_visible()  # independent of a live snapshot
    assert page.evaluate("document.activeElement.id") == "resume-title"
    assert page.get_by_text("저장 당시 메타데이터 · 현재 한도나 컨텍스트가 아닙니다").is_visible()
    assert page.locator("#resume-metadata").get_by_text("84% 사용 · 로컬 추정", exact=True).is_visible()
    assert "2026" in page.locator("#resume-source").inner_text()
    original_brief = page.locator("#resume-brief").input_value()
    assert "작업 내용 요약 아님" in original_brief and "현재 값 아님" in original_brief
    assert "tokenjuice" in original_brief and checkpoint["branch"] in original_brief
    assert all(secret not in original_brief for secret in ("SECRET_PROMPT", "SECRET_CODE", "SECRET_ACTION"))
    assert page.evaluate("localStorage.length") == 0
    # Clipboard API is isolated inside this browser, never the host clipboard.
    page.evaluate("Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {window.__copiedResume = text;}}})")
    page.get_by_role("button", name="재개 안내 복사", exact=True).click()
    page.wait_for_function("window.__copiedResume !== undefined")
    assert page.evaluate("window.__copiedResume") == original_brief
    page.evaluate("Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {throw new Error('denied');}}})")
    page.get_by_role("button", name="재개 안내 복사", exact=True).click()
    page.get_by_text("클립보드에 접근할 수 없습니다.", exact=False).wait_for()
    assert page.locator("#resume-brief").evaluate("el => el.selectionEnd - el.selectionStart") == len(original_brief)
    with page.expect_download() as download_info:
        page.get_by_role("button", name="텍스트 저장", exact=True).click()
    assert download_info.value.suggested_filename == "tokenjuice-resume.txt"
    assert Path(download_info.value.path()).read_text(encoding="utf-8").rstrip() == original_brief
    # Import errors retain both the resume and any separately stored quota.
    snapshot_path = Path(directory) / "resume-quota-snapshot.json"
    snapshot_path.write_text(json.dumps(SNAPSHOT), encoding="utf-8")
    page.locator("#snapshot-file").set_input_files(str(snapshot_path))
    page.locator("#dashboard").wait_for(state="visible")
    stored_snapshot = page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")
    invalids = [[], {**checkpoint, "format": "unknown"}, {**checkpoint, "privacy": "raw"},
                {**checkpoint, "createdAt": "1791390000000"}, {**checkpoint, "createdAt": 1e20},
                {**checkpoint, "platform": "unknown"}, {**checkpoint, "branch": "bad\nbranch"},
                {**checkpoint, "project": {}}, {**checkpoint, "context": None},
                {**checkpoint, "context": {"used": "168000", "window": 200000, "pct": 84}},
                {**checkpoint, "context": {"used": -1, "window": 200000, "pct": 84}},
                {**checkpoint, "context": {"used": 168000, "window": 0, "pct": 84}},
                {**checkpoint, "context": {"used": 168000, "window": 200000, "pct": -1}}]
    invalid_path = Path(directory) / "invalid-checkpoint.json"
    for invalid in invalids:
        invalid_path.write_text(json.dumps(invalid), encoding="utf-8")
        page.locator("#checkpoint-file").set_input_files(str(invalid_path))
        page.wait_for_function("document.querySelector('#checkpoint-file').value === ''")
        assert "열 수 없는 checkpoint" in page.locator("#resume-feedback").inner_text()
        assert page.locator("#resume-brief").input_value() == original_brief
        assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == stored_snapshot
    invalid_path.write_text(json.dumps(checkpoint) + " " * 65536, encoding="utf-8")
    page.locator("#checkpoint-file").set_input_files(str(invalid_path))
    page.wait_for_function("document.querySelector('#checkpoint-file').value === ''")
    assert "64 KiB 이하" in page.locator("#resume-feedback").inner_text()
    assert page.locator("#resume-brief").input_value() == original_brief
    # Don't generate a file that the new reader cannot reopen.
    invalid_session_snapshot = json.loads(json.dumps(SNAPSHOT))
    invalid_session_snapshot["sessions"][0]["branch"] = "bad\nbranch"
    snapshot_path.write_text(json.dumps(invalid_session_snapshot), encoding="utf-8")
    page.locator("#snapshot-file").set_input_files(str(snapshot_path))
    page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
    failed_exports = []
    page.on("download", lambda download: failed_exports.append(download.suggested_filename))
    page.get_by_role("button", name="메타데이터 checkpoint 저장", exact=False).click()
    page.locator("#import-feedback").get_by_text("checkpoint를 만들 수 없습니다.", exact=False).wait_for()
    assert not failed_exports
    assert page.locator("#resume-brief").input_value() == original_brief
    snapshot_path.write_text(json.dumps(SNAPSHOT), encoding="utf-8")
    page.locator("#snapshot-file").set_input_files(str(snapshot_path))
    page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
    # Text-only rendering, missing optional metadata, and over-100 estimates.
    safe = {**checkpoint, "project": "<img src=x onerror=alert(1)>", "branch": None, "model": None,
            "context": {"used": 0, "window": None, "pct": 105}}
    checkpoint_path.write_text(json.dumps(safe), encoding="utf-8")
    page.locator("#checkpoint-file").set_input_files(str(checkpoint_path))
    page.wait_for_function("document.querySelector('#checkpoint-file').value === ''")
    assert page.locator("#resume-metadata img").count() == 0
    assert "<img" in page.locator("#resume-metadata").inner_text()
    assert "브랜치: 정보 없음" in page.locator("#resume-brief").input_value()
    assert "105%" in page.locator("#resume-brief").input_value()
    # Small screen, landscape, desktop, large type and keyboard focus.
    for width, height in ((375, 812), (812, 375), (1280, 900)):
        page.set_viewport_size({"width": width, "height": height})
        assert_no_horizontal_overflow(page)
    page.set_viewport_size({"width": 375, "height": 812})
    page.add_style_tag(content="html { font-size: 200% !important; }")
    assert_no_horizontal_overflow(page)
    page.emulate_media(reduced_motion="reduce", color_scheme="light")
    assert_theme_contrast(page)
    for control in ("resume-copy", "resume-download", "resume-clear", "resume-brief"):
        page.locator(f"#{control}").focus()
        page.keyboard.press("Tab")
        page.keyboard.press("Shift+Tab")
        # :focus-visible may be matched before its painted style is updated.
        page.wait_for_function("id => {const el = document.getElementById(id); return document.activeElement === el && parseFloat(getComputedStyle(el).outlineWidth) >= 2;}", arg=control)
        focus = page.locator(f"#{control}").evaluate("el => ({id: el.id, active: document.activeElement.id, visible: el.matches(':focus-visible'), outline: parseFloat(getComputedStyle(el).outlineWidth)})")
        if focus["outline"] < 2:
            focus["rules"] = page.locator(f"#{control}").evaluate("el => Array.from(document.styleSheets).flatMap(sheet => Array.from(sheet.cssRules)).filter(rule => rule.selectorText && el.matches(rule.selectorText)).map(rule => rule.cssText)")
        assert focus["outline"] >= 2, focus
    assert all(target["height"] >= 44 for target in visible_target_heights(page))
    screenshot_dir = os.environ.get("TOKENJUICE_TEST_SCREENSHOT_DIR")
    if screenshot_dir:
        checkpoint_path.write_text(json.dumps(checkpoint), encoding="utf-8")
        page.reload(wait_until="networkidle")
        page.locator("#checkpoint-file").set_input_files(str(checkpoint_path))
        page.locator("#resume-content").wait_for(state="visible")
        page.locator("#resume-panel").screenshot(path=str(Path(screenshot_dir) / "resume-mobile.png"))
        page.set_viewport_size({"width": 1280, "height": 900})
        page.locator("#resume-panel").screenshot(path=str(Path(screenshot_dir) / "resume-desktop.png"))
        page.set_viewport_size({"width": 375, "height": 812})
    page.get_by_role("button", name="화면에서 지우기", exact=True).click()
    assert page.locator("#resume-content").is_hidden()
    assert page.locator("#resume-brief").input_value() == ""
    assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == stored_snapshot
    # New module is precached; reading a local checkpoint needs no network.
    page.evaluate("navigator.serviceWorker.ready")
    page.reload(wait_until="networkidle")
    page.context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    assert page.locator("#resume-content").is_hidden()  # no persistent checkpoint
    page.locator("#checkpoint-file").set_input_files(str(checkpoint_path))
    page.locator("#resume-content").wait_for(state="visible")
    assert all(request.method == "GET" and request.post_data is None for request in requests)
    assert not errors, errors
    page.close()


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        snapshot = Path(directory) / "widget-snapshot.json"
        snapshot.write_text(json.dumps(SNAPSHOT), encoding="utf-8")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.add_init_script("Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' });")
            page.set_default_timeout(8_000)
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            passphrase = {"value": None}
            dialogs: list[str] = []
            def handle_dialog(dialog):
                dialogs.append(f"{dialog.type}: {dialog.message}")
                dialog.accept(passphrase["value"] or "")
            page.on("dialog", handle_dialog)
            page.goto("http://127.0.0.1:4173", wait_until="networkidle")
            assert page.get_by_text("내 스냅샷 가져오기").is_visible()
            assert page.get_by_text("예시 화면 보기").is_visible()
            assert page.get_by_text("Claude Code·Codex를 자주 쓰다 한도·컨텍스트 때문에 작업이 끊기는 사람을 위한 화면입니다.").is_visible()
            assert page.get_by_text("수동 스냅샷 공개 베타", exact=True).is_visible()
            assert page.get_by_text("자동 동기화나 앱스토어 배포는 아직 제공하지 않습니다.").is_visible()
            assert page.get_by_label("내 스냅샷 가져오기").count() == 1
            assert page.get_by_role("button", name="예시 화면 보기").is_visible()
            assert page.get_by_text("본문으로 건너뛰기").count() == 1
            assert page.locator("#content").count() == 1
            # UX6: the supported mobile and desktop shells must not create a
            # sideways scroll region. Desktop is checked explicitly because
            # the account grid changes at the breakpoint.
            assert_no_horizontal_overflow(page)
            page.set_viewport_size({"width": 1280, "height": 900})
            page.reload(wait_until="networkidle")
            assert_no_horizontal_overflow(page)
            page.set_viewport_size({"width": 375, "height": 812})
            page.reload(wait_until="networkidle")
            assert_no_horizontal_overflow(page)
            targets = visible_target_heights(page)
            assert min(target["height"] for target in targets) >= 44, targets
            # UX6: emulate browser large text without changing the product
            # data; the first-run CTA must remain readable and contained.
            page.add_style_tag(content="html { font-size: 200% !important; }")
            assert_no_horizontal_overflow(page)
            assert page.get_by_text("내 스냅샷 가져오기").is_visible()
            # The product intentionally uses one dark token set. A light
            # preference must not silently swap to an untested palette.
            page.emulate_media(color_scheme="light")
            assert page.evaluate("getComputedStyle(document.documentElement).colorScheme") == "dark"
            assert_theme_contrast(page)
            assert_no_horizontal_overflow(page)
            page.emulate_media(color_scheme=None)
            page.reload(wait_until="networkidle")
            # Keyboard-only: the first tab reaches the skip link and every
            # visible tab stop exposes the shared focus-visible outline.
            focus_order = []
            for _ in range(12):
                page.keyboard.press("Tab")
                focused = page.evaluate("""() => {
                  const el = document.activeElement;
                  if (!el || el === document.body) return null;
                  const box = el.getBoundingClientRect();
                  const style = getComputedStyle(el);
                  return { tag: el.tagName, id: el.id, text: (el.innerText || el.getAttribute('aria-label') || '').trim(), visible: box.width > 0 && box.height > 0, outline: parseFloat(style.outlineWidth) || 0 };
                }""")
                if focused and focused["visible"]:
                    focus_order.append(focused)
                    assert focused["outline"] >= 2, focused
            assert focus_order[0]["text"] == "본문으로 건너뛰기", focus_order
            assert any(item["id"] == "preview-demo" for item in focus_order), focus_order
            assert_theme_contrast(page)
            # 첫 방문자는 자신의 파일 없이도 제품이 해결하는 문제를
            # 이해할 수 있어야 한다. 예시는 localStorage에 남지 않는다.
            page.get_by_text("예시 화면 보기").click()
            assert page.get_by_text("예시 화면", exact=True).is_visible()
            assert page.get_by_text("실제 사용량이 아니며 이 기기에 저장되지 않습니다. 내 상태를 보려면 Mac에서 내보낸 스냅샷을 가져오세요.").is_visible()
            assert page.get_by_text("제공자 제한 중", exact=True).is_visible()
            assert page.get_by_text("NOW", exact=True).is_visible()
            assert page.get_by_text("WHY", exact=True).is_visible()
            assert page.get_by_text("NEXT", exact=True).is_visible()
            assert page.locator("#priority-card").get_attribute("aria-labelledby") == "priority-label"
            assert page.get_by_text("새 스냅샷 가져오기").is_visible()
            assert page.get_by_text("NOW", exact=True).is_visible()
            assert page.get_by_text("WHY", exact=True).is_visible()
            assert page.get_by_text("NEXT", exact=True).is_visible()
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") is None
            # Reduced motion is a real media preference, not only a CSS text
            # check: all entrance animations must resolve to near-zero.
            page.emulate_media(reduced_motion="reduce")
            assert page.evaluate("parseFloat(getComputedStyle(document.querySelector('.dashboard')).animationDuration)") <= 0.01
            page.emulate_media(reduced_motion=None)
            page.reload(wait_until="networkidle")
            assert page.get_by_text("내 스냅샷 가져오기").is_visible()
            assert page.locator('link[rel="icon"]').get_attribute("href") == "./icons/tokenjuice-192.png"
            assert page.get_by_text("설치·FAQ").is_visible()
            page.get_by_text("설치·FAQ").click()
            page.get_by_text("설치하고 메뉴바 확인").wait_for()
            assert page.get_by_text("개인정보 원칙 보기").is_visible()
            page.go_back(wait_until="networkidle")
            page.get_by_text("개인정보").click()
            assert page.get_by_text("기기 밖으로", exact=False).is_visible()
            assert page.locator('link[rel="icon"]').get_attribute("href") == "./icons/tokenjuice-192.png"
            assert page.get_by_text("계기판으로").is_visible()
            page.get_by_text("계기판으로").click()
            page.locator("#snapshot-file").set_input_files(str(snapshot))
            page.get_by_text("Personal").wait_for()
            assert page.locator("#demo-notice").is_hidden()
            assert page.locator("#import-feedback").get_by_text("스냅샷을 가져왔습니다.", exact=False).is_visible()
            assert "확인한 스냅샷 · 가장 먼저 확인할 상태를 표시합니다." in page.locator("#live-region").inner_text()
            # Core status and NEXT remain visible on a narrow screen; verbose
            # provenance is a semantic disclosure with normal keyboard use.
            details = page.locator(".account-detail")
            assert details.count() == 3
            assert all(details.nth(index).get_attribute("open") is None for index in range(details.count()))
            assert page.get_by_text("다음 행동").count() >= 2
            first_summary = details.nth(0).locator("summary")
            first_summary.focus()
            page.keyboard.press("Enter")
            assert details.nth(0).get_attribute("open") is not None
            assert page.locator(".account.claude .state-explainer").get_by_text("이 스냅샷을 만든 시점에 성공적으로 읽은 값입니다.").is_visible()
            for index in range(1, details.count()):
                details.nth(index).locator("summary").click()
            assert page.get_by_text("65%").is_visible()
            assert page.get_by_text("리셋 전 소진 예상").is_visible()
            assert page.get_by_text("제공자 제한 중", exact=True).is_visible()
            assert page.get_by_text("다음 행동").count() >= 2
            assert page.get_by_text("이 스냅샷을 만든 시점에 성공적으로 읽은 값입니다.").count() >= 1
            assert page.get_by_text("제공자가 다음 확인 가능 시각 전의 요청을 제한하고 있습니다.").is_visible()
            # retryAt은 snapshot 계약에서 Unix ms다. 초처럼 다시 곱하지 않는다.
            retry_copy = page.locator(".account.codex .recovery").inner_text()
            assert "다음 확인" in retry_copy and "1970" not in retry_copy
            assert page.get_by_text("Cursor").is_visible()
            assert page.get_by_text("90%").is_visible()
            assert page.get_by_text("작업 컨텍스트").is_visible()
            assert page.get_by_text("checkpoint 권장").count() >= 1
            assert page.get_by_text("84% 사용").is_visible()
            assert page.get_by_text("스냅샷 업데이트 필요", exact=True).is_visible()
            assert "Mac에서 새 스냅샷을 내보낸 뒤 다시 가져오세요." in page.locator("#snapshot-age-warning").inner_text()
            assert page.locator("#status-dot").get_attribute("class") == "caution"
            targets = visible_target_heights(page)
            assert min(target["height"] for target in targets) >= 44, targets
            assert_no_horizontal_overflow(page)
            with page.expect_download() as download_info:
                page.get_by_text("메타데이터 checkpoint 저장").click()
            checkpoint = download_info.value
            assert checkpoint.suggested_filename.startswith("tokenjuice-checkpoint-")
            checkpoint_payload = json.loads(Path(checkpoint.path()).read_text(encoding="utf-8"))
            assert checkpoint_payload["format"] == "tokenjuice-checkpoint-v1"
            assert checkpoint_payload["privacy"] == "metadata_only"
            assert "topic" not in json.dumps(checkpoint_payload)
            assert page.locator("#resume-content").is_visible()
            assert "프로젝트: tokenjuice" in page.locator("#resume-brief").input_value()
            assert page.locator("#empty-state").is_hidden()
            page.reload(wait_until="networkidle")
            assert page.get_by_text("Personal").is_visible()
            # The static shell must remain usable offline; imported data is
            # already local and must not depend on a provider or our server.
            page.evaluate("navigator.serviceWorker.ready")
            page.reload(wait_until="networkidle")
            page.context.set_offline(True)
            page.reload(wait_until="domcontentloaded")
            assert page.get_by_text("Personal").is_visible()
            assert page.locator("#transport").inner_text() == "오프라인 · 저장된 스냅샷"
            page.context.set_offline(False)

            # The guide is a separate UX10 surface but shares the same 375px
            # accessibility gate.
            page.goto("http://127.0.0.1:4173/guide.html", wait_until="networkidle")
            page.set_viewport_size({"width": 375, "height": 812})
            page.reload(wait_until="networkidle")
            assert_no_horizontal_overflow(page)
            assert page.get_by_text("공개 베타", exact=True).is_visible()
            assert page.get_by_text("설치하고 메뉴바 확인").is_visible()
            assert page.get_by_text("이 기기는 macOS로 확인되었습니다. 아래 메뉴바 설치 경로만 안내합니다.").is_visible()
            assert page.locator('[data-install-platform="windows"]').is_hidden()
            assert page.locator('[data-install-platform="mac"] .install-steps li').count() == 3
            mac_card = page.locator('[data-install-platform="mac"]')
            assert mac_card.get_by_text("첫 데이터 확인", exact=True).is_visible()
            assert mac_card.get_by_text("필수:", exact=True).is_visible()
            assert mac_card.get_by_text("비밀값 없는 진단 정보와 함께 피드백 보내기 →", exact=True).is_visible()
            assert page.get_by_text("./install.sh --doctor", exact=True).count() == 2
            page.get_by_text("피드백에 어떤 정보를 보내면 되나요?", exact=True).click()
            assert page.get_by_text("bun claude-codex-battery.5s.js --copy-diagnostics", exact=True).is_visible()
            targets = visible_target_heights(page)
            assert min(target["height"] for target in targets) >= 44, targets
            page.goto("http://127.0.0.1:4173/", wait_until="networkidle")

            # A current export must not inherit an old file's transport warning.
            fresh_snapshot = {**SNAPSHOT, "generatedAt": int(time.time() * 1000)}
            fresh_path = Path(directory) / "fresh-widget-snapshot.json"
            fresh_path.write_text(json.dumps(fresh_snapshot), encoding="utf-8")
            page.locator("#snapshot-file").set_input_files(str(fresh_path))
            page.locator("#snapshot-age-warning").wait_for(state="hidden")

            # A failed/stale provider can retain its last known numbers in the
            # export. These must not look like current remaining quota in any
            # account card, nor show a forecast derived from the old sample.
            state_labels = {
                "stale": "업데이트 필요", "auth_expired": "다시 연결 필요",
                "rate_limited": "제공자 제한 중", "unavailable": "확인할 수 없음",
            }
            state_path = Path(directory) / "state-widget-snapshot.json"
            for state, label in state_labels.items():
                for kind in ("claude", "codex", "provider"):
                    state_snapshot = json.loads(json.dumps(fresh_snapshot))
                    payload = state_snapshot["claude"][0] if kind == "claude" else state_snapshot["codex"] if kind == "codex" else state_snapshot["providers"][0]
                    payload.update(state=state, items=SNAPSHOT["claude"][0]["items"])
                    state_path.write_text(json.dumps(state_snapshot), encoding="utf-8")
                    page.locator("#snapshot-file").set_input_files(str(state_path))
                    page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
                    account = page.locator(f".account.{kind}")
                    assert account.locator(".state").inner_text() == label, (kind, state)
                    assert account.locator(".metric").count() == 0, (kind, state)
                    assert "% 남음" not in account.inner_text(), (kind, state)
                    assert account.locator(".forecast").count() == 0, (kind, state)
                    assert account.locator(".recovery").is_visible(), (kind, state)
            # Fresh and explicitly labelled fallback samples remain visible.
            for state in ("fresh", "fallback"):
                state_snapshot = json.loads(json.dumps(fresh_snapshot))
                state_snapshot["claude"][0]["state"] = state
                state_path.write_text(json.dumps(state_snapshot), encoding="utf-8")
                page.locator("#snapshot-file").set_input_files(str(state_path))
                page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
                assert page.locator(".account.claude .metric").count() == 1
                assert page.locator(".account.claude").get_by_text("65%").is_visible()
            page.locator("#snapshot-file").set_input_files(str(fresh_path))
            page.wait_for_function("document.querySelector('#snapshot-file').value === ''")

            # Export with the real Bun engine and import it through the browser
            # WebCrypto path. This proves the two implementations interoperate.
            engine_home = Path(directory) / "engine-home"
            config = engine_home / ".config" / "claude-codex-battery" / "config.json"
            config.parent.mkdir(parents=True)
            config.write_text(json.dumps({"api": True}), encoding="utf-8")
            fixture = engine_home / "usage-fixture.json"
            fixture.write_text(json.dumps({"status": 200, "body": {
                "five_hour": {"utilization": 35, "resets_at": "2026-10-08T19:00:00.000Z"},
                "seven_day": {"utilization": 50, "resets_at": "2026-10-12T19:00:00.000Z"},
            }}), encoding="utf-8")
            root = Path(__file__).resolve().parent.parent
            env = {**os.environ, "HOME": str(engine_home), "CCB_COMPACT": "0", "CCB_TEST_USAGE_FIXTURE": str(fixture), "TOKENJUICE_SYNC_PASSPHRASE": "pocket test passphrase"}
            subprocess.run([shutil.which("bun") or "bun", str(root / "claude-codex-battery.5s.js"), "--export-sync-bundle"], env=env, check=True, capture_output=True, text=True)
            encrypted = engine_home / ".cache" / "claude-codex-battery" / "widget-sync.tokenjuice"
            assert encrypted.exists()
            bundle = json.loads(encrypted.read_text(encoding="utf-8"))
            decrypted_transport = page.evaluate("""async ({ bundle, passphrase }) => {
              const bytes = (value) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
              const text = new TextEncoder();
              const material = await crypto.subtle.importKey("raw", text.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
              const key = await crypto.subtle.deriveKey({ name:"PBKDF2", salt:bytes(bundle.crypto.salt), iterations:bundle.crypto.iterations, hash:"SHA-256" }, material, { name:"AES-GCM", length:256 }, false, ["decrypt"]);
              const ciphertext = bytes(bundle.crypto.ciphertext), tag = bytes(bundle.crypto.tag), sealed = new Uint8Array(ciphertext.length + tag.length);
              sealed.set(ciphertext); sealed.set(tag, ciphertext.length);
              const plaintext = await crypto.subtle.decrypt({ name:"AES-GCM", iv:bytes(bundle.crypto.iv), additionalData:text.encode("tokenjuice-sync-v1"), tagLength:128 }, key, sealed);
              return JSON.parse(new TextDecoder().decode(plaintext)).transport;
            }""", {"bundle": bundle, "passphrase": "pocket test passphrase"})
            assert decrypted_transport == "local_export_only"
            # Simulate slower browser crypto deterministically. Waiting a fixed
            # 300ms used to inspect the "checking" message on the Pages runner.
            page.evaluate("""() => {
              const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
              crypto.subtle.decrypt = async (...args) => {
                await new Promise(resolve => setTimeout(resolve, 600));
                return decrypt(...args);
              };
            }""")
            # A failed decryption must not replace the snapshot the user was
            # already viewing. This is both a privacy and a recovery guard.
            before_failed_import = page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")
            passphrase["value"] = "wrong passphrase"
            page.locator("#snapshot-file").set_input_files(str(encrypted))
            page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import
            assert dialogs[-1:] == ["prompt: 이 암호화 번들을 만들 때 사용한 암호를 입력하세요."], dialogs
            assert page.locator("#import-feedback").get_by_text("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.").is_visible()
            assert page.locator("#live-region").inner_text() == "가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요."

            # Cancelling the passphrase prompt must resolve the in-progress
            # message into a clear retry path and leave the existing data alone.
            passphrase["value"] = None
            page.locator("#snapshot-file").set_input_files(str(encrypted))
            page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import
            assert page.locator("#import-feedback").get_by_text("가져오기를 취소했습니다. 암호화 번들은 만든 때의 암호를 입력해야 열 수 있습니다.").is_visible()
            assert page.locator("#live-region").inner_text() == "가져오기를 취소했습니다. 암호화 번들은 만든 때의 암호를 입력해야 열 수 있습니다."

            # A malformed file must produce the same nearby, recoverable error
            # without an alert and without replacing the existing snapshot.
            malformed = Path(directory) / "malformed.json"
            malformed.write_text('{"not":"a tokenjuice snapshot"}', encoding="utf-8")
            page.locator("#snapshot-file").set_input_files(str(malformed))
            page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import
            assert page.locator("#import-feedback").get_by_text("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.").is_visible()

            # A correct envelope is not enough: nested malformed data used to
            # overwrite storage before rendering failed. Preserve both the
            # persisted snapshot and the visible dashboard on every rejection.
            accounts_before = page.locator("#accounts").inner_html()
            priority_before = page.locator("#priority-card").inner_text()
            invalid_patches = [
                {"claude": [None]},
                {"codex": "not an account"},
                {"providers": {}},
                {"providers": [None]},
                {"claude": [{**SNAPSHOT["claude"][0], "items": {"length": 1}}]},
                {"codex": {**SNAPSHOT["codex"], "items": [None]}},
                {"claude": [{**SNAPSHOT["claude"][0], "items": [{"name": "5-hour", "used": None}]}]},
                {"claude": [{**SNAPSHOT["claude"][0], "items": [{"name": "5-hour", "used": "35"}]}]},
                {"claude": [{**SNAPSHOT["claude"][0], "items": [{"name": "5-hour", "used": -1}]}]},
                {"claude": [{**SNAPSHOT["claude"][0], "items": [{"name": "5-hour", "used": 101}]}]},
                {"claude": [{**SNAPSHOT["claude"][0], "items": [{"name": "5-hour", "used": 35, "forecast": "estimate"}]}]},
                {"sessions": [None]},
                {"sessions": [{**SNAPSHOT["sessions"][0], "pct": "84"}]},
                {"generatedAt": None},
            ]
            for index, patch in enumerate(invalid_patches):
                malformed.write_text(json.dumps({**fresh_snapshot, **patch}), encoding="utf-8")
                page.locator("#snapshot-file").set_input_files(str(malformed))
                page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
                assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import, (index, patch)
                assert page.locator("#accounts").inner_html() == accounts_before, (index, patch)
                assert page.locator("#priority-card").inner_text() == priority_before, (index, patch)
                assert page.locator("#import-feedback").get_by_text("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.").is_visible()

            # Previously saved corrupt data must not crash on next startup.
            page.evaluate("snapshot => localStorage.setItem('tokenjuice.widget-snapshot.v1', JSON.stringify(snapshot))", {**fresh_snapshot, "providers": {}})
            page.reload(wait_until="networkidle")
            assert page.locator("#empty-state").is_visible()
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") is None
            # Older v1 exports without the optional context/provider additions
            # are still importable; stricter validation is not a new contract.
            legacy_snapshot = {key: value for key, value in fresh_snapshot.items() if key not in ("providers", "sessions")}
            legacy_path = Path(directory) / "legacy-widget-snapshot.json"
            legacy_path.write_text(json.dumps(legacy_snapshot), encoding="utf-8")
            page.locator("#snapshot-file").set_input_files(str(legacy_path))
            page.get_by_text("Personal").wait_for()
            assert json.loads(page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")) == legacy_snapshot

            # The valid bundle must work even after an earlier failed attempt.
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="networkidle")
            passphrase["value"] = "pocket test passphrase"
            page.locator("#snapshot-file").set_input_files(str(encrypted))
            page.wait_for_function("document.querySelector('#snapshot-file').value === ''")
            assert page.get_by_text("Claude", exact=True).is_visible(), {"dialogs": dialogs, "errors": errors, "body": page.locator("body").inner_text()}
            assert page.get_by_text("65%").is_visible()
            assert dialogs[-1:] == ["prompt: 이 암호화 번들을 만들 때 사용한 암호를 입력하세요."], dialogs

            # The advertised deletion action must remove the browser-local copy.
            page.get_by_text("이 기기에서 삭제").click()
            page.locator("#empty-state").wait_for(state="visible")
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") is None
            assert page.get_by_text("내 스냅샷 가져오기").is_visible()
            assert not errors, errors
            check_resume(browser, directory)
            browser.close()


if __name__ == "__main__":
    main()
