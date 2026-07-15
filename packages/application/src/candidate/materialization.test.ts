import { describe, expect, it } from "vitest";
import { runCandidateGeneration } from "./materialization";
import type { RuntimeProviderAdapter } from "../ports/provider";
import type { OuroborosStorePort } from "../ports/store";

describe("legacy provider candidate materialization", () => {
  it("cannot turn provider output into a candidate without CandidateArena admission", async () => {
    await expect(runCandidateGeneration(
      {} as OuroborosStorePort,
      {} as RuntimeProviderAdapter,
      { prompt: "attempt direct provider materialization" }
    )).rejects.toThrow("candidate_generation_retired_use_candidate_arena");
  });
});
