import type { SystemCodeRecord } from "@ouroboros/domain";

export interface SystemCodeArtifactResolverPort {
  resolveArtifactDigest(systemCode: SystemCodeRecord): Promise<string>;
}
