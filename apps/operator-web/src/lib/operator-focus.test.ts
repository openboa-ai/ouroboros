import { describe, expect, it, vi } from "vitest";
import { focusNarrowDetail, OPERATOR_NARROW_DETAIL_QUERY } from "./operator-focus";

describe("Operator narrow detail focus", () => {
  it("focuses the detail entry point when the master pane becomes hidden", () => {
    const focus = vi.fn();
    const matches = vi.fn(() => true);

    focusNarrowDetail({ focus }, matches);

    expect(matches).toHaveBeenCalledWith(OPERATOR_NARROW_DETAIL_QUERY);
    expect(focus).toHaveBeenCalledOnce();
  });

  it("does not move focus in the persistent desktop master-detail layout", () => {
    const focus = vi.fn();

    focusNarrowDetail({ focus }, () => false);

    expect(focus).not.toHaveBeenCalled();
  });
});
