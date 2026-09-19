import { describe, it, expect } from "vitest";
import { initialNavigation, navigationReducer as reduce } from "./navigation";
describe("shared investigation navigation", () => {
  it("returns from CEO conversation to the exact artifact and its predecessor", () => {
    let s = reduce(initialNavigation, {
      type: "open",
      target: { kind: "order", id: "buy", period: "day" },
    });
    s = reduce(s, {
      type: "open",
      target: {
        kind: "artifact",
        id: "position-review",
        revision: 11,
        period: "day",
      },
    });
    const original = s.stack;
    s = reduce(s, {
      type: "discuss",
      context: {
        label: "treasury / r11 / position-review.json",
        target: s.stack[1],
      },
    });
    expect(s.destination).toBe("conversations");
    expect(s.stack).toEqual([]);
    s = reduce(s, { type: "return" });
    expect(s.stack).toEqual(original);
    expect(s.destination).toBe("home");
    expect(reduce(s, { type: "back" }).stack).toEqual([original[0]]);
  });
  it("navigation does not silently transfer an inspector to a different destination", () => {
    const s = reduce(
      reduce(initialNavigation, {
        type: "open",
        target: { kind: "execution", id: "run-2" },
      }),
      { type: "navigate", destination: "library" },
    );
    expect(s.stack).toEqual([]);
    expect(s.destination).toBe("library");
  });
  it("clears context without changing the retained return location", () => {
    const s = reduce(initialNavigation, {
      type: "discuss",
      context: { label: "review", target: { kind: "artifact", id: "r8" } },
    });
    expect(reduce(s, { type: "clear-context" }).returnTo).toEqual(s.returnTo);
  });
});

it("retains resource category and query across a nested investigation", () => {
  let s = reduce(initialNavigation, {
    type: "open",
    target: { kind: "connections" },
  });
  s = reduce(s, {
    type: "patch-detail",
    patch: { tab: "resource", query: "runtime" },
  });
  s = reduce(s, {
    type: "open",
    target: { kind: "connections", id: "runtime" },
  });
  s = reduce(s, { type: "back" });
  expect(s.stack).toEqual([
    { kind: "connections", tab: "resource", query: "runtime" },
  ]);
});
