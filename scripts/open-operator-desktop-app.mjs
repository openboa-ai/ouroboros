#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const appPath = join(
  repoRoot,
  "apps",
  "operator-desktop",
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Ouroboros Operator.app"
);
const appExecutable = join(appPath, "Contents", "MacOS", "ouroboros-operator-desktop");
const bundleIdentifier = "ai.openboa.ouroboros.operator";
const launchServicesRegister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
const runtimeBaseUrl = process.env.OUROBOROS_DESKTOP_RUNTIME_URL
  ?? `http://${process.env.OUROBOROS_DESKTOP_RUNTIME_HOST ?? "127.0.0.1"}:${process.env.OUROBOROS_DESKTOP_RUNTIME_PORT ?? process.env.PORT ?? "4173"}`;
const requiredRuntimeContractVersion = "paper-loop-continuation-v2";
const requiredLoopCommands = [
  "arena.start",
  "arena.stop",
  "arena.tick",
  "arena.cycle",
  "trading_run.start",
  "trading_run.observe"
];

if (process.platform !== "darwin") {
  console.error("open_operator_desktop_app_requires_macos");
  process.exit(1);
}

if (!existsSync(appPath)) {
  console.error(`operator_desktop_app_bundle_missing:${appPath}`);
  console.error("Run npm run package:operator-desktop first.");
  process.exit(1);
}

if (!existsSync(appExecutable)) {
  console.error(`operator_desktop_app_executable_missing:${appExecutable}`);
  process.exit(1);
}

await stopIncompatibleSourceRuntime(runtimeBaseUrl);

