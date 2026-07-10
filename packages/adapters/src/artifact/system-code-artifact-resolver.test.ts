import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SystemCodeRecord } from "@ouroboros/domain";
import { FileSystemCodeArtifactResolver } from "./system-code-artifact-resolver";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-artifact-digest-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("FileSystemCodeArtifactResolver", () => {
  it("changes the resolved digest when executable bytes change", async () => {
    const script = path.join(tmpDir, "candidate.py");
    await writeFile(script, "print('first')\n", "utf8");
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });

    const first = await resolver.resolveArtifactDigest(pythonSystemCode(script));
    await writeFile(script, "print('second')\n", "utf8");
    const second = await resolver.resolveArtifactDigest(pythonSystemCode(script));

    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });

  it("resolves relative Python artifacts against the configured repository root", async () => {
    const script = path.join(tmpDir, "candidate.py");
    await writeFile(script, "print('relative')\n", "utf8");
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });

    await expect(resolver.resolveArtifactDigest(pythonSystemCode("candidate.py")))
      .resolves.toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("requires a digest-qualified container image", async () => {
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });

    await expect(resolver.resolveArtifactDigest(containerSystemCode("repo/image:latest")))
      .rejects.toThrow("mutable_container_image_ref");
    await expect(resolver.resolveArtifactDigest(containerSystemCode(
      "repo/image@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ))).resolves.toBe(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });
});

function pythonSystemCode(artifactPath: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-artifact-resolver-python",
    artifact_kind: "python_file",
    artifact_path: artifactPath,
    artifact_digest: "sha256:stored-value",
    runtime_kind: "python",
    entrypoint: ["python3", artifactPath],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-10T09:00:00.000Z",
    authority_status: "not_live"
  };
}

function containerSystemCode(imageRef: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-artifact-resolver-container",
    artifact_kind: "container_image",
    image_ref: imageRef,
    artifact_digest: "sha256:stored-value",
    runtime_kind: "container_image",
    entrypoint: ["/app/run"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-10T09:00:00.000Z",
    authority_status: "not_live"
  };
}
