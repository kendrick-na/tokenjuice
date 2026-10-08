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
        "items": [{"name": "5-hour", "used": 35, "resets": "2026-10-08T19:00:00.000Z"}],
    }],
    "codex": {"state": "rate_limited", "source": "codex-jsonl", "lastSuccessAt": None, "items": []},
    "providers": [{"id": "cursor", "label": "Cursor", "state": "fresh", "source": "external-local-file", "items": [{"name": "Monthly", "used": 10, "resets": None}]}],
}


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
            assert page.get_by_text("스냅샷 가져오기").is_visible()
            assert page.locator('link[rel="icon"]').get_attribute("href") == "./icons/tokenjuice-192.png"
            page.get_by_text("개인정보").click()
            assert page.get_by_text("기기 밖으로", exact=False).is_visible()
            assert page.locator('link[rel="icon"]').get_attribute("href") == "./icons/tokenjuice-192.png"
            assert page.get_by_text("계기판으로").is_visible()
            page.get_by_text("계기판으로").click()
            page.locator("#snapshot-file").set_input_files(str(snapshot))
            page.get_by_text("Personal").wait_for()
            assert page.get_by_text("65%").is_visible()
            assert page.get_by_text("rate limited").is_visible()
            assert page.get_by_text("Cursor").is_visible()
            assert page.get_by_text("90%").is_visible()
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
            assert dialogs[-2:] == [
                "prompt: 이 암호화 번들을 만들 때 사용한 암호를 입력하세요.",
                "alert: TokenJuice 스냅샷 v1 또는 올바른 암호화 번들이 아닙니다.",
            ], dialogs

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
            assert page.get_by_text("스냅샷 가져오기").is_visible()
            assert not errors, errors
            browser.close()


if __name__ == "__main__":
    main()
