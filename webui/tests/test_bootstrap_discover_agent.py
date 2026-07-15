"""Tests for `discover_agent_dir` launcher and interpreter fallbacks.

When the standard candidate paths (`~/.flash/flash-agent`, `~/flash-agent`,
`<webui-parent>/flash-agent`, `HERMES_WEBUI_AGENT_DIR`) don't match, bootstrap
bootstrap checks the `flash` launcher, then asks the configured Python for the
installed `run_agent` module without importing it.
"""

from __future__ import annotations

import textwrap

import pytest

import bootstrap


def _make_agent_install(tmp_path, *, with_run_agent: bool = True):
    """Build a fake flash-agent install with venv/bin/python3 + run_agent.py."""
    install = tmp_path / "agent"
    venv_python = install / "venv" / "bin" / "python3"
    venv_python.parent.mkdir(parents=True)
    venv_python.write_text("", encoding="utf-8")
    if with_run_agent:
        (install / "run_agent.py").write_text("", encoding="utf-8")
    return install, venv_python


def _make_flash_cli(tmp_path, shebang_target: str | None):
    """Write a `flash` console-script with the given shebang interpreter."""
    bin_dir = tmp_path / "user-bin"
    bin_dir.mkdir()
    flash = bin_dir / "flash"
    if shebang_target is None:
        flash.write_text("not a script", encoding="utf-8")
    else:
        flash.write_text(
            textwrap.dedent(
                f"""\
                #!{shebang_target}
                from flash_cli.main import main
                main()
                """
            ),
            encoding="utf-8",
        )
    return flash


def _make_flash_bash_wrapper(tmp_path, exec_target: str):
    """Write a `flash` POSIX shell wrapper that ``exec``s the venv entrypoint.

    This is the current installer shape: a bash wrapper whose shebang is
    ``#!/usr/bin/env bash`` (so the shebang itself points at /usr/bin/env, not
    the agent), and whose ``exec`` line carries the real venv path.
    """
    bin_dir = tmp_path / "user-bin"
    bin_dir.mkdir(exist_ok=True)
    flash = bin_dir / "flash"
    flash.write_text(
        textwrap.dedent(
            f"""\
            #!/usr/bin/env bash
            unset PYTHONPATH
            unset PYTHONHOME
            exec "{exec_target}" "$@"
            """
        ),
        encoding="utf-8",
    )
    return flash


def _isolate_discover_agent_dir(monkeypatch, tmp_path, flash_path):
    """Point `which("flash")` at our fake CLI and clear all standard candidates."""
    monkeypatch.setattr(bootstrap.shutil, "which", lambda name: str(flash_path) if name == "flash" else None)
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "no-such-flash-home"))
    monkeypatch.delenv("HERMES_WEBUI_AGENT_DIR", raising=False)
    monkeypatch.delenv("HERMES_WEBUI_PYTHON", raising=False)
    monkeypatch.setattr(bootstrap, "_agent_dir_from_python", lambda _python: None)
    # Force REPO_ROOT.parent to a dir that won't accidentally contain a
    # `flash-agent` sibling on the dev machine running these tests.
    monkeypatch.setattr(bootstrap, "REPO_ROOT", tmp_path / "isolated-repo-root")
    # Pin Path.home() to a directory with no `.flash/flash-agent` or
    # `flash-agent` so the hard-coded `Path.home() / ".flash" / "flash-agent"`
    # / `Path.home() / "flash-agent"` candidates in `discover_agent_dir()`
    # cannot pick up the dev machine's real install. Stage-313 absorbed
    # this in-stage after the original test file isolated only env vars
    # and REPO_ROOT, missing the Path.home() leakage.
    monkeypatch.setattr(bootstrap.Path, "home", classmethod(lambda cls: tmp_path / "isolated-home"))


def test_discovers_agent_dir_from_flash_shebang(monkeypatch, tmp_path):
    """Happy path: flash shebang → walk up parents → find run_agent.py → return install."""
    install, venv_python = _make_agent_install(tmp_path)
    flash = _make_flash_cli(tmp_path, str(venv_python))
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)
    monkeypatch.chdir(tmp_path)  # make Path.home() candidates won't match install

    assert bootstrap.discover_agent_dir() == install.resolve()


