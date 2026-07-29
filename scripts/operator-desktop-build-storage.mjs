#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;

if (invokedPath === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "verify-release") {
    const repoRoot = requiredOption(args, "--repo-root");
    const result = verifyDesktopReleaseStamp(repoRoot);
    console.log(JSON.stringify(result));
    process.exit(result.status === "release_current" ? 0 : 1);
  }
  if (command === "clean") {
    const repoRoot = requiredOption(args, "--repo-root");
    console.log(JSON.stringify(cleanDesktopBuildStorage(repoRoot)));
    process.exit(0);
  }
  if (command === "exec") {
    const repoRoot = requiredOption(args, "--repo-root");
    const label = requiredOptionValue(args, "--label");
    const separator = args.indexOf("--");
    const executable = separator >= 0 ? args[separator + 1] : undefined;
    if (!executable) {
      console.error("operator_desktop_build_storage_exec_command_required");
      process.exit(2);
    }
    const result = runDesktopBuildCommand({
      repoRoot,
      label,
      command: executable,
      args: args.slice(separator + 2),
      cwd: repoRoot
    });
    process.exit(result.status ?? 1);
  }
  if (command !== "inspect" && command !== "audit" && command !== "preflight") {
    console.error(`operator_desktop_build_storage_unknown_command:${command ?? "missing"}`);
    process.exit(2);
  }
  const repoRoot = requiredOption(args, "--repo-root");
  const inspection = inspectDesktopBuildStorage(repoRoot);
  const result = command === "preflight" || command === "audit"
    ? preflightDesktopBuildStorage(repoRoot, inspection)
    : inspection;
  console.log(JSON.stringify(result));
  if (result.status !== "ready") {
    process.exit(1);
  }
}

export function runDesktopBuildCommand({
  repoRoot,
  label = command,
  command,
  args = [],
  cwd = repoRoot,
  beforeSpawn,
  afterSuccess
}) {
  const preflight = preflightDesktopBuildStorage(repoRoot);
  if (preflight.status !== "ready") {
    console.log(JSON.stringify(preflight));
    return { status: 1 };
  }
  const configuredTarget = process.env.CARGO_TARGET_DIR
    ? path.resolve(cwd, process.env.CARGO_TARGET_DIR)
    : undefined;
  if (configuredTarget && configuredTarget !== preflight.target_dir) {
    console.error(
      `operator_desktop_cargo_target_override_refused:${configuredTarget}:expected=${preflight.target_dir}`
    );
    return { status: 1 };
  }
  let lock;
  try {
    lock = acquireDesktopNativeBuildLock({ preflight, repoRoot, label });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return { status: 1 };
  }
  try {
    assertNoActiveDesktopNativeProcess({ repoRoot, targetDir: preflight.target_dir });
    const commandContext = beforeSpawn ? beforeSpawn(preflight) : undefined;
    const result = spawnSync(command, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: preflight.target_dir
      }
    });
    if (!result.error && result.status === 0) {
      const postflight = preflightDesktopBuildStorage(repoRoot);
      if (postflight.status !== "ready") {
        console.log(JSON.stringify(postflight));
        return { ...result, status: 1, storage_postflight: postflight };
      }
      if (afterSuccess) {
        afterSuccess(preflight, commandContext);
      }
    }
    return result;
  } finally {
    releaseDesktopNativeBuildLock(lock);
  }
}

