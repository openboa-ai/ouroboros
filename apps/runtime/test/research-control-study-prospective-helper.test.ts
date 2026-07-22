import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fallingProspectivePricePath,
  prospectiveClock,
  prospectiveMarketData
} from
  "./helpers/research-control-study-prospective";

describe("prospectiveClock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("advances repeated reads while the wall clock is unchanged", () => {
    const startedAt = "2026-07-19T06:00:00.000Z";
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(startedAt));
    const clock = prospectiveClock(startedAt);

    const first = clock.now();
    const second = clock.now();

    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
  });

  it("keeps captured public market evidence at or before the caller clock", async () => {
    const startedAt = "2026-07-19T06:00:00.000Z";
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(startedAt));
    const clock = prospectiveClock(startedAt);
    const marketData = prospectiveMarketData({ now: clock.now });
    const capturedAt = clock.now();

    const [market, execution] = await Promise.all([
      marketData.readMarketSnapshot(),
      marketData.readPublicExecutionSnapshot()
    ]);

    expect(Date.parse(market.observed_at)).toBeLessThanOrEqual(
      Date.parse(capturedAt)
    );
    expect(Date.parse(execution.observed_at)).toBeLessThanOrEqual(
      Date.parse(capturedAt)
    );
  });

  it("keeps the prospective price path falling through the integration timeout", () => {
    const startedAt = "2026-07-19T06:00:00.000Z";
    const priceAt = fallingProspectivePricePath(startedAt);
    const beforeTimeout = new Date(
      Date.parse(startedAt) + 480_000 - 25
    ).toISOString();
    const atTimeout = new Date(
      Date.parse(startedAt) + 480_000
    ).toISOString();

    expect(priceAt(beforeTimeout)).toBeGreaterThan(priceAt(atTimeout));
  });
});
