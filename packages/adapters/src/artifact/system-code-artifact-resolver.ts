import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SystemCodeArtifactResolverPort } from "@ouroboros/application/ports/system-code-artifact";
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
    const bytes = await readFile(artifactPath);
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  }
}

function immutableContainerDigest(imageRef: string): string {
  const match = imageRef.match(/@sha256:([a-f0-9]{64})$/i);
  if (!match?.[1]) {
    throw new Error("mutable_container_image_ref");
  }
  return `sha256:${match[1].toLowerCase()}`;
}
