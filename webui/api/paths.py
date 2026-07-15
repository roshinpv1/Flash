"""Shared path helpers for Flash WebUI.

Keep low-level filesystem defaults here instead of in ``api.config`` so modules
that need the default Flash home can import them without triggering config's
larger startup side effects.
"""

import os
from pathlib import Path

HOME = Path.home()


def _flash_home_has_webui_state(base: Path) -> bool:
    """Return True when *base* holds real WebUI state under its ``webui/`` dir.

    Used only on Windows to detect a pre-v0.51.134 install at the legacy
    ``%USERPROFILE%\\.flash`` location so we don't strand the user's existing
    sessions/pins/settings when the default moved to ``%LOCALAPPDATA%\\flash``
    (#2905).

    We intentionally check ONLY WebUI-owned artifacts (the ``webui/`` subtree),
    NOT agent-owned files like ``config.yaml`` / ``auth.json``.  The agent has
    defaulted to ``%LOCALAPPDATA%\\flash`` on Windows since before #2897, so a
    long-time agent user who never ran WebUI at the legacy location would have a
    stray ``auth.json`` there — keying on that would wrongly divert a *fresh*
    WebUI install to the legacy dir.  Only ``webui/`` state is what actually
    gets stranded by the move, so it is the correct and narrow signal.
    Cheap stat-only checks; never raises.
    """
    try:
        if not base.is_dir():
            return False
        markers = (
            base / "webui" / "sessions",        # WebUI session store
            base / "webui" / "settings.json",   # WebUI UI settings + pins
            base / "webui",                     # WebUI state dir at all
        )
        return any(m.exists() for m in markers)
    except OSError:
        return False


def _platform_default_flash_home() -> Path:
    """Return the platform-aware default Flash home when HERMES_HOME is unset.

    Native Windows Flash Agent installs default to %LOCALAPPDATA%\\flash,
    while POSIX installs use ~/.flash.

    Windows migration safety (#2905): v0.51.134 moved the Windows default from
    ``%USERPROFILE%\\.flash`` to ``%LOCALAPPDATA%\\flash`` to match the agent.
    Upgrading users whose WebUI state still lives at the old location saw an
    empty app (sessions/pins/settings "lost" — actually just at an address the
    new build no longer reads).  To avoid stranding that data, prefer the
    legacy ``%USERPROFILE%\\.flash`` ONLY when it is populated AND the new
    ``%LOCALAPPDATA%\\flash`` location is not yet established.  This is a
    non-destructive, self-healing fallback: no files are moved, and once the
    new location has state (fresh installs, or users who set HERMES_HOME) the
    legacy path is never preferred.  Explicit HERMES_HOME / HERMES_WEBUI_STATE_DIR
    overrides take precedence upstream and are unaffected.
    """
    if os.name == "nt":
        local_app_data = os.getenv("LOCALAPPDATA", "").strip()
        if local_app_data:
            new_home = Path(local_app_data) / "flash"
            legacy_home = HOME / ".flash"
            # Only fall back to the legacy home if it actually holds state and
            # the new location has not been established yet — the exact
            # post-upgrade fingerprint from #2905.
            if (
                legacy_home != new_home
                and not _flash_home_has_webui_state(new_home)
                and _flash_home_has_webui_state(legacy_home)
            ):
                return legacy_home
            return new_home
    return HOME / ".flash"
