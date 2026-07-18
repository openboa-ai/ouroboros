import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperatorMetricStrip } from "./operator-metrics";

describe("OperatorMetricStrip", () => {
  it("wraps complete metric evidence instead of truncating it", () => {
    const markup = renderToStaticMarkup(
      <OperatorMetricStrip metrics={[{
        label: "Revenue / cost",
        value: "154.22 USDT / 27.80 USDT",
        detail: "Complete external paper evidence"
      }]} />
    );

    expect(markup).not.toContain("truncate");
    expect(markup).toContain("154.22 USDT / 27.80 USDT");
  });
});
