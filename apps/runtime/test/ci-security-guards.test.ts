import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("CI security guard scripts", () => {
  it("accepts the current GitHub workflows and action pin manifest", async () => {
    const result = await runNode([
      "scripts/check-github-workflows.mjs",
      "--workflows-dir",
      ".github/workflows",
      "--pins-file",
      ".github/action-pins.json"
    ]);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("GitHub workflow security checks passed");
  });

  it("rejects unpinned action refs", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    try {
      await writeWorkflow(tempDir, "ci.yml", workflowWithUses("actions/checkout@v6"));
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("actions/checkout@v6 must use a full 40-character commit SHA");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects workflows without top-level permissions", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    try {
      await writeWorkflow(tempDir, "ci.yml", `name: ci\non:\n  pull_request:\njobs: {}\n`);
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ci.yml: missing top-level permissions");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects pull_request_target workflows", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    try {
      await writeWorkflow(tempDir, "ci.yml", `name: ci\non:\n  pull_request_target:\npermissions:\n  contents: read\njobs: {}\n`);
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ci.yml: pull_request_target is not allowed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unexpected write permissions", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    try {
      await writeWorkflow(tempDir, "ci.yml", `name: ci\non:\n  pull_request:\npermissions:\n  contents: write\njobs: {}\n`);
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ci.yml: unexpected write permission contents: write");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unexpected job-level write permissions", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    try {
      await writeWorkflow(
        tempDir,
        "ci.yml",
        `name: ci
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps: []
`
      );
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ci.yml: job test has unexpected write permission contents: write");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects action SHAs missing from the manifest", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-workflow-guard-"));
    const checkoutSha = "de0fac2e4500dabe0009e67214ff5f5447ce83dd";
    try {
      await writeWorkflow(tempDir, "ci.yml", workflowWithUses(`actions/checkout@${checkoutSha}`));
      await writePins(tempDir, []);

      const result = await runNode([
        "scripts/check-github-workflows.mjs",
        "--workflows-dir",
        tempDir,
        "--pins-file",
        path.join(tempDir, "action-pins.json")
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain(`ci.yml: actions/checkout@${checkoutSha} is not listed in`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts the current package-lock install-script allowlist", async () => {
    const result = await runNode([
      "scripts/check-npm-install-scripts.mjs",
      "--package-lock",
      "package-lock.json"
    ]);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("npm install-script guard passed");
  });

  it("rejects unallowlisted npm install scripts", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-install-script-"));
    try {
      const lock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
      lock.packages["node_modules/untrusted-package"] = {
        version: "1.0.0",
        hasInstallScript: true
      };
      const lockPath = path.join(tempDir, "package-lock.json");
      await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

      const result = await runNode([
        "scripts/check-npm-install-scripts.mjs",
        "--package-lock",
        lockPath
      ]);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("node_modules/untrusted-package@1.0.0 has an unallowlisted install script");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

async function writeWorkflow(dir: string, name: string, body: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), body, "utf8");
}

async function writePins(dir: string, pins: Array<{ uses: string; tag: string }>): Promise<void> {
  await writeFile(
    path.join(dir, "action-pins.json"),
    `${JSON.stringify({ pins }, null, 2)}\n`,
    "utf8"
  );
}

function workflowWithUses(uses: string): string {
  return `name: ci
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ${uses}
`;
}

function runNode(args: string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on("error", reject);
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`;
}
