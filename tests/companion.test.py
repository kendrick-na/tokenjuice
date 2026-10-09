#!/usr/bin/env python3
"""브라우저에서 TokenJuice Pocket의 스냅샷 가져오기·로컬 보관을 검증한다."""

import json
import os
import shutil
import subprocess
import tempfile
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
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions


def visible_target_heights(page) -> list[float]:
    return page.locator("button:visible, .primary-action:visible, footer a:visible, .snapshot-toolbar button:visible").evaluate_all(
        "els => els.map(el => ({ id: el.id, text: (el.innerText || '').trim(), height: el.getBoundingClientRect().height }))"
    )


def assert_theme_contrast(page) -> None:
    theme = page.evaluate("""() => {
      const styles = getComputedStyle(document.documentElement);
      return Object.fromEntries(['--ink', '--muted', '--faint', '--teal', '--panel-2'].map(name => [name, styles.getPropertyValue(name).trim()]));
    }""")
    for foreground in ("--ink", "--muted", "--faint", "--teal"):
        assert contrast_ratio(theme[foreground], theme["--panel-2"]) >= 4.5, (foreground, theme)


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        snapshot = Path(directory) / "widget-snapshot.json"
        snapshot.write_text(json.dumps(SNAPSHOT), encoding="utf-8")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 390, "height": 844})
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
            assert page.locator("#import-feedback").get_by_text("스냅샷을 가져왔습니다. 가장 먼저 확인할 상태를 표시합니다.").is_visible()
            assert page.locator("#live-region").inner_text() == "스냅샷을 가져왔습니다. 가장 먼저 확인할 상태를 표시합니다."
            assert page.get_by_text("65%").is_visible()
            assert page.get_by_text("리셋 전 소진 예상").is_visible()
            assert page.get_by_text("제공자 제한 중", exact=True).is_visible()
            assert page.get_by_text("다음 행동").count() >= 2
            # retryAt은 snapshot 계약에서 Unix ms다. 초처럼 다시 곱하지 않는다.
            retry_copy = page.locator(".account.codex .recovery").inner_text()
            assert "다음 확인" in retry_copy and "1970" not in retry_copy
            assert page.get_by_text("Cursor").is_visible()
            assert page.get_by_text("90%").is_visible()
            assert page.get_by_text("작업 컨텍스트").is_visible()
            assert page.get_by_text("checkpoint 권장").count() >= 1
            assert page.get_by_text("84% 사용").is_visible()
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
            page.context.set_offline(False)

            # The guide is a separate UX10 surface but shares the same 375px
            # accessibility gate.
            page.goto("http://127.0.0.1:4173/guide.html", wait_until="networkidle")
            page.set_viewport_size({"width": 375, "height": 812})
            page.reload(wait_until="networkidle")
            assert_no_horizontal_overflow(page)
            assert page.get_by_text("공개 베타", exact=True).is_visible()
            assert page.get_by_text("설치하고 메뉴바 확인").is_visible()
            assert page.get_by_text("./install.sh --doctor", exact=True).count() == 2
            targets = visible_target_heights(page)
            assert min(target["height"] for target in targets) >= 44, targets
            page.goto("http://127.0.0.1:4173/", wait_until="networkidle")

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
            # A failed decryption must not replace the snapshot the user was
            # already viewing. This is both a privacy and a recovery guard.
            before_failed_import = page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")
            passphrase["value"] = "wrong passphrase"
            page.locator("#snapshot-file").set_input_files(str(encrypted))
            page.wait_for_timeout(300)
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import
            assert dialogs[-1:] == ["prompt: 이 암호화 번들을 만들 때 사용한 암호를 입력하세요."], dialogs
            assert page.locator("#import-feedback").get_by_text("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.").is_visible()
            assert page.locator("#live-region").inner_text() == "가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요."

            # A malformed file must produce the same nearby, recoverable error
            # without an alert and without replacing the existing snapshot.
            malformed = Path(directory) / "malformed.json"
            malformed.write_text('{"not":"a tokenjuice snapshot"}', encoding="utf-8")
            page.locator("#snapshot-file").set_input_files(str(malformed))
            page.wait_for_timeout(200)
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") == before_failed_import
            assert page.locator("#import-feedback").get_by_text("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.").is_visible()

            # The valid bundle must work even after an earlier failed attempt.
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="networkidle")
            passphrase["value"] = "pocket test passphrase"
            page.locator("#snapshot-file").set_input_files(str(encrypted))
            page.wait_for_timeout(500)
            assert page.get_by_text("Claude", exact=True).is_visible(), {"dialogs": dialogs, "errors": errors, "body": page.locator("body").inner_text()}
            assert page.get_by_text("65%").is_visible()
            assert dialogs[-1:] == ["prompt: 이 암호화 번들을 만들 때 사용한 암호를 입력하세요."], dialogs

            # The advertised deletion action must remove the browser-local copy.
            page.get_by_text("이 기기에서 삭제").click()
            page.wait_for_timeout(100)
            assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')") is None
            assert page.get_by_text("내 스냅샷 가져오기").is_visible()
            assert not errors, errors
            browser.close()


if __name__ == "__main__":
    main()
