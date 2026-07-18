import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { statusVariant, StatusBadge } from "./operator-status";

describe("StatusBadge", () => {
  it("renders a neutral marker for terminal states instead of a loading indicator", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="stopped" />);

    expect(markup).toContain("lucide-circle");
    expect(markup).not.toContain("lucide-loader-circle");
  });

  it("does not classify negated or unsupported states as successful", () => {
    expect(statusVariant("not_configured")).toBe("outline");
    expect(statusVariant("unauthenticated")).toBe("outline");
    expect(statusVariant("not_running")).toBe("outline");
    expect(statusVariant("gateway_unavailable")).toBe("outline");
  });

  it("keeps positive, waiting, and failed status families distinct", () => {
    expect(statusVariant("configured")).toBe("success");
    expect(statusVariant("awaiting_selection")).toBe("warning");
    expect(statusVariant("running_degraded")).toBe("warning");
    expect(statusVariant("completed_with_errors")).toBe("warning");
    expect(statusVariant("failed_closed")).toBe("destructive");
  });
});
