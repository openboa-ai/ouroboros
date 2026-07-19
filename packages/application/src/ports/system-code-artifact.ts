import type { SystemCodeRecord } from "@ouroboros/domain";

export interface SystemCodeArtifactResolution {
  artifact_digest: string;
  artifact_path?: string;
}

export interface SystemCodeArtifactResolverPort {
  resolveArtifactDigest(systemCode: SystemCodeRecord): Promise<string>;
  resolveArtifact?(
    systemCode: SystemCodeRecord
  ): Promise<SystemCodeArtifactResolution>;
}
