import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  paperTradingEvidenceIntegrityReasons
} from "./qualification";

describe("application paper qualification compatibility", () => {
  it("exports the domain qualification baseline and treats a missing commitment as integrity failure", () => {
    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY.minObservationCount).toBe(30);
    expect(paperTradingEvidenceIntegrityReasons({
      evaluation: {} as never,
      observations: []
    })).toEqual(["paper_evaluation_commitment_missing"]);
  });
});
