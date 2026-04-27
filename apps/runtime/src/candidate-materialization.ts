import type { CandidateMaterializationOutcome } from "@autokairos/domain";
import type { LocalStore } from "@autokairos/local-store";
import type { CandidateGenerationRequest, RuntimeProviderAdapter } from "./providers/runtime-provider-adapter";

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
