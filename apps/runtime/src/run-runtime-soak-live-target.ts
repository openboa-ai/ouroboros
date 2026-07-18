import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { probeAgentProfile } from "@ouroboros/application/agent/profiles";
import { evaluateRuntimeSoakInvariants } from "@ouroboros/application/runtime-soak";
import { LocalStore } from "@ouroboros/local-store";
import {
  executeLiveRuntimeSoakControl,
  serveLiveRuntimeSoakRuntime
} from "./runtime-soak-live-control";
import {
  collectLiveRuntimeSoakSandboxEvidence,
  digestRuntimeSoakExecutable,
  inspectCleanRuntimeSoakRepository,
  prepareLiveRuntimeSoakRun,
  verifyLiveRuntimeSoakEnvironmentManifest,
  type LiveRuntimeSoakEnvironmentManifest
} from "./runtime-soak-live-preparation";
import {
  buildLiveRuntimeSoakSample,
  createLiveRuntimeSoakScenario,
  parseLiveRuntimeSoakTargetConfig,
  type LiveRuntimeSoakTargetConfig
} from "./runtime-soak-live-target";
import { runRuntimeSoakCommand } from "./run-runtime-soak";

type Io = { stdout(line: string): void };

export async function runLiveRuntimeSoakTargetCommand(
  args: string[],
  io: Io = { stdout: console.log },
  environment: NodeJS.ProcessEnv = process.env
): Promise<{ exitCode: number }> {
  const input = parseArgs(args);
  if (input.mode === "prepare") {
    const prepared = await prepareLiveRuntimeSoakRun({
      repoRoot: process.cwd(),
      runId: required(input.options, "--run-id"),
      runtimePort: positiveInteger(required(input.options, "--runtime-port")),
      authSource: required(input.options, "--auth-source"),
      ...(input.options["--provider-command"]
        ? { providerCommand: input.options["--provider-command"] }
        : {}),
      ...(input.options["--sandbox-command"]
        ? { sandboxCommand: input.options["--sandbox-command"] }
        : {}),
      ...(input.options["--sandbox-home"]
        ? { sandboxHome: path.resolve(input.options["--sandbox-home"]) }
        : {})
    });
    io.stdout(JSON.stringify(prepared));
    return { exitCode: 0 };
  }

  const verified = await readVerifiedRun(required(input.options, "--config"));
  const config = verified.config;
  const entrypoint = path.join(
    config.repo_root,
    "apps",
    "runtime",
    "src",
    "run-runtime-soak-live-target.ts"
  );
  const tsxCli = path.join(config.repo_root, "node_modules", "tsx", "dist", "cli.mjs");
  if (input.mode === "control") {
    const actionId = environment.OUROBOROS_SOAK_ACTION_ID;
    if (!canonical(actionId) || environment.OUROBOROS_SOAK_RUN_ID !== config.run_id) {
      throw new Error("Runtime soak control requires exact harness action metadata.");
    }
    await executeFrozenLiveRuntimeSoakControl({
      actionId,
      verifyControl: () => assertFrozenControlBindings(config, verified.manifest),
      verifyCleanup: () => assertFrozenCleanupBindings(config, verified.manifest),
      execute: () => executeLiveRuntimeSoakControl(config, actionId, entrypoint, tsxCli)
    });
    io.stdout(JSON.stringify({ run_id: config.run_id, action_id: actionId, status: "completed" }));
    return { exitCode: 0 };
  }
  if (input.mode === "probe") {
    await assertFrozenControlBindings(config, verified.manifest);
    io.stdout(JSON.stringify(await buildLiveRuntimeSoakSample(config)));
    return { exitCode: 0 };
  }
  if (input.mode === "serve-runtime") {
    const instanceToken = required(input.options, "--instance-token");
    if (!/^[a-f0-9-]{36}$/.test(instanceToken)) {
      throw new Error("Runtime soak server instance token is invalid.");
    }
    await serveLiveRuntimeSoakRuntime(config);
    return { exitCode: 0 };
  }
  if (input.mode === "preflight") {
    await assertFrozenLaunchBindings(config, verified.manifest);
    for (const action of createLiveRuntimeSoakScenario(config.run_id).actions) {
      await executeLiveRuntimeSoakControl(config, action.action_id, entrypoint, tsxCli);
      const failure = evaluateRuntimeSoakInvariants(
        await buildLiveRuntimeSoakSample(config),
        { terminal: action.kind === "terminal_cleanup" }
      );
      if (failure) {
        throw new Error(`Runtime soak preflight invariant failed: ${failure.kind}`);
      }
    }
    io.stdout(JSON.stringify({ run_id: config.run_id, status: "preflight_passed" }));
    return { exitCode: 0 };
  }
  await assertFrozenLaunchBindings(config, verified.manifest);
  const result = await runRuntimeSoakCommand([
    "--config",
    path.join(config.run_root, "config", "harness.json"),
    "--report-root",
    config.report_root
  ], io);
  const completion = liveRuntimeSoakLaunchCompletion(config.run_id, result);
  io.stdout(JSON.stringify(completion.output));
  return { exitCode: completion.exitCode };
}

