import type { LedgerInput } from "@ouroboros/domain";

export function recordPaperExecutionResult(
  gatewayResult: LedgerInput["gateway_result"]
): NonNullable<LedgerInput["execution_result"]> {
  if (gatewayResult.decision_outcome === "dry_run_only") {
    return {
      execution_mode: "host_local",
      status: "dry_run_recorded",
      result_reason: gatewayResult.decision_reason
    };
  }

  return {
    execution_mode: "host_local",
    status: gatewayResult.decision_outcome === "rejected" ? "blocked" : "not_submitted",
    result_reason: gatewayResult.decision_reason
  };
}
