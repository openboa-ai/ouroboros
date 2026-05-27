import { afterEach, describe, expect, it, vi } from "vitest";
import type { CandidateInspectReadModel } from "@ouroboros/domain";
import { recordRunControl } from "./api";

const candidate = {
  candidate_id: "candidate-001",
  candidate_version: {
    candidate_version_id: "candidate-version-001"
  }
} as CandidateInspectReadModel;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Slice 4 run control MLP flow", () => {
  it("records run control through the shared command endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        operator: {},
        result: {
          status: "recorded",
          decision: {
            resulting_lifecycle_status: "paused"
          }
        }
      })
    } as Response);

    const outcome = await recordRunControl(candidate);

    expect(outcome).toMatchObject({
      status: "recorded",
      decision: {
        resulting_lifecycle_status: "paused"
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"command_kind\":\"run_control.record\"")
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      command_kind: "run_control.record",
      payload: {
        candidate_id: "candidate-001",
        candidate_version_id: "candidate-version-001"
      }
    });
  });
});
