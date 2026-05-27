import type { CandidateMaterializationOutcome } from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import type { CandidateGenerationRequest, RuntimeProviderAdapter } from "@ouroboros/adapters/providers/runtime-provider-adapter";

export async function runCandidateGeneration(
  store: LocalStore,
  providerAdapter: RuntimeProviderAdapter,
  request: CandidateGenerationRequest
): Promise<CandidateMaterializationOutcome> {
  const providerResult = await providerAdapter.runCandidateGeneration(request);
  if (providerResult.status === "failed") {
    return store.recordCandidateMaterializationFailure(providerResult);
  }
  return store.materializeCandidate(providerResult.output);
}
