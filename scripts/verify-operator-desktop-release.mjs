#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const desktopRoot = join(repoRoot, "apps", "operator-desktop");
const tauriConfigPath = join(desktopRoot, "src-tauri", "tauri.conf.json");
const runtimeManifestPath = join(
  desktopRoot,
  "src-tauri",
  "resources",
  "runtime",
  "ouroboros-runtime.manifest.json"
);
const runtimeSidecarPath = join(
  desktopRoot,
  "src-tauri",
  "resources",
  "runtime",
  "ouroboros-runtime"
);
const appPath = join(
  desktopRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Ouroboros Operator.app"
);
const appExecutable = join(appPath, "Contents", "MacOS", "ouroboros-operator-desktop");
const bundledRuntimeManifestPath = join(
  appPath,
  "Contents",
  "Resources",
  "resources",
  "runtime",
  "ouroboros-runtime.manifest.json"
);
const bundledRuntimeSidecarPath = join(
  appPath,
  "Contents",
  "Resources",
  "resources",
  "runtime",
  "ouroboros-runtime"
);

const checks = [];

check("tauri_config_present", existsSync(tauriConfigPath), tauriConfigPath);
check("runtime_manifest_present", existsSync(runtimeManifestPath), runtimeManifestPath);
check("runtime_sidecar_present", existsSync(runtimeSidecarPath), runtimeSidecarPath);
check("runtime_sidecar_executable", isExecutable(runtimeSidecarPath), runtimeSidecarPath);
check("app_bundle_present", existsSync(appPath), appPath);
check("app_executable_present", existsSync(appExecutable), appExecutable);
check("app_executable_nonempty", existsSync(appExecutable) && statSync(appExecutable).size > 0, appExecutable);
check("bundled_runtime_manifest_present", existsSync(bundledRuntimeManifestPath), bundledRuntimeManifestPath);
check("bundled_runtime_sidecar_present", existsSync(bundledRuntimeSidecarPath), bundledRuntimeSidecarPath);
check("bundled_runtime_sidecar_executable", isExecutable(bundledRuntimeSidecarPath), bundledRuntimeSidecarPath);

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
check("bundle_active", tauriConfig.bundle?.active === true, "bundle.active");
check("bundle_targets_app", JSON.stringify(tauriConfig.bundle?.targets) === JSON.stringify(["app"]), "bundle.targets");
check(
  "runtime_manifest_resource",
  tauriConfig.bundle?.resources?.includes("resources/runtime/ouroboros-runtime.manifest.json") === true,
  "bundle.resources"
);
check(
  "runtime_sidecar_resource",
  tauriConfig.bundle?.resources?.includes("resources/runtime/ouroboros-runtime") === true,
  "bundle.resources"
);

const runtimeManifest = JSON.parse(readFileSync(runtimeManifestPath, "utf8"));
check(
  "runtime_sidecar_contract",
  runtimeManifest.runtime_kind === "operator_runtime_sidecar"
    && runtimeManifest.runtime_packaging === "source_backed_launcher"
    && runtimeManifest.packaged_executable_name === "ouroboros-runtime",
  "runtime manifest"
);

const packageJson = JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8"));
check("no_electron_dependency", !packageJson.devDependencies?.electron && !packageJson.dependencies?.electron, "package.json");
check("tauri_cli_dependency", Boolean(packageJson.devDependencies?.["@tauri-apps/cli"]), "package.json");

const codesign = existsSync(appPath)
  ? spawnSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      encoding: "utf8"
    })
  : { status: 1, stderr: "app bundle missing" };
checks.push({
  name: "codesign_verify",
  status: codesign.status === 0 ? "pass" : "pending",
  detail: codesign.status === 0 ? "signed_or_ad_hoc_valid" : String(codesign.stderr || codesign.stdout).trim()
});

const result = {
  checked_at: new Date().toISOString(),
  app_path: appPath,
  release_scope: "local_app_bundle",
  checks,
  pending_release_gates: [
    "developer_id_signing",
    "dmg_installer",
    "apple_notarization"
  ],
  status: checks.every((item) => item.status === "pass" || item.status === "pending") ? "pass" : "fail"
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "pass") {
  process.exitCode = 1;
}

function check(name, condition, detail) {
  checks.push({
    name,
    status: condition ? "pass" : "fail",
    detail
  });
}

function isExecutable(path) {
  if (!existsSync(path)) {
    return false;
  }
  return (statSync(path).mode & 0o111) !== 0;
}
