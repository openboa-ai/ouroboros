import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const validatorPath = path.join(repoRoot, "scripts/check-pr-identity.mjs");
const execFileAsync = promisify(execFile);

describe("PR identity validator", () => {
  it("accepts matching pull-request metadata", async () => {
    const result = await runValidator([
      "--mode",
      "pull-request",
      "--head",
      "codex/OURO-200-pr-identity",
      "--base",
      "main",
      "--title",
      "[OURO-200] Validate PR identity",
      "--body",
      "OURO-200"
    ]);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("mode=pull-request");
    expect(result.stdout).toContain("issue=OURO-200");
    expect(result.stdout).toContain("PR_IDENTITY_RESULT valid");
  });

  it("accepts the template identifier with one terminal newline", async () => {
    const result = await runValidator(pullRequestArgs({ body: "OURO-200\n" }));

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("issue=OURO-200");
    expect(result.stdout).toContain("PR_IDENTITY_RESULT valid");
  });

  it.each([
    {
      name: "missing head",
      overrides: { head: undefined },
      error: "missing --head"
    },
    {
      name: "malformed head",
      overrides: { head: "feature/OURO-200" },
      error: "invalid --head: expected codex/OURO-NNN-short-slug"
    },
    {
      name: "missing title identity",
      overrides: { title: "Validate PR identity" },
      error:
        "invalid --title: expected [OURO-NNN] <short task title> with exactly one issue identifier"
    },
    {
      name: "duplicate title identity",
      overrides: { title: "[OURO-200] Compare with OURO-201" },
      error:
        "invalid --title: expected [OURO-NNN] <short task title> with exactly one issue identifier"
    },
    {
      name: "Linear URL body",
      overrides: { body: "https://linear.app/openboa/issue/OURO-200" },
      error: "invalid --body: expected exactly OURO-NNN"
    },
    {
      name: "prose body",
      overrides: { body: "OURO-200\n\nValidation details" },
      error: "invalid --body: expected exactly OURO-NNN"
    },
    {
      name: "conflicting identity",
      overrides: { title: "[OURO-201] Validate PR identity" },
      error: "identity mismatch: head=OURO-200 title=OURO-201 body=OURO-200"
    },
    {
      name: "missing base",
      overrides: { base: undefined },
      error: "missing --base"
    },
    {
      name: "base equals head",
      overrides: { base: "codex/OURO-200-pr-identity" },
      error: "invalid --base: must identify a branch different from --head"
    }
  ])("reports an actionable error for $name", async ({ overrides, error }) => {
    const result = await runValidator(pullRequestArgs(overrides));

    expect(result.code, scriptOutput(result)).toBe(2);
    expect(result.stderr).toContain(`ERROR ${error}`);
    expect(result.stderr).toContain("PR_IDENTITY_RESULT invalid");
  });

  it("accepts a linked issue worktree in local mode", async () => {
    const fixture = await createGitFixture("codex/OURO-200-pr-identity");
    try {
      const result = await runValidator(["--mode", "local"], fixture.worktree);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("mode=local");
      expect(result.stdout).toContain("issue=OURO-200");
      expect(result.stdout).toContain("PR_IDENTITY_RESULT valid");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects the root control checkout in local mode", async () => {
    const fixture = await createGitFixture("codex/OURO-200-pr-identity");
    try {
      const result = await runValidator(["--mode", "local"], fixture.repo);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stderr).toContain(
        "ERROR invalid worktree: root control checkout is not an implementation workspace"
      );
      expect(result.stderr).toContain("PR_IDENTITY_RESULT invalid");
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    {
      name: "detached HEAD",
      branch: undefined,
      error: "invalid branch: linked worktree must check out codex/OURO-NNN-short-slug"
    },
    {
      name: "malformed branch",
      branch: "codex/workflow-cleanup",
      error: "invalid branch: linked worktree must check out codex/OURO-NNN-short-slug"
    }
  ])("rejects $name in a linked worktree", async ({ branch, error }) => {
    const fixture = await createGitFixture(branch);
    try {
      const result = await runValidator(["--mode", "local"], fixture.worktree);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stderr).toContain(`ERROR ${error}`);
      expect(result.stderr).toContain("PR_IDENTITY_RESULT invalid");
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    {
      name: "unknown option",
      args: [...pullRequestArgs(), "--comment", "bot-generated linkback"],
      error: "unknown option: --comment"
    },
    {
      name: "duplicate option",
      args: [...pullRequestArgs(), "--body", "OURO-201"],
      error: "duplicate option: --body"
    },
    {
      name: "local-only option in pull-request mode",
      args: [...pullRequestArgs(), "--repo", repoRoot],
      error: "option --repo is not valid for pull-request mode"
    },
    {
      name: "pull-request-only option in local mode",
      args: ["--mode", "local", "--head", "codex/OURO-200-pr-identity"],
      error: "option --head is not valid for local mode"
    }
  ])("rejects $name instead of ignoring ambiguous input", async ({ args, error }) => {
    const result = await runValidator(args);

    expect(result.code, scriptOutput(result)).toBe(1);
    expect(result.stderr).toContain(`ERROR ${error}`);
  });
});

function pullRequestArgs(overrides: Partial<{
  head: string;
  base: string;
  title: string;
  body: string;
}> = {}): string[] {
  const input = {
    head: "codex/OURO-200-pr-identity",
    base: "main",
    title: "[OURO-200] Validate PR identity",
    body: "OURO-200",
    ...overrides
  };
  return [
    "--mode",
    "pull-request",
    ...Object.entries(input).flatMap(([name, value]) =>
      value === undefined ? [] : [`--${name}`, value]
    )
  ];
}

function runValidator(args: string[], cwd = repoRoot) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [validatorPath, ...args], {
      cwd,
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

async function createGitFixture(branch: string | undefined): Promise<{
  repo: string;
  worktree: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "ouroboros-pr-identity-"));
  const repo = path.join(root, "repo");
  const worktree = path.join(root, "issue-worktree");
  await execFileAsync("git", ["init", "-b", "main", repo]);
  await writeFile(path.join(repo, "README.md"), "fixture\n", "utf8");
  await execFileAsync("git", ["-C", repo, "add", "README.md"]);
  await execFileAsync("git", [
    "-C",
    repo,
    "-c",
    "user.name=Ouroboros Test",
    "-c",
    "user.email=ouroboros-test@example.invalid",
    "commit",
    "-m",
    "fixture"
  ]);
  if (branch) {
    await execFileAsync("git", ["-C", repo, "worktree", "add", "-b", branch, worktree]);
  } else {
    await execFileAsync("git", ["-C", repo, "worktree", "add", "--detach", worktree]);
  }
  return {
    repo,
    worktree,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
