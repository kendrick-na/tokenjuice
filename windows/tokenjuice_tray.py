#!/usr/bin/env python3
"""
tokenjuice — Windows system tray

The battery maths live in claude-codex-battery.5s.js (one engine, both OSes).
This file is only a renderer: it runs the engine with --json and draws the
result into the tray. Keeping it that way is deliberate — a second
implementation of the usage logic would drift from the macOS one.

    python tokenjuice_tray.py                 # run in the tray
    python tokenjuice_tray.py --once          # print one reading and exit (debug)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

from PIL import Image, ImageDraw
import pystray
from pystray import Menu, MenuItem

APP_NAME = "tokenjuice"
REFRESH_SECONDS = 5
ENGINE_TIMEOUT = 25

# Matches the macOS palette so screenshots of both look like one product.
CLAUDE_ORANGE = (217, 119, 87)
CODEX_VIOLET = (139, 122, 246)
LETSUR_CYAN = (34, 211, 238)
GREEN = (52, 199, 89)
YELLOW = (255, 204, 0)
RED = (255, 69, 58)
DIM = (110, 118, 129)

# Tray icon sizing. pystray hands our PIL image to Windows as an .ICO and loads
# it with LR_DEFAULTSIZE, so Windows picks a frame from *inside* the file by the
# current DPI: 100%=16, 125%=20, 150%=24, and the Win10+ taskbar uses 24.
# A 16-only ICO therefore gets upscaled and looks blurry on most laptops, which
# ship at 125% or 150% — so we render every size natively instead.
ICON_SIZES = (16, 20, 24, 32)
ICON_BASE = 16
# Draw oversampled, then downsample: keeps the 1px battery outline crisp.
SCALE = 4


def heat(remain: float) -> tuple[int, int, int]:
    if remain >= 50:
        return GREEN
    if remain >= 20:
        return YELLOW
    return RED


# ───────────────────────── engine ─────────────────────────


def repo_root() -> Path:
    # Frozen (PyInstaller) → engine sits next to the exe; source → parent dir.
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def find_engine() -> Path | None:
    for cand in (
        repo_root() / "claude-codex-battery.5s.js",
        repo_root() / "engine" / "claude-codex-battery.5s.js",
        Path(__file__).resolve().parent / "claude-codex-battery.5s.js",
    ):
        if cand.exists():
            return cand
    return None


def find_bun() -> str | None:
    found = shutil.which("bun")
    if found:
        return found
    # bun's Windows installer puts it here but does not always refresh PATH for
    # already-running processes — check directly so a fresh install just works.
    fallback = Path(os.environ.get("USERPROFILE", "")) / ".bun" / "bin" / "bun.exe"
    return str(fallback) if fallback.exists() else None


class EngineError(RuntimeError):
    pass


def read_usage(show_topics: bool) -> dict:
    bun = find_bun()
    if not bun:
        raise EngineError(
            "bun not found.\nInstall it:  powershell -c \"irm bun.sh/install.ps1 | iex\""
        )
    engine = find_engine()
    if not engine:
        raise EngineError("Engine not found (claude-codex-battery.5s.js).")

    cmd = [bun, str(engine), "--json"]
    cmd.append("--topics" if show_topics else "--no-topics")

    # CREATE_NO_WINDOW: without it every 5s poll flashes a console window.
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=ENGINE_TIMEOUT,
            creationflags=flags,
        )
    except subprocess.TimeoutExpired as exc:
        raise EngineError("Engine timed out.") from exc

    if proc.returncode != 0:
        raise EngineError((proc.stderr or "Engine failed.").strip()[:300])
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise EngineError("Engine returned malformed JSON.") from exc


# ───────────────────────── model ─────────────────────────


def build_groups(data: dict) -> list[dict]:
    """Flatten the engine payload into the bars the tray should draw."""
    groups: list[dict] = []

    accounts = data.get("claude") or []
    for acc in accounts:
        items = acc.get("items") or []
        label = (acc.get("account") or "C")[0].upper() if len(accounts) > 1 else "C"
        state = acc.get("state") or ("stale" if acc.get("stale") else ("fresh" if items else "unavailable"))
        bars = [100 - i.get("used", 0) for i in items] if state in ("fresh", "fallback") else [None]
        groups.append({"label": label, "color": CLAUDE_ORANGE, "bars": bars})

    # Only sessions touched in the last 15 min are "live" — same rule as macOS.
    now_ms = time.time() * 1000
    sessions = [
        s for s in (data.get("sessions") or [])
        if now_ms - s.get("mtime", 0) < 15 * 60 * 1000
    ]
    if sessions:
        # Riskiest first so the one about to compact is the one you can see.
        risky = sorted(sessions, key=lambda s: s.get("pct", 0), reverse=True)[:2]
        groups.append({
            "label": "S",
            "color": CLAUDE_ORANGE,
            "bars": [100 - s.get("pct", 0) for s in risky],
            "overflow": len(sessions) - len(risky),
        })

    codex = data.get("codex") or []
    codex_status = data.get("codexStatus") or {}
    if codex and codex_status.get("state", "fresh") in ("fresh", "fallback"):
        groups.append({
            "label": "X",
            "color": CODEX_VIOLET,
            "bars": [100 - i.get("used", 0) for i in codex],
        })

    letsur = data.get("letsur")
    if letsur:
        groups.append({
            "label": "L",
            "color": LETSUR_CYAN,
            "bars": [100 - letsur.get("pct", 0)],
        })
    return groups


def worst_remaining(groups: list[dict]) -> float | None:
    vals = [b for g in groups for b in g["bars"] if b is not None]
    return min(vals) if vals else None


# ───────────────────────── icon drawing ─────────────────────────


def draw_battery(
    d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, remain: float | None, lw: int
):
    """
    A pixel battery: outline, fill proportional to remaining, nub on the right.

    Two things matter at 16px and cost us a redraw to learn:
      - the empty part must be a dark trough, not transparent. Left transparent
        it picks up the taskbar behind it and the bar stops reading as a battery.
      - the outline must be exactly 1 logical pixel (`lw`), not thicker, or a
        short bar closes up into a solid blob with no discernible shape.
    """
    col = DIM if remain is None else heat(remain)
    TROUGH = (18, 20, 24, 235)

    d.rectangle([x, y, x + w - 1, y + h - 1], fill=TROUGH, outline=col, width=lw)

    nub_h = max(lw * 2, h // 3)
    nub_y = y + (h - nub_h) // 2
    d.rectangle([x + w, nub_y, x + w + lw - 1, nub_y + nub_h - 1], fill=col)

    if remain is None:
        return
    inner_x, inner_y = x + lw, y + lw
    inner_w, inner_h = w - lw * 2, h - lw * 2

    if remain <= 0:
        # Truly empty. A 1px sliver of red inside a red outline is invisible, so
        # "0%" and "2%" would look identical — mark dead-empty with a cross
        # instead of relying on fill width to carry the difference.
        d.line([inner_x, inner_y, inner_x + inner_w - 1, inner_y + inner_h - 1], fill=col, width=lw)
        d.line([inner_x + inner_w - 1, inner_y, inner_x, inner_y + inner_h - 1], fill=col, width=lw)
        return

    fill_w = max(lw, round(inner_w * min(100.0, remain) / 100))
    d.rectangle(
        [inner_x, inner_y, inner_x + fill_w - 1, inner_y + inner_h - 1],
        fill=col,
    )


def render_frame(groups: list[dict], error: bool = False, target: int = ICON_BASE) -> Image.Image:
    """
    Render one icon frame at `target`x`target` px.

    The Windows tray gives us ~16-24px — far less room than a macOS menu bar. So
    we do NOT try to reproduce the wide `[C 88][17]` strip. We stack up to 3
    batteries vertically (the worst offenders) and leave the numbers to the menu,
    which is where there is actually space to read them.
    """
    size = target * SCALE
    lw = SCALE  # 1 logical px at this target size
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if error:
        pad = 3 * SCALE
        d.line([pad, pad, size - pad, size - pad], fill=RED, width=lw)
        d.line([size - pad, pad, pad, size - pad], fill=RED, width=lw)
        return img.resize((target, target), Image.LANCZOS)

    bars = [b for g in groups for b in g["bars"]]
    if not bars:
        bars = [None]
    # Show the tightest limits — those are the ones that will bite.
    known = sorted([b for b in bars if b is not None])
    bars = (known or [None])[:3]

    n = len(bars)
    gap = lw
    avail_h = size - 2 * lw
    bar_w = size - 4 * lw
    # Cap the height so a single battery stays battery-shaped instead of
    # stretching into a square blob; the stack is then centred vertically.
    bar_h = min((avail_h - gap * (n - 1)) // n, round(bar_w * 0.55))
    stack_h = bar_h * n + gap * (n - 1)
    y = (size - stack_h) // 2
    for b in bars:
        draw_battery(d, lw, y, bar_w, bar_h, b, lw)
        y += bar_h + gap

    return img.resize((target, target), Image.LANCZOS)


def render_icon(groups: list[dict], error: bool = False) -> Image.Image:
    """
    Build the icon Windows will actually use.

    pystray saves our image with a bare `image.save(fp, format='ICO')`, and
    Pillow's ICO writer then does two things that decide what we can do here:

      1. it only emits frames whose size is <= the base image's size
         (IcoImagePlugin._save: `if size[0] > width: continue`), and
      2. it reads `append_images` from *encoderinfo* — i.e. save() kwargs —
         which pystray does not pass, so attaching frames to the image is
         silently ignored.

    So we cannot hand over a 16px base and attach bigger frames; verified
    empirically that only the 16px frame survives. Instead render at the largest
    size we care about (32px) and let Pillow downscale for the smaller entries,
    which it will do because they are all <= 32. Windows can then pick the frame
    matching the user's DPI (100%=16, 125%=20, 150%=24, taskbar=24) instead of
    upscaling a lone 16px bitmap.
    """
    biggest = max(ICON_SIZES)
    base = render_frame(groups, error, biggest)
    # Consumed by Pillow only if something passes it through to save(); harmless
    # otherwise, and it documents the sizes this icon is meant to serve.
    base.info["sizes"] = [(s, s) for s in ICON_SIZES]
    return base


def explain_no_limits(reason: str | None, state: str | None = None) -> list[str]:
    """Why the Claude limit batteries are blank, and what to do about it."""
    if state == "auth_expired" or reason == "auth":
        return [
            "usage API login expired",
            "renewing automatically when Claude CLI is available",
            "last successful value is never shown as live",
        ]
    if state == "rate_limited" or reason == "rate-limit":
        return [
            "usage API rate limited",
            "retry-after is respected automatically",
            "last successful value is marked stale",
        ]
    if reason == "needs-api":
        return [
            "limits need API mode",
            "set CCB_API=1 and restart tokenjuice",
            "sessions and Codex work without it",
        ]
    if reason == "login":
        return ["log in first — run  claude  in a terminal"]
    return ["no usage data yet"]


def state_display_label(state: str | None) -> str:
    """Stable engine states translated for the human-facing tray only."""
    return {
        "fresh": "방금 확인됨",
        "fallback": "대체 정보",
        "stale": "업데이트 필요",
        "auth_expired": "다시 연결 필요",
        "rate_limited": "제공자 제한 중",
        "unavailable": "확인할 수 없음",
    }.get(state, "상태 확인 필요")


def state_recovery_hint(state: str | None) -> str:
    return {
        # Keep this language aligned with Pocket: state is not a colour or a
        # terse error code; it tells the user why a number can or cannot be
        # trusted before suggesting a recovery action.
        "fallback": "제공자 응답 대신 최근 로컬 기록을 읽은 값",
        "stale": "마지막 성공 값 — 현재 값으로 가정하지 않음",
        "auth_expired": "연결 자격이 만료됨 — Claude Code에서 다시 로그인",
        "rate_limited": "다음 확인 가능 시각 전의 요청이 제한됨",
        "unavailable": "확인 가능한 데이터가 없어 숫자를 숨김",
    }.get(state, "")


def bar_text(remain: float, width: int = 12) -> str:
    filled = round(width * max(0.0, min(100.0, remain)) / 100)
    return "█" * filled + "░" * (width - filled)


def fmt_k(n: float) -> str:
    return f"{n / 1000:.0f}k" if n >= 1000 else str(int(n))


def fmt_ago(ms: float) -> str:
    secs = max(0, time.time() - ms / 1000)
    if secs < 60:
        return "just now"
    if secs < 3600:
        return f"{int(secs // 60)}m ago"
    if secs < 86400:
        return f"{int(secs // 3600)}h ago"
    return f"{int(secs // 86400)}d ago"


def build_tooltip(groups: list[dict], err: str | None) -> str:
    if err:
        return f"{APP_NAME} — error"
    parts = []
    for g in groups:
        # Drop all-blank groups from the tooltip. "C --" reads like a fault; the
        # menu is where the reason and the fix belong.
        if all(b is None for b in g["bars"]):
            continue
        vals = "/".join("--" if b is None else f"{round(b)}%" for b in g["bars"])
        parts.append(f"{g['label']} {vals}")
    if not parts:
        return APP_NAME
    # Windows truncates tray tooltips at 127 chars. Realistic setups land near
    # 84, but many accounts could overflow — trim ourselves so it degrades
    # predictably instead of getting cut mid-number by the shell.
    tip = f"{APP_NAME}  " + "  ".join(parts)
    return tip if len(tip) <= 127 else tip[:124] + "..."


# ───────────────────────── app ─────────────────────────


class TrayApp:
    def __init__(self) -> None:
        self.data: dict = {}
        self.groups: list[dict] = []
        self.error: str | None = None
        self.show_topics = os.environ.get("CCB_TOPICS") == "1"
        self.stop = threading.Event()
        self.icon = pystray.Icon(
            APP_NAME,
            render_icon([]),
            APP_NAME,
            menu=Menu(self._menu_items),
        )

    # pystray calls this each time the menu opens, so it is always fresh.
    def _menu_items(self):
        if self.error:
            yield MenuItem("⚠ " + self.error.splitlines()[0][:60], None, enabled=False)
            yield Menu.SEPARATOR
            yield MenuItem("Refresh now", self._refresh_now)
            yield MenuItem("Quit", self._quit)
            return

        for acc in self.data.get("claude") or []:
            name = acc.get("account") or "Claude"
            yield MenuItem(f"Claude Code — {name}", None, enabled=False)
            items = acc.get("items") or []
            state = acc.get("state") or ("stale" if acc.get("stale") else ("fresh" if items else "unavailable"))
            if state != "fresh":
                last = acc.get("lastSuccessAt") or acc.get("observedAt")
                when = f"last success {fmt_ago(last)}" if last else "no successful reading"
                source = acc.get("sourceLabel") or acc.get("source") or "unknown source"
                retry = acc.get("retryAt")
                retry_text = f" · retry {time.strftime('%H:%M', time.localtime(retry / 1000))}" if retry else ""
                yield MenuItem(
                    f"   {state_display_label(state)} · {state_recovery_hint(state)} · {source} · {when}{retry_text}",
                    None, enabled=False,
                )
            if not items:
                # Say the actual cause. "log in" is wrong when you *are* logged in
                # and the limits simply need API mode turned on.
                for line in explain_no_limits(acc.get("reason"), state):
                    yield MenuItem(f"   {line}", None, enabled=False)
            elif state != "fresh":
                yield MenuItem("   위 값은 현재 값이 아닙니다", None, enabled=False)
            for i in items:
                r = round(100 - i.get("used", 0))
                yield MenuItem(f"   {i.get('name')}  {bar_text(r)}  {r}% left", None, enabled=False)
                forecast = i.get("forecast") or {}
                if forecast:
                    verdict = "may run out before reset" if forecast.get("beforeReset") else "reset is expected first"
                    yield MenuItem(
                        f"      local pace estimate · {verdict} · +{forecast.get('usedPerHour', '?')}%/h",
                        None, enabled=False,
                    )

        sessions = self.data.get("sessions") or []
        if sessions:
            yield Menu.SEPARATOR
            yield MenuItem("Session context", None, enabled=False)
            for s in sessions[:8]:
                r = round(100 - s.get("pct", 0))
                warn = "  ⚠ compaction soon" if s.get("pct", 0) >= 80 else ""
                plat = "Codex" if s.get("platform") == "codex" else "Claude"
                yield MenuItem(
                    f"   {plat} · {s.get('name')}  {bar_text(r)}  {r}%{warn}",
                    None, enabled=False,
                )
                meta = "  ·  ".join(
                    x for x in (
                        s.get("model"),
                        f"{fmt_k(s.get('used', 0))}/{fmt_k(s.get('win', 0))}",
                        fmt_ago(s.get("mtime", 0)),
                    ) if x
                )
                yield MenuItem(f"      {meta}", None, enabled=False)
                if s.get("status"):
                    yield MenuItem(f"      status: {s['status'].replace('_', ' ')} · local heuristic", None, enabled=False)
                if self.show_topics and s.get("topic"):
                    yield MenuItem(f"      “{s['topic'][:60]}”", None, enabled=False)

        codex = self.data.get("codex") or []
        codex_status = self.data.get("codexStatus") or {}
        profiles = self.data.get("codexAccounts") or []
        if not profiles and codex:
            profiles = [{**codex_status, "state": codex_status.get("state", "fresh"), "account": "Codex", "items": codex, "selected": True}]
        for profile in profiles:
            if profile.get("id") == "default" and not profile.get("items"):
                continue
            yield Menu.SEPARATOR
            alias = profile.get("account") or "Codex"
            label = "Codex" if alias == "Codex" else f"Codex {alias}"
            yield MenuItem(label, None, enabled=False)
            if len(profiles) > 1:
                if profile.get("selected"):
                    yield MenuItem("   Selected for X header and Pocket export", None, enabled=False)
                elif re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,31}", profile.get("id") or ""):
                    yield MenuItem(f"   Use {alias} — local display only, not login", self._select_codex_account(profile["id"]))
            state = profile.get("state") or "unavailable"
            if state != "fresh":
                last = profile.get("lastSuccessAt") or profile.get("observedAt")
                when = f"last success {fmt_ago(last)}" if last else "no successful reading"
                yield MenuItem(f"   {state_display_label(state)} · {state_recovery_hint(state)} · {when}", None, enabled=False)
            if profile.get("reason") == "invalid_profiles":
                yield MenuItem("   Fix codexAccounts IDs, names and absolute local roots in config.json", None, enabled=False)
            for i in profile.get("items") or []:
                r = round(100 - i.get("used", 0))
                yield MenuItem(f"   {i.get('name')}  {bar_text(r)}  {r}% left", None, enabled=False)
        if codex_status.get("reason") == "invalid_selection":
            yield MenuItem("Codex selection unavailable — choose a configured local profile", None, enabled=False)

        for provider in self.data.get("providers") or []:
            yield Menu.SEPARATOR
            label = provider.get("label") or provider.get("id") or "Local provider"
            state = provider.get("state") or "unavailable"
            yield MenuItem(f"{label} — local quota file", None, enabled=False)
            if state != "fresh":
                yield MenuItem(f"   {state_display_label(state)} · {state_recovery_hint(state)}", None, enabled=False)
            for item in provider.get("items") or []:
                r = round(100 - item.get("used", 0))
                yield MenuItem(f"   {item.get('name')}  {bar_text(r)}  {r}% left", None, enabled=False)
            yield MenuItem("   no token, cookie, command, or network access", None, enabled=False)

        letsur = self.data.get("letsur")
        if letsur:
            yield Menu.SEPARATOR
            r = round(100 - letsur.get("pct", 0))
            yield MenuItem(f"{letsur.get('label', 'Letsur')}  {bar_text(r)}  {r}% left", None, enabled=False)

        # GitHub's API reports Copilot Premium-request *spend*. It must not be
        # rendered as a provider quota or folded into the battery icon.
        copilot = self.data.get("copilot") or {}
        if copilot.get("enabled"):
            yield Menu.SEPARATOR
            yield MenuItem("GitHub Copilot — monthly spend, not quota", None, enabled=False)
            if copilot.get("state") == "fresh":
                amount = float(copilot.get("amountUsd", 0))
                budget = copilot.get("budgetUsd")
                if budget:
                    remain = max(0, round(100 - float(copilot.get("usedPct", 0))))
                    yield MenuItem(f"   ${amount:.2f} / ${float(budget):.2f} voluntary budget · {remain}% left", None, enabled=False)
                else:
                    yield MenuItem(f"   ${amount:.2f} this month · no local budget set", None, enabled=False)
                yield MenuItem("   official GitHub API · explicit environment token only", None, enabled=False)
            else:
                yield MenuItem("   usage unavailable · no prior number shown", None, enabled=False)

        yield Menu.SEPARATOR
        config_file = Path.home() / ".config" / "claude-codex-battery" / "config.json"
        if not config_file.exists():
            # Keep the first-run privacy disclosure visible in the product,
            # not only in README. The starter config leaves every sensitive
            # optional capability disabled.
            yield MenuItem("First setup — local data, safe defaults", None, enabled=False)
            yield MenuItem("   reads ~/.claude and ~/.codex; API, alerts, auto-renew and topics are off", None, enabled=False)
            yield MenuItem("   optional API calls Anthropic directly; TokenJuice stores no token, prompt or code", None, enabled=False)
            yield MenuItem("Create safe starter config", self._init_config)
        yield MenuItem(
            "Show prompt topics",
            self._toggle_topics,
            checked=lambda _: self.show_topics,
        )
        yield MenuItem("Refresh now", self._refresh_now)
        yield MenuItem("Open Claude usage page", self._open_usage)
        yield MenuItem("Quit", self._quit)

    def _toggle_topics(self, _icon=None, _item=None):
        # Off by default: a session topic is your raw prompt text, and the tray
        # is visible in screen shares and screenshots.
        self.show_topics = not self.show_topics
        self._poll_once()

    def _refresh_now(self, _icon=None, _item=None):
        self._poll_once()

    def _init_config(self, _icon=None, _item=None):
        """Create only the engine's opt-out defaults; never overwrite a config."""
        bun = find_bun()
        engine = find_engine()
        if not bun or not engine:
            self.error = "Could not find bun or the TokenJuice engine."
            return
        try:
            subprocess.run(
                [bun, str(engine), "--init-config"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=ENGINE_TIMEOUT,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=True,
            )
            self._poll_once()
        except (OSError, subprocess.SubprocessError) as exc:
            self.error = f"Could not create starter config: {exc}"[:200]

    def _open_usage(self, _icon=None, _item=None):
        webbrowser.open("https://claude.ai/settings/usage")

    def _select_codex_account(self, profile_id):
        """A bound callback: profile order/alias changes do not change its ID."""
        def select(_icon=None, _item=None):
            if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,31}", profile_id or ""):
                self.error = "Invalid local Codex profile ID."
                return
            bun, engine = find_bun(), find_engine()
            if not bun or not engine:
                self.error = "Could not find bun or the TokenJuice engine."
                return
            try:
                subprocess.run(
                    [bun, str(engine), f"--select-codex-account={profile_id}"],
                    capture_output=True, text=True, encoding="utf-8", errors="replace",
                    timeout=ENGINE_TIMEOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), check=True,
                )
                self._poll_once()
            except (OSError, subprocess.SubprocessError):
                self.error = "Codex selection failed — check configured profile IDs; login was not changed."
        return select

    def _quit(self, _icon=None, _item=None):
        self.stop.set()
        self.icon.stop()

    def _poll_once(self):
        try:
            self.data = read_usage(self.show_topics)
            self.groups = build_groups(self.data)
            self.error = None
        except EngineError as exc:
            self.error = str(exc)
        except Exception as exc:  # keep the tray alive on anything unexpected
            self.error = f"{type(exc).__name__}: {exc}"[:200]

        self.icon.icon = render_icon(self.groups, error=self.error is not None)
        self.icon.title = build_tooltip(self.groups, self.error)

    def _loop(self):
        while not self.stop.is_set():
            self._poll_once()
            self.stop.wait(REFRESH_SECONDS)

    def run(self):
        threading.Thread(target=self._loop, daemon=True).start()
        self.icon.run()


def main() -> int:
    if "--once" in sys.argv:
        try:
            data = read_usage("--topics" in sys.argv)
        except EngineError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        groups = build_groups(data)
        for g in groups:
            for b in g["bars"]:
                label = "--" if b is None else f"{round(b):3d}%"
                bar = "" if b is None else f" {bar_text(b)}"
                print(f"{g['label']}{bar} {label}")
        print(f"\ntooltip: {build_tooltip(groups, None)}")
        return 0

    TrayApp().run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
