"""Resolve NYXO_HOME for standalone skill scripts.

Skill scripts may run outside the Nyxo process (e.g. system Python,
nix env, CI) where ``nyxo_constants`` is not importable.  This module
provides the same ``get_nyxo_home()`` and ``display_nyxo_home()``
contracts as ``nyxo_constants`` without requiring it on ``sys.path``.

When ``nyxo_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``nyxo_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``NYXO_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from nyxo_constants import display_nyxo_home as display_nyxo_home
    from nyxo_constants import get_nyxo_home as get_nyxo_home
except (ModuleNotFoundError, ImportError):

    def get_nyxo_home() -> Path:
        """Return the Nyxo home directory (default: ~/.nyxo).

        Mirrors ``nyxo_constants.get_nyxo_home()``."""
        val = os.environ.get("NYXO_HOME", "").strip()
        return Path(val) if val else Path.home() / ".nyxo"

    def display_nyxo_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``nyxo_constants.display_nyxo_home()``."""
        home = get_nyxo_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
