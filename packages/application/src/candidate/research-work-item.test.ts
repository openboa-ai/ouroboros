import { describe, expect, it } from "vitest";
import {
  canonicalResearchWorkItemIdentityKey,
  researchWorkItemId
} from "./research-work-item";

describe("Research work-item identity", () => {
  it("uses one stable canonical key order", () => {
    expect(canonicalResearchWorkItemIdentityKey({
      direction_kind: "trend_following",
      research_allocation_id: "allocation-1"
    })).toBe(
      '{"research_allocation_id":"allocation-1","direction_kind":"trend_following"}'
    );
  });

  it("separates directions within the same allocation", () => {
    expect(researchWorkItemId({
      research_allocation_id: "allocation-1",
      direction_kind: "trend_following"
    })).not.toBe(researchWorkItemId({
      research_allocation_id: "allocation-1",
      direction_kind: "mean_reversion"
    }));
  });

  it("separates the same direction across different allocations", () => {
    expect(researchWorkItemId({
      research_allocation_id: "allocation-1",
      direction_kind: "trend_following"
    })).not.toBe(researchWorkItemId({
      research_allocation_id: "allocation-2",
      direction_kind: "trend_following"
    }));
  });

  it("uses the exact versioned full SHA-256 digest format", () => {
    expect(researchWorkItemId({
      research_allocation_id: "allocation-1",
      direction_kind: "trend_following"
    })).toBe(
      "research-session-v1-3aa75ab2a2412b786278d243d349cdffe1235a1f26314e1fab0b4959b505dc3f"
    );
  });
});
