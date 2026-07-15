import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const frontierPath = path.join(repoRoot, "scripts/check-pr-frontier.mjs");
const execFileAsync = promisify(execFile);

describe("PR frontier integration", () => {
  it("runs identity and scope components for pull-request metadata", async () => {
    const fixture = await createGitFixture();
    try {
      await fixture.write("src/feature.ts", "export const feature = true;\n");
      const head = await fixture.commit("add feature");

      const result = await runFrontier(pullRequestArgs(fixture.repo, fixture.base, head));

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PR_IDENTITY_RESULT valid");
      expect(result.stdout).toContain('"record_kind": "pr_scope_report"');
      expect(result.stdout).toContain('"result": "within_budget"');
    } finally {
      await fixture.cleanup();
    }
  });

  it("runs the same components from a direct local worktree push", async () => {
    const fixture = await createGitFixture();
    try {
      const worktree = await fixture.createWorktree("codex/OURO-202-frontier-ci");
      await worktree.write("src/local-feature.ts", "export const localFeature = true;\n");
      await worktree.commit("add local feature");

      const result = await runFrontier(["--mode", "local", "--repo", worktree.path]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("mode=local");
      expect(result.stdout).toContain("issue=OURO-202");
      expect(result.stdout).toContain('"result": "within_budget"');
    } finally {
      await fixture.cleanup();
    }
  });

  it("binds an over-budget atomicity rationale to the current head commit", async () => {
    const fixture = await createGitFixture();
    try {
      const content = Array.from(
        { length: 401 },
        (_, index) => `export const line${index} = ${index};`
      ).join("\n");
      await fixture.write("src/atomic-migration.ts", `${content}\n`);
      const rationale = "All lines implement one indivisible schema migration.";
      const head = await fixture.commit(`add atomic migration\n\nScope-Rationale: ${rationale}`);

      const result = await runFrontier(pullRequestArgs(fixture.repo, fixture.base, head));

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain('"result": "rationale_recorded"');
      expect(result.stdout).toContain(`"value": "${rationale}"`);
    } finally {
      await fixture.cleanup();
    }
  });

  it("preserves the split failure when an over-budget head has no rationale", async () => {
    const fixture = await createGitFixture();
    try {
      const content = Array.from(
        { length: 401 },
        (_, index) => `export const unshaped${index} = ${index};`
      ).join("\n");
      await fixture.write("src/unshaped-change.ts", `${content}\n`);
      const head = await fixture.commit("add unshaped change");

      const result = await runFrontier(pullRequestArgs(fixture.repo, fixture.base, head));

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain('"result": "rationale_required"');
      expect(result.stderr).toContain("split the frontier or provide --rationale");
    } finally {
      await fixture.cleanup();
    }
  });

  it("fails clearly when pull-request event metadata is missing", async () => {
    const fixture = await createGitFixture();
    try {
      const args = pullRequestArgs(fixture.repo, fixture.base, fixture.base);
      const bodyIndex = args.indexOf("--pr-body");
      args.splice(bodyIndex, 2);

      const result = await runFrontier(args);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ERROR missing --pr-body");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects option-shaped scope refs before invoking Git", async () => {
    const fixture = await createGitFixture();
    try {
      const args = pullRequestArgs(fixture.repo, fixture.base, "--all");

      const result = await runFrontier(args);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("ERROR missing or invalid --scope-head");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects unsupported event modes", async () => {
    const result = await runFrontier(["--mode", "push"]);

    expect(result.code, scriptOutput(result)).toBe(1);
    expect(result.stderr).toContain("ERROR --mode must be local or pull-request");
  });

  it("rejects pull-request-only metadata in local mode", async () => {
    const result = await runFrontier([
      "--mode",
      "local",
      "--repo",
      repoRoot,
      "--pr-title",
      "[OURO-202] Wrong context"
    ]);

    expect(result.code, scriptOutput(result)).toBe(1);
    expect(result.stderr).toContain("option --pr-title is not valid for local mode");
  });

  it("wires the local frontier check into pre-push without network tools", async () => {
    const hook = await readFile(path.join(repoRoot, ".githooks/pre-push"), "utf8");

    expect(hook).toContain("node scripts/check-pr-frontier.mjs --mode local --repo .");
    expect(hook).toContain("Skipping pre-push guards: no non-delete branch update.");
    expect(hook).toContain("ERROR push branches from their linked worktree.");
    expect(hook).not.toMatch(/\b(?:curl|gh)\b/);
  });

  it("skips cleanup pushes that contain no non-delete branch update", async () => {
    const zero = "0".repeat(40);
    const result = await runPrePush(`(delete) ${zero} refs/heads/old-branch deadbeef\n`);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("Skipping pre-push guards: no non-delete branch update.");
  });

  it("rejects pushing a branch other than the worktree branch", async () => {
    const head = await git(repoRoot, ["rev-parse", "HEAD"]);
    const zero = "0".repeat(40);
    const result = await runPrePush(
      `refs/heads/other ${head} refs/heads/other ${zero}\n`
    );

    expect(result.code, scriptOutput(result)).toBe(1);
    expect(result.stderr).toContain("ERROR push branches from their linked worktree.");
  });

  it("maps pull-request event metadata into one CI frontier check", async () => {
    const workflow = await readFile(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).not.toContain('- "codex/**"');
    expect(workflow).not.toContain('- "feat/**"');
    expect(workflow).toContain("if: github.event_name == 'pull_request'");
    expect(workflow).toContain("PR_HEAD: ${{ github.head_ref }}");
    expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("node scripts/check-pr-frontier.mjs");
    expect(workflow.match(/node scripts\/check-pr-frontier\.mjs/g)).toHaveLength(1);
  });

  it("keeps feature branches out of duplicate security workflow push runs", async () => {
    for (const filename of ["codeql.yml", "gitleaks.yml"]) {
      const workflow = await readFile(path.join(repoRoot, ".github/workflows", filename), "utf8");
      expect(workflow, filename).not.toContain('- "codex/**"');
      expect(workflow, filename).not.toContain('- "feat/**"');
    }
  });

  it("documents the current-head rationale and event contract", async () => {
    const docs = await readFile(path.join(repoRoot, "docs/development-workflow.md"), "utf8");

    expect(docs).toContain("Scope-Rationale: <reason>");
    expect(docs).toContain("feature-branch pushes do not duplicate pull-request CI");
  });
});

function pullRequestArgs(repo: string, base: string, head: string): string[] {
  return [
    "--mode",
    "pull-request",
    "--repo",
    repo,
    "--pr-head",
    "codex/OURO-202-frontier-ci",
    "--pr-base",
    "main",
    "--pr-title",
    "[OURO-202] Wire frontier checks",
    "--pr-body",
    "OURO-202",
    "--scope-base",
    base,
    "--scope-head",
    head
  ];
}

function runFrontier(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [frontierPath, ...args], {
      cwd: repoRoot,
      env: process.env,
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
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

function runPrePush(input: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn("bash", [path.join(repoRoot, ".githooks/pre-push"), "origin", "fixture"], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
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
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.stdin.end(input);
  });
}

async function createGitFixture(): Promise<{
  repo: string;
  base: string;
  write: (pathname: string, content: string) => Promise<void>;
  commit: (message: string) => Promise<string>;
  createWorktree: (branch: string) => Promise<{
    path: string;
    write: (pathname: string, content: string) => Promise<void>;
    commit: (message: string) => Promise<string>;
  }>;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "ouroboros-pr-frontier-"));
  const repo = path.join(root, "repo");
  await execFileAsync("git", ["init", "-b", "main", repo]);
  await writeFixtureFile(repo, "README.md", "fixture\n");
  await git(repo, ["add", "README.md"]);
  await commitFixture(repo, "fixture");
  const base = await git(repo, ["rev-parse", "HEAD"]);

  return {
    repo,
    base,
    write: (pathname, content) => writeFixtureFile(repo, pathname, content),
    commit: async (message) => {
      await git(repo, ["add", "--all"]);
      await commitFixture(repo, message);
      return git(repo, ["rev-parse", "HEAD"]);
    },
    createWorktree: async (branch) => {
      const worktree = path.join(root, "worktree");
      await git(repo, ["update-ref", "refs/remotes/origin/main", base]);
      await git(repo, ["worktree", "add", "-b", branch, worktree, base]);
      return {
        path: worktree,
        write: (pathname, content) => writeFixtureFile(worktree, pathname, content),
        commit: async (message) => {
          await git(worktree, ["add", "--all"]);
          await commitFixture(worktree, message);
          return git(worktree, ["rev-parse", "HEAD"]);
        }
      };
    },
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function writeFixtureFile(repo: string, pathname: string, content: string): Promise<void> {
  const target = path.join(repo, pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function commitFixture(repo: string, message: string) {
  return git(repo, [
    "-c",
    "user.name=Ouroboros Test",
    "-c",
    "user.email=ouroboros-test@example.invalid",
    "commit",
    "-m",
    message
  ]);
}

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repo, ...args]);
  return result.stdout.trim();
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