export function acquireDesktopNativeBuildLock({ preflight, repoRoot, label }) {
  const lockPath = path.join(path.dirname(preflight.target_dir), "native-build.lock");
  const recoveryPath = `${lockPath}.recovery`;
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const owner = {
    pid: process.pid,
    worktree: path.resolve(repoRoot),
    branch: currentBranch(repoRoot),
    command: label,
    started_at: new Date().toISOString(),
    token: randomUUID()
  };
  try {
    writeExclusiveLock(lockPath, owner);
    if (existsSync(recoveryPath)) {
      releaseOwnedLockFile({ path: lockPath, token: owner.token });
      throw new Error(
        `operator_desktop_native_build_lock_recovery_guard_present:${recoveryPath}`
      );
    }
    return { path: lockPath, token: owner.token };
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
    const recoveryOwner = {
      ...owner,
      command: `${label}:recover-stale-lock`
    };
    try {
      acquireRecoveryGuard(recoveryPath, recoveryOwner);
    } catch (recoveryGuardError) {
      if (recoveryGuardError?.code === "EEXIST") {
        throw new Error("operator_desktop_native_build_lock_recovery_race");
      }
      throw recoveryGuardError;
    }
    try {
      const observedLock = lstatSync(lockPath, { bigint: true });
      const activeOwner = readNativeBuildLock(lockPath);
      const liveness = processLiveness(activeOwner.pid);
      if (liveness !== "absent") {
        throw new Error(
          `operator_desktop_native_build_lock_active:${JSON.stringify(activeOwner)}`
        );
      }
      const currentLock = lstatSync(lockPath, { bigint: true });
      if (observedLock.dev !== currentLock.dev || observedLock.ino !== currentLock.ino) {
        throw new Error("operator_desktop_native_build_lock_recovery_race");
      }
      unlinkSync(lockPath);
      try {
        writeExclusiveLock(lockPath, owner);
      } catch (recoveryError) {
        if (recoveryError?.code === "EEXIST") {
          throw new Error("operator_desktop_native_build_lock_recovery_race");
        }
        throw recoveryError;
      }
      return { path: lockPath, token: owner.token };
    } finally {
      releaseOwnedLockFile({ path: recoveryPath, token: recoveryOwner.token });
    }
  }
}

export function releaseDesktopNativeBuildLock(lock) {
  releaseOwnedLockFile(lock);
}

export function preflightDesktopBuildStorage(
  repoRoot,
  inspection = inspectDesktopBuildStorage(repoRoot)
) {
  const minimumFreeBytes = configuredGiB(
    "OUROBOROS_DESKTOP_MIN_FREE_GIB",
    8,
    "minimum"
  );
  const maximumTargetBytes = configuredGiB(
    "OUROBOROS_DESKTOP_MAX_TARGET_GIB",
    6,
    "maximum"
  );
  const filesystem = statfsSync(inspection.control_checkout, { bigint: true });
  const availableBytes = filesystem.bavail * filesystem.bsize;
  const targetBytes = directorySize(inspection.target_dir);
  if (inspection.recovery_guard_present) {
    return {
      ...inspection,
      status: "recovery_guard_present",
      available_bytes: availableBytes.toString(),
      minimum_free_bytes: minimumFreeBytes.toString(),
      target_bytes: targetBytes.toString(),
      maximum_target_bytes: maximumTargetBytes.toString()
    };
  }
  if (inspection.cleanup_quarantine_dirs.length > 0) {
    return {
      ...inspection,
      status: "cleanup_quarantines_present",
      available_bytes: availableBytes.toString(),
      minimum_free_bytes: minimumFreeBytes.toString(),
      target_bytes: targetBytes.toString(),
      maximum_target_bytes: maximumTargetBytes.toString()
    };
  }
  if (inspection.legacy_target_dirs.length > 0) {
    return {
      ...inspection,
      status: "legacy_targets_present",
      available_bytes: availableBytes.toString(),
      minimum_free_bytes: minimumFreeBytes.toString(),
      target_bytes: targetBytes.toString(),
      maximum_target_bytes: maximumTargetBytes.toString()
    };
  }
  if (availableBytes < minimumFreeBytes) {
    return {
      ...inspection,
      status: "insufficient_free_space",
      available_bytes: availableBytes.toString(),
      minimum_free_bytes: minimumFreeBytes.toString(),
      target_bytes: targetBytes.toString(),
      maximum_target_bytes: maximumTargetBytes.toString()
    };
  }
  if (targetBytes > maximumTargetBytes) {
    return {
      ...inspection,
      status: "target_cache_limit_exceeded",
      available_bytes: availableBytes.toString(),
      minimum_free_bytes: minimumFreeBytes.toString(),
      target_bytes: targetBytes.toString(),
      maximum_target_bytes: maximumTargetBytes.toString()
    };
  }
  return {
    ...inspection,
    available_bytes: availableBytes.toString(),
    minimum_free_bytes: minimumFreeBytes.toString(),
    target_bytes: targetBytes.toString(),
    maximum_target_bytes: maximumTargetBytes.toString()
  };
}

