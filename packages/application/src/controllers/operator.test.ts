import { describe, expect, it, vi } from "vitest";
import {
  createOperatorController
} from "./operator";
import {
  OperatorReadError,
  type OperatorService
} from "../services/operator";

describe("OperatorController Research detail reads", () => {
  it("translates a typed Research projection failure into the stable unavailable response", async () => {
    const service = researchDetailServiceStub(
      vi.fn().mockRejectedValue(new OperatorReadError(
        503,
        "research_operations_unavailable",
        { availability: "unavailable" }
      ))
    );
    const controller = createOperatorController(service);

    await expect(controller.readResearchSessionDetail("research-session-v1-private"))
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

    await expect(controller.readResearchSessionDetail("research-session-v1-private"))
      .rejects.toBe(programmerError);
  });
});

function researchDetailServiceStub(
  readResearchSessionDetail: OperatorService["readResearchSessionDetail"]
): OperatorService {
  return { readResearchSessionDetail } as OperatorService;
}
