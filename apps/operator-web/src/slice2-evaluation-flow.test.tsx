import { afterEach, describe, expect, it, vi } from "vitest";
import type { CandidateInspectReadModel } from "@ouroboros/domain";
import { recordImprovement } from "./api";

const candidate = {
  candidate_id: "candidate-001"
} as CandidateInspectReadModel;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Slice 2 evaluation flow", () => {
  it("runs candidate evaluation through the shared command endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        operator: {},
        result: {
          status: "created",
          evaluation: {
            evaluation_run: {
              evaluation_run_record_id: "evaluation-run-001"
            }
          }
        }
      })
    } as Response);

    const outcome = await recordImprovement(candidate);

    expect(outcome).toMatchObject({
      status: "created",
      evaluation: {
        evaluation_run: {
          evaluation_run_record_id: "evaluation-run-001"
        }
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          command_kind: "candidate.evaluation.run",
          payload: { candidate_id: "candidate-001" }
        })
      })
    );
  });
});
