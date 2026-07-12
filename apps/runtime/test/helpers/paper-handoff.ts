import type {
  TradingArtifactPaperHandoffProbeInput
} from "@ouroboros/application/trading/research/artifact-runner";
import type {
  TradingArtifactPaperHandoffProbeResult,
  TradingArtifactRunnerKind,
  TradingProviderRequestLog
} from "@ouroboros/application/trading/research/types";

export function passingPaperHandoffProbe(
  input: TradingArtifactPaperHandoffProbeInput,
  runnerKind: TradingArtifactRunnerKind = "host_process"
): TradingArtifactPaperHandoffProbeResult {
  const at = input.start_at;
  const decision = {
    event: "hold",
    event_id: `${input.instance_id}:hold:0001`,
    instance_id: input.instance_id,
    at,
    authority_status: "trace_only",
    reason: "deterministic runtime test paper handoff"
  };
  const providerBody = {
    symbol: "BTCUSDT",
    side: "hold",
    quantity: 0,
    order_type: "none",
    reason: "deterministic runtime test paper handoff"
  };
  const outputLines = [
    JSON.stringify(decision),
    JSON.stringify({
      event: "runtime_heartbeat",
      instance_id: input.instance_id,
      tick: 1,
      at
    }),
    JSON.stringify({
      event: "runtime_stopped",
      instance_id: input.instance_id,
      tick: 1,
      at
    })
  ];

  return {
    status: "completed",
    runner_kind: runnerKind,
    artifact_dir: input.artifact_dir,
    entrypoint: [...input.manifest.entrypoint],
    instance_id: input.instance_id,
    started_at: at,
    completed_at: at,
    timed_out: false,
    stdout: outputLines.join("\n"),
    stderr: "",
    exit_code: 0,
    output_lines: outputLines,
    provider_requests: [
      providerRequest(at, "GET", "/market/snapshot"),
      providerRequest(at, "GET", "/account/state"),
      providerRequest(at, "POST", "/orders/validate", providerBody)
    ]
  };
}

function providerRequest(
  at: string,
  method: string,
  path: string,
  body?: unknown
): TradingProviderRequestLog {
  return {
    at,
    method,
    path,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}
