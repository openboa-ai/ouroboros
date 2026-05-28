import { describe, expect, it } from "vitest";
import {
  getOuroborosCommandDescriptor,
  isOuroborosCommandKind,
  OUROBOROS_COMMAND_DESCRIPTORS,
  OUROBOROS_COMMAND_KINDS,
  OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS,
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

  it("keeps the product loop command subset explicit and non-live", () => {
    expect(OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS).toEqual([
      "arena.status",
      "arena.start",
      "arena.stop",
      "arena.tick",
      "candidate.select",
      "trading_run.start",
      "trading_run.observe",
      "trading_run.stop",
      "agent_provider.status",
      "agent_provider.setup",
      "agent_provider.login.start",
      "agent_provider.probe",
      "researcher.provider.select"
    ]);

    for (const commandKind of OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS) {
      const descriptor = getOuroborosCommandDescriptor(commandKind);
      expect(OUROBOROS_COMMAND_KINDS).toContain(commandKind);
      expect(descriptor.authority_status).not.toBe("live");
    }
  });
});
