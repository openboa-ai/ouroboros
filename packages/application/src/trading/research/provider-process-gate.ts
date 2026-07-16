import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const OWNED_PROVIDER_PROCESS_GATE_SOURCE = String.raw`
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [gateFile, file, ...args] = process.argv.slice(1);
const deadline = Date.now() + 120000;
let child;
const timer = setInterval(() => {
  let gateState;
  try {
    gateState = fs.readFileSync(gateFile, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      clearInterval(timer);
      process.exit(79);
    }
    if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(78);
    }
    return;
  }
  if (gateState !== "go\n") {
    if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(78);
    }
    return;
  }
  clearInterval(timer);
  try { fs.unlinkSync(gateFile); } catch {}
  child = spawn(file, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stdin.on("error", (error) => {
    if (!error || error.code !== "EPIPE") process.exitCode = 1;
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.once("error", () => process.exit(127));
  child.once("close", (code) => process.exit(code ?? 1));
}, 5);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child?.kill(signal));
}
`;

const OWNED_PROVIDER_PROCESS_GATE_SHELL = String.raw`#!/bin/sh
gate_file=$1
shift
attempt=0
while [ "$attempt" -lt 12000 ]; do
  gate_state=
  if [ -r "$gate_file" ]; then
    IFS= read -r gate_state < "$gate_file" || true
  fi
  if [ "$gate_state" = "go" ]; then
    rm -f -- "$gate_file"
    exec "$@"
  fi
  attempt=$((attempt + 1))
  sleep 0.01
done
exit 78
`;

export interface ProviderProcessGate {
  readonly stateFile: string;
  command(file: string, args: string[]): { file: string; args: string[] };
  release(): Promise<void>;
  cleanup(): Promise<void>;
}

export async function createProviderProcessGate(input: {
  sessionToken: string;
  root?: string;
  platform?: NodeJS.Platform;
}): Promise<ProviderProcessGate> {
  const root = input.root ?? tmpdir();
  const platform = input.platform ?? process.platform;
  const tokenDigest = createHash("sha256").update(input.sessionToken).digest("hex");
  const stateFile = path.join(root, `ouroboros-provider-ownership-${tokenDigest}.gate`);
  const scriptFile = platform === "win32"
    ? undefined
    : path.join(root, `ouroboros-provider-ownership-${tokenDigest}.sh`);

  try {
    await writeFile(stateFile, "wait\n", {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx"
    });
    if (scriptFile) {
      await writeFile(scriptFile, OWNED_PROVIDER_PROCESS_GATE_SHELL, {
        encoding: "utf8",
        mode: 0o700,
        flag: "wx"
      });
    }
  } catch (error) {
    await cleanupGateFiles(stateFile, scriptFile);
    throw error;
  }

  return {
    stateFile,
    command: (file, args) => platform === "win32"
      ? {
          file: process.execPath,
          args: ["-e", OWNED_PROVIDER_PROCESS_GATE_SOURCE, stateFile, file, ...args]
        }
      : {
          file: "/bin/sh",
          args: [scriptFile!, stateFile, file, ...args]
        },
    release: () => releaseProviderProcessGate(stateFile),
    cleanup: () => cleanupGateFiles(stateFile, scriptFile)
  };
}

async function releaseProviderProcessGate(stateFile: string): Promise<void> {
  await writeFile(stateFile, "go\n", { encoding: "utf8", mode: 0o600 });
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const consumed = await readFile(stateFile, "utf8").then(
      () => false,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return true;
        throw error;
      }
    );
    if (consumed) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("provider_ownership_gate_consumption_timeout");
}

async function cleanupGateFiles(
  stateFile: string,
  scriptFile: string | undefined
): Promise<void> {
  await Promise.all([
    rm(stateFile, { force: true }),
    ...(scriptFile ? [rm(scriptFile, { force: true })] : [])
  ]);
}
