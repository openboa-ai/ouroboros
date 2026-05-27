import type { CandidateMaterializationOutcome } from "@ouroboros/domain";
import type { CandidateGenerationRequest, RuntimeProviderAdapter } from "./ports/provider-ports";
import type { OuroborosStorePort } from "./ports/store-ports";

export async function runCandidateGeneration(
  store: OuroborosStorePort,
  providerAdapter: RuntimeProviderAdapter,
  request: CandidateGenerationRequest
): Promise<CandidateMaterializationOutcome> {
  const providerResult = await providerAdapter.runCandidateGeneration(request);
  if (providerResult.status === "failed") {
    return store.recordCandidateMaterializationFailure(providerResult);
  }
  return store.materializeCandidate(providerResult.output);
}
