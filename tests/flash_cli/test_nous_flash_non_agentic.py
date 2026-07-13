"""Tests for the Nous-Flash-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"flash"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``flash-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "flash" tag namespace.

``is_flash_flash_non_agentic`` should only match the actual Flash Org
Flash-3 / Flash-4 chat family.
"""

from __future__ import annotations

import pytest

from flash_cli.model_switch import (
    _HERMES_MODEL_WARNING,
    _check_flash_model_warning,
    is_flash_flash_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "FlashOrg/Flash-3-Llama-3.1-70B",
        "FlashOrg/Flash-3-Llama-3.1-405B",
        "flash-3",
        "Flash-3",
        "flash-4",
        "flash-4-405b",
        "flash_4_70b",
        "openrouter/flash3:70b",
        "openrouter/flashorg/flash-4-405b",
        "FlashOrg/Flash3",
        "flash-3.1",
    ],
)
def test_matches_real_flash_flash_chat_models(model_name: str) -> None:
    assert is_flash_flash_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Flash 3/4"
    )
    assert _check_flash_model_warning(model_name) == _HERMES_MODEL_WARNING


@pytest.mark.parametrize(
    "model_name",
    [
        # Kyle's local Modelfile — qwen3:14b under a custom tag
        "flash-brain:qwen3-14b-ctx16k",
        "flash-brain:qwen3-14b-ctx32k",
        "flash-honcho:qwen3-8b-ctx8k",
        # Plain unrelated models
        "qwen3:14b",
        "qwen3-coder:30b",
        "qwen2.5:14b",
        "claude-opus-4-6",
        "anthropic/claude-sonnet-4.5",
        "gpt-5",
        "openai/gpt-4o",
        "google/gemini-2.5-flash",
        "deepseek-chat",
        # Non-chat Flash models we don't warn about
        "flash-llm-2",
        "flash2-pro",
        "flash-flash-2-mistral",
        # Edge cases
        "",
        "flash",  # bare "flash" isn't the 3/4 family
        "flash-brain",
        "brain-flash-3-impostor",  # "3" not preceded by /: boundary
    ],
)
def test_does_not_match_unrelated_models(model_name: str) -> None:
    assert not is_flash_flash_non_agentic(model_name), (
        f"expected {model_name!r} NOT to be flagged as Nous Flash 3/4"
    )
    assert _check_flash_model_warning(model_name) == ""


def test_none_like_inputs_are_safe() -> None:
    assert is_flash_flash_non_agentic("") is False
    # Defensive: the helper shouldn't crash on None-ish falsy input either.
    assert _check_flash_model_warning("") == ""
