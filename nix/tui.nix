# nix/tui.nix — Nyxo TUI (Ink/React) compiled with tsc and bundled
{ pkgs, nyxoNpmLib, ... }:
let
  npm = nyxoNpmLib.mkNpmPassthru { folder = "ui-tui"; attr = "tui"; pname = "nyxo-tui"; };

  packageJson = builtins.fromJSON (builtins.readFile (npm.src + "/ui-tui/package.json"));
  version = packageJson.version;
in
pkgs.buildNpmPackage (npm // {
  pname = "nyxo-tui";
  inherit version;

  doCheck = false;

  buildPhase = ''
    # esbuild bundles everything — no need for tsc or vite.
    # Run from the workspace root where node_modules/ lives.
    node ui-tui/scripts/build.mjs
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/nyxo-tui
    # esbuild writes to ui-tui/dist/ from the source root (no cd).
    cp -r ui-tui/dist $out/lib/nyxo-tui/dist

    # package.json kept for "type": "module" resolution on `node dist/entry.js`.
    cp ui-tui/package.json $out/lib/nyxo-tui/

    runHook postInstall
  '';
})
