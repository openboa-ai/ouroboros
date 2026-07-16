import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  FileRuntimeSoakJournal,
  SubprocessRuntimeSoakTarget,
  type RuntimeSoakCommand
} from "@ouroboros/adapters/runtime-soak";
import {
  RuntimeSoakHarness,
  validateRuntimeSoakScenario,
  type RuntimeSoakResult,
  type RuntimeSoakScenario
} from "@ouroboros/application/runtime-soak";

export interface RunRuntimeSoakCommandResult {
  exitCode: number;
  result: RuntimeSoakResult;
}

export async function runRuntimeSoakCommand(
  args: string[],
  io: { stdout(line: string): void } = { stdout: console.log }
): Promise<RunRuntimeSoakCommandResult> {
  const input = parseArgs(args);
  const config = parseConfig(JSON.parse(await readFile(input.configPath, "utf8")));
  const result = await new RuntimeSoakHarness({
    scenario: config.scenario,
    journal: new FileRuntimeSoakJournal(input.reportRoot),
    target: new SubprocessRuntimeSoakTarget({
      runId: config.scenario.run_id,
      controls: config.controls,
      probe: config.probe
    })
  }).run();
  io.stdout(JSON.stringify(result));
  return { exitCode: result.classification === "passed" ? 0 : 1, result };
}

interface RuntimeSoakConfig {
  scenario: RuntimeSoakScenario;
  controls: Record<string, RuntimeSoakCommand>;
  probe: RuntimeSoakCommand;
}

function parseArgs(args: string[]): { configPath: string; reportRoot: string } {
  let configPath: string | undefined;
  let reportRoot: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || (flag !== "--config" && flag !== "--report-root")) {
      throw new Error("Usage: npm run runtime:soak -- --config <file> --report-root <directory>");
    }
    if (flag === "--config" && !configPath) configPath = path.resolve(value);
    else if (flag === "--report-root" && !reportRoot) reportRoot = path.resolve(value);
    else throw new Error(`Duplicate runtime soak option: ${flag}`);
  }
  if (!configPath || !reportRoot) {
    throw new Error("Both --config and --report-root are required.");
  }
  return { configPath, reportRoot };
}

function parseConfig(value: unknown): RuntimeSoakConfig {
  if (!record(value) || value.version !== 1 || !record(value.scenario) ||
    !record(value.controls) || !command(value.probe)) {
    throw new Error("Runtime soak config is invalid.");
  }
  const scenario = validateRuntimeSoakScenario(value.scenario as unknown as RuntimeSoakScenario);
  const actionIds = new Set(scenario.actions.map((action) => action.action_id));
  const controls: Record<string, RuntimeSoakCommand> = {};
  for (const [actionId, control] of Object.entries(value.controls)) {
    if (!actionIds.has(actionId) || !command(control)) {
      throw new Error("Runtime soak control configuration is invalid.");
    }
    controls[actionId] = structuredClone(control);
  }
  if (Object.keys(controls).length !== actionIds.size) {
    throw new Error("Every runtime soak action requires exactly one control command.");
  }
  return { scenario, controls, probe: structuredClone(value.probe) };
}

function command(value: unknown): value is RuntimeSoakCommand {
  return record(value) && Array.isArray(value.argv) && value.argv.length > 0 &&
    value.argv.every((part) => typeof part === "string" && part.length > 0) &&
    (value.cwd === undefined || (typeof value.cwd === "string" && path.isAbsolute(value.cwd))) &&
    (value.timeout_ms === undefined || (Number.isSafeInteger(value.timeout_ms) && Number(value.timeout_ms) > 0));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runRuntimeSoakCommand(process.argv.slice(2))
    .then(({ exitCode }) => { process.exitCode = exitCode; })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
