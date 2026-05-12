import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtifactRunResult,
  ReplayTradingApiProviderSession,
  TradingSystemEvent,
  TradingSystemManifest
} from "./types";

const execFileAsync = promisify(execFile);

export interface TradingArtifactRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  provider: ReplayTradingApiProviderSession;
  output_dir: string;
  timeout_ms?: number;
}

export async function runTradingArtifact(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
  await mkdir(input.output_dir, { recursive: true });
  const eventsPath = path.join(input.output_dir, "events.jsonl");
  await rm(eventsPath, { force: true });

  const [command, ...args] = input.manifest.entrypoint;
  if (!command) {
    throw new Error("Trading artifact manifest entrypoint is empty");
  }

  try {
    const result = await execFileAsync(command, [...args, "--output-events", eventsPath], {
      cwd: input.artifact_dir,
      timeout: input.timeout_ms ?? 30_000,
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...process.env,
        TRADING_API_BASE_URL: input.provider.base_url
      }
    });
    const events = await readEvents(eventsPath);
    return {
      status: "completed",
      artifact_dir: input.artifact_dir,
      entrypoint: input.manifest.entrypoint,
      events_path: eventsPath,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      events,
      provider_requests: input.provider.requests()
    };
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      code?: number | string;
    };
    return {
      status: "crashed",
      artifact_dir: input.artifact_dir,
      entrypoint: input.manifest.entrypoint,
      events_path: eventsPath,
      stdout: String(processError.stdout ?? ""),
      stderr: String(processError.stderr ?? ""),
      exit_code: typeof processError.code === "number" ? processError.code : undefined,
      events: await readEventsIfPresent(eventsPath),
      provider_requests: input.provider.requests(),
      error: processError.message
    };
  }
}

export async function readTradingSystemManifest(artifactDir: string): Promise<TradingSystemManifest> {
  const raw = await readFile(path.join(artifactDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as TradingSystemManifest;
  if (!Array.isArray(manifest.entrypoint) || manifest.entrypoint.length === 0) {
    throw new Error("Trading system manifest must include a non-empty entrypoint");
  }
  if (manifest.api_contract !== "trading_api_provider_v1") {
    throw new Error("Trading system manifest must use trading_api_provider_v1");
  }
  return manifest;
}

async function readEventsIfPresent(eventsPath: string): Promise<TradingSystemEvent[]> {
  try {
    return await readEvents(eventsPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readEvents(eventsPath: string): Promise<TradingSystemEvent[]> {
  const raw = await readFile(eventsPath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TradingSystemEvent);
}