export function inspectDesktopBuildStorage(repoRoot) {
  const commonGitDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: repoRoot, encoding: "utf8" }
  ).trim();
  const controlCheckout = realpathSync(path.dirname(commonGitDir));
  const worktreePaths = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realpathSync(path.resolve(line.slice("worktree ".length))));
  const legacyTargetDirs = worktreePaths
    .map((worktreePath) => path.join(
      worktreePath,
      "apps",
      "operator-desktop",
      "src-tauri",
      "target"
    ))
    .filter(pathEntryExists);
  const targetDir = path.join(
    controlCheckout,
    ".cache",
    "operator-desktop",
    "cargo-target"
  );
  const nativeBuildLockPath = path.join(
    controlCheckout,
    ".cache",
    "operator-desktop",
    "native-build.lock"
  );
  const recoveryGuardPath = `${nativeBuildLockPath}.recovery`;
  const recoveryGuard = inspectRecoveryGuard(recoveryGuardPath);
  assertNoSymlinkComponents(
    controlCheckout,
    targetDir,
    "operator_desktop_storage_symlink_refused"
  );
  const cleanupQuarantineDirs = [
    ...cleanupQuarantinesIn({
      root: controlCheckout,
      parent: path.dirname(targetDir),
      namePattern: /^cargo-target\.cleanup-\d+-[0-9a-f-]{36}$/
    }),
    ...worktreePaths.flatMap((worktreePath) => cleanupQuarantinesIn({
      root: worktreePath,
      parent: path.join(
        worktreePath,
        "apps",
        "operator-desktop",
        "src-tauri"
      ),
      namePattern: /^target\.cleanup-\d+-[0-9a-f-]{36}$/
    }))
  ].sort();
  return {
    status: "ready",
    control_checkout: controlCheckout,
    target_dir: targetDir,
    app_bundle_path: path.join(
      targetDir,
      "release",
      "bundle",
      "macos",
      "Ouroboros Operator.app"
    ),
    release_stamp_path: path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "release-stamp.json"
    ),
    native_build_lock_path: nativeBuildLockPath,
    recovery_guard_path: recoveryGuardPath,
    ...recoveryGuard,
    legacy_target_dirs: legacyTargetDirs,
    cleanup_quarantine_dirs: cleanupQuarantineDirs
  };
}

export function captureDesktopReleaseSourceState(repoRoot) {
  return desktopSourceState(repoRoot);
}

export function assertDesktopReleaseSourceState(repoRoot, expectedSource) {
  if (!validSourceState(expectedSource)) {
    throw new Error("operator_desktop_release_source_state_invalid");
  }
  const currentSource = desktopSourceState(repoRoot);
  if (!sameSourceState(currentSource, expectedSource)) {
    throw new Error("operator_desktop_release_source_changed_during_package");
  }
  return currentSource;
}

export function invalidateDesktopReleaseStamp(repoRoot) {
  const inspection = inspectDesktopBuildStorage(repoRoot);
  if (!existsSync(inspection.release_stamp_path)) {
    return { status: "release_stamp_absent" };
  }
  removeValidatedFile({
    root: inspection.control_checkout,
    target: inspection.release_stamp_path,
    relative: path.join(".cache", "operator-desktop", "release-stamp.json")
  });
  return { status: "release_stamp_invalidated" };
}

