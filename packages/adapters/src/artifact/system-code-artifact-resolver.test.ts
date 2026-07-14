import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

  it("requires CandidateArena generated Python artifacts to retain a single-file closure", async () => {
    const artifactDir = path.join(tmpDir, "generated");
    const script = await writeGeneratedArtifact(artifactDir);
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });
    const systemCode = generatedPythonSystemCode(script);

    const first = await resolver.resolveArtifactDigest(systemCode);
    expect(first).toBe(
      "sha256:a59805b441ad3e541c40549f15c2ca398d58e3fab1f5896a6a8adda29842fe56"
    );

    await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
      id: "generated",
      name: "Changed Generated Name",
      entrypoint: ["python3", "run.py"],
      editable_paths: ["run.py"],
      api_contract: "trading_api_provider_v1"
    }, null, 2)}\n`, "utf8");
    const second = await resolver.resolveArtifactDigest(systemCode);
    expect(second).not.toBe(first);

    await writeFile(path.join(artifactDir, "helper.py"), "SIDE = 'sell'\n", "utf8");
    await expect(resolver.resolveArtifactDigest(systemCode))
      .rejects.toThrow("generated_system_code_artifact_closure_invalid");
    await rm(path.join(artifactDir, "helper.py"));

    await symlink(script, path.join(artifactDir, "alias.py"));
    await expect(resolver.resolveArtifactDigest(systemCode))
      .rejects.toThrow("generated_system_code_artifact_closure_invalid");
  });

  it("resolves a generated artifact from the closure root when its entrypoint is nested", async () => {
    const artifactDir = path.join(tmpDir, "generated-nested");
    const scriptDir = path.join(artifactDir, "src");
    const script = path.join(scriptDir, "run.py");
    await mkdir(scriptDir, { recursive: true });
    await writeFile(script, "print('nested generated')\n", "utf8");
    await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
      id: "generated-nested",
      name: "Nested Generated",
      entrypoint: ["python3", "src/run.py"],
      editable_paths: ["src/run.py"],
      api_contract: "trading_api_provider_v1"
    }, null, 2)}\n`, "utf8");
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });

    await expect(resolver.resolveArtifactDigest(generatedPythonSystemCode(script)))
      .resolves.toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects generated artifact manifest drift before resolving paper bytes", async () => {
    const artifactDir = path.join(tmpDir, "manifest-drift");
    const script = await writeGeneratedArtifact(artifactDir);
    const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });
    const systemCode = generatedPythonSystemCode(script);

    await writeFile(path.join(artifactDir, "manifest.json"), JSON.stringify({
      id: "generated",
      name: "Generated",
      entrypoint: ["python3", "run.py"],
      editable_paths: ["run.py", "helper.py"],
      api_contract: "trading_api_provider_v1"
    }), "utf8");

    await expect(resolver.resolveArtifactDigest(systemCode))
      .rejects.toThrow("generated_system_code_artifact_closure_invalid");
  });
});

async function writeGeneratedArtifact(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  const script = path.join(root, "run.py");
  await writeFile(script, "print('generated')\n", "utf8");
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
    id: "generated",
    name: "Generated",
    entrypoint: ["python3", "run.py"],
    editable_paths: ["run.py"],
    api_contract: "trading_api_provider_v1"
  }, null, 2)}\n`, "utf8");
  return script;
}

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
      id: "test-python-system-code"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-10T09:00:00.000Z",
    authority_status: "not_live"
  };
}

function generatedPythonSystemCode(artifactPath: string): SystemCodeRecord {
  return {
    ...pythonSystemCode(artifactPath),
    system_code_id: "system-code-artifact-resolver-generated",
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    }
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
