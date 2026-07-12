"""Resolve HERMES_HOME for standalone skill scripts.

Skill scripts may run outside the Hermes process (e.g. system Python,
nix env, CI) where ``flash_constants`` is not importable.  This module
provides the same ``get_flash_home()`` and ``display_flash_home()``
contracts as ``flash_constants`` without requiring it on ``sys.path``.

When ``flash_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``flash_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``HERMES_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from flash_constants import display_flash_home as display_flash_home
    from flash_constants import get_flash_home as get_flash_home
except (ModuleNotFoundError, ImportError):

    def get_flash_home() -> Path:
        """Return the Hermes home directory (default: ~/.flash).

        Mirrors ``flash_constants.get_flash_home()``."""
        val = os.environ.get("HERMES_HOME", "").strip()
        return Path(val) if val else Path.home() / ".flash"

    def display_flash_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``flash_constants.display_flash_home()``."""
        home = get_flash_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
