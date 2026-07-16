import { describe, expect, it } from "vitest";
import {
  adoptRuntimeProcessOwnership,
  closeRuntimeProcessOwnership,
  createRuntimeProcessOwnership,
  RuntimeProcessOwnershipDecisionError,
  runtimeProcessOwnershipHasRuntimeShape
} from "./index";

describe("RuntimeProcessOwnership", () => {
  it("binds one runtime scope to an exact same-host process identity", () => {
    const ownership = activeOwnership();

    expect(ownership).toMatchObject({
      record_kind: "runtime_process_ownership",
      version: 1,
      process_kind: "research_provider",
      subject_ref: { record_kind: "research_worker", id: "worker-1" },
      runtime_ref: {
        record_kind: "research_preflight_commitment",
        id: "preflight-1"
      },
      owner: {
        host_id: "host-a",
        process_id: 101,
        process_start_marker: "process-start-a"
      },
      executable: "/usr/local/bin/codex",
      profile_digest: `sha256:${"a".repeat(64)}`,
      session_token: "session-token-a",
      ownership_status: "active",
      adoption_count: 0,
      runtime_coordination_authority: true,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    });
    expect(runtimeProcessOwnershipHasRuntimeShape(ownership)).toBe(true);
  });

  it("records adoption and immutable terminal outcomes without changing identity", () => {
    const active = activeOwnership();
    const adopted = adoptRuntimeProcessOwnership({
      ownership: active,
      adoptedAt: "2026-07-15T00:00:01.000Z"
    });
    const closed = closeRuntimeProcessOwnership({
      ownership: adopted,
      terminalReason: "restart_terminated",
      closedAt: "2026-07-15T00:00:02.000Z"
    });

    expect(adopted).toMatchObject({
      ownership_status: "active",
      adoption_count: 1,
      last_adopted_at: "2026-07-15T00:00:01.000Z"
    });
    expect(closed).toMatchObject({
      ownership_status: "terminal",
      adoption_count: 1,
      terminal_reason: "restart_terminated",
      closed_at: "2026-07-15T00:00:02.000Z"
    });
    expect(closed.runtime_process_ownership_id)
      .toBe(active.runtime_process_ownership_id);
    expect(closed.owner).toEqual(active.owner);
    expect(closed.ownership_digest).not.toBe(active.ownership_digest);
    expect(runtimeProcessOwnershipHasRuntimeShape(closed)).toBe(true);
  });

  it.each([
    ["zero PID", (value: ReturnType<typeof ownershipInput>) => {
      value.owner.process_id = 0;
    }],
    ["missing process start marker", (value: ReturnType<typeof ownershipInput>) => {
      value.owner.process_start_marker = "";
    }],
    ["non-canonical executable", (value: ReturnType<typeof ownershipInput>) => {
      value.executable = " codex";
    }],
    ["invalid profile digest", (value: ReturnType<typeof ownershipInput>) => {
      value.profileDigest = "sha256:not-a-digest";
    }],
    ["missing runtime identity", (value: ReturnType<typeof ownershipInput>) => {
      value.runtimeRef.id = "";
    }]
  ])("rejects %s", (_name, mutate) => {
    const input = ownershipInput();
    mutate(input);

    expect(() => createRuntimeProcessOwnership(input))
      .toThrow(RuntimeProcessOwnershipDecisionError);
  });
});

function activeOwnership() {
  return createRuntimeProcessOwnership(ownershipInput());
}

function ownershipInput() {
  return {
    processKind: "research_provider" as const,
    subjectRef: { record_kind: "research_worker", id: "worker-1" },
    runtimeRef: {
      record_kind: "research_preflight_commitment",
      id: "preflight-1"
    },
    owner: {
      host_id: "host-a",
      process_id: 101,
      process_start_marker: "process-start-a"
    },
    executable: "/usr/local/bin/codex",
    profileDigest: `sha256:${"a".repeat(64)}`,
    sessionToken: "session-token-a",
    startedAt: "2026-07-15T00:00:00.000Z"
  };
}