export async function executeFrozenLiveRuntimeSoakControl(input: {
  actionId: string;
  verifyControl(): Promise<void>;
  verifyCleanup(): Promise<void>;
  execute(): Promise<void>;
}): Promise<void> {
  await (input.actionId === "terminal-cleanup"
    ? input.verifyCleanup()
    : input.verifyControl());
  await input.execute();
}

export function liveRuntimeSoakLaunchCompletion(
  runId: string,
  result: { exitCode: number; result: { classification: string } }
): {
  exitCode: number;
  output: { run_id: string; status: "completed"; classification: string };
} {
  return {
    // A published terminal result completes the launchd job even when the
    // operational classification failed. Pre-terminal process errors still
    // reject and remain restartable under SuccessfulExit=false.
    exitCode: 0,
    output: {
      run_id: runId,
      status: "completed",
      classification: result.result.classification
    }
  };
}

type Mode = "prepare" | "control" | "probe" | "serve-runtime" | "preflight" | "launch";

function parseArgs(args: string[]): { mode: Mode; options: Record<string, string> } {
  const mode = args[0] as Mode | undefined;
  const allowed: Record<Mode, Set<string>> = {
    prepare: new Set([
      "--run-id", "--runtime-port", "--auth-source", "--provider-command",
      "--sandbox-command", "--sandbox-home"
    ]),
    control: new Set(["--config"]),
    probe: new Set(["--config"]),
    "serve-runtime": new Set(["--config", "--instance-token"]),
    preflight: new Set(["--config"]),
    launch: new Set(["--config"])
  };
  if (!mode || !Object.hasOwn(allowed, mode) || (args.length - 1) % 2 !== 0) {
    throw new Error("Invalid live runtime soak command.");
  }
  const options: Record<string, string> = {};
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]!;
    const value = args[index + 1]!;
    if (!allowed[mode].has(flag) || !canonical(value) || Object.hasOwn(options, flag)) {
      throw new Error("Invalid live runtime soak command option.");
    }
    options[flag] = value;
  }
  return { mode, options };
}

async function readVerifiedRun(fileInput: string): Promise<{
  config: LiveRuntimeSoakTargetConfig;
  manifest: LiveRuntimeSoakEnvironmentManifest;
}> {
  const file = path.resolve(fileInput);
  await assertRegular(file);
  const config = parseLiveRuntimeSoakTargetConfig(
    JSON.parse(await readFile(file, "utf8")) as unknown
  );
  if (file !== path.join(config.run_root, "config", "target.json")) {
    throw new Error("Runtime soak target config path is not bound to its run root.");
  }
  const manifestFile = path.join(config.run_root, "environment-manifest.json");
  await assertRegular(manifestFile);
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as unknown;
  return {
    config,
    manifest: verifyLiveRuntimeSoakEnvironmentManifest(config, manifest)
  };
}

