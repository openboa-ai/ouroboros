import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SystemCodeArtifactResolverPort } from "@ouroboros/application/ports/system-code-artifact";
import {
  systemCodeArtifactClosureDigestInput,
  type SystemCodeRecord
} from "@ouroboros/domain";

export interface FileSystemCodeArtifactResolverOptions {
  repoRoot: string;
}

export class FileSystemCodeArtifactResolver implements SystemCodeArtifactResolverPort {
  private readonly repoRoot: string;

  constructor(options: FileSystemCodeArtifactResolverOptions) {
    this.repoRoot = path.resolve(options.repoRoot);
  }

  async resolveArtifactDigest(systemCode: SystemCodeRecord): Promise<string> {
    if (systemCode.artifact_kind === "container_image") {
      return immutableContainerDigest(systemCode.image_ref);
    }
    const artifactPath = path.isAbsolute(systemCode.artifact_path)
      ? path.normalize(systemCode.artifact_path)
      : path.resolve(this.repoRoot, systemCode.artifact_path);
    if (systemCode.capability_policy_ref && [
      "candidate-arena-paper-system-code",
      "candidate-arena-research-source"
    ].includes(systemCode.capability_policy_ref.id)) {
      return resolveGeneratedArtifactClosureDigest(systemCode, artifactPath);
    }
    const bytes = await readFile(artifactPath);
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  }
}

async function resolveGeneratedArtifactClosureDigest(
  systemCode: SystemCodeRecord,
  artifactPath: string
): Promise<string> {
  const artifactDir = path.dirname(artifactPath);
  const artifactName = path.basename(artifactPath);
  const entries = await readdir(artifactDir, { withFileTypes: true }).catch(() => []);
  const expectedFiles = new Set(["manifest.json", artifactName]);
  if (entries.length !== expectedFiles.size || entries.some((entry) =>
    !entry.isFile() || entry.isSymbolicLink() || !expectedFiles.has(entry.name)
  )) {
    throw new Error("generated_system_code_artifact_closure_invalid");
  }

  let manifest: unknown;
  let manifestBytes: Buffer;
  let artifactBytes: Buffer;
  try {
    manifestBytes = await readFile(path.join(artifactDir, "manifest.json"));
    artifactBytes = await readFile(artifactPath);
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("generated_system_code_artifact_closure_invalid");
  }
  if (!isGeneratedArtifactManifest(manifest, artifactName) ||
    systemCode.entrypoint.length < 2 ||
    path.resolve(artifactDir, systemCode.entrypoint[1]!) !== artifactPath) {
    throw new Error("generated_system_code_artifact_closure_invalid");
  }
  const digestInput = systemCodeArtifactClosureDigestInput([
    {
      relative_path: "manifest.json",
      content_digest: sha256(manifestBytes)
    },
    {
      relative_path: artifactName,
      content_digest: sha256(artifactBytes)
    }
  ]);
  return sha256(Buffer.from(digestInput));
}

function isGeneratedArtifactManifest(
  value: unknown,
  artifactName: string
): value is {
  entrypoint: [string, string];
  editable_paths: [string];
  api_contract: "trading_api_provider_v1";
} {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Record<string, unknown>;
  return Array.isArray(manifest.entrypoint) &&
    manifest.entrypoint.length === 2 &&
    (manifest.entrypoint[0] === "python" || manifest.entrypoint[0] === "python3") &&
    manifest.entrypoint[1] === artifactName &&
    Array.isArray(manifest.editable_paths) &&
    manifest.editable_paths.length === 1 &&
    manifest.editable_paths[0] === artifactName &&
    manifest.api_contract === "trading_api_provider_v1";
}

function immutableContainerDigest(imageRef: string): string {
  const match = imageRef.match(/@sha256:([a-f0-9]{64})$/i);
  if (!match?.[1]) {
    throw new Error("mutable_container_image_ref");
  }
  return `sha256:${match[1].toLowerCase()}`;
}

function sha256(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
