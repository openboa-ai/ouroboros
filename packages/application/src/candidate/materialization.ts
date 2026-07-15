import type { CandidateMaterializationOutcome } from "@ouroboros/domain";
import type { CandidateGenerationRequest, RuntimeProviderAdapter } from "../ports/provider";
import type { OuroborosStorePort } from "../ports/store";

/**
 * @deprecated CandidateArena is the only provider-output-to-materialization path.
 */
export async function runCandidateGeneration(
  _store: OuroborosStorePort,
  _providerAdapter: RuntimeProviderAdapter,
  _request: CandidateGenerationRequest
): Promise<CandidateMaterializationOutcome> {
  throw new Error("candidate_generation_retired_use_candidate_arena");
}
