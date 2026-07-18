import { describe, expect, it } from "vitest";
import {
  operatorRouteHref,
  parseOperatorRoute,
  type OperatorRoute
} from "./operator-route";

describe("Operator hash routes", () => {
  it("opens Arena by default and rejects unknown sections", () => {
    expect(parseOperatorRoute("")).toEqual({ section: "arena" });
    expect(parseOperatorRoute("#/unknown?system=ignored")).toEqual({ section: "arena" });
  });

  it("redirects documented query entrypoints into the new hash sections", () => {
    expect(parseOperatorRoute("", "?view=trading")).toEqual({ section: "trading" });
    expect(parseOperatorRoute("", "?view=arena")).toEqual({ section: "arena" });
    expect(parseOperatorRoute("", "?view=research")).toEqual({ section: "research" });
    expect(parseOperatorRoute("", "?view=details")).toEqual({ section: "evidence" });
    expect(parseOperatorRoute("", "?view=unknown")).toEqual({ section: "arena" });
    expect(parseOperatorRoute("#/research", "?view=trading")).toEqual({ section: "research" });
  });

  it("keeps Arena and Research selections URL-stable", () => {
    expect(parseOperatorRoute("#/arena?system=candidate%2Fone")).toEqual({
      section: "arena",
      selectedId: "candidate/one"
    });
    expect(parseOperatorRoute("#/research?session=research-7")).toEqual({
      section: "research",
      selectedId: "research-7"
    });
  });

  it("drops object selections from sections without a master-detail route", () => {
    expect(parseOperatorRoute("#/system?system=ignored")).toEqual({ section: "system" });
  });

  it("builds canonical hashes for navigation and selection", () => {
    const routes: Array<[OperatorRoute, string]> = [
      [{ section: "arena" }, "#/arena"],
      [{ section: "arena", selectedId: "candidate/one" }, "#/arena?system=candidate%2Fone"],
      [{ section: "research", selectedId: "session 2" }, "#/research?session=session+2"],
      [{ section: "trading" }, "#/trading"]
    ];

    for (const [route, expected] of routes) {
      expect(operatorRouteHref(route)).toBe(expected);
    }
  });
});
