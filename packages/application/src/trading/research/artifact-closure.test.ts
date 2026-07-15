import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertSingleFileTradingArtifactClosure,
  restoreSingleFileTradingArtifactClosure,
  sealSingleFileTradingArtifactClosure,
  TradingArtifactClosureViolationError
} from "./artifact-closure";
import type { TradingSystemManifest } from "./types";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-artifact-closure-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("single-file TradingSystem artifact closure", () => {
  it("seals the exact manifest and entrypoint and accepts their canonical closure", async () => {
    const manifest = await writeArtifact(tmpDir);

    const sealed = await sealSingleFileTradingArtifactClosure(tmpDir, manifest);

    expect(sealed.entrypoint_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(sealed.closure_digest).toBe(
      "sha256:87fa93655d536d9a1a21ac15f7d71557bdec15a3c0dd0ade7a3cf1b64e518b49"
    );
    expect(sealed.files.map((file) => file.relative_path)).toEqual([
      "manifest.json",
      "run.py"
    ]);
    await expect(assertSingleFileTradingArtifactClosure(tmpDir, manifest)).resolves.toBeUndefined();
    await expect(restoreSingleFileTradingArtifactClosure(sealed)).resolves.toBe(false);
  });

  it("includes manifest bytes in the canonical closure digest", async () => {
    const manifest = await writeArtifact(tmpDir);
    const first = await sealSingleFileTradingArtifactClosure(tmpDir, manifest);
    const changedManifest = { ...manifest, name: "Changed Manifest Name" };
    await writeFile(
      path.join(tmpDir, "manifest.json"),
      `${JSON.stringify(changedManifest, null, 2)}\n`,
      "utf8"
    );

    const second = await sealSingleFileTradingArtifactClosure(tmpDir, changedManifest);

    expect(second.entrypoint_digest).toBe(first.entrypoint_digest);
    expect(second.closure_digest).not.toBe(first.closure_digest);
  });

  it("rejects undeclared files, directories, symlinks, and editable-path drift before execution", async () => {
    const cases: Array<{
      name: string;
      mutate: (manifest: TradingSystemManifest) => Promise<TradingSystemManifest>;
      reason: string;
    }> = [
      {
        name: "undeclared file",
        mutate: async (manifest) => {
          await writeFile(path.join(tmpDir, "helper.py"), "SIDE = 'buy'\n", "utf8");
          return manifest;
        },
        reason: "artifact_closure_unexpected_entry"
      },
      {
        name: "undeclared directory",
        mutate: async (manifest) => {
          await mkdir(path.join(tmpDir, "state"));
          return manifest;
        },
        reason: "artifact_closure_unexpected_entry"
      },
      {
        name: "symlink",
        mutate: async (manifest) => {
          await symlink(path.join(tmpDir, "run.py"), path.join(tmpDir, "alias.py"));
          return manifest;
        },
        reason: "artifact_closure_unexpected_entry"
      },
      {
        name: "editable path drift",
        mutate: async (manifest) => ({ ...manifest, editable_paths: ["run.py", "helper.py"] }),
        reason: "artifact_closure_manifest_invalid"
      }
    ];

    for (const testCase of cases) {
      await rm(tmpDir, { recursive: true, force: true });
      await mkdir(tmpDir, { recursive: true });
      const manifest = await testCase.mutate(await writeArtifact(tmpDir));

      await expect(assertSingleFileTradingArtifactClosure(tmpDir, manifest), testCase.name)
        .rejects.toMatchObject({
          name: "TradingArtifactClosureViolationError",
          code: testCase.reason,
          candidate_rejection: true
        });
    }
  });

  it("detects and restores entrypoint, manifest, added-file, and removed-file mutation", async () => {
    const manifest = await writeArtifact(tmpDir);
    const sealed = await sealSingleFileTradingArtifactClosure(tmpDir, manifest);

    await writeFile(path.join(tmpDir, "run.py"), "print('mutated')\n", "utf8");
    await writeFile(path.join(tmpDir, "manifest.json"), "{}\n", "utf8");
    await writeFile(path.join(tmpDir, "helper.py"), "print('hidden')\n", "utf8");

    await expect(restoreSingleFileTradingArtifactClosure(sealed)).resolves.toBe(true);
    await expect(readFile(path.join(tmpDir, "run.py"), "utf8")).resolves.toBe("print('sealed')\n");
    await expect(JSON.parse(await readFile(path.join(tmpDir, "manifest.json"), "utf8")))
      .toEqual(manifest);
    await expect(readdir(tmpDir)).resolves.toEqual(["manifest.json", "run.py"]);

    await rm(path.join(tmpDir, "run.py"));
    await expect(restoreSingleFileTradingArtifactClosure(sealed)).resolves.toBe(true);
    await expect(readFile(path.join(tmpDir, "run.py"), "utf8")).resolves.toBe("print('sealed')\n");
    await expect(restoreSingleFileTradingArtifactClosure(sealed)).resolves.toBe(false);
  });

  it("exports a candidate-attributable error rather than an infrastructure error", () => {
    const error = new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "invalid manifest"
    );

    expect(error).toMatchObject({
      name: "TradingArtifactClosureViolationError",
      code: "artifact_closure_manifest_invalid",
      candidate_rejection: true
    });
  });
});

async function writeArtifact(root: string): Promise<TradingSystemManifest> {
  const manifest: TradingSystemManifest = {
    id: "single-file-system",
    name: "Single File System",
    entrypoint: ["python3", "run.py"],
    editable_paths: ["run.py"],
    api_contract: "trading_api_provider_v1"
  };
  await writeFile(path.join(root, "run.py"), "print('sealed')\n", "utf8");
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}
