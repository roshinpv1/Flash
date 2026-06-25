from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    assert "%LOCALAPPDATA%\\nyxo\\nyxo-agent\\venv\\Scripts" in doc
    assert "Get-Command nyxo        # should print C:\\Users\\<you>\\AppData\\Local\\nyxo\\nyxo-agent\\venv\\Scripts\\nyxo.exe" in doc
    assert '$nyxoBin = "$InstallDir\\venv\\Scripts"' in install