const result = spawnSync("open", ["-n", "-a", appPath], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (!result.error && result.status === 0) {
  console.log(`operator_desktop_app_opened:${appPath}`);
  process.exit(0);
}

const openError = result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? "unknown";
console.error(`operator_desktop_open_failed:${openError}`);
console.error("operator_desktop_open_retry:register_bundle");

const registerResult = spawnSync(launchServicesRegister, ["-f", appPath], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (registerResult.error || registerResult.status !== 0) {
  const registerError = registerResult.error?.message
    ?? registerResult.stderr?.trim()
    ?? registerResult.stdout?.trim()
    ?? "unknown";
  console.error(`operator_desktop_register_failed:${registerError}`);
} else {
  console.error("operator_desktop_register_succeeded");
}

const bundleResult = spawnSync("open", ["-n", "-b", bundleIdentifier], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (!bundleResult.error && bundleResult.status === 0) {
  console.log(`operator_desktop_app_opened:${bundleIdentifier}`);
  process.exit(0);
}

const bundleError = bundleResult.error?.message
  ?? bundleResult.stderr?.trim()
  ?? bundleResult.stdout?.trim()
  ?? "unknown";
console.error(`operator_desktop_bundle_open_failed:${bundleError}`);

console.error("operator_desktop_open_fallback:sanitized_app_copy");
try {
  const launchableAppPath = prepareLaunchableAppCopy();
  const copiedBundleResult = spawnSync("open", ["-n", launchableAppPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (!copiedBundleResult.error && copiedBundleResult.status === 0) {
    console.log(`operator_desktop_app_opened:${launchableAppPath}`);
    process.exit(0);
  }
  const copiedBundleError = copiedBundleResult.error?.message
    ?? copiedBundleResult.stderr?.trim()
    ?? copiedBundleResult.stdout?.trim()
    ?? "unknown";
  console.error(`operator_desktop_sanitized_copy_open_failed:${copiedBundleError}`);
} catch (error) {
  console.error(`operator_desktop_sanitized_copy_failed:${conciseError(error)}`);
}

console.error("operator_desktop_open_fallback:direct_executable");

const child = spawn(appExecutable, [], {
  cwd: repoRoot,
  detached: true,
  stdio: "ignore"
});
child.unref();

await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1500));

if (child.exitCode !== null) {
  console.error(`operator_desktop_direct_launch_exited:${child.exitCode}`);
  process.exit(child.exitCode ?? 1);
}

console.log(`operator_desktop_app_started:${child.pid}`);

function prepareLaunchableAppCopy() {
  const launchRoot = "/tmp";
  const launchableAppPath = join(launchRoot, "Ouroboros Operator.app");
  mkdirSync(launchRoot, { recursive: true });
  rmSync(launchableAppPath, { recursive: true, force: true });
  cpSync(appPath, launchableAppPath, { recursive: true });
  spawnSync("/usr/libexec/PlistBuddy", [
    "-c",
    "Delete :LSRequiresCarbon",
    join(launchableAppPath, "Contents", "Info.plist")
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  const xattrResult = spawnSync("xattr", ["-cr", launchableAppPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (xattrResult.error || xattrResult.status !== 0) {
    throw new Error(xattrResult.error?.message
      ?? xattrResult.stderr?.trim()
      ?? xattrResult.stdout?.trim()
      ?? "xattr_failed");
  }
  const codesignResult = spawnSync("codesign", ["--force", "--deep", "--sign", "-", launchableAppPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (codesignResult.error || codesignResult.status !== 0) {
    throw new Error(codesignResult.error?.message
      ?? codesignResult.stderr?.trim()
      ?? codesignResult.stdout?.trim()
      ?? "codesign_failed");
  }
  spawnSync("xattr", ["-dr", "com.apple.provenance", launchableAppPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return launchableAppPath;
}

function conciseError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function stopIncompatibleSourceRuntime(baseUrl) {
  const compatibility = await runtimeCompatibility(baseUrl);
  if (compatibility.status !== "incompatible") {
    return;
  }

  console.error(
    `operator_desktop_stale_runtime_detected:${baseUrl}:reasons=${compatibility.reasons.join(",")}`
  );
  const port = runtimePort(baseUrl);
  if (!port) {
    console.error(`operator_desktop_stale_runtime_port_unknown:${baseUrl}`);
    return;
  }

  const pids = listeningRuntimePids(port);
  for (const pid of pids) {
    const command = processCommand(pid);
    if (!command.includes("apps/runtime/src/main.ts") || !command.includes(repoRoot)) {
      console.error(`operator_desktop_stale_runtime_skip_foreign_pid:${pid}`);
      continue;
    }
    stopProcess(pid);
    if (await waitForPortToClose(port, 2_500)) {
      console.error(`operator_desktop_stale_runtime_stopped:${pid}`);
      return;
    }
    stopProcess(pid, "SIGKILL");
    if (await waitForPortToClose(port, 1_000)) {
      console.error(`operator_desktop_stale_runtime_stopped:${pid}`);
      return;
    }
    console.error(`operator_desktop_stale_runtime_stop_failed:${pid}`);
  }
}

async function runtimeCompatibility(baseUrl) {
  const health = await fetchRuntimeJson(`${baseUrl}/health`, {});
  if (!health || health.service !== "ouroboros-runtime") {
    return { status: "unknown", reasons: [] };
  }

  const reasons = [];
  if (health.operator_loop_contract_version !== requiredRuntimeContractVersion) {
    reasons.push("operator_loop_contract_version");
  }

  const headers = {};
  if (process.env.OUROBOROS_OPERATOR_API_TOKEN) {
    headers["x-ouroboros-operator-token"] = process.env.OUROBOROS_OPERATOR_API_TOKEN;
  }
  const operator = await fetchRuntimeJson(`${baseUrl}/api/operator`, headers);
  if (!operator) {
    return reasons.length
      ? { status: "incompatible", reasons }
      : { status: "unknown", reasons: [] };
  }
  const commands = new Set(
    operator?.operator?.command_descriptors
      ?.map((descriptor) => descriptor.command_kind)
      ?.filter((commandKind) => typeof commandKind === "string") ?? []
  );
  const missing = requiredLoopCommands.filter((commandKind) => !commands.has(commandKind));
  reasons.push(...missing);
  return reasons.length
    ? { status: "incompatible", reasons }
    : { status: "compatible", reasons: [] };
}

async function fetchRuntimeJson(url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      return undefined;
    }
    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function runtimePort(baseUrl) {
  try {
    return new URL(baseUrl).port || "80";
  } catch {
    return undefined;
  }
}

function listeningRuntimePids(port) {
  const result = spawnSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function processCommand(pid) {
  const result = spawnSync("ps", ["-p", pid, "-o", "command="], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function stopProcess(pid, signal = "SIGTERM") {
  try {
    process.kill(Number(pid), signal);
  } catch {
    // The process may have already exited.
  }
}

async function waitForPortToClose(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (listeningRuntimePids(port).length === 0) {
      return true;
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 100));
  }
  return false;
}
