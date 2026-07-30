import { describe, expect, it, vi } from "vitest";
import {
  createOperatorController
} from "./operator";
import {
  OperatorReadError,
  type OperatorService
} from "../services/operator";

describe("OperatorController Research detail reads", () => {
  it("returns a stable exact miss for an overlong Research work-item id", async () => {
    const overlongId = `research-session-v1-${"a".repeat(181)}`;
    const readResearchSessionDetail = vi.fn().mockResolvedValue(undefined);
    const controller = createOperatorController(
      researchDetailServiceStub(readResearchSessionDetail)
    );

    await expect(controller.readResearchSessionDetail(overlongId))
      .resolves.toEqual({
        statusCode: 404,
        body: {
          error: "research_session_not_found",
          research_work_item_id: overlongId
        }
      });
    expect(readResearchSessionDetail).toHaveBeenCalledWith(overlongId);
  });

  it("translates a typed Research projection failure into the stable unavailable response", async () => {
    const service = researchDetailServiceStub(
      vi.fn().mockRejectedValue(new OperatorReadError(
        503,
        "research_operations_unavailable",
        { availability: "unavailable" }
      ))
    );
    const controller = createOperatorController(service);

    await expect(controller.readResearchSessionDetail(
      `research-session-v1-${"b".repeat(64)}`
    ))
      .resolves.toEqual({
        statusCode: 503,
        body: {
          error: "research_operations_unavailable",
          availability: "unavailable"
        }
      });
  });

  it("does not swallow unexpected Research detail programmer errors", async () => {
    const programmerError = new Error("unexpected_programmer_error");
    const service = researchDetailServiceStub(
      vi.fn().mockRejectedValue(programmerError)
    );
    const controller = createOperatorController(service);

    await expect(controller.readResearchSessionDetail(
      `research-session-v1-${"c".repeat(64)}`
    ))
      .rejects.toBe(programmerError);
  });
});

function researchDetailServiceStub(
  readResearchSessionDetail: OperatorService["readResearchSessionDetail"]
): OperatorService {
  return { readResearchSessionDetail } as OperatorService;
}
