#!/usr/bin/env python3
"""
Windows tray self-test.

Exists because the maintainer develops on macOS, where pystray cannot select its
win32 backend and the ICO path Windows actually consumes is never exercised. CI
runs this on a real Windows runner; it also works on macOS for the parts that
are platform-independent.

    python selftest.py

Exits non-zero with the failing assertion on the first problem.
"""

from __future__ import annotations

import sys
from unittest.mock import patch

import tokenjuice_tray as t

CASES = {
    "healthy": [95.0],
    "mixed": [45.0, 30.0],
    "three": [8.0, 15.0, 60.0],
    "empty": [0.0],
    "nodata": [None],
    "tiny": [2.0],
}


def group(bars):
    return [{"label": "C", "color": t.CLAUDE_ORANGE, "bars": bars}]


def check_icons() -> None:
    biggest = max(t.ICON_SIZES)
    for name, bars in CASES.items():
        for size in t.ICON_SIZES:
            f = t.render_frame(group(bars), False, size)
            assert f.size == (size, size), f"{name}@{size}: got {f.size}"
        icon = t.render_icon(group(bars))
        assert icon.size == (biggest, biggest), f"{name}: base is {icon.size}"
    err = t.render_icon([], error=True)
    assert err.size == (biggest, biggest), f"error icon: {err.size}"
    print(f"  icons rendered at {t.ICON_SIZES} for {len(CASES)} states + error")


def check_ico() -> None:
    """
    The real pystray path. Windows loads the .ICO with LR_DEFAULTSIZE and picks a
    frame by DPI (100%=16, 125%=20, 150%=24), so a single-frame ICO gets upscaled
    and looks blurry on the 125%/150% laptops most people have.
    """
    from PIL import Image
    from pystray._util import serialized_image

    with serialized_image(t.render_icon(group([45.0])), "ICO") as path:
        sizes = sorted(Image.open(path).info["sizes"])
    assert (16, 16) in sizes, f"no 16px frame: {sizes}"
    assert len(sizes) > 1, f"single frame, Windows would upscale: {sizes}"
    print(f"  ICO frames: {sizes}")


def check_degenerate() -> None:
    """Missing or partial engine output must degrade, never crash the tray."""
    payloads = [
        {},
        {"claude": []},
        {"claude": [{"account": "X", "items": [], "reason": "login"}]},
        {"claude": [{"account": "X", "items": [], "reason": "needs-api"}]},
        {"claude": [{"account": "X", "items": [{"name": "5-hour", "used": 25}], "state": "rate_limited"}]},
        {"codex": [{"name": "Weekly", "used": 25}], "codexStatus": {"state": "stale"}},
        {"sessions": [{"pct": 99, "mtime": 0, "name": "n", "used": 1, "win": 2}]},
    ]
    for p in payloads:
        g = t.build_groups(p)
        t.render_icon(g)
        t.render_icon(g, error=True)
        t.build_tooltip(g, None)
    for reason in ("needs-api", "login", "rate-limit", None, "unrecognised"):
        assert t.explain_no_limits(reason), f"no explanation for {reason!r}"
    assert t.explain_no_limits(None, "auth_expired"), "no explanation for auth_expired"
    assert t.explain_no_limits(None, "rate_limited"), "no explanation for rate_limited"
    assert t.state_display_label("stale") == "업데이트 필요"
    assert t.state_display_label("auth_expired") == "다시 연결 필요"
    assert "다시 로그인" in t.state_recovery_hint("auth_expired")
    for state in ("fallback", "stale", "auth_expired", "rate_limited", "unavailable"):
        assert t.state_recovery_hint(state), f"no recovery explanation for {state}"
    stale = t.build_groups({"claude": [{"items": [{"used": 25}], "state": "rate_limited"}]})
    assert stale[0]["bars"] == [None], f"stale Claude value rendered as live: {stale}"
    stale_codex = t.build_groups({"codex": [{"used": 25}], "codexStatus": {"state": "stale"}})
    assert not any(g["label"] == "X" for g in stale_codex), f"stale Codex value rendered as live: {stale_codex}"
    print(f"  {len(payloads)} degenerate payloads OK")


def check_tooltip() -> None:
    # Windows truncates tray tooltips at 127 chars.
    many = [{"label": c, "color": 1, "bars": [88.0, 77.0]} for c in "ABCDEFGHIJ"]
    tip = t.build_tooltip(many, None)
    assert len(tip) <= 127, f"tooltip {len(tip)} > 127"
    # An all-blank group would read as a fault; the menu carries the reason.
    assert t.build_tooltip(group([None]), None) == t.APP_NAME
    print(f"  tooltip {len(tip)} chars (limit 127), blank groups omitted")


def check_manual_auth_recovery() -> None:
    """Windows explains manual recovery but never runs login or promises renewal."""
    app = t.TrayApp()
    for state, reason in (("auth_expired", None), ("unavailable", "auth"), ("auth_expired", "auth")):
        with patch.object(t.subprocess, "run") as invoke, patch.object(app, "_poll_once") as poll:
            app.data = {"claude": [{"account": "Fixture", "state": state, "reason": reason,
                                    "items": [], "lastSuccessAt": None, "observedAt": 1000}]}
            rows = [item for item in app._menu_items() if hasattr(item, "text")]
            labels = [item.text for item in rows]
            assert sum("NEXT · Claude Code에서 다시 로그인" in label for label in labels) == 1, labels
            assert any("Windows에서는 자동 로그인 갱신을 실행하지 않습니다" in label for label in labels), labels
            assert not any("renewing automatically" in label for label in labels), labels
            assert not any(" · last success " in label or "% left" in label for label in labels), labels
            assert all(not row.enabled for row in rows if "NEXT ·" in row.text), labels
            invoke.assert_not_called()
            poll.assert_not_called()
    app.data["claude"][0]["items"] = [{"name": "5-hour", "used": 25}]
    app.data["claude"][0]["lastSuccessAt"] = 1000
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("다시 로그인" in label for label in labels), labels
    assert any("위 값은 현재 값이 아닙니다" in label for label in labels), labels
    assert not any("renewing automatically" in label for label in labels), labels
    assert t.build_groups(app.data)[0]["bars"] == [None]
    assert "CCB_API=1" in " ".join(t.explain_no_limits("needs-api"))
    assert "terminal" in " ".join(t.explain_no_limits("login"))
    assert "retry-after" in " ".join(t.explain_no_limits(None, "rate_limited"))
    print("  manual auth recovery is explanatory only; no automatic Windows renewal")


