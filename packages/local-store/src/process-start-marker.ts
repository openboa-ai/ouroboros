import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

let cachedCurrentProcessStartMarker: string | undefined;

export function currentProcessStartMarker(): string {
  cachedCurrentProcessStartMarker ??=
    processStartMarkerSync(process.pid) ?? currentProcessFallbackStartMarker();
  return cachedCurrentProcessStartMarker;
}

export async function processStartMarker(pid: number): Promise<string | undefined> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  if (pid === process.pid) return currentProcessStartMarker();
  if (process.platform === "linux") {
    const marker = await linuxProcessStartMarker(pid);
    if (marker) return marker;
  }
  return posixProcessStartMarker(pid);
}

function processStartMarkerSync(pid: number): string | undefined {
  if (process.platform === "linux") {
    try {
      const statText = readFileSync(`/proc/${pid}/stat`, "utf8");
      const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
      const startTicks = linuxStartTicks(statText);
      if (bootId && startTicks) return `linux:${bootId}:${startTicks}`;
    } catch {
      // Fall through to the portable process-start lookup.
    }
  }
  try {
    const stdout = execFileSync(
      "/bin/ps",
      ["-p", String(pid), "-o", "lstart="],
      { encoding: "utf8", timeout: 1_000, maxBuffer: 16_384 }
    );
    return epochSecondMarker(stdout);
  } catch {
    return undefined;
  }
}

function currentProcessFallbackStartMarker(): string {
  const startedAtMs = Date.now() - (process.uptime() * 1_000);
  return `epoch-second:${Math.floor(startedAtMs / 1_000)}`;
}

async function linuxProcessStartMarker(pid: number): Promise<string | undefined> {
  try {
    const [statText, bootIdText] = await Promise.all([
      readFile(`/proc/${pid}/stat`, "utf8"),
      readFile("/proc/sys/kernel/random/boot_id", "utf8")
    ]);
    const bootId = bootIdText.trim();
    const startTicks = linuxStartTicks(statText);
    return bootId && startTicks ? `linux:${bootId}:${startTicks}` : undefined;
  } catch {
    return undefined;
  }
}

function linuxStartTicks(statText: string): string | undefined {
  const commandEnd = statText.lastIndexOf(")");
  if (commandEnd < 0) return undefined;
  const startTicks = statText.slice(commandEnd + 1).trim().split(/\s+/)[19];
  return startTicks && /^\d+$/.test(startTicks) ? startTicks : undefined;
}

function posixProcessStartMarker(pid: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      execFile(
        "/bin/ps",
        ["-p", String(pid), "-o", "lstart="],
        { encoding: "utf8", timeout: 1_000, maxBuffer: 16_384 },
        (error, stdout) => resolve(error ? undefined : epochSecondMarker(stdout))
      );
    } catch {
      resolve(undefined);
    }
  });
}

function epochSecondMarker(value: string): string | undefined {
  const startedAtMs = Date.parse(value.trim().replace(/\s+/g, " "));
  return Number.isFinite(startedAtMs)
    ? `epoch-second:${Math.floor(startedAtMs / 1_000)}`
    : undefined;
}
