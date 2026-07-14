import { describe, expect, it } from "vitest";
import {
  PaperTradingHandoffConformanceInfrastructureError,
  evaluatePaperTradingHandoffProbe
} from "./paper-handoff-conformance";
import type { TradingArtifactPaperHandoffProbeResult } from "./types";

describe("paper handoff conformance evaluator", () => {
  it.each(["order_request", "hold", "no_action"] as const)(
    "accepts one bounded %s decision through the production paper protocol",
    (decisionKind) => {
      const result = evaluatePaperTradingHandoffProbe(probeFixture(decisionKind));

      expect(result).toEqual({
        status: "passed",
        reason: "passed",
        provider_request_count: 3,
        decision_event_kind: decisionKind,
        heartbeat_count: 1,
        runtime_stopped: true,
        runnable_paper_handoff: true
      });
    }
  );

  it.each(["hold", "no_action"] as const)(
    "accepts a %s decision without synthesizing an order validation request",
    (decisionKind) => {
      const probe = probeFixture(decisionKind);
      probe.provider_requests = probe.provider_requests.filter((request) =>
        request.path !== "/orders/validate"
      );

      expect(evaluatePaperTradingHandoffProbe(probe)).toEqual({
        status: "passed",
        reason: "passed",
        provider_request_count: 2,
        decision_event_kind: decisionKind,
        heartbeat_count: 1,
        runtime_stopped: true,
        runnable_paper_handoff: true
      });
    }
  );

  it("requires external order validation for an order_request decision", () => {
    const probe = probeFixture("order_request");
    probe.provider_requests = probe.provider_requests.filter((request) =>
      request.path !== "/orders/validate"
    );

    expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
      status: "rejected",
      reason: "provider_protocol_incomplete",
      runnable_paper_handoff: false
    });
  });

  it.each([
    ["runner crash", "runner_crash", (probe: any) => {
      probe.status = "crashed";
      probe.exit_code = 1;
      probe.error = "candidate exited 1";
    }],
    ["timeout", "execution_timed_out", (probe: any) => {
      probe.status = "crashed";
      probe.timed_out = true;
      probe.error = "candidate timed out";
    }],
    ["missing decision", "paper_decision_missing", (probe: any) => {
      probe.output_lines = probe.output_lines.slice(1);
    }],
    ["ambiguous decision", "paper_decision_ambiguous", (probe: any) => {
      probe.output_lines.unshift(probe.output_lines[0]);
    }],
    ["malformed paper event", "paper_event_invalid", (probe: any) => {
      probe.output_lines[0] = JSON.stringify({
        ...JSON.parse(probe.output_lines[0]),
        authority_status: "not_live"
      });
    }],
    ["wrong decision instance", "instance_identity_mismatch", (probe: any) => {
      probe.output_lines[0] = JSON.stringify({
        ...JSON.parse(probe.output_lines[0]),
        instance_id: "other-instance"
      });
    }],
    ["missing heartbeat", "runtime_heartbeat_missing", (probe: any) => {
      probe.output_lines = probe.output_lines.filter((line: string) =>
        JSON.parse(line).event !== "runtime_heartbeat"
      );
    }],
    ["missing stop", "runtime_stop_missing", (probe: any) => {
      probe.output_lines = probe.output_lines.filter((line: string) =>
        JSON.parse(line).event !== "runtime_stopped"
      );
    }],
    ["missing account request", "provider_protocol_incomplete", (probe: any) => {
      probe.provider_requests = probe.provider_requests.filter((request: any) =>
        request.path !== "/account/state"
      );
    }],
    ["failed provider request", "provider_protocol_incomplete", (probe: any) => {
      probe.provider_requests[0].response_status = 503;
    }],
    ["unexpected endpoint", "provider_protocol_violation", (probe: any) => {
      probe.provider_requests.push(providerRequest("GET", "/evaluation/outcome"));
    }],
    ["request budget", "provider_request_limit_exceeded", (probe: any) => {
      while (probe.provider_requests.length < 9) {
        probe.provider_requests.push(providerRequest("GET", "/market/snapshot"));
      }
    }],
    ["validation body mismatch", "provider_protocol_violation", (probe: any) => {
      probe.provider_requests[2].body.side = "sell";
    }],
    ["validation payload smuggling", "provider_protocol_violation", (probe: any) => {
      probe.provider_requests[2].body.undeclared_payload = true;
    }],
    ["provider read payload smuggling", "provider_protocol_violation", (probe: any) => {
      probe.provider_requests[0].body = { undeclared_payload: true };
    }],
    ["hidden evaluator field", "hidden_evaluator_field", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", expected_direction: "long" }));
    }],
    ["aliased hidden evaluator field", "hidden_evaluator_field", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", expectedDirection: "long" }));
    }],
    ["candidate profit claim", "candidate_self_report", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", net_revenue_usdt: 999 }));
    }],
    ["aliased candidate profit claim", "candidate_self_report", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", netRevenueUsdt: 999 }));
    }],
    ["private provider payload", "private_or_live_authority", (probe: any) => {
      probe.provider_requests[2].body.apiKey = "forbidden";
    }],
    ["private field", "private_or_live_authority", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", api_key: "forbidden" }));
    }],
    ["live field", "private_or_live_authority", (probe: any) => {
      probe.output_lines.push(JSON.stringify({ event: "diagnostic", runtime_environment: "live" }));
    }]
  ] as const)("rejects %s as %s", (_label, reason, mutate) => {
    const probe = probeFixture("order_request") as any;
    mutate(probe);

    expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
      status: "rejected",
      reason,
      runnable_paper_handoff: false
    });
  });

  it("keeps infrastructure failures outside candidate rejection", () => {
    const error = new PaperTradingHandoffConformanceInfrastructureError(
      "sandbox_create_failed",
      "sandbox unavailable"
    );
    expect(error).toMatchObject({
      name: "PaperTradingHandoffConformanceInfrastructureError",
      code: "sandbox_create_failed",
      candidate_rejection: false
    });
  });
});