def test_returns_none_when_flash_not_on_path(monkeypatch, tmp_path):
    _make_agent_install(tmp_path)  # install exists, but no `flash` CLI to point at it
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash_path=tmp_path / "missing")
    monkeypatch.setattr(bootstrap.shutil, "which", lambda name: None)

    assert bootstrap.discover_agent_dir() is None


def test_returns_none_when_flash_has_no_shebang(monkeypatch, tmp_path):
    """A `flash` file without a #! line gives us nothing to introspect."""
    _make_agent_install(tmp_path)
    flash = _make_flash_cli(tmp_path, shebang_target=None)
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)

    assert bootstrap.discover_agent_dir() is None


def test_returns_none_when_shebang_interpreter_does_not_walk_to_run_agent(monkeypatch, tmp_path):
    """Shebang points at a system Python — no parent of /usr/bin/python3 has run_agent.py."""
    flash = _make_flash_cli(tmp_path, "/usr/bin/python3")
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)

    assert bootstrap.discover_agent_dir() is None


def test_explicit_candidate_takes_precedence_over_shebang(monkeypatch, tmp_path):
    """HERMES_WEBUI_AGENT_DIR and the standard layout still win when present."""
    explicit_install = tmp_path / "explicit"
    (explicit_install).mkdir()
    (explicit_install / "run_agent.py").write_text("", encoding="utf-8")

    # Also set up a flash-shebang install at a different location — this should NOT win.
    other_install, venv_python = _make_agent_install(tmp_path)
    flash = _make_flash_cli(tmp_path, str(venv_python))
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)
    monkeypatch.setenv("HERMES_WEBUI_AGENT_DIR", str(explicit_install))
    monkeypatch.setattr(
        bootstrap,
        "_agent_dir_from_python",
        lambda _python: (_ for _ in ()).throw(AssertionError("Python probe must not run")),
    )

    assert bootstrap.discover_agent_dir() == explicit_install.resolve()


def test_discovers_agent_dir_from_flash_bash_wrapper(monkeypatch, tmp_path):
    """Current installer shape: a `#!/usr/bin/env bash` wrapper that execs the
    venv entrypoint. The shebang is useless (/usr/bin/env), so discovery must
    follow the quoted exec target up to run_agent.py. Regression for the
    root-on-Linux report where bootstrap built a deps-only local venv and chat
    failed with 'cannot import both WebUI dependencies and Flash Agent'."""
    install, _venv_python = _make_agent_install(tmp_path)
    venv_flash = install / "venv" / "bin" / "flash"
    venv_flash.write_text("", encoding="utf-8")
    flash = _make_flash_bash_wrapper(tmp_path, str(venv_flash))
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)
    monkeypatch.chdir(tmp_path)

    assert bootstrap.discover_agent_dir() == install.resolve()


def test_root_fhs_layout_is_in_candidate_list(monkeypatch, tmp_path):
    """Root-on-Linux installs put agent code at /usr/local/lib/flash-agent and
    link the CLI into /usr/local/bin. HERMES_HOME stays at /root/.flash, so the
    `home / 'flash-agent'` candidate never covers it. Verify the explicit FHS
    path is probed by discover_agent_dir() — we can't create a real /usr/local
    dir in tests, so capture the candidates the function actually checks by
    stubbing Path.exists to record probed paths."""
    monkeypatch.setattr(bootstrap.shutil, "which", lambda name: None)
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "root-dot-flash"))
    monkeypatch.delenv("HERMES_WEBUI_AGENT_DIR", raising=False)
    monkeypatch.setattr(bootstrap, "REPO_ROOT", tmp_path / "isolated-repo-root")
    monkeypatch.setattr(bootstrap.Path, "home", classmethod(lambda cls: tmp_path / "isolated-home"))

    probed: list[str] = []
    real_exists = bootstrap.Path.exists

    def recording_exists(self):
        probed.append(str(self))
        return real_exists(self)

    monkeypatch.setattr(bootstrap.Path, "exists", recording_exists)

    bootstrap.discover_agent_dir()

    assert any(p == "/usr/local/lib/flash-agent" for p in probed), (
        f"/usr/local/lib/flash-agent was not probed; checked: {probed}"
    )


