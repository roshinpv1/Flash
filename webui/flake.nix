{
  description = "Flash Web UI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      linuxSystems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      flashModule = import ./nix/nixosModules.nix { inherit self; };
      packageVersion = self.shortRev or (self.dirtyShortRev or "unstable");
      perSystem = forAllSystems (system: let
        pkgs = import nixpkgs { inherit system; };
        package = import ./nix/packages.nix {
          inherit pkgs;
          version = packageVersion;
        };
        moduleChecks = if builtins.elem system linuxSystems then
          let
            moduleConfig = nixpkgs.lib.nixosSystem {
              inherit system;
              modules = [
                flashModule
                {
                  services.flash-webui = {
                    enable = true;
                    package = package;
                    host = "127.0.0.1";
                    port = 8787;
                    stateDir = "/var/lib/flash-webui";
                    agent.dir = "/var/lib/flash-agent";
                  };
                }
              ];
            };
            packageOnlyAgentVenv = pkgs.runCommand "flash-agent-package-only-venv-${system}" { } ''
              mkdir -p "$out/bin"
              touch "$out/bin/python3"
            '';
            packageOnlyAgentPackage = pkgs.runCommand "flash-agent-package-only-${system}" {
              passthru.flashVenv = packageOnlyAgentVenv;
            } ''
              touch "$out"
            '';
            packageOnlyModuleConfig = nixpkgs.lib.nixosSystem {
              inherit system;
              modules = [
                flashModule
                {
                  services.flash-webui = {
                    enable = true;
                    package = package;
                    agent.package = packageOnlyAgentPackage;
                  };
                }
              ];
            };
            moduleServiceEnvironment = nixpkgs.lib.concatStringsSep "\n" moduleConfig.config.systemd.services.flash-webui.serviceConfig.Environment;
            envProbe = pkgs.writeText "flash-webui-nixos-env-${system}.txt" moduleServiceEnvironment;
            packageOnlyServiceEnvironment = nixpkgs.lib.concatStringsSep "\n" packageOnlyModuleConfig.config.systemd.services.flash-webui.serviceConfig.Environment;
            packageOnlyEnvProbe = pkgs.writeText "flash-webui-nixos-package-only-env-${system}.txt" packageOnlyServiceEnvironment;
          in
          {
            module-env-mapping = pkgs.runCommand "flash-webui-nixos-module-${system}" {
              nativeBuildInputs = [ pkgs.coreutils ];
            } ''
              grep -q 'HERMES_WEBUI_HOST=127.0.0.1' ${envProbe}
              grep -q 'HERMES_WEBUI_PORT=8787' ${envProbe}
              grep -q 'HERMES_WEBUI_STATE_DIR=/var/lib/flash-webui' ${envProbe}
              grep -q 'HERMES_WEBUI_AGENT_DIR=/var/lib/flash-agent' ${envProbe}
              grep -q 'HERMES_WEBUI_PYTHON=${packageOnlyAgentVenv}/bin/python3' ${packageOnlyEnvProbe}
              ! grep -q 'HERMES_WEBUI_AGENT_DIR=' ${packageOnlyEnvProbe}
              touch "$out"
            '';
            runtime-layout = pkgs.runCommand "flash-webui-runtime-layout-${system}" {
              nativeBuildInputs = [ pkgs.coreutils ];
            } ''
              test -f ${package}/flash-webui/bootstrap.py
              test -f ${package}/flash-webui/server.py
              test -d ${package}/flash-webui/api
              test -d ${package}/flash-webui/static
              cd ${package}/flash-webui
              ${package}/bin/flash-webui --help >/dev/null
              ${package}/bin/flash-webui --help 2>&1 | grep -q -- '--foreground'
              PYTHONPATH=${package}/flash-webui ${pkgs.python3.withPackages (ps: with ps; [ pyyaml cryptography ])}/bin/python3 -c 'import api.config, server; print("runtime imports ok")'
              touch "$out"
            '';
          }
        else
          { };
      in
      {
        packages = {
          flash-webui = package;
          default = package;
        };

        apps = {
          default = {
            type = "app";
            program = "${package}/bin/flash-webui";
          };
        };

        checks = moduleChecks // {
          package = package;
        };
      });
    in
    {
      packages = forAllSystems (system: perSystem.${system}.packages);
      apps = forAllSystems (system: perSystem.${system}.apps);
      checks = nixpkgs.lib.genAttrs linuxSystems (system: perSystem.${system}.checks);

      nixosModules = {
        default = flashModule;
        flash-webui = flashModule;
      };
    };
}
