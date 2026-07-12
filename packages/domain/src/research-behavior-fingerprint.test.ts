import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  researchBehaviorFingerprintDigestInput,
  researchBehaviorFingerprintHasRuntimeShape,
  type ResearchBehaviorFingerprintRecord
} from "./index";

describe("ResearchBehaviorFingerprint", () => {
  it("keys identity only by protocol, development suite, and normalized observations", () => {
    const first = fingerprintFixture();
    const second: ResearchBehaviorFingerprintRecord = {
      ...structuredClone(first),
      research_behavior_fingerprint_id: "behavior-fingerprint-other-code",
      research_preflight_commitment_ref: {
        record_kind: "research_preflight_commitment",
        id: "preflight-other-code"
      },
      research_preflight_commitment_digest: digest("preflight-other-code"),
      system_code_ref: { record_kind: "system_code", id: "system-code-other" },
      system_code_artifact_digest: digest("system-code-other"),
      created_at: "2026-07-12T12:00:00.000Z"
    };

    expect(researchBehaviorFingerprintDigestInput(second)).toBe(
      researchBehaviorFingerprintDigestInput(first)
    );
  });

  it("changes identity when protocol, suite, scenario, or effective decision changes", () => {
    const baseline = fingerprintFixture();
    const digestInput = researchBehaviorFingerprintDigestInput(baseline);
    const mutations: Array<(record: ResearchBehaviorFingerprintRecord) => void> = [
      (record) => {
        record.protocol_version =
          "research_behavior_fingerprint_v2" as typeof record.protocol_version;
      },
      (record) => {
        record.development_suite_version =
          "research_development_replay_v2" as typeof record.development_suite_version;
      },
      (record) => { record.development_suite_digest = digest("development-other"); },
      (record) => { record.observations[0]!.scenario_id = "development-other"; },
      (record) => {
        record.observations[0]!.decision.symbol =
          "ETHUSDT" as typeof record.observations[0]["decision"]["symbol"];
      },
      (record) => { record.observations[0]!.decision.side = "sell"; },
      (record) => { record.observations[0]!.decision.quantity = 0.01999999; },
      (record) => { record.observations[0]!.decision.order_type = "limit"; }
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(researchBehaviorFingerprintDigestInput(changed)).not.toBe(digestInput);
    }
  });

  it("accepts a complete sorted closed-authority record", () => {
    expect(researchBehaviorFingerprintHasRuntimeShape(fingerprintFixture())).toBe(true);
  });

  it.each([
    ["missing property", (record: any) => { delete record.observation_count; }],
    ["extra property", (record: any) => { record.score = 1; }],
    ["wrong record kind", (record: any) => { record.record_kind = "other"; }],
    ["wrong commitment ref", (record: any) => {
      record.research_preflight_commitment_ref.record_kind = "experiment_run";
    }],
    ["wrong SystemCode ref", (record: any) => {
      record.system_code_ref.record_kind = "candidate_version";
    }],
    ["invalid commitment digest", (record: any) => {
      record.research_preflight_commitment_digest = "sha256:short";
    }],
    ["invalid artifact digest", (record: any) => {
      record.system_code_artifact_digest = "pending";
    }],
    ["unknown protocol", (record: any) => {
      record.protocol_version = "research_behavior_fingerprint_v2";
    }],
    ["unknown suite", (record: any) => {
      record.development_suite_version = "research_development_replay_v2";
    }],
    ["invalid suite digest", (record: any) => {
      record.development_suite_digest = "suite";
    }],
    ["empty observations", (record: any) => { record.observations = []; record.observation_count = 0; }],
    ["unsorted observations", (record: any) => { record.observations.reverse(); }],
    ["duplicate scenarios", (record: any) => {
      record.observations[1].scenario_id = record.observations[0].scenario_id;
    }],
    ["extra observation property", (record: any) => {
      record.observations[0].score = 1;
    }],
    ["extra decision property", (record: any) => {
      record.observations[0].decision.reason = "not identity";
    }],
    ["empty scenario", (record: any) => { record.observations[0].scenario_id = ""; }],
    ["wrong symbol", (record: any) => { record.observations[0].decision.symbol = "ETHUSDT"; }],
    ["non-finite quantity", (record: any) => {
      record.observations[0].decision.quantity = Number.NaN;
    }],
    ["negative quantity", (record: any) => { record.observations[0].decision.quantity = -1; }],
    ["zero directional quantity", (record: any) => {
      record.observations[0].decision.quantity = 0;
    }],
    ["directional none order", (record: any) => {
      record.observations[0].decision.order_type = "none";
    }],
    ["hold market order", (record: any) => {
      record.observations[1].decision.order_type = "market";
    }],
    ["hold nonzero quantity", (record: any) => {
      record.observations[1].decision.quantity = 0.1;
    }],
    ["count mismatch", (record: any) => { record.observation_count += 1; }],
    ["invalid fingerprint digest", (record: any) => { record.fingerprint_digest = "pending"; }],
    ["non-canonical time", (record: any) => {
      record.created_at = "2026-07-12 10:00:00";
    }],
    ["duplicate authority removed", (record: any) => {
      record.duplicate_detection_authority = false;
    }],
    ["promotion authority", (record: any) => { record.promotion_authority = true; }],
    ["order authority", (record: any) => { record.order_submission_authority = true; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; }],
    ["wrong authority status", (record: any) => {
      record.authority_status = "not_live";
    }]
  ])("rejects invalid %s", (_label, mutate) => {
    const record = fingerprintFixture() as any;
    mutate(record);
    expect(researchBehaviorFingerprintHasRuntimeShape(record)).toBe(false);
  });
});

function fingerprintFixture(): ResearchBehaviorFingerprintRecord {
  return {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id: "behavior-fingerprint-system-code-001",
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: "preflight-tick-7-trend-following"
    },
    research_preflight_commitment_digest: digest("preflight"),
    system_code_ref: { record_kind: "system_code", id: "system-code-001" },
    system_code_artifact_digest: digest("system-code-001"),
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: "research_development_replay_v1",
    development_suite_digest: digest("development-suite"),
    observations: [
      {
        scenario_id: "development-long",
        decision: {
          symbol: "BTCUSDT",
          side: "buy",
          quantity: 0.02,
          order_type: "market"
        }
      },
      {
        scenario_id: "development-range",
        decision: {
          symbol: "BTCUSDT",
          side: "hold",
          quantity: 0,
          order_type: "none"
        }
      }
    ],
    observation_count: 2,
    fingerprint_digest: digest("behavior"),
    created_at: "2026-07-12T10:00:01.000Z",
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
