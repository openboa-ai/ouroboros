import { afterEach, describe, expect, it, vi } from "vitest";
import type { CandidateInspectReadModel } from "@ouroboros/domain";
import { observeTradingRun, runPaperEvidenceForCandidate, startTradingRun, stopTradingRun } from "./api";

const candidate = {
  candidate_id: "candidate-001",
  runtime: {
    ref: {
      record_kind: "trading_run",
      id: "trading-run-001"
    }
  }
} as CandidateInspectReadModel;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Slice 3 trading run MLP flow", () => {
  it("routes paper evidence and trading run actions through /api/commands", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        operator: {
          selected_paper_evidence: {
            status: "ledger_chain_complete"
          }
        },
        result: {
          status: "started",
          trading_run_id: "trading-run-001"
        }
      })
    } as Response);

    await runPaperEvidenceForCandidate("candidate-001");
    await startTradingRun(candidate);
    await observeTradingRun(candidate);
    await stopTradingRun(candidate);

    const requestBodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(requestBodies).toEqual([
      {
        command_kind: "candidate.paper_evidence.run",
        payload: { candidate_id: "candidate-001" }
      },
      {
        command_kind: "trading_run.start",
        payload: { candidate_id: "candidate-001" }
      },
      {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: "trading-run-001" }
      },
      {
        command_kind: "trading_run.stop",
        payload: { trading_run_id: "trading-run-001" }
      }
    ]);
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).toBe("http://127.0.0.1:4173/api/commands");
      expect(call[1]).toMatchObject({ method: "POST" });
    }
  });
});