def test_bash_wrapper_without_agent_target_returns_none(monkeypatch, tmp_path):
    """A bash wrapper whose exec target is a system path (no run_agent.py in any
    parent) must not false-positive."""
    flash = _make_flash_bash_wrapper(tmp_path, "/usr/bin/python3")
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)

    assert bootstrap.discover_agent_dir() is None


def test_discovers_installed_agent_dir_from_configured_python(monkeypatch, tmp_path):
    agent_dir = tmp_path / "site-packages"
    python_exe = str(tmp_path / "venv" / "python")
    run_agent = agent_dir / "run_agent.py"
    agent_dir.mkdir()
    run_agent.write_text("raise AssertionError('must not import run_agent')", encoding="utf-8")
    calls = []

    def fake_run(argv, **kwargs):
        calls.append((argv, kwargs))
        return bootstrap.subprocess.CompletedProcess(argv, 0, stdout=f"{run_agent}\n", stderr="")

    monkeypatch.setattr(bootstrap.subprocess, "run", fake_run)

    assert bootstrap._agent_dir_from_python(python_exe) == agent_dir.resolve()
    argv, kwargs = calls[0]
    assert argv[:2] == [python_exe, "-c"]
    assert 'find_spec("run_agent")' in argv[2]
    assert "import run_agent" not in argv[2]
    assert kwargs == {"capture_output": True, "text": True}


def test_python_probe_returns_none_when_run_agent_spec_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 0, stdout="\n", stderr=""),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


def test_python_probe_rejects_malformed_relative_origin(monkeypatch, tmp_path):
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 0, stdout="run_agent.py\n", stderr=""),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


def test_python_probe_rejects_non_file_origin(monkeypatch, tmp_path):
    missing = tmp_path / "site-packages" / "run_agent.py"
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 0, stdout=f"{missing}\n", stderr=""),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


@pytest.mark.parametrize("error", [FileNotFoundError(), PermissionError()])
def test_python_probe_returns_none_when_interpreter_cannot_start(monkeypatch, tmp_path, error):
    monkeypatch.setattr(bootstrap.subprocess, "run", lambda *args, **kwargs: (_ for _ in ()).throw(error))

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


def test_python_probe_returns_none_on_nonzero_exit(monkeypatch, tmp_path):
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 1, stdout="", stderr="probe failed"),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


def test_python_probe_accepts_valid_origin_with_benign_stderr(monkeypatch, tmp_path):
    run_agent = tmp_path / "site-packages" / "run_agent.py"
    run_agent.parent.mkdir()
    run_agent.write_text("", encoding="utf-8")
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 0, stdout=f"{run_agent}\n", stderr="warning\n"),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) == run_agent.parent.resolve()


def test_python_probe_rejects_existing_file_with_wrong_name(monkeypatch, tmp_path):
    origin = tmp_path / "site-packages" / "agent_entry.py"
    origin.parent.mkdir()
    origin.write_text("", encoding="utf-8")
    monkeypatch.setattr(
        bootstrap.subprocess,
        "run",
        lambda argv, **kwargs: bootstrap.subprocess.CompletedProcess(argv, 0, stdout=f"{origin}\n", stderr=""),
    )

    assert bootstrap._agent_dir_from_python(str(tmp_path / "python")) is None


def test_flash_cli_takes_precedence_over_configured_python(monkeypatch, tmp_path):
    install, venv_python = _make_agent_install(tmp_path)
    flash = _make_flash_cli(tmp_path, str(venv_python))
    _isolate_discover_agent_dir(monkeypatch, tmp_path, flash)
    monkeypatch.setattr(
        bootstrap,
        "_agent_dir_from_python",
        lambda _python: (_ for _ in ()).throw(AssertionError("Python probe must not run")),
    )

    assert bootstrap.discover_agent_dir() == install.resolve()
