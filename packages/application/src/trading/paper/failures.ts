import type { PaperTradingFailureKind, PaperTradingFailureReadModel } from "@ouroboros/domain";

export function classifyPaperTradingFailure(reason: string | undefined): PaperTradingFailureReadModel | undefined {
  if (!reason) {
    return undefined;
  }
  const failureKind = paperTradingFailureKind(reason);
  const guidance = failureGuidance(failureKind);
  return {
    failure_kind: failureKind,
    reason,
    summary: guidance.summary,
    next_action: guidance.next_action,
    authority_status: "not_live"
  };
}

function paperTradingFailureKind(reason: string): PaperTradingFailureKind {
  const normalized = reason.toLowerCase();
  if (normalized.includes("forbidden_private_or_live_authority") ||
    normalized.includes("live authority") ||
    normalized.includes("private")) {
    return "authority_boundary_violation";
  }
  if (normalized.includes("public execution") || normalized.includes("execution stream")) {
    return "public_execution_evidence_gap";
  }
  if (normalized.includes("market data") || normalized.includes("market snapshot")) {
    return "market_data_gap";
  }
  if (normalized.includes("ledger")) {
    return "ledger_gap";
  }
  if (normalized.includes("runner health") || normalized.includes("runner inactive")) {
    return "runner_health_loss";
  }
  if (normalized.includes("sandbox") || normalized.includes("runner")) {
    return "sandbox_or_runner_failure";
  }
  if (normalized.includes("risk") || normalized.includes("validation rejected")) {
    return "risk_rejection";
  }
  if (normalized.includes("protocol") || normalized.includes("malformed") || normalized.includes("invalid")) {
    return "trading_system_protocol_error";
  }
  return "unknown_failure";
}

function failureGuidance(kind: PaperTradingFailureKind): {
  summary: string;
  next_action: string;
} {
  switch (kind) {
    case "market_data_gap":
      return {
        summary: "Paper observation could not read current public market data.",
        next_action: "Restore Gateway market data before continuing paper evidence."
      };
    case "public_execution_evidence_gap":
      return {
        summary: "Paper fill or execution evidence could not be tied to public execution data.",
        next_action: "Restore public execution evidence before trusting fills or paper score."
      };
    case "trading_system_protocol_error":
      return {
        summary: "TradingSystem emitted an invalid paper event or protocol shape.",
        next_action: "Fix the TradingSystem paper event protocol before retrying observation."
      };
    case "risk_rejection":
      return {
        summary: "Gateway or paper risk validation rejected the emitted decision.",
        next_action: "Review order sizing, side, and risk limits before continuing paper evidence."
      };
    case "sandbox_or_runner_failure":
      return {
        summary: "Sandbox or paper runner failed before reliable evidence could be recorded.",
        next_action: "Repair or resume the runner before treating paper evidence as current."
      };
    case "runner_health_loss":
      return {
        summary: "Persisted paper session lost active runner health evidence.",
        next_action: "Resume paper trading before review."
      };
    case "ledger_gap":
      return {
        summary: "Paper observation did not produce a complete Ledger chain.",
        next_action: "Inspect order, Gateway, and execution records before trusting the observation."
      };
    case "authority_boundary_violation":
      return {
        summary: "TradingSystem attempted private or live authority outside the paper boundary.",
        next_action: "Reject or repair the candidate before any further review."
      };
    case "unknown_failure":
      return {
        summary: "Paper observation failed without a recognized failure group.",
        next_action: "Inspect the raw failure reason and add a classifier if this recurs."
      };
  }
}