export function writeDesktopReleaseStamp(repoRoot, appPath, expectedSource) {
  if (!validSourceState(expectedSource)) {
    throw new Error("operator_desktop_release_source_state_required");
  }
  const inspection = inspectDesktopBuildStorage(repoRoot);
  const resolvedAppPath = path.resolve(appPath);
  if (resolvedAppPath !== inspection.app_bundle_path) {
    throw new Error(
      `operator_desktop_release_app_path_mismatch:${resolvedAppPath}:expected=${inspection.app_bundle_path}`
    );
  }
  if (!existsSync(resolvedAppPath)) {
    throw new Error(`operator_desktop_release_app_missing:${resolvedAppPath}`);
  }
  assertNoSymlinkComponents(
    inspection.target_dir,
    resolvedAppPath,
    "operator_desktop_release_app_symlink_refused"
  );
  const source = assertDesktopReleaseSourceState(repoRoot, expectedSource);
  const appBundleDigest = desktopAppBundleDigest(resolvedAppPath);
  const stamp = {
    version: 2,
    worktree: source.worktree,
    head_sha: source.head_sha,
    source_state_digest: source.source_state_digest,
    app_bundle_path: resolvedAppPath,
    app_bundle_digest: appBundleDigest,
    packaged_at: new Date().toISOString()
  };
  mkdirSync(path.dirname(inspection.release_stamp_path), { recursive: true });
  const temporaryPath = `${inspection.release_stamp_path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(stamp, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  renameSync(temporaryPath, inspection.release_stamp_path);
  return { status: "release_stamped", ...stamp };
}

export function verifyDesktopReleaseStamp(repoRoot) {
  const inspection = inspectDesktopBuildStorage(repoRoot);
  if (!existsSync(inspection.release_stamp_path)) {
    return {
      status: "release_stamp_missing",
      app_bundle_path: inspection.app_bundle_path,
      release_stamp_path: inspection.release_stamp_path
    };
  }
  let stamp;
  try {
    stamp = JSON.parse(readFileSync(inspection.release_stamp_path, "utf8"));
  } catch {
    return {
      status: "release_stamp_invalid",
      app_bundle_path: inspection.app_bundle_path,
      release_stamp_path: inspection.release_stamp_path
    };
  }
  if (!validReleaseStamp(stamp)) {
    return {
      status: "release_stamp_invalid",
      app_bundle_path: inspection.app_bundle_path,
      release_stamp_path: inspection.release_stamp_path
    };
  }
  const source = desktopSourceState(repoRoot);
  if (stamp.worktree !== source.worktree) {
    return { ...stamp, status: "release_worktree_mismatch" };
  }
  if (stamp.head_sha !== source.head_sha || stamp.source_state_digest !== source.source_state_digest) {
    return { ...stamp, status: "release_source_state_mismatch" };
  }
  if (stamp.app_bundle_path !== inspection.app_bundle_path || !existsSync(stamp.app_bundle_path)) {
    return { ...stamp, status: "release_app_bundle_mismatch" };
  }
  let appBundleDigest;
  try {
    appBundleDigest = desktopAppBundleDigest(stamp.app_bundle_path);
  } catch {
    return { ...stamp, status: "release_app_bundle_mismatch" };
  }
  if (stamp.app_bundle_digest !== appBundleDigest) {
    return { ...stamp, status: "release_bundle_digest_mismatch" };
  }
  return { ...stamp, status: "release_current" };
}

export function cleanDesktopBuildStorage(repoRoot) {
  const inspection = inspectDesktopBuildStorage(repoRoot);
  let lock;
  try {
    lock = acquireDesktopNativeBuildLock({
      preflight: inspection,
      repoRoot,
      label: "clean"
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
  const removed = [];
  try {
    assertNoActiveDesktopNativeProcess({ repoRoot, targetDir: inspection.target_dir });
    if (existsSync(inspection.target_dir)) {
      removeValidatedDirectory({
        root: inspection.control_checkout,
        target: inspection.target_dir,
        relative: path.join(".cache", "operator-desktop", "cargo-target")
      });
      removed.push(inspection.target_dir);
    }
    const registeredWorktrees = registeredWorktreePaths(repoRoot);
    for (const targetDir of inspection.legacy_target_dirs) {
      const owner = registeredWorktrees.find((worktree) =>
        targetDir === path.join(
          worktree,
          "apps",
          "operator-desktop",
          "src-tauri",
          "target"
        )
      );
      if (!owner) {
        throw new Error(`operator_desktop_cleanup_unregistered_target_refused:${targetDir}`);
      }
      removeValidatedDirectory({
        root: owner,
        target: targetDir,
        relative: path.join("apps", "operator-desktop", "src-tauri", "target")
      });
      removed.push(targetDir);
    }
    for (const quarantineDir of inspection.cleanup_quarantine_dirs) {
      if (path.dirname(quarantineDir) === path.dirname(inspection.target_dir)) {
        removeValidatedQuarantineDirectory({
          root: inspection.control_checkout,
          target: quarantineDir,
          relative: path.join(
            ".cache",
            "operator-desktop",
            path.basename(quarantineDir)
          )
        });
        removed.push(quarantineDir);
        continue;
      }
      const owner = registeredWorktrees.find((worktree) => path.dirname(
        quarantineDir
      ) === path.join(
        worktree,
        "apps",
        "operator-desktop",
        "src-tauri"
      ));
      if (!owner) {
        throw new Error(
          `operator_desktop_cleanup_unregistered_quarantine_refused:${quarantineDir}`
        );
      }
      removeValidatedQuarantineDirectory({
        root: owner,
        target: quarantineDir,
        relative: path.join(
          "apps",
          "operator-desktop",
          "src-tauri",
          path.basename(quarantineDir)
        )
      });
      removed.push(quarantineDir);
    }
    if (existsSync(inspection.release_stamp_path)) {
      removeValidatedFile({
        root: inspection.control_checkout,
        target: inspection.release_stamp_path,
        relative: path.join(".cache", "operator-desktop", "release-stamp.json")
      });
      removed.push(inspection.release_stamp_path);
    }
  } finally {
    releaseDesktopNativeBuildLock(lock);
  }
  return {
    status: "cleaned",
    removed
  };
}

function requiredOption(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) {
    console.error(`operator_desktop_build_storage_option_required:${name}`);
    process.exit(2);
  }
  return path.resolve(value);
}

function requiredOptionValue(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) {
    console.error(`operator_desktop_build_storage_option_required:${name}`);
    process.exit(2);
  }
  return value;
}

function configuredGiB(name, fallback, bound) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`operator_desktop_build_storage_invalid_gib:${name}`);
  }
  const weakensDefault = bound === "minimum" ? value < fallback : value > fallback;
  if (weakensDefault) {
    throw new Error(
      `operator_desktop_capacity_override_weakening_refused:${name}:${value}:default=${fallback}`
    );
  }
  return BigInt(Math.ceil(value * 1024 ** 3));
}

function readNativeBuildLock(lockPath) {
  let owner;
  try {
    owner = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    throw new Error(`operator_desktop_native_build_lock_unreadable:${lockPath}`);
  }
  if (
    !Number.isSafeInteger(owner?.pid)
    || owner.pid <= 0
    || typeof owner.worktree !== "string"
    || typeof owner.branch !== "string"
    || typeof owner.command !== "string"
    || typeof owner.started_at !== "string"
    || typeof owner.token !== "string"
  ) {
    throw new Error(`operator_desktop_native_build_lock_invalid:${lockPath}`);
  }
  return owner;
}

function inspectRecoveryGuard(recoveryPath) {
  let stat;
  try {
    stat = lstatSync(recoveryPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        recovery_guard_present: false,
        recovery_guard_owner_status: "absent"
      };
    }
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return {
      recovery_guard_present: true,
      recovery_guard_owner_status: "unreadable"
    };
  }
  let owner;
  try {
    owner = readNativeBuildLock(recoveryPath);
  } catch {
    return {
      recovery_guard_present: true,
      recovery_guard_owner_status: "unreadable"
    };
  }
  return {
    recovery_guard_present: true,
    recovery_guard_owner_status: "readable",
    recovery_guard_owner: {
      pid: owner.pid,
      worktree: owner.worktree,
      branch: owner.branch,
      command: owner.command,
      started_at: owner.started_at,
      liveness: processLiveness(owner.pid)
    }
  };
}

function writeExclusiveLock(lockPath, owner) {
  const descriptor = openSync(lockPath, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(owner)}\n`, "utf8");
  } finally {
    closeSync(descriptor);
  }
}