async function assertFrozenLaunchBindings(
  config: LiveRuntimeSoakTargetConfig,
  manifest: LiveRuntimeSoakEnvironmentManifest
): Promise<void> {
  await assertFrozenControlBindings(config, manifest);
  const store = new LocalStore(config.store_root);
  const profile = await store.getAgentProfile("codex");
  if (!profile) throw new Error("Managed Codex profile is missing.");
  const [providerProfile, sandboxEvidence] = await Promise.all([
    probeAgentProfile({ store, profileId: "codex", command: config.provider.command }),
    collectLiveRuntimeSoakSandboxEvidence({
      repoRoot: config.repo_root,
      command: config.sandbox.command,
      home: config.sandbox.home
    })
  ]);
  if (providerProfile.version !== manifest.provider.version ||
    digest(JSON.stringify(providerProfile)) !== manifest.provider.profile_digest ||
    sandboxEvidence.version !== manifest.sandbox.version) {
    throw new Error("Runtime soak launch binding differs from its frozen manifest.");
  }
}

async function assertFrozenControlBindings(
  config: LiveRuntimeSoakTargetConfig,
  manifest: LiveRuntimeSoakEnvironmentManifest
): Promise<void> {
  await assertFrozenCleanupBindings(config, manifest);
  const profile = await new LocalStore(config.store_root).getAgentProfile("codex");
  if (!profile) throw new Error("Managed Codex profile is missing.");
  const [auth, providerDigest] = await Promise.all([
    readFile(path.join(profile.managed_provider_home, "auth.json")),
    digestRuntimeSoakExecutable(config.provider.command)
  ]);
  if (digest(auth) !== manifest.provider.auth_digest ||
    providerDigest !== manifest.provider.executable_digest) {
    throw new Error("Runtime soak control binding differs from its frozen manifest.");
  }
}

async function assertFrozenCleanupBindings(
  config: LiveRuntimeSoakTargetConfig,
  manifest: LiveRuntimeSoakEnvironmentManifest
): Promise<void> {
  const harness = JSON.parse(await readFile(
    path.join(config.run_root, "config", "harness.json"),
    "utf8"
  )) as unknown;
  const launchAgent = await readFile(
    path.join(config.run_root, "launch-agent.plist"),
    "utf8"
  );
  const tsxCli = path.join(config.repo_root, "node_modules", "tsx", "dist", "cli.mjs");
  const [repository, sandboxDigest, nodeDigest, tsxDigest] = await Promise.all([
    inspectCleanRuntimeSoakRepository(config.repo_root),
    digestRuntimeSoakExecutable(config.sandbox.command),
    digestRuntimeSoakExecutable(process.execPath),
    digestRuntimeSoakExecutable(tsxCli)
  ]);
  if (digest(JSON.stringify(harness)) !== manifest.target.harness_config_digest ||
    digest(launchAgent) !== manifest.target.launch_agent_digest ||
    repository.commit !== manifest.repository.commit ||
    repository.tree !== manifest.repository.tree ||
    sandboxDigest !== manifest.sandbox.executable_digest ||
    nodeDigest !== manifest.target.node_executable_digest ||
    tsxDigest !== manifest.target.tsx_cli_digest) {
    throw new Error("Runtime soak cleanup binding differs from its frozen manifest.");
  }
}

async function assertRegular(file: string): Promise<void> {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Runtime soak input must be one regular non-symlink file.");
  }
}

function required(options: Record<string, string>, key: string): string {
  const value = options[key];
  if (!canonical(value)) throw new Error(`Missing live runtime soak option: ${key}`);
  return value;
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Live runtime soak numeric option is invalid.");
  }
  return parsed;
}

function canonical(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function runtimeSoakLogMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\r\n]/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .slice(0, 4_096);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runLiveRuntimeSoakTargetCommand(process.argv.slice(2))
    .then(({ exitCode }) => { process.exitCode = exitCode; })
    .catch((error: unknown) => {
      console.error(runtimeSoakLogMessage(error));
      process.exitCode = 2;
    });
}
