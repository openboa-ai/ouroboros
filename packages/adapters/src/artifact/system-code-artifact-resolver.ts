import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SystemCodeArtifactResolverPort } from "@ouroboros/application/ports/system-code-artifact";
import { sealSingleFileTradingArtifactClosure } from "@ouroboros/application/trading/research/artifact-closure";
import type { TradingSystemManifest } from "@ouroboros/application/trading/research/types";
import type { SystemCodeRecord } from "@ouroboros/domain";

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
  try {
    const { root, manifest } = await findGeneratedArtifactClosure(artifactPath);
    if (path.resolve(root, systemCode.entrypoint[1]!) !== artifactPath) {
      throw new Error("persisted entrypoint does not resolve to the generated artifact");
    }
    const sealed = await sealSingleFileTradingArtifactClosure(root, manifest);
    if (path.resolve(root, sealed.entrypoint_relative_path) !== artifactPath) {
      throw new Error("sealed entrypoint does not resolve to the generated artifact");
    }
    return sealed.closure_digest;
  } catch {
    throw new Error("generated_system_code_artifact_closure_invalid");
  }
}

async function findGeneratedArtifactClosure(artifactPath: string): Promise<{
  root: string;
  manifest: TradingSystemManifest;
}> {
  let directory = path.dirname(artifactPath);
  while (true) {
    const manifestBytes = await readFile(path.join(directory, "manifest.json"))
      .catch(() => undefined);
    if (manifestBytes) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(manifestBytes.toString("utf8"));
      } catch {
        manifest = undefined;
      }
      if (isGeneratedArtifactManifest(manifest) &&
        path.resolve(directory, manifest.entrypoint[1]) === artifactPath) {
        return { root: directory, manifest };
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("generated artifact closure root was not found");
}

function isGeneratedArtifactManifest(value: unknown): value is TradingSystemManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Record<string, unknown>;
  return Array.isArray(manifest.entrypoint) &&
    manifest.entrypoint.length === 2 &&
    (manifest.entrypoint[0] === "python" || manifest.entrypoint[0] === "python3") &&
    typeof manifest.entrypoint[1] === "string" &&
    manifest.entrypoint[1].length > 0 &&
    !path.isAbsolute(manifest.entrypoint[1]) &&
    Array.isArray(manifest.editable_paths) &&
    manifest.editable_paths.length === 1 &&
    manifest.editable_paths[0] === manifest.entrypoint[1] &&
    manifest.api_contract === "trading_api_provider_v1";
}

function immutableContainerDigest(imageRef: string): string {
  const match = imageRef.match(/@sha256:([a-f0-9]{64})$/i);
  if (!match?.[1]) {
    throw new Error("mutable_container_image_ref");
  }
  return `sha256:${match[1].toLowerCase()}`;
}