function acquireRecoveryGuard(recoveryPath, owner) {
  try {
    writeExclusiveLock(recoveryPath, owner);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `operator_desktop_native_build_lock_recovery_guard_present:${recoveryPath}`
      );
    }
    throw error;
  }
}

function releaseOwnedLockFile(lock) {
  const owner = readNativeBuildLock(lock.path);
  if (owner.token !== lock.token || owner.pid !== process.pid) {
    throw new Error("operator_desktop_native_build_lock_release_mismatch");
  }
  unlinkSync(lock.path);
}

function processLiveness(pid) {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    if (error?.code === "ESRCH") {
      return "absent";
    }
    return "unknown";
  }
}

function currentBranch(repoRoot) {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim();
  return branch || "detached";
}

export function activeDesktopNativeProcesses({
  repoRoot,
  targetDir,
  processTable,
  workingDirectoryForPid = processWorkingDirectory
}) {
  const worktreePaths = registeredWorktreePaths(repoRoot);
  const scopePaths = [path.resolve(targetDir), ...worktreePaths];
  return processTable
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\S+)\s+(.+)$/);
      return match
        ? { pid: Number(match[1]), executable: match[2], command: match[3] }
        : undefined;
    })
    .filter((entry) => entry && entry.pid !== process.pid)
    .filter((entry) => {
      const executableName = path.basename(entry.executable);
      const argv0Name = path.basename(entry.command.split(/\s+/, 1)[0]);
      const names = [executableName, argv0Name];
      const isNativeApp = names.includes("ouroboros-operator-desktop")
        || /[\\/]Contents[\\/]MacOS[\\/]ouroboros-operator-desktop(?:\s|$)/.test(
          entry.command
        );
      const isRustTool = names.some((name) => ["cargo", "rustc"].includes(name));
      const isTauriCli = names.includes("tauri")
        || /(?:^|[\\/])@tauri-apps[\\/]cli[\\/]tauri(?:\.js)?(?:\s|$)/.test(entry.command)
        || /(?:^|[\\/])node_modules[\\/]\.bin[\\/]tauri(?:\s|$)/.test(entry.command);
      if (!isNativeApp && !isRustTool && !isTauriCli) {
        return false;
      }
      let workingDirectory;
      try {
        workingDirectory = workingDirectoryForPid(entry.pid);
      } catch {
        workingDirectory = undefined;
      }
      const commandIsScoped = scopePaths.some((scopePath) =>
        entry.command.includes(scopePath)
      );
      const cwdIsScoped = typeof workingDirectory === "string"
        && scopePaths.some((scopePath) => pathIsWithin(workingDirectory, scopePath));
      if (!commandIsScoped && !cwdIsScoped) {
        return false;
      }
      entry.working_directory = workingDirectory;
      return true;
    });
}

