# nix/devShell.nix — Dev shell that delegates setup to each package
#
# Each npm workspace package exposes passthru.packageJsonPath (e.g.
# "ui-tui/package.json").  This file collects them all and passes the
# list to mkNpmDevShellHook, which stamps all package.jsons at once,
# then runs a single `npm i --package-lock-only` if any changed and
# `npm ci` if the lockfile changed.
{ ... }:
{
  perSystem =
    { pkgs, self', ... }:
    let
      packages = builtins.attrValues self'.packages;
      flashNpmLib = self'.packages.default.passthru.flashNpmLib;

      # Collect all packageJsonPath values from npm workspace packages.
      npmPackageJsonPaths = builtins.filter (p: p != null) (
        map (p: p.passthru.packageJsonPath or null) packages
      );

      # Non-npm packages may have their own devShellHook (e.g. flash-agent
      # stamps pyproject.toml + uv.lock for Python venv setup).
      nonNpmHooks = map (p: p.passthru.devShellHook or "") packages;
      combinedNonNpm = pkgs.lib.concatStringsSep "\n" (builtins.filter (h: h != "") nonNpmHooks);
    in
    {
      devShells.default = pkgs.mkShell {
        packages =
          with pkgs;
          [
            (pkgs.runCommand "flash" { } ''
              mkdir -p $out/bin
              install -Dm755 ${../flash} $out/bin/flash
            '')
            (pkgs.runCommand "dev-sandbox" { } ''
              mkdir -p $out/bin
              install -Dm755 ${../scripts/dev-sandbox.sh} $out/bin/sandbox
            '')
            uv
          ]
          ++ self'.packages.default.passthru.devDeps;
        shellHook = ''
          ${combinedNonNpm}
          ${flashNpmLib.mkNpmDevShellHook npmPackageJsonPaths}

          # for the devshell to pick up the src
          export HERMES_PYTHON_SRC_ROOT=$(git rev-parse --show-toplevel)
          echo "Flash Agent dev shell in $HERMES_PYTHON_SRC_ROOT"
          echo "Ready. Run 'flash' or 'sandbox flash' to start."
        '';
      };
    };
}
