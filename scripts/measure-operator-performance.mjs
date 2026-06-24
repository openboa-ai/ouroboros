#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const runtimeUrl = process.env.OUROBOROS_RUNTIME_URL ?? "http://127.0.0.1:4173";
const outDir = process.env.OUROBOROS_PERF_OUT_DIR ?? "/tmp/ouroboros-performance";
const desktopAppEnabled = !process.argv.includes("--skip-app");
const checkMode = process.argv.includes("--check");

const thresholds = {
  runtimeReadyMs: Number(process.env.OUROBOROS_PERF_MAX_RUNTIME_READY_MS ?? 20_000),
  operatorPayloadBytes: Number(process.env.OUROBOROS_PERF_MAX_OPERATOR_PAYLOAD_BYTES ?? 4_000_000),
  operatorFetchMs: Number(process.env.OUROBOROS_PERF_MAX_OPERATOR_FETCH_MS ?? 2_500),
  desktopAppScreenshotMs: Number(process.env.OUROBOROS_PERF_MAX_DESKTOP_APP_SCREENSHOT_MS ?? 15_000),
  operatorWebAssetBytes: Number(process.env.OUROBOROS_PERF_MAX_WEB_ASSET_BYTES ?? 3_000_000)
};

mkdirSync(outDir, { recursive: true });

const startedAt = performance.now();
let runtimeChild;
let desktopAppChild;

class DesktopAppRenderFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "DesktopAppRenderFailure";
  }
}

try {
  const runtimeProbe = await probeOperator();
  const runtimeStart = runtimeProbe.ok
    ? { mode: "reused", ready_ms: 0 }
    : await startRuntime();
  const operatorFetch = await measureOperatorFetch();
  const webAssets = measureWebAssets();
  const desktopBundle = measureDesktopBundle();
  const desktopAppRender = desktopAppEnabled
    ? await measureDesktopAppRender(desktopBundle).catch((error) => ({
        status: error instanceof DesktopAppRenderFailure ? "failed" : "skipped",
        reason: error instanceof Error ? error.message : String(error)
      }))
    : { status: "skipped", reason: "disabled_by_flag" };

  const result = {
    measured_at: new Date().toISOString(),
    runtime_url: runtimeUrl,
    total_ms: roundMs(performance.now() - startedAt),
    runtime_start: runtimeStart,
    operator_fetch: operatorFetch,
    web_assets: webAssets,
    desktop_bundle: desktopBundle,
    desktop_app_render: desktopAppRender,
    thresholds,
    status: performanceStatus({ runtimeStart, operatorFetch, webAssets, desktopAppRender })
  };

  console.log(JSON.stringify(result, null, 2));
  if (checkMode && result.status !== "pass") {
    process.exitCode = 1;
  }
} finally {
  if (desktopAppChild) {
    desktopAppChild.kill();
  }
  if (runtimeChild) {
    runtimeChild.kill();
  }
}

async function startRuntime() {
  const start = performance.now();
  const tsx = runtimeTsxPath();
  runtimeChild = spawn(tsx, ["apps/runtime/src/main.ts"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "4173",
      OUROBOROS_RUNTIME_URL: runtimeUrl
    },
    stdio: ["ignore", "ignore", "ignore"]
  });

  await waitFor(async () => (await probeOperator()).ok, thresholds.runtimeReadyMs);
  return {
    mode: "spawned",
    pid: runtimeChild.pid,
    ready_ms: roundMs(performance.now() - start),
    rss_kb: await processRssKb(runtimeChild.pid)
  };
}

function runtimeTsxPath() {
  const executable = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const localTsx = join(repoRoot, "node_modules", ".bin", executable);
  if (!existsSync(localTsx)) {
    throw new Error(`runtime_tsx_not_found:${localTsx}`);
  }
  return localTsx;
}

async function measureOperatorFetch() {
  const start = performance.now();
  const response = await fetch(`${runtimeUrl}/api/operator`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`operator_fetch_failed:${response.status}`);
  }
  const body = JSON.parse(text);
  const arena = body.operator?.candidate_arena;
  const latestTick = arena?.latest_ticks?.[0];
  return {
    status: response.status,
    latency_ms: roundMs(performance.now() - start),
    payload_bytes: Buffer.byteLength(text),
    runner_status: arena?.runner_status,
    tick_count: arena?.tick_count,
    latest_tick: latestTick?.tick_id,
    latest_source: latestTick?.source_candidate?.source_kind
  };
}

