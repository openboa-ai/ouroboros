import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  captureResearchExperimentBaseline,
  ensureResearchExperimentStoreCopy,
  verifyResearchExperimentBaseline
} from "../src/candidate/arena/research-experiment-baseline";
import {
  ensureResearchExperimentSourceArtifact,
  resolveResearchExperimentSource,
  verifyResearchExperimentSourceArtifact
} from "../src/candidate/arena/research-experiment-source";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-experiment-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ResearchExperiment baseline", () => {
  it("captures deterministic regular files while excluding all experiment evidence", async () => {
    const left = path.join(tmpDir, "left");
    const right = path.join(tmpDir, "right");
    await writeBaselineFixture(left, ["b.json", "nested/a.json"]);
    await writeBaselineFixture(right, ["nested/a.json", "b.json"]);

    const first = await captureResearchExperimentBaseline({
      root: left,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    const second = await captureResearchExperimentBaseline({
      root: right,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });

    expect(first).toEqual(second);
    expect(first).toEqual({
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      regular_file_count: 2,
      total_bytes: 4,
      exclusion_policy: "research_experiment_evidence_only"
    });
  });

  it.each([
    "research_control_campaign_evidence_only",
    "research_experiment_evidence_only"
  ] as const)("ignores study execution leases under %s", async (exclusionPolicy) => {
    const root = path.join(tmpDir, exclusionPolicy);
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "state.json"), "before\n", "utf8");
    const expected = await captureResearchExperimentBaseline({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000,
      exclusionPolicy
    });

    const leasePath = path.join(
      root,
      "research-control-study-execution-leases",
      "active",
      "study.lock",
      "lease.json"
    );
    await mkdir(path.dirname(leasePath), { recursive: true });
    await writeFile(leasePath, "runtime lease\n", "utf8");

    await expect(verifyResearchExperimentBaseline({
      root,
      expected,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    })).resolves.toBeUndefined();
  });

  it.each([
    ["empty", async (_root: string) => undefined,
      "research_experiment_baseline_empty"],
    ["temporary file", async (root: string) => {
      await writeFile(path.join(root, "record.json.tmp"), "partial", "utf8");
    }, "research_experiment_baseline_temporary_file"],
    ["symlink", async (root: string) => {
      await writeFile(path.join(root, "target.json"), "target", "utf8");
      await symlink("target.json", path.join(root, "link.json"));
    }, "research_experiment_baseline_unsupported_entry"],
    ["file bound", async (root: string) => {
      await writeFile(path.join(root, "a.json"), "a", "utf8");
      await writeFile(path.join(root, "b.json"), "b", "utf8");
    }, "research_experiment_baseline_file_bound_exceeded"],
    ["byte bound", async (root: string) => {
      await writeFile(path.join(root, "a.json"), "12345", "utf8");
    }, "research_experiment_baseline_byte_bound_exceeded"]
  ])("rejects %s", async (label, prepare, code) => {
    const root = path.join(tmpDir, String(label).replaceAll(" ", "-"));
    await mkdir(root, { recursive: true });
    await prepare(root);

    await expect(captureResearchExperimentBaseline({
      root,
      maximumRegularFileCount: label === "file bound" ? 1 : 10,
      maximumTotalBytes: label === "byte bound" ? 4 : 1_000
    })).rejects.toMatchObject({ code });
  });

  it("verifies and atomically copies one exact frozen store", async () => {
    const sourceRoot = path.join(tmpDir, "copy-source");
    const destinationRoot = path.join(tmpDir, "copies/baseline");
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(path.join(sourceRoot, "state.json"), "before\n", "utf8");
    const expected = await captureResearchExperimentBaseline({
      root: sourceRoot,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });

    await ensureResearchExperimentStoreCopy({
      sourceRoot,
      destinationRoot,
      expected,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    await verifyResearchExperimentBaseline({
      root: destinationRoot,
      expected,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    expect((await readdir(path.dirname(destinationRoot))).sort()).toEqual([
      "baseline"
    ]);

    await writeFile(path.join(destinationRoot, "state.json"), "after\n", "utf8");
    await expect(ensureResearchExperimentStoreCopy({
      sourceRoot,
      destinationRoot,
      expected,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    })).rejects.toMatchObject({
      code: "research_experiment_baseline_digest_mismatch"
    });
  });
});

describe("ResearchExperiment source", () => {
  it("binds and verifies one exact single-file TradingSystem closure", async () => {
    const repoRoot = path.join(tmpDir, "repo");
    const artifactDirectory = path.join(repoRoot, "artifacts/trading-system");
    const fixturePath = path.join(repoRoot, "fixtures/trading-systems/clock.py");
    const destinationRoot = path.join(tmpDir, "source-copy");
    await mkdir(path.dirname(artifactDirectory), { recursive: true });
    await cp(path.resolve("artifacts/trading-system"), artifactDirectory, {
      recursive: true
    });
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await cp(path.resolve("fixtures/trading-systems/clock.py"), fixturePath);
    const store = new LocalStore(path.join(tmpDir, "store"));
    await store.initialize();

    const resolved = await resolveResearchExperimentSource({
      store,
      candidateId: FIXTURE_CANDIDATE_ID,
      repoRoot
    });
    expect(resolved.source).toMatchObject({
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: FIXTURE_CANDIDATE_ID
      },
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest:
        expect.stringMatching(/^sha256:[a-f0-9]{64}$/)
    });
    await ensureResearchExperimentSourceArtifact({
      sourceArtifactDirectory: resolved.artifactDirectory,
      destinationRoot,
      expectedClosureDigest:
        resolved.source.research_artifact_closure_digest
    });
    await verifyResearchExperimentSourceArtifact({
      artifactDirectory: destinationRoot,
      expectedClosureDigest:
        resolved.source.research_artifact_closure_digest
    });

    await writeFile(path.join(destinationRoot, "run.py"), "print('drift')\n", "utf8");
    await expect(verifyResearchExperimentSourceArtifact({
      artifactDirectory: destinationRoot,
      expectedClosureDigest:
        resolved.source.research_artifact_closure_digest
    })).rejects.toMatchObject({
      code: "research_experiment_source_artifact_mismatch"
    });
    await writeFile(path.join(artifactDirectory, "undeclared.py"), "pass\n", "utf8");
    await expect(resolveResearchExperimentSource({
      store,
      candidateId: FIXTURE_CANDIDATE_ID,
      repoRoot
    })).rejects.toMatchObject({
      code: "research_experiment_source_artifact_invalid"
    });
  });
});

async function writeBaselineFixture(
  root: string,
  regularFiles: string[]
): Promise<void> {
  for (const relativePath of regularFiles) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${path.basename(relativePath, ".json")}\n`, "utf8");
  }
  for (const collection of [
    "research-control-campaigns",
    "research-control-study-execution-leases",
    "research-control-study-outcomes",
    "research-memory-control-studies",
    "research-memory-control-pair-outcomes",
    "research-memory-control-study-outcomes"
  ]) {
    const evidencePath = path.join(root, collection, "items/evidence.json");
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, "excluded\n", "utf8");
  }
}