function probeFixture(
  decisionKind: "order_request" | "hold" | "no_action"
): TradingArtifactPaperHandoffProbeResult {
  const instanceId = "paper-handoff-probe-system-code-001";
  const decision = decisionKind === "order_request"
    ? {
        event: "order_request",
        event_id: `${instanceId}:order-request:0001`,
        instance_id: instanceId,
        at: "2026-07-12T10:00:00.000Z",
        authority_status: "trace_only",
        intent_kind: "place_order",
        symbol: "BTCUSDT",
        side: "buy",
        order_type: "market",
        quantity: "0.001",
        reason: "bounded paper handoff conformance order"
      }
    : {
        event: decisionKind,
        event_id: `${instanceId}:${decisionKind}:0001`,
        instance_id: instanceId,
        at: "2026-07-12T10:00:00.000Z",
        authority_status: "trace_only",
        reason: "bounded paper handoff conformance no-order decision"
      };
  const providerBody = decisionKind === "order_request"
    ? {
        symbol: "BTCUSDT",
        side: "buy",
        quantity: 0.001,
        order_type: "market",
        reason: "bounded paper handoff conformance order"
      }
    : {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 0,
        order_type: "none",
        reason: "bounded paper handoff conformance no-order decision"
      };
  return {
    status: "completed",
    runner_kind: "host_process",
    artifact_dir: "/tmp/artifact",
    entrypoint: ["python3", "run.py"],
    instance_id: instanceId,
    started_at: "2026-07-12T10:00:00.000Z",
    completed_at: "2026-07-12T10:00:01.000Z",
    timed_out: false,
    stdout: "",
    stderr: "",
    exit_code: 0,
    output_lines: [
      JSON.stringify(decision),
      JSON.stringify({
        event: "runtime_heartbeat",
        instance_id: instanceId,
        tick: 1,
        at: "2026-07-12T10:00:00.500Z"
      }),
      JSON.stringify({
        event: "runtime_stopped",
        instance_id: instanceId,
        tick: 1,
        at: "2026-07-12T10:00:01.000Z"
      })
    ],
    provider_requests: [
      providerRequest("GET", "/market/snapshot"),
      providerRequest("GET", "/account/state"),
      providerRequest("POST", "/orders/validate", providerBody)
    ]
  };
}

function providerRequest(
  method: string,
  path: string,
  body?: unknown
) {
  return {
    at: "2026-07-12T10:00:00.000Z",
    method,
    path,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}
