#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const platform = process.env.OUROBOROS_OPERATOR_DESKTOP_PLATFORM ?? process.platform;
const linuxNativePackages = ["glib-2.0", "gtk+-3.0", "webkit2gtk-4.1"];

if (platform === "linux" && !linuxNativeDepsAvailable()) {
  console.log([
    "Skipping @ouroboros/operator-desktop native cargo check on Linux",
    "because GTK/WebKit pkg-config dependencies are unavailable.",
    "macOS package verification still runs through npm run package:operator-desktop."
  ].join(" "));
  process.exit(0);
}

run("cargo", ["check", "--manifest-path", "src-tauri/Cargo.toml"]);

function linuxNativeDepsAvailable() {
  return linuxNativePackages.every((packageName) => {
    const result = spawnSync(pkgConfigCommand(), ["--exists", packageName], {
      stdio: "ignore"
    });
    return result.status === 0;
  });
}

function pkgConfigCommand() {
  return process.env.OUROBOROS_OPERATOR_DESKTOP_PKG_CONFIG ?? "pkg-config";
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
