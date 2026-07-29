import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  activeDesktopNativeProcesses,
  assertDesktopReleaseSourceState,
  captureDesktopReleaseSourceState,
  invalidateDesktopReleaseStamp,
  runDesktopBuildCommand,
  writeDesktopReleaseStamp
} from "../../scripts/operator-desktop-build-storage.mjs";

const createdRoots: string[] = [];
const storageScript = path.join(
  process.cwd(),
  "scripts",
  "operator-desktop-build-storage.mjs"
);

describe("Operator Desktop build storage", () => {
  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves every registered worktree to one control-checkout Cargo target", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();

    const controlResult = inspectStorage(controlCheckout);
    const siblingResult = inspectStorage(siblingWorktree);
    const expectedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );

    expect(controlResult.status, controlResult.stderr).toBe(0);
    expect(siblingResult.status, siblingResult.stderr).toBe(0);
    expect(JSON.parse(controlResult.stdout)).toMatchObject({
      status: "ready",
      control_checkout: controlCheckout,
      target_dir: expectedTarget,
      legacy_target_dirs: []
    });
    expect(JSON.parse(siblingResult.stdout)).toMatchObject({
      status: "ready",
      control_checkout: controlCheckout,
      target_dir: expectedTarget,
      legacy_target_dirs: []
    });
  });

  it("fails the audit for a legacy target in any registered worktree", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const legacyTarget = path.join(
      siblingWorktree,
      "apps",
      "operator-desktop",
      "src-tauri",
      "target"
    );
    mkdirSync(legacyTarget, { recursive: true });
    writeFileSync(path.join(legacyTarget, "artifact"), "duplicate build output\n");

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "legacy_targets_present",
      legacy_target_dirs: [legacyTarget]
    });
  });

  it("fails the audit for a dangling legacy target symlink", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const legacyTarget = path.join(
      siblingWorktree,
      "apps",
      "operator-desktop",
      "src-tauri",
      "target"
    );
    mkdirSync(path.dirname(legacyTarget), { recursive: true });
    symlinkSync(path.join(siblingWorktree, "missing-legacy-target"), legacyTarget);

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "legacy_targets_present",
      legacy_target_dirs: [legacyTarget]
    });
  });

  it("fails the audit for a dangling legacy-target ancestor symlink", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const desktopRoot = path.join(siblingWorktree, "apps", "operator-desktop");
    mkdirSync(desktopRoot, { recursive: true });
    symlinkSync(
      path.join(siblingWorktree, "missing-src-tauri"),
      path.join(desktopRoot, "src-tauri")
    );

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_cleanup_symlink_refused");
  });

  it("fails the audit when the shared Cargo target itself is a symlink", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const externalRoot = mkdtempSync(path.join(realpathSync(tmpdir()), "ouroboros-target-"));
    createdRoots.push(externalRoot);
    const sharedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    mkdirSync(path.dirname(sharedTarget), { recursive: true });
    writeFileSync(path.join(externalRoot, "sentinel"), "external target\n");
    symlinkSync(externalRoot, sharedTarget);

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_storage_symlink_refused");
    expect(existsSync(path.join(externalRoot, "sentinel"))).toBe(true);
  });

  it("fails the audit when the shared Cargo target is a dangling symlink", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const sharedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    mkdirSync(path.dirname(sharedTarget), { recursive: true });
    symlinkSync(path.join(controlCheckout, "missing-external-target"), sharedTarget);

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_storage_symlink_refused");
  });

  it("fails the audit when a shared-target ancestor is a dangling symlink", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const operatorCache = path.join(controlCheckout, ".cache", "operator-desktop");
    mkdirSync(path.dirname(operatorCache), { recursive: true });
    symlinkSync(path.join(controlCheckout, "missing-operator-cache"), operatorCache);

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_storage_symlink_refused");
  });

  it("blocks native work on an interrupted cleanup quarantine and resumes its cleanup", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const quarantine = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target.cleanup-999-123e4567-e89b-42d3-a456-426614174000"
    );
    mkdirSync(quarantine, { recursive: true });
    writeFileSync(path.join(quarantine, "sentinel"), "interrupted cleanup\n");

    const audit = runStorageCommand(controlCheckout, "audit");
    const clean = runStorageCommand(controlCheckout, "clean");

    expect(audit.status).toBe(1);
    expect(JSON.parse(audit.stdout)).toMatchObject({
      status: "cleanup_quarantines_present",
      cleanup_quarantine_dirs: [quarantine]
    });
    expect(clean.status, clean.stderr).toBe(0);
    expect(existsSync(quarantine)).toBe(false);
  });

  it("blocks a native build before free disk falls below the configured floor", () => {
    const { controlCheckout } = createRepositoryWithWorktree();

    const result = runStorageCommand(controlCheckout, "audit", {
      OUROBOROS_DESKTOP_MIN_FREE_GIB: "999999"
    });

    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "insufficient_free_space"
    });
  });

  it("allows capacity overrides to tighten but never weaken repository defaults", () => {
    const { controlCheckout } = createRepositoryWithWorktree();

    const lowerFreeFloor = runStorageCommand(controlCheckout, "audit", {
      OUROBOROS_DESKTOP_MIN_FREE_GIB: "7"
    });
    const higherCacheCeiling = runStorageCommand(controlCheckout, "audit", {
      OUROBOROS_DESKTOP_MAX_TARGET_GIB: "7"
    });

    expect(lowerFreeFloor.status).toBe(1);
    expect(lowerFreeFloor.stderr).toContain("operator_desktop_capacity_override_weakening_refused");
    expect(higherCacheCeiling.status).toBe(1);
    expect(higherCacheCeiling.stderr).toContain("operator_desktop_capacity_override_weakening_refused");
  });

  it("blocks the next native build after the shared target exceeds its high-water mark", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const sharedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    mkdirSync(sharedTarget, { recursive: true });
    writeFileSync(path.join(sharedTarget, "oversized-artifact"), Buffer.alloc(2_048));

    const result = runStorageCommand(controlCheckout, "audit", {
      OUROBOROS_DESKTOP_MAX_TARGET_GIB: "0.000001"
    });

    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "target_cache_limit_exceeded",
      target_bytes: "2048"
    });
  });

  it("fails the same native command that crosses the shared-target high-water mark", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "oversized-build",
        "--",
        process.execPath,
        "-e",
        [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          "fs.mkdirSync(process.env.CARGO_TARGET_DIR, { recursive: true });",
          "fs.writeFileSync(path.join(process.env.CARGO_TARGET_DIR, 'oversized'), Buffer.alloc(2048));"
        ].join(" ")
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: storageEnv({ OUROBOROS_DESKTOP_MAX_TARGET_GIB: "0.000001" })
      }
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("target_cache_limit_exceeded");
  });

  it("runs native commands with the shared Cargo target", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const expectedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        siblingWorktree,
        "--label",
        "test-command",
        "--",
        process.execPath,
        "-e",
        "process.stdout.write(process.env.CARGO_TARGET_DIR ?? '')"
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: storageEnv()
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(expectedTarget);
  });

  it("rejects a conflicting Cargo target override that would bypass the shared cache", () => {
    const { controlCheckout } = createRepositoryWithWorktree();

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "test-command",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)"
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: storageEnv({
          CARGO_TARGET_DIR: path.join(controlCheckout, "private-target")
        })
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_cargo_target_override_refused");
  });

  it("rejects a concurrent native build with exact active-owner evidence", async () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const first = spawn(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "first-build",
        "--",
        process.execPath,
        "-e",
        "setTimeout(() => process.exit(0), 5000)"
      ],
      {
        cwd: process.cwd(),
        stdio: "ignore",
        env: storageEnv()
      }
    );
    const lockPath = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "native-build.lock"
    );

    try {
      await waitUntil(() => existsSync(lockPath));
      expect(existsSync(lockPath)).toBe(true);

      const second = spawnSync(
        process.execPath,
        [
          storageScript,
          "exec",
          "--repo-root",
          controlCheckout,
          "--label",
          "second-build",
          "--",
          process.execPath,
          "-e",
          "process.exit(0)"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: storageEnv()
        }
      );

      expect(second.status).toBe(1);
      expect(second.stderr).toContain("operator_desktop_native_build_lock_active");
      expect(second.stderr).toContain("first-build");
    } finally {
      first.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (first.exitCode !== null) {
          resolve();
          return;
        }
        first.once("exit", () => resolve());
      });
    }
  });

  it("recovers a well-formed stale lock only after its owner PID is absent", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const lockPath = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "native-build.lock"
    );
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({
      pid: 999_999_999,
      worktree: controlCheckout,
      branch: "stale-branch",
      command: "stale-build",
      started_at: "2026-01-01T00:00:00.000Z",
      token: "stale-lock-token"
    }));

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "replacement-build",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)"
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: storageEnv()
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("refuses stale-lock recovery while another live recovery claimant exists", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const cacheRoot = path.join(controlCheckout, ".cache", "operator-desktop");
    const lockPath = path.join(cacheRoot, "native-build.lock");
    const recoveryPath = `${lockPath}.recovery`;
    mkdirSync(cacheRoot, { recursive: true });
    const baseOwner = {
      worktree: controlCheckout,
      branch: "stale-branch",
      started_at: "2026-01-01T00:00:00.000Z"
    };
    writeFileSync(lockPath, JSON.stringify({
      ...baseOwner,
      pid: 999_999_999,
      command: "stale-build",
      token: "stale-lock-token"
    }));
    writeFileSync(recoveryPath, JSON.stringify({
      ...baseOwner,
      pid: process.pid,
      command: "live-recovery",
      token: "live-recovery-token"
    }));

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "replacement-build",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)"
      ],
      { cwd: process.cwd(), encoding: "utf8", env: storageEnv() }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "recovery_guard_present",
      recovery_guard_path: recoveryPath,
      recovery_guard_owner_status: "readable",
      recovery_guard_owner: {
        pid: process.pid,
        command: "live-recovery",
        liveness: "alive"
      }
    });
    expect(existsSync(lockPath)).toBe(true);
  });

  it("fails the read-only audit when a recovery guard exists", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const recoveryPath = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "native-build.lock.recovery"
    );
    mkdirSync(path.dirname(recoveryPath), { recursive: true });
    writeFileSync(recoveryPath, "ambiguous recovery owner\n");

    const result = runStorageCommand(controlCheckout, "audit");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "recovery_guard_present",
      recovery_guard_path: recoveryPath,
      recovery_guard_owner_status: "unreadable"
    });
  });

  it("fails closed on a standalone recovery guard before starting native work", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const cacheRoot = path.join(controlCheckout, ".cache", "operator-desktop");
    const lockPath = path.join(cacheRoot, "native-build.lock");
    const recoveryPath = `${lockPath}.recovery`;
    mkdirSync(cacheRoot, { recursive: true });
    writeFileSync(recoveryPath, JSON.stringify({
      pid: 999_999_999,
      worktree: controlCheckout,
      branch: "stale-branch",
      command: "abandoned-recovery",
      started_at: "2026-01-01T00:00:00.000Z",
      token: "abandoned-recovery-token"
    }));

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "replacement-build",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)"
      ],
      { cwd: process.cwd(), encoding: "utf8", env: storageEnv() }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "recovery_guard_present",
      recovery_guard_path: recoveryPath,
      recovery_guard_owner_status: "readable",
      recovery_guard_owner: {
        pid: 999_999_999,
        command: "abandoned-recovery",
        liveness: "absent"
      }
    });
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(recoveryPath)).toBe(true);
  });

  it("fails closed when an abandoned recovery guard is present", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const cacheRoot = path.join(controlCheckout, ".cache", "operator-desktop");
    const lockPath = path.join(cacheRoot, "native-build.lock");
    const recoveryPath = `${lockPath}.recovery`;
    mkdirSync(cacheRoot, { recursive: true });
    const baseOwner = {
      pid: 999_999_999,
      worktree: controlCheckout,
      branch: "stale-branch",
      started_at: "2026-01-01T00:00:00.000Z"
    };
    writeFileSync(lockPath, JSON.stringify({
      ...baseOwner,
      command: "stale-build",
      token: "stale-lock-token"
    }));
    writeFileSync(recoveryPath, JSON.stringify({
      ...baseOwner,
      command: "abandoned-recovery",
      token: "abandoned-recovery-token"
    }));

    const result = spawnSync(
      process.execPath,
      [
        storageScript,
        "exec",
        "--repo-root",
        controlCheckout,
        "--label",
        "replacement-build",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)"
      ],
      { cwd: process.cwd(), encoding: "utf8", env: storageEnv() }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "recovery_guard_present",
      recovery_guard_path: recoveryPath
    });
    expect(existsSync(lockPath)).toBe(true);
    expect(existsSync(recoveryPath)).toBe(true);
  });

  it("detects a repo-scoped Node Tauri CLI before Cargo starts", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const targetDir = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    const tauriCli = path.join(
      siblingWorktree,
      "node_modules",
      "@tauri-apps",
      "cli",
      "tauri.js"
    );

    const active = activeDesktopNativeProcesses({
      repoRoot: siblingWorktree,
      targetDir,
      processTable: `101 node ${process.execPath} ${tauriCli} dev\n`,
      workingDirectoryForPid: () => siblingWorktree
    });

    expect(active).toEqual([
      expect.objectContaining({ pid: 101, command: expect.stringContaining("tauri.js") })
    ]);
  });

  it("detects a macOS app whose comm is truncated and whose command path contains spaces", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const targetDir = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    const appExecutable = path.join(
      targetDir,
      "release",
      "bundle",
      "macos",
      "Ouroboros Operator.app",
      "Contents",
      "MacOS",
      "ouroboros-operator-desktop"
    );

    const active = activeDesktopNativeProcesses({
      repoRoot: controlCheckout,
      targetDir,
      processTable: `111 ouroboros-operat ${appExecutable}\n`,
      workingDirectoryForPid: () => "/"
    });

    expect(active).toEqual([
      expect.objectContaining({ pid: 111, command: appExecutable })
    ]);
  });

  it("ignores unrelated Cargo while detecting repo-scoped Cargo", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const targetDir = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );

    const active = activeDesktopNativeProcesses({
      repoRoot: siblingWorktree,
      targetDir,
      processTable: [
        "201 cargo cargo build",
        "202 cargo cargo build"
      ].join("\n"),
      workingDirectoryForPid: (pid) => pid === 201
        ? path.join(siblingWorktree, "apps", "operator-desktop", "src-tauri")
        : path.join(realpathSync(tmpdir()), "unrelated-rust-project")
    });

    expect(active).toEqual([
      expect.objectContaining({ pid: 201, executable: "cargo" })
    ]);
  });

  it("allows exactly one concurrent recovery claimant for a stale native lock", async () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const cacheRoot = path.join(controlCheckout, ".cache", "operator-desktop");
    const lockPath = path.join(cacheRoot, "native-build.lock");
    const barrierPath = path.join(controlCheckout, "start-recovery");
    const markerPath = path.join(controlCheckout, "recovery-owners");
    mkdirSync(cacheRoot, { recursive: true });
    writeFileSync(lockPath, JSON.stringify({
      pid: 999_999_999,
      worktree: controlCheckout,
      branch: "stale-branch",
      command: "stale-build",
      started_at: "2026-01-01T00:00:00.000Z",
      token: "stale-lock-token"
    }));
    const wrapper = [
      "const fs = require('node:fs');",
      "const { pathToFileURL } = require('node:url');",
      "const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));",
      "(async () => {",
      `  while (!fs.existsSync(${JSON.stringify(barrierPath)})) await wait(5);`,
      `  process.argv = [process.execPath, ${JSON.stringify(storageScript)},`,
      `    'exec', '--repo-root', ${JSON.stringify(controlCheckout)},`,
      "    '--label', `recovery-${process.pid}`, '--', process.execPath, '-e',",
      `    ${JSON.stringify([
        "const fs = require('node:fs');",
        `fs.appendFileSync(${JSON.stringify(markerPath)}, process.pid + '\\n');`,
        "setTimeout(() => process.exit(0), 700);"
      ].join(" "))}];`,
      `  await import(pathToFileURL(${JSON.stringify(storageScript)}).href + '?pid=' + process.pid);`,
      "})().catch((error) => { console.error(error); process.exit(1); });"
    ].join("\n");
    const contenders = [0, 1].map(() => spawn(
      process.execPath,
      ["-e", wrapper],
      { cwd: process.cwd(), env: storageEnv(), stdio: ["ignore", "pipe", "pipe"] }
    ));
    writeFileSync(barrierPath, "start\n");

    const results = await Promise.all(contenders.map(waitForChild));
    const markerPids = existsSync(markerPath)
      ? readFileSync(markerPath, "utf8").trim().split("\n").filter(Boolean)
      : [];

    expect(results.filter((result) => result.status === 0)).toHaveLength(1);
    expect(results.filter((result) => result.status !== 0)).toHaveLength(1);
    expect(markerPids).toHaveLength(1);
  });

  it("does not expose release-stamp publication through the storage CLI", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const appPath = JSON.parse(inspectStorage(controlCheckout).stdout).app_bundle_path;
    mkdirSync(appPath, { recursive: true });

    const result = runStorageCommandWithArgs(controlCheckout, "stamp-release", [
      "--app-path",
      appPath
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("operator_desktop_build_storage_unknown_command:stamp-release");
  });

  it("requires a pre-build source snapshot to publish a release stamp", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const appPath = JSON.parse(inspectStorage(controlCheckout).stdout).app_bundle_path;
    mkdirSync(appPath, { recursive: true });

    expect(() => writeDesktopReleaseStamp(controlCheckout, appPath)).toThrow(
      "operator_desktop_release_source_state_required"
    );
  });

  it("refuses a shared release bundle after the source worktree state changes", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const appPath = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target",
      "release",
      "bundle",
      "macos",
      "Ouroboros Operator.app"
    );
    mkdirSync(appPath, { recursive: true });

    const stamp = writeDesktopReleaseStamp(
      controlCheckout,
      appPath,
      captureDesktopReleaseSourceState(controlCheckout)
    );
    const current = runStorageCommand(controlCheckout, "verify-release");
    const otherWorktree = runStorageCommand(siblingWorktree, "verify-release");
    writeFileSync(path.join(controlCheckout, "changed.ts"), "new source state\n");
    const changed = runStorageCommand(controlCheckout, "verify-release");

    expect(stamp.status).toBe("release_stamped");
    expect(current.status, `${current.stderr}\n${current.stdout}`).toBe(0);
    expect(JSON.parse(current.stdout)).toMatchObject({
      status: "release_current",
      app_bundle_path: appPath
    });
    expect(otherWorktree.status).toBe(1);
    expect(JSON.parse(otherWorktree.stdout)).toMatchObject({
      status: "release_worktree_mismatch"
    });
    expect(changed.status).toBe(1);
    expect(JSON.parse(changed.stdout)).toMatchObject({
      status: "release_source_state_mismatch"
    });
  });

  it("refuses a stamped release after any app bundle byte changes", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const appPath = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target",
      "release",
      "bundle",
      "macos",
      "Ouroboros Operator.app"
    );
    const payloadPath = path.join(appPath, "Contents", "MacOS", "operator");
    mkdirSync(path.dirname(payloadPath), { recursive: true });
    writeFileSync(payloadPath, "first bundle\n");
    const stamp = writeDesktopReleaseStamp(
      controlCheckout,
      appPath,
      captureDesktopReleaseSourceState(controlCheckout)
    );
    writeFileSync(payloadPath, "mutated bundle\n");

    const result = runStorageCommand(controlCheckout, "verify-release");

    expect(stamp.status).toBe("release_stamped");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "release_bundle_digest_mismatch"
    });
  });

  it("invalidates the prior release stamp inside the native lease before packaging", () => {
    const packageSource = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "scripts", "package-app.mjs"),
      "utf8"
    );

    expect(packageSource).toContain("beforeSpawn:");
    expect(packageSource).toContain("invalidateDesktopReleaseStamp");
    expect(packageSource).toContain("operator_desktop_release_app_missing");
    expect(packageSource.slice(packageSource.indexOf("function run")))
      .not.toContain("process.exit(");
  });

  it("keeps a failed in-place package overwrite unavailable", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const appPath = JSON.parse(inspectStorage(controlCheckout).stdout).app_bundle_path;
    const payloadPath = path.join(appPath, "Contents", "MacOS", "operator");
    mkdirSync(path.dirname(payloadPath), { recursive: true });
    writeFileSync(payloadPath, "published bundle\n");
    writeDesktopReleaseStamp(
      controlCheckout,
      appPath,
      captureDesktopReleaseSourceState(controlCheckout)
    );

    const result = runDesktopBuildCommand({
      repoRoot: controlCheckout,
      label: "failed-package",
      command: process.execPath,
      args: [
        "-e",
        [
          "const fs = require('node:fs');",
          `fs.writeFileSync(${JSON.stringify(payloadPath)}, 'partial bundle\\n');`,
          "process.exit(1);"
        ].join(" ")
      ],
      beforeSpawn: () => invalidateDesktopReleaseStamp(controlCheckout)
    });
    const verified = runStorageCommand(controlCheckout, "verify-release");

    expect(result.status).toBe(1);
    expect(verified.status).toBe(1);
    expect(JSON.parse(verified.stdout)).toMatchObject({ status: "release_stamp_missing" });
  });

  it("refuses publication when source changes during the package lease", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const appPath = JSON.parse(inspectStorage(controlCheckout).stdout).app_bundle_path;
    mkdirSync(appPath, { recursive: true });
    writeFileSync(path.join(appPath, "payload"), "bundle\n");

    expect(() => runDesktopBuildCommand({
      repoRoot: controlCheckout,
      label: "source-changing-package",
      command: process.execPath,
      args: [
        "-e",
        `require('node:fs').writeFileSync(${JSON.stringify(path.join(controlCheckout, "README.md"))}, 'changed during build\\n')`
      ],
      beforeSpawn: () => {
        const source = captureDesktopReleaseSourceState(controlCheckout);
        invalidateDesktopReleaseStamp(controlCheckout);
        return source;
      },
      afterSuccess: (_preflight, sourceAtStart) => {
        assertDesktopReleaseSourceState(controlCheckout, sourceAtStart);
        writeDesktopReleaseStamp(controlCheckout, appPath, sourceAtStart);
      }
    })).toThrow("operator_desktop_release_source_changed_during_package");
    expect(runStorageCommand(controlCheckout, "verify-release").status).toBe(1);
  });

  it("cleans only shared and registered legacy Desktop build output", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const sharedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    const releaseStamp = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "release-stamp.json"
    );
    const legacyTarget = path.join(
      siblingWorktree,
      "apps",
      "operator-desktop",
      "src-tauri",
      "target"
    );
    const unrelatedFile = path.join(siblingWorktree, "keep.txt");
    mkdirSync(sharedTarget, { recursive: true });
    mkdirSync(legacyTarget, { recursive: true });
    writeFileSync(path.join(sharedTarget, "shared-artifact"), "shared\n");
    writeFileSync(path.join(legacyTarget, "legacy-artifact"), "legacy\n");
    writeFileSync(releaseStamp, "{}\n");
    writeFileSync(unrelatedFile, "preserve me\n");

    const result = runStorageCommand(controlCheckout, "clean");

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(sharedTarget)).toBe(false);
    expect(existsSync(releaseStamp)).toBe(false);
    expect(existsSync(legacyTarget)).toBe(false);
    expect(existsSync(unrelatedFile)).toBe(true);
  });

  it("refuses cleanup when a legacy target resolves through an ancestor symlink", () => {
    const { controlCheckout, siblingWorktree } = createRepositoryWithWorktree();
    const externalRoot = mkdtempSync(path.join(realpathSync(tmpdir()), "ouroboros-external-"));
    createdRoots.push(externalRoot);
    const externalTarget = path.join(externalRoot, "target");
    const sentinel = path.join(externalTarget, "sentinel");
    mkdirSync(externalTarget, { recursive: true });
    writeFileSync(sentinel, "preserve external data\n");
    const desktopRoot = path.join(siblingWorktree, "apps", "operator-desktop");
    mkdirSync(desktopRoot, { recursive: true });
    symlinkSync(externalRoot, path.join(desktopRoot, "src-tauri"));

    const result = runStorageCommand(controlCheckout, "clean");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_cleanup_symlink_refused");
    expect(existsSync(sentinel)).toBe(true);
  });

  it("refuses cleanup when the shared cache resolves through an ancestor symlink", () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const externalRoot = mkdtempSync(path.join(realpathSync(tmpdir()), "ouroboros-cache-"));
    createdRoots.push(externalRoot);
    const externalTarget = path.join(externalRoot, "cargo-target");
    const sentinel = path.join(externalTarget, "sentinel");
    mkdirSync(externalTarget, { recursive: true });
    writeFileSync(sentinel, "preserve external cache\n");
    mkdirSync(path.join(controlCheckout, ".cache"), { recursive: true });
    symlinkSync(externalRoot, path.join(controlCheckout, ".cache", "operator-desktop"));

    const result = runStorageCommand(controlCheckout, "clean");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("operator_desktop_storage_symlink_refused");
    expect(existsSync(sentinel)).toBe(true);
  });

  it("refuses cleanup while a native Operator Desktop process is alive", async () => {
    const { controlCheckout } = createRepositoryWithWorktree();
    const sharedTarget = path.join(
      controlCheckout,
      ".cache",
      "operator-desktop",
      "cargo-target"
    );
    mkdirSync(sharedTarget, { recursive: true });
    writeFileSync(path.join(sharedTarget, "active-artifact"), "preserve while active\n");
    const desktopProcess = spawn(
      process.execPath,
      ["-e", "setTimeout(() => process.exit(0), 5000)"],
      {
        argv0: "ouroboros-operator-desktop",
        cwd: controlCheckout,
        stdio: "ignore"
      }
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = runStorageCommand(controlCheckout, "clean");

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("operator_desktop_native_process_active");
      expect(existsSync(sharedTarget)).toBe(true);
    } finally {
      desktopProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (desktopProcess.exitCode !== null) {
          resolve();
          return;
        }
        desktopProcess.once("exit", () => resolve());
      });
    }
  });

  it("routes the Desktop cargo check through the shared target guard", () => {
    const fakeBin = mkdtempSync(path.join(realpathSync(tmpdir()), "ouroboros-fake-cargo-"));
    createdRoots.push(fakeBin);
    const fakeCargo = path.join(fakeBin, "cargo");
    writeFileSync(fakeCargo, [
      "#!/usr/bin/env node",
      "process.stdout.write(process.env.CARGO_TARGET_DIR ?? 'missing-cargo-target');",
      ""
    ].join("\n"));
    chmodSync(fakeCargo, 0o755);
    const inspection = JSON.parse(inspectStorage(process.cwd()).stdout);

    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "apps", "operator-desktop", "scripts", "check-build.mjs")],
      {
        cwd: path.join(process.cwd(), "apps", "operator-desktop"),
        encoding: "utf8",
        env: storageEnv({
          OUROBOROS_OPERATOR_DESKTOP_PLATFORM: "darwin",
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`
        })
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(inspection.target_dir);
  });
});

function createRepositoryWithWorktree() {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), "ouroboros-build-storage-"));
  createdRoots.push(root);
  runGit(root, ["init", "--initial-branch=main"]);
  runGit(root, ["config", "user.name", "Ouroboros Test"]);
  runGit(root, ["config", "user.email", "ouroboros-test@example.invalid"]);
  writeFileSync(path.join(root, "README.md"), "test repository\n");
  runGit(root, ["add", "README.md"]);
  runGit(root, ["commit", "-m", "test fixture"]);
  const siblingWorktree = `${root}-sibling`;
  createdRoots.push(siblingWorktree);
  runGit(root, ["worktree", "add", "-b", "sibling", siblingWorktree]);
  return { controlCheckout: root, siblingWorktree };
}

function inspectStorage(repoRoot: string) {
  return runStorageCommand(repoRoot, "inspect");
}

function runStorageCommand(
  repoRoot: string,
  command: string,
  envOverrides: Record<string, string> = {}
) {
  return runStorageCommandWithArgs(repoRoot, command, [], envOverrides);
}

function runStorageCommandWithArgs(
  repoRoot: string,
  command: string,
  args: string[],
  envOverrides: Record<string, string> = {}
) {
  return spawnSync(
    process.execPath,
    [storageScript, command, "--repo-root", repoRoot, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: storageEnv(envOverrides)
    }
  );
}

function storageEnv(envOverrides: Record<string, string> = {}) {
  return {
    ...process.env,
    OUROBOROS_DESKTOP_MIN_FREE_GIB: undefined,
    OUROBOROS_DESKTOP_MAX_TARGET_GIB: undefined,
    ...envOverrides
  };
}

function runGit(cwd: string, args: string[]) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

async function waitUntil(predicate: () => boolean) {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function waitForChild(child: ReturnType<typeof spawn>) {
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    child.once("exit", (status) => resolve({ status, stdout, stderr }));
  });
}