function assertNoActiveDesktopNativeProcess({ repoRoot, targetDir }) {
  let processTable;
  try {
    processTable = execFileSync("ps", ["-axo", "pid=,comm=,command="], {
      encoding: "utf8"
    });
  } catch {
    throw new Error("operator_desktop_native_process_inspection_failed");
  }
  const active = activeDesktopNativeProcesses({ repoRoot, targetDir, processTable });
  if (active.length > 0) {
    throw new Error(`operator_desktop_native_process_active:${JSON.stringify(active)}`);
  }
}

function processWorkingDirectory(pid) {
  const procPath = `/proc/${pid}/cwd`;
  if (existsSync(procPath)) {
    return realpathSync(procPath);
  }
  const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
    encoding: "utf8"
  });
  const cwdLine = output.split(/\r?\n/).find((line) => line.startsWith("n"));
  return cwdLine ? realpathSync(cwdLine.slice(1)) : undefined;
}

function pathIsWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function desktopSourceState(repoRoot) {
  const worktree = realpathSync(repoRoot);
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim();
  const trackedDiff = execFileSync(
    "git",
    ["diff", "--binary", "HEAD", "--", ".", ":(exclude).cache/**"],
    {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024
    }
  );
  const untrackedFiles = execFileSync(
    "git",
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".",
      ":(exclude).cache/**"
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const digest = createHash("sha256");
  digest.update("ouroboros-operator-desktop-source-state-v1\0");
  digest.update(headSha);
  digest.update("\0");
  digest.update(trackedDiff);
  for (const relativePath of untrackedFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    const stat = lstatSync(absolutePath);
    digest.update("\0");
    digest.update(relativePath);
    digest.update("\0");
    if (stat.isSymbolicLink()) {
      digest.update("symlink\0");
      digest.update(readlinkSync(absolutePath));
    } else if (stat.isFile()) {
      digest.update("file\0");
      digest.update(readFileSync(absolutePath));
    } else {
      digest.update(`other:${stat.mode}\0`);
    }
  }
  return {
    worktree,
    head_sha: headSha,
    source_state_digest: digest.digest("hex")
  };
}

function validReleaseStamp(stamp) {
  return stamp?.version === 2
    && typeof stamp.worktree === "string"
    && typeof stamp.head_sha === "string"
    && /^[a-f0-9]{64}$/.test(stamp.source_state_digest)
    && typeof stamp.app_bundle_path === "string"
    && /^sha256:[a-f0-9]{64}$/.test(stamp.app_bundle_digest)
    && typeof stamp.packaged_at === "string";
}

function validSourceState(source) {
  return source && typeof source.worktree === "string" &&
    /^[a-f0-9]{40}$/.test(source.head_sha) &&
    /^[a-f0-9]{64}$/.test(source.source_state_digest);
}

function sameSourceState(left, right) {
  return left.worktree === right.worktree && left.head_sha === right.head_sha &&
    left.source_state_digest === right.source_state_digest;
}

function desktopAppBundleDigest(root) {
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("operator_desktop_release_app_bundle_invalid");
  }
  const digest = createHash("sha256");
  digest.update("ouroboros-operator-desktop-app-bundle-v1\0");
  const visit = (current, relative) => {
    const stat = lstatSync(current);
    const mode = (stat.mode & 0o7777).toString(8);
    if (stat.isDirectory()) {
      digest.update(`directory\0${relative}\0${mode}\0`);
      for (const entry of readdirSync(current).sort()) {
        visit(path.join(current, entry), relative ? path.join(relative, entry) : entry);
      }
      return;
    }
    if (stat.isSymbolicLink()) {
      digest.update(`symlink\0${relative}\0${mode}\0${readlinkSync(current)}\0`);
      return;
    }
    if (!stat.isFile()) {
      throw new Error(`operator_desktop_release_app_bundle_entry_invalid:${relative}`);
    }
    digest.update(`file\0${relative}\0${mode}\0${stat.size}\0`);
    digest.update(readFileSync(current));
  };
  visit(root, "");
  return `sha256:${digest.digest("hex")}`;
}

