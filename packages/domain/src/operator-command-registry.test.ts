import { describe, expect, it } from "vitest";
import {
  getOuroborosCommandDescriptor,
  isOuroborosCommandKind,
  OUROBOROS_COMMAND_DESCRIPTORS,
  OUROBOROS_COMMAND_KINDS,
  OUROBOROS_COMMAND_REGISTRY
} from "./index";

describe("Ouroboros command registry", () => {
  it("keeps command descriptors and registry coverage aligned", () => {
    expect(OUROBOROS_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.command_kind))
      .toEqual(OUROBOROS_COMMAND_KINDS);
    expect(Object.keys(OUROBOROS_COMMAND_REGISTRY)).toEqual(OUROBOROS_COMMAND_KINDS);
    expect(getOuroborosCommandDescriptor("candidate.paper_evidence.run")).toMatchObject({
      command_kind: "candidate.paper_evidence.run",
      group: "candidate",
      requires_candidate_id: true,
      authority_status: "not_live"
    });
  });

  it("validates command kinds through the shared registry", () => {
    expect(isOuroborosCommandKind("arena.tick")).toBe(true);
    expect(isOuroborosCommandKind("codex.runtime.setup")).toBe(false);
  });
});
