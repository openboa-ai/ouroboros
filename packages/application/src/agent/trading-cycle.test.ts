import { describe, expect, it } from "vitest";
import {
  runAgentTradingCycle,
  type RunAgentTradingCycleInput
} from "./trading-cycle";

describe("legacy agent trading cycle", () => {
  it("cannot bypass CandidateArena admission and materialize research output", async () => {
    await expect(runAgentTradingCycle({} as RunAgentTradingCycleInput)).rejects.toThrow(
      "agent_trading_cycle_retired_use_candidate_arena"
    );
  });
});