function registeredWorktreePaths(repoRoot) {
  return execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realpathSync(path.resolve(line.slice("worktree ".length))));
}

function cleanupQuarantinesIn({ root, parent, namePattern }) {
  assertNoSymlinkComponents(
    root,
    parent,
    "operator_desktop_cleanup_symlink_refused"
  );
  if (!pathEntryExists(parent)) return [];
  return readdirSync(parent)
    .filter((name) => namePattern.test(name))
    .map((name) => path.join(parent, name));
}

function pathEntryExists(target) {
  try {
    lstatSync(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function assertNoSymlinkComponents(root, target, errorCode) {
  const realRoot = realpathSync(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(realRoot, resolvedTarget);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." ||
    path.isAbsolute(relative)) {
    throw new Error(`${errorCode}:${resolvedTarget}`);
  }
  let current = realRoot;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${errorCode}:${current}`);
    }
  }
}

function assertValidatedRemovalTarget({ root, target, relative, kind }) {
  const realRoot = realpathSync(root);
  const expected = path.join(realRoot, relative);
  if (path.resolve(target) !== expected) {
    throw new Error(`operator_desktop_cleanup_target_mismatch:${target}:expected=${expected}`);
  }
  assertNoSymlinkComponents(
    realRoot,
    target,
    "operator_desktop_cleanup_symlink_refused"
  );
  const resolved = realpathSync(target);
  const containment = path.relative(realRoot, resolved);
  if (!containment || containment.startsWith(`..${path.sep}`) || containment === ".." ||
    path.isAbsolute(containment)) {
    throw new Error(`operator_desktop_cleanup_containment_refused:${target}`);
  }
  const stat = lstatSync(target);
  if (kind === "directory" ? !stat.isDirectory() : !stat.isFile()) {
    throw new Error(`operator_desktop_cleanup_type_refused:${target}`);
  }
}

function removeValidatedDirectory(input) {
  assertValidatedRemovalTarget({ ...input, kind: "directory" });
  const quarantine = `${input.target}.cleanup-${process.pid}-${randomUUID()}`;
  renameSync(input.target, quarantine);
  rmSync(quarantine, { recursive: true, force: true });
}

function removeValidatedFile(input) {
  assertValidatedRemovalTarget({ ...input, kind: "file" });
  unlinkSync(input.target);
}

function removeValidatedQuarantineDirectory(input) {
  assertValidatedRemovalTarget({ ...input, kind: "directory" });
  rmSync(input.target, { recursive: true, force: true });
}

function directorySize(root) {
  if (!existsSync(root)) {
    return 0n;
  }
  const stat = lstatSync(root, { bigint: true });
  if (!stat.isDirectory()) {
    return stat.size;
  }
  return readdirSync(root).reduce(
    (total, entry) => total + directorySize(path.join(root, entry)),
    0n
  );
}