def check_failed_observation_menu() -> None:
    """A failed read must not become last success or disappear as no session."""
    app = t.TrayApp()
    for reason, message in (("invalid_quota", "잘못된 사용량 형식"), ("invalid_timestamp", "사용량 기록 시각")):
        failure = {"state": "unavailable", "reason": reason, "items": [],
                   "observedAt": 1000, "lastSuccessAt": None, "source": "local"}
        app.data = {"claude": [{"account": "Claude", **failure}], "codex": [],
                    "codexAccounts": [{"id": "default", "account": "Codex", **failure}]}
        labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
        assert sum(message in label for label in labels) == 2, labels
        assert sum("no successful reading" in label for label in labels) == 2, labels
        assert not any("last success" in label for label in labels), labels
        assert not any("no usage data yet" in label or "% left" in label for label in labels), labels
        app.data = {"claude": [], "codex": [], "codexStatus": failure}
        labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
        assert any(message in label for label in labels), labels
    app.data = {"claude": [{"items": [], "state": "stale", "lastSuccessAt": 1000, "observedAt": 2000}], "codex": []}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("last success" in label for label in labels), labels
    app.data = {"claude": [{"items": [], "state": "stale", "at": 1000}], "codex": [],
                "codexAccounts": [{"id": "work", "state": "stale", "at": 1000, "items": []}]}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert sum("last success" in label for label in labels) == 2, labels
    app.data = {"claude": [], "codex": [], "codexAccounts": [{"id": "default", "items": []}]}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert not any(label == "Codex" for label in labels), labels
    print("  failed observations remain visible without invented success")


def check_cost_menu() -> None:
    """A monetary Copilot report must never become a quota-looking battery."""
    app = t.TrayApp()
    app.data = {
        "claude": [], "sessions": [], "codex": [],
        "copilot": {"enabled": True, "state": "fresh", "amountUsd": 12.5, "budgetUsd": 20, "usedPct": 62.5},
    }
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("monthly spend, not quota" in label for label in labels), labels
    assert any("voluntary budget" in label for label in labels), labels
    app.data["copilot"] = {"enabled": True, "state": "unavailable"}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("usage unavailable" in label for label in labels), labels
    print("  Copilot cost menu states OK")


def check_local_provider_menu() -> None:
    """A configured local adapter is explicit and never masquerades as live when stale."""
    app = t.TrayApp()
    app.data = {
        "claude": [], "sessions": [], "codex": [],
        "providers": [{"id": "cursor", "label": "Cursor", "state": "fresh", "items": [{"name": "Monthly", "used": 42}]}],
    }
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("Cursor — local quota file" in label for label in labels), labels
    assert any("58% left" in label for label in labels), labels
    assert any("no token, cookie, command, or network access" in label for label in labels), labels
    app.data["providers"][0]["state"] = "stale"
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("업데이트 필요 · 마지막 성공 값 — 현재 값으로 가정하지 않음" in label for label in labels), labels
    print("  local provider menu states OK")


def check_codex_profiles() -> None:
    """Additive profile contract and bound selection do not run a real engine."""
    app = t.TrayApp()
    app.data = {"codex": [{"name": "Weekly", "used": 25}], "codexAccounts": [
        {"id": "personal", "account": "Personal", "state": "fresh", "selected": True, "items": [{"name": "Weekly", "used": 25}]},
        {"id": "work", "account": "Work", "state": "stale", "selected": False, "items": []},
    ]}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert "Codex Personal" in labels and "Codex Work" in labels, labels
    assert any("Selected for X header" in label for label in labels), labels
    assert any("Use Work — local display only, not login" in label for label in labels), labels
    assert any("업데이트 필요" in label for label in labels), labels
    app.data = {"codex": [{"name": "Weekly", "used": 25}]}
    legacy_labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert "Codex" in legacy_labels and any("75% left" in label for label in legacy_labels), legacy_labels
    assert not any("확인할 수 없음" in label for label in legacy_labels), legacy_labels
    with patch.object(t, "find_bun", return_value="bun-fixture"), patch.object(t, "find_engine", return_value="engine-fixture.js"), patch.object(t.subprocess, "run") as invoke, patch.object(app, "_poll_once") as poll:
        callback = app._select_codex_account("work")
        callback()
        assert invoke.call_args.args[0] == ["bun-fixture", "engine-fixture.js", "--select-codex-account=work"]
        assert invoke.call_args.kwargs.get("shell", False) is False
        poll.assert_called_once()
        app._select_codex_account("bad;id")()
        assert invoke.call_count == 1, "invalid ID invoked engine"
    print("  Codex profiles and isolated selection OK")


def main() -> int:
    print(f"tokenjuice self-test on {sys.platform}")
    for fn in (check_icons, check_ico, check_degenerate, check_tooltip, check_manual_auth_recovery, check_failed_observation_menu, check_cost_menu, check_local_provider_menu, check_codex_profiles):
        print(f"- {fn.__name__}")
        fn()
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