function measureWebAssets() {
  const dist = join(repoRoot, "apps", "operator-web", "dist", "assets");
  if (!existsSync(dist)) {
    return { status: "missing", asset_count: 0, total_bytes: 0 };
  }
  const assets = readdirSync(dist)
    .map((name) => {
      const path = join(dist, name);
      return { name, bytes: statSync(path).size };
    })
    .sort((left, right) => right.bytes - left.bytes);
  return {
    status: "present",
    asset_count: assets.length,
    total_bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    largest_assets: assets.slice(0, 5)
  };
}

function measureDesktopBundle() {
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
  const executable = join(appPath, "Contents", "MacOS", "ouroboros-operator-desktop");
  return {
    status: existsSync(executable) ? "present" : "missing",
    app_path: appPath,
    executable_path: executable,
    executable_bytes: existsSync(executable) ? statSync(executable).size : 0
  };
}

async function measureDesktopAppRender(desktopBundle) {
  if (process.platform !== "darwin") {
    return { status: "skipped", reason: "desktop_app_capture_requires_macos" };
  }
  if (desktopBundle.status !== "present") {
    return { status: "skipped", reason: "desktop_app_bundle_missing" };
  }

  const start = performance.now();
  desktopAppChild = spawn(desktopBundle.executable_path, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OUROBOROS_DESKTOP_RUNTIME_HOST: "127.0.0.1",
      OUROBOROS_DESKTOP_RUNTIME_PORT: "4173"
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  await waitFor(async () => (await probeOperator()).ok, thresholds.runtimeReadyMs);
  const earlyExit = await waitForChildExit(desktopAppChild, 1500);
  if (earlyExit.exited) {
    throw new DesktopAppRenderFailure(
      `desktop_app_exited_before_capture:${formatChildExit(earlyExit)}`
    );
  }

  const screenshotPath = join(outDir, "operator-desktop-app.png");
  await runCommand("screencapture", ["-x", screenshotPath], { cwd: repoRoot });
  assertDesktopAppStillRunning(desktopAppChild, "after_capture");

  return {
    status: "captured",
    screenshot_ms: roundMs(performance.now() - start),
    launch_pid: desktopAppChild.pid,
    screenshot_path: screenshotPath,
    screenshot_bytes: statSync(screenshotPath).size
  };
}

function performanceStatus({ runtimeStart, operatorFetch, webAssets, desktopAppRender }) {
  const desktopAppOk = desktopAppRender.status !== "failed"
    && (desktopAppRender.status !== "captured"
      || desktopAppRender.screenshot_ms <= thresholds.desktopAppScreenshotMs);
  const runtimeOk = runtimeStart.ready_ms <= thresholds.runtimeReadyMs;
  const fetchOk = operatorFetch.latency_ms <= thresholds.operatorFetchMs
    && operatorFetch.payload_bytes <= thresholds.operatorPayloadBytes;
  const webOk = webAssets.status !== "present"
    || webAssets.total_bytes <= thresholds.operatorWebAssetBytes;
  return runtimeOk && fetchOk && webOk && desktopAppOk ? "pass" : "fail";
}

function assertDesktopAppStillRunning(child, stage) {
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new DesktopAppRenderFailure(
      `desktop_app_exited_${stage}:code=${child.exitCode ?? "null"}:signal=${child.signalCode ?? "null"}`
    );
  }
}

function waitForChildExit(child, timeoutMs) {
  return new Promise((resolveExit) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveExit({
        exited: true,
        code: child.exitCode,
        signal: child.signalCode
      });
      return;
    }

    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit({ exited: false });
    }, timeoutMs);

    function onExit(code, signal) {
      clearTimeout(timeout);
      resolveExit({ exited: true, code, signal });
    }

    child.once("exit", onExit);
  });
}

function formatChildExit(exit) {
  return `code=${exit.code ?? "null"}:signal=${exit.signal ?? "null"}`;
}

async function probeOperator() {
  try {
    const response = await fetch(`${runtimeUrl}/api/operator`);
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}

async function waitFor(check, timeoutMs) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 250));
  }
  throw new Error(`timeout_after_${timeoutMs}ms`);
}

async function processRssKb(pid) {
  if (!pid) {
    return null;
  }
  try {
    const { stdout } = await runCommand("ps", ["-o", "rss=", "-p", String(pid)], { cwd: repoRoot });
    const rss = Number(stdout.trim());
    return Number.isFinite(rss) ? rss : null;
  } catch {
    return null;
  }
}

function runCommand(command, args, options) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectCommand);
    child.on("close", (code) => {
      if (code === 0) {
        resolveCommand({ stdout, stderr });
        return;
      }
      rejectCommand(new Error(`${command} exited ${code}: ${stderr || stdout}`));
    });
  });
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}
