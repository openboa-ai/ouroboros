import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const reporterPath = path.join(repoRoot, "scripts/report-pr-scope.mjs");
const execFileAsync = promisify(execFile);

describe("PR scope reporter", () => {
  it("reports production, test, and documentation changes separately", async () => {
    const fixture = await createGitFixture();
    try {
      await fixture.write("src/feature.ts", "export const feature = true;\n");
      await fixture.write("apps/runtime/test/feature.test.ts", "export const covered = true;\n");
      await fixture.write("docs/feature.md", "# Feature\n");
      const head = await fixture.commit("add feature evidence");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({
        record_kind: "pr_scope_report",
        version: 1,
        result: "within_budget",
        categories: {
          production: {
            file_count: 1,
            additions: 1,
            deletions: 0,
            changed_lines: 1
          },
          tests: {
            file_count: 1,
            additions: 1,
            deletions: 0,
            changed_lines: 1
          },
          docs: {
            file_count: 1,
            additions: 1,
            deletions: 0,
            changed_lines: 1
          },
          generated: {
            file_count: 0,
            additions: 0,
            deletions: 0,
            changed_lines: 0
          }
        }
      });
      expect(report.categories.production.files).toEqual([
        { path: "src/feature.ts", additions: 1, deletions: 0, binary: false }
      ]);
      expect(report.categories.tests.files[0].path).toBe("apps/runtime/test/feature.test.ts");
      expect(report.categories.docs.files[0].path).toBe("docs/feature.md");
    } finally {
      await fixture.cleanup();
    }
  });

  it("identifies generated files without charging them to production scope", async () => {
    const fixture = await createGitFixture();
    try {
      await fixture.write("package-lock.json", "{}\n");
      await fixture.write("dist/operator.js", "export const bundled = true;\n");
      await fixture.write("src/client.generated.ts", "export const generated = true;\n");
      const head = await fixture.commit("add generated output");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.categories.production.file_count).toBe(0);
      expect(report.categories.generated).toMatchObject({
        file_count: 3,
        additions: 3,
        deletions: 0,
        changed_lines: 3
      });
      expect(report.categories.generated.files.map((file: { path: string }) => file.path)).toEqual([
        "dist/operator.js",
        "package-lock.json",
        "src/client.generated.ts"
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("requires an atomicity rationale after the production-file budget is crossed", async () => {
    const fixture = await createGitFixture();
    try {
      for (let index = 1; index <= 9; index += 1) {
        await fixture.write(`src/feature-${index}.ts`, `export const feature${index} = true;\n`);
      }
      const head = await fixture.commit("add nine production files");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({
        thresholds: { production_files: 8, production_changed_lines: 400 },
        over_budget: { files: true, lines: false, any: true },
        rationale: { provided: false, value: null },
        result: "rationale_required"
      });
      expect(result.stderr).toContain(
        "ERROR scope budget exceeded; split the frontier or provide --rationale"
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("requires an atomicity rationale after the production-line budget is crossed", async () => {
    const fixture = await createGitFixture();
    try {
      const content = Array.from({ length: 401 }, (_, index) => `export const line${index} = ${index};`).join("\n");
      await fixture.write("src/large-change.ts", `${content}\n`);
      const head = await fixture.commit("add large production change");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      const report = JSON.parse(result.stdout);
      expect(report.categories.production.changed_lines).toBe(401);
      expect(report.over_budget).toEqual({ files: false, lines: true, any: true });
      expect(report.result).toBe("rationale_required");
    } finally {
      await fixture.cleanup();
    }
  });

  it("charges both additions and deletions to production review load", async () => {
    const fixture = await createGitFixture();
    try {
      const original = Array.from(
        { length: 201 },
        (_, index) => `export const before${index} = ${index};`
      ).join("\n");
      await fixture.write("src/rewrite.ts", `${original}\n`);
      const base = await fixture.commit("seed production file");

      const replacement = Array.from(
        { length: 201 },
        (_, index) => `export const after${index} = ${index};`
      ).join("\n");
      await fixture.write("src/rewrite.ts", `${replacement}\n`);
      const head = await fixture.commit("rewrite production file");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      const report = JSON.parse(result.stdout);
      expect(report.categories.production).toMatchObject({
        additions: 201,
        deletions: 201,
        changed_lines: 402
      });
      expect(report.over_budget).toEqual({ files: false, lines: true, any: true });
      expect(report.result).toBe("rationale_required");
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps an over-budget diff reviewable when an atomicity rationale is recorded", async () => {
    const fixture = await createGitFixture();
    try {
      for (let index = 1; index <= 9; index += 1) {
        await fixture.write(`src/migration-${index}.ts`, `export const migration${index} = true;\n`);
      }
      const head = await fixture.commit("add atomic migration");
      const rationale = "All files implement one indivisible schema migration.";

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head,
        "--rationale",
        rationale
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.over_budget).toEqual({ files: true, lines: false, any: true });
      expect(report.rationale).toEqual({ provided: true, value: rationale });
      expect(report.result).toBe("rationale_recorded");
      expect(result.stderr).toContain("WARNING scope budget exceeded; atomicity rationale recorded");
    } finally {
      await fixture.cleanup();
    }
  });

  it("orders evidence by Git pathname bytes instead of the host locale", async () => {
    const fixture = await createGitFixture();
    try {
      await fixture.write("src/Z.ts", "export const upper = true;\n");
      await fixture.write("src/a.ts", "export const lower = true;\n");
      const head = await fixture.commit("add case-sensitive paths");

      const result = await runReporter([
        "--repo",
        fixture.repo,
        "--base",
        fixture.base,
        "--head",
        head
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.categories.production.files.map((file: { path: string }) => file.path)).toEqual([
        "src/Z.ts",
        "src/a.ts"
      ]);
    } finally {
      await fixture.cleanup();
    }
  });
});

function runReporter(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [reporterPath, ...args], {
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

async function createGitFixture(): Promise<{
  repo: string;
  base: string;
  write: (pathname: string, content: string | Buffer) => Promise<void>;
  commit: (message: string) => Promise<string>;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "ouroboros-pr-scope-"));
  const repo = path.join(root, "repo");
  await execFileAsync("git", ["init", "-b", "main", repo]);
  await writeFixtureFile(repo, "README.md", "fixture\n");
  await git(repo, ["add", "README.md"]);
  await git(repo, [
    "-c",
    "user.name=Ouroboros Test",
    "-c",
    "user.email=ouroboros-test@example.invalid",
    "commit",
    "-m",
    "fixture"
  ]);
  const base = await git(repo, ["rev-parse", "HEAD"]);

  return {
    repo,
    base,
    write: (pathname, content) => writeFixtureFile(repo, pathname, content),
    commit: async (message) => {
      await git(repo, ["add", "--all"]);
      await git(repo, [
        "-c",
        "user.name=Ouroboros Test",
        "-c",
        "user.email=ouroboros-test@example.invalid",
        "commit",
        "-m",
        message
      ]);
      return git(repo, ["rev-parse", "HEAD"]);
    },
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function writeFixtureFile(
  repo: string,
  pathname: string,
  content: string | Buffer
): Promise<void> {
  const target = path.join(repo, pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repo, ...args]);
  return result.stdout.trim();
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
