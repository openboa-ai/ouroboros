import { describe, it, expect } from "vitest";
import { artifactAt } from "./artifacts";
describe("retained sample publication references", () => {
  it("loads distinct prior content instead of the latest manifest", () => {
    const old = artifactAt("position-review", 11)!;
    const current = artifactAt("position-review", 12)!;
    expect(JSON.parse(old.content).position_btc).toBe("0.15");
    expect(JSON.parse(current.content).position_btc).toBe("0.20");
    expect(old.path).toBe(current.path);
  });
  it("does not substitute a revision when an exact reference is missing", () => {
    expect(artifactAt("position-review", 99)).toBeUndefined();
    expect(artifactAt("funding-review", 12)).toBeUndefined();
  });
});
