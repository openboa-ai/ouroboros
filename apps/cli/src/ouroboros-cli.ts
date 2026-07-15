import { fileURLToPath } from "node:url";
import type {
  AgentProfileProviderKind,
  AgentProfileReadModel,
  OperatorReadModel,
  OuroborosCommandReadModel,
  OuroborosCommandRequest,
  ResearchGeneralizationReadModel
} from "@ouroboros/domain";
import { commandRemediation } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  parseAgentProfileId,
  type AgentProfileExecFile,
  type AgentProfileSpawnFile
} from "@ouroboros/application/agent/profiles";
import { createLocalOuroborosController } from "@ouroboros/application/controllers/local-ouroboros";

const DEFAULT_RUNTIME_BASE_URL = process.env.OUROBOROS_RUNTIME_URL ?? "http://127.0.0.1:4173";

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export interface OuroborosCliCommandMode {
  mode: "command";
  request: OuroborosCommandRequest;
}

export interface OuroborosCliServeMode {
  mode: "serve";
}

export interface OuroborosCliTuiMode {
  mode: "tui";
}

export interface OuroborosCliStatusMode {
  mode: "status";
}

export interface OuroborosCliHelpMode {
  mode: "help";
}

export interface OuroborosCliAgentMode {
  mode: "agent";
  action: "status" | "setup" | "login" | "probe";
  provider: AgentProfileProviderKind;
}

export type OuroborosCliMode =
  | OuroborosCliCommandMode
  | OuroborosCliServeMode
  | OuroborosCliTuiMode
  | OuroborosCliStatusMode
  | OuroborosCliHelpMode
  | OuroborosCliAgentMode;

type OuroborosCliOutputMode = "human" | "json";

interface OuroborosCommandEndpointResponse {
  command?: OuroborosCommandReadModel;
  result?: unknown;
  operator?: OperatorReadModel;
  error?: string;
  reason?: string;
  system_id?: string;
  candidate_id?: string;
  required_command?: string;
  message?: string;
}

export interface OuroborosCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runOuroborosCli(
  args: string[] = process.argv.slice(2),
  deps: {
    fetch?: FetchLike;
    runtimeBaseUrl?: string;
    operatorApiToken?: string | false;
    storeRoot?: string;
    profileExecFile?: AgentProfileExecFile;
    profileSpawnFile?: AgentProfileSpawnFile;
  } = {}
): Promise<OuroborosCliResult> {
  const globalOptions = parseGlobalOptions(args);
  let parsed: OuroborosCliMode;
  try {
    parsed = parseOuroborosCliArgs(globalOptions.args);
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`
    };
  }

  if (parsed.mode === "serve") {
    await import("../../runtime/src/main");
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  if (parsed.mode === "help") {
    return { exitCode: 0, stdout: `${usage()}\n`, stderr: "" };
  }

  if (parsed.mode === "tui") {
    const tui = await import("@ouroboros/operator-tui");
    await tui.runOperatorTui({
      runtimeBaseUrl: deps.runtimeBaseUrl ?? DEFAULT_RUNTIME_BASE_URL,
      fetch: deps.fetch ?? fetch,
      operatorApiToken: deps.operatorApiToken
    });
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  if (parsed.mode === "agent") {
    try {
      const store = new LocalStore(deps.storeRoot);
      const controller = createLocalOuroborosController({
        store,
        execFile: deps.profileExecFile,
        spawnFile: deps.profileSpawnFile
      });
      const result = await controller.dispatchAgentProviderCommand(parsed);
      return {
        exitCode: 0,
        stdout: `${formatCliPayload(result, globalOptions.outputMode, formatAgentCommandResult)}\n`,
        stderr: ""
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`
      };
    }
  }

  const runtimeBaseUrl = deps.runtimeBaseUrl ?? DEFAULT_RUNTIME_BASE_URL;
  const fetcher = deps.fetch ?? fetch;
  const operatorApiToken = resolveOperatorApiToken(deps.operatorApiToken);
  if (parsed.mode === "status") {
    const operator = await fetchOperatorStatus(runtimeBaseUrl, fetcher, operatorApiToken);
    if (operator.exitCode !== 0) {
      return operator;
    }
    if (!operator.operator) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Ouroboros runtime did not return an operator read model.\n"
      };
    }
    return {
      exitCode: 0,
      stdout: `${formatCliPayload(operator.operator, globalOptions.outputMode, formatOperatorSummary)}\n`,
      stderr: ""
    };
  }

  let response: Response;
  try {
    response = await runtimeFetch(fetcher, `${runtimeBaseUrl}/api/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(commandRequestBody(parsed.request))
    }, operatorApiToken);
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${formatRuntimeFetchError(runtimeBaseUrl, error)}\n`
    };
  }
  const text = await response.text();
  if (!response.ok) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${formatCommandHttpError(text)}\n`
    };
  }
  const body = JSON.parse(text) as OuroborosCommandEndpointResponse;
  return {
    exitCode: 0,
    stdout: `${formatCliPayload(body, globalOptions.outputMode, formatCommandResponse)}\n`,
    stderr: ""
  };
}

export function parseOuroborosCliArgs(args: string[]): OuroborosCliMode {
  const [domain, action, subject, extra] = args;
  if (domain === "help" || domain === "--help" || domain === "-h") {
    return { mode: "help" };
  }
  if (!domain) {
    throw new Error(usage());
  }
  if (domain === "runtime" && action === "serve" && subject === undefined) {
    return { mode: "serve" };
  }
  if (domain === "tui" && action === undefined) {
    return { mode: "tui" };
  }
  if (domain === "status" && action === undefined) {
    return { mode: "status" };
  }
  if (domain === "arena" && isArenaAction(action) && subject === undefined) {
    return {
      mode: "command",
      request: {
        command_kind: `arena.${action}`
      }
    };
  }
  if (domain === "candidate" && action === "select" && subject && extra === undefined) {
    return {
      mode: "command",
      request: {
        command_kind: "candidate.select",
        payload: {
          candidate_id: subject
        }
      }
    };
  }
  if (domain === "candidate" && action === "promote" && subject && extra === undefined) {
    return {
      mode: "command",
      request: {
        command_kind: "trading_candidate.promote",
        payload: {
          candidate_id: subject
        }
      }
    };
  }
  if (domain === "candidate" && action === "evidence" && subject === "run" && extra) {
    return {
      mode: "command",
      request: {
        command_kind: "candidate.paper_evidence.run",
        payload: {
          candidate_id: extra
        }
      }
    };
  }
  if (domain === "candidate" && action === "paper" && subject === "start" && extra) {
    return {
      mode: "command",
      request: {
        command_kind: "trading_run.start",
        payload: {
          candidate_id: extra
        }
      }
    };
  }
  if (domain === "trading-run" && action === "observe" && subject && extra === undefined) {
    return {
      mode: "command",
      request: {
        command_kind: "trading_run.observe",
        payload: {
          trading_run_id: subject
        }
      }
    };
  }
  if (domain === "trading-run" && action === "stop" && subject && extra === undefined) {
    return {
      mode: "command",
      request: {
        command_kind: "trading_run.stop",
        payload: {
          trading_run_id: subject
        }
      }
    };
  }
  if (domain === "agent" && isAgentAction(action) && subject && extra === undefined) {
    return {
      mode: "agent",
      action,
      provider: normalizeAgentProvider(subject)
    };
  }
  if (domain === "researcher" && action === "provider" && subject === "set" && extra) {
    return {
      mode: "command",
      request: {
        command_kind: "researcher.provider.select",
        payload: {
          provider: normalizeResearcherProvider(extra)
        }
      }
    };
  }
  throw new Error(usage());
}

async function fetchOperatorStatus(
  runtimeBaseUrl: string,
  fetcher: FetchLike,
  operatorApiToken?: string
): Promise<OuroborosCliResult & { operator?: OperatorReadModel }> {
  let response: Response;
  try {
    response = await runtimeFetch(fetcher, `${runtimeBaseUrl}/api/operator`, undefined, operatorApiToken);
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${formatRuntimeFetchError(runtimeBaseUrl, error)}\n`
    };
  }
  const text = await response.text();
  if (!response.ok) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${formatCommandHttpError(text)}\n`
    };
  }
  const body = JSON.parse(text) as { operator: OperatorReadModel };
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    operator: body.operator
  };
}

function parseGlobalOptions(args: string[]): { args: string[]; outputMode: OuroborosCliOutputMode } {
  return {
    args: args.filter((arg) => arg !== "--json"),
    outputMode: args.includes("--json") ? "json" : "human"
  };
}

function commandRequestBody(request: OuroborosCommandRequest): OuroborosCommandRequest {
  return request.payload
    ? request
    : { command_kind: request.command_kind };
}

function formatCliPayload<T>(
  payload: T,
  outputMode: OuroborosCliOutputMode,
  humanFormatter: (payload: T) => string
): string {
  if (outputMode === "json") {
    return JSON.stringify(payload, null, 2);
  }
  return humanFormatter(payload);
}

function formatCommandResponse(body: OuroborosCommandEndpointResponse): string {
  const command = body.command;
  const summary = command?.summary
    ?? (command ? `${command.command_kind} ${command.status}.` : "Command completed.");
  const lines = [`OK ${summary}`];
  if (body.operator) {
    lines.push("", formatOperatorSummary(body.operator));
  }
  return lines.join("\n");
}

function formatAgentCommandResult(result: unknown): string {
  const profile = (result as { profile?: AgentProfileReadModel }).profile;
  if (!profile) {
    return "OK Agent provider command completed.";
  }
  return [
    `OK Agent provider ${profile.provider}: ${profile.status}`,
    `Profile: ${profile.profile_id}`,
    `Managed home: ${profile.managed_home}`,
    `Provider home: ${profile.managed_provider_home}`,
    profile.version ? `Version: ${profile.version}` : undefined,
    profile.failure_reason ? `Failure: ${profile.failure_reason}` : undefined,
    `Agent profile authority: ${profile.authority_status}`
  ].filter(Boolean).join("\n");
}

function formatOperatorSummary(operator: OperatorReadModel): string {
  const arena = operator.candidate_arena;
  const leader = arena.leaderboard[0];
  const lastCommand = operator.latest_commands[0];
  const selectedProfile = operator.agent_profiles.find((profile) =>
    profile.profile_id === operator.researcher_provider.selected_provider
  );
  const selectedProfileNextStep = selectedProfile ? agentProfileNextStep(selectedProfile) : undefined;
  const paper = operator.selected_paper_trading_evaluation;
  const paperLeader = operator.paper_trading_board.entries[0];
  const latestTick = arena.latest_ticks[0];
  const market = paper.latest_market_snapshot;
  const decision = paper.latest_decision;
  const tradingReviewPacket = operator.trading_review.review_packet;
  const lastCommandRemediation = lastCommand ? commandRemediation(lastCommand) : undefined;
  return [
    "Ouroboros status",
    `Arena: ${arena.runner_status} (${arena.tick_count} ticks, ${arena.leaderboard.length} candidates)`,
    formatResearchGeneralizationSummary(arena.research_generalization),
    latestTick
      ? `Latest tick: ${formatCandidateArenaTickSummary(latestTick)}`
      : undefined,
    latestTick
      ? `Latest tick source: ${formatCandidateArenaTickSource(latestTick)}`
      : undefined,
    latestTick
      ? `Latest tick directions: ${formatCandidateArenaTickDirections(latestTick)}`
      : undefined,
    latestTick
      ? `Latest tick efficiency: ${formatCandidateArenaTickEfficiency(latestTick)}`
      : undefined,
    `Researcher provider: ${operator.researcher_provider.selected_provider} (available: ${operator.researcher_provider.available_providers.join(", ")})`,
    selectedProfile
      ? `Agent profile: ${selectedProfile.label} ${selectedProfile.status}${selectedProfileNextStep ? `; next: ${selectedProfileNextStep}` : ""}`
      : undefined,
    `Live authority: ${operator.live_disabled ? "disabled" : "enabled"} / ${operator.authority_status}`,
    leader
      ? `Leader: #${leader.rank} ${leader.display_name} ${formatUsdt(leader.profit_loss.net_revenue_usdt)} (${formatPercent(leader.profit_loss.net_return_pct)})`
      : "Leader: none",
    `Selected candidate: ${operator.selected_candidate_id ?? "none"}`,
    `Trading review: ${operator.trading_review.status} / ${operator.trading_review.readiness_status} / ${operator.trading_review.display_name ?? operator.trading_review.active_candidate_id ?? "none"} / selected ${operator.trading_review.selected_matches_trading_review ? "matches" : "differs"}`,
    `Trading review packet: ${tradingReviewPacket.verdict.severity} / top ${tradingReviewPacket.verdict.top_blocker ?? "none"} / next ${tradingReviewPacket.next_action}`,
    `Trading review subject: ${formatTradingReviewSubject(tradingReviewPacket)}`,
    `Trading review evidence window: ${formatTradingReviewEvidenceWindow(tradingReviewPacket)}`,
    `Trading review blockers: ${formatTradingReviewBlockers(tradingReviewPacket)}`,
    `Trading review authority: ${formatTradingReviewAuthority(tradingReviewPacket)}`,
    `Trading review runner: ${formatTradingReviewRunner(tradingReviewPacket)}`,
    `Trading review ledger: ${formatTradingReviewLedger(tradingReviewPacket)}`,
    `Trading review lineage: ${formatTradingReviewLineage(tradingReviewPacket)}`,
    tradingReviewPacket.lineage.paper_board_learning
      ? `Trading review lineage learning: ${formatTradingReviewLineageLearning(tradingReviewPacket)}`
      : undefined,
    `Trading review provenance: ${formatTradingReviewProvenance(tradingReviewPacket)}`,
    `Trading review risk: ${formatTradingReviewRisk(tradingReviewPacket)}`,
    operator.trading_promotion
      ? `Trading promotion: ${operator.trading_promotion.status} / ${operator.trading_promotion.readiness_status} / ${operator.trading_promotion.display_name ?? operator.trading_promotion.candidate_id ?? "none"}`
      : "Trading promotion: not projected",
    `Paper evidence: ${operator.selected_paper_evidence.status}`,
    `Paper Trading Evaluation: ${paper.status} (${paper.observation_count} observations, ${formatUsdt(paper.profit_loss.net_revenue_usdt)})`,
    paperLeader
      ? `Paper board: #${paperLeader.rank} ${paperLeader.display_name} ${formatUsdt(paperLeader.profit_loss.net_revenue_usdt)} / ${paperLeader.qualification_status} / gate ${paperLeader.promotion_gate_status}`
      : "Paper board: no paper evaluations",
    paperLeader
      ? `Paper board trend: ${formatPaperBoardTrend(paperLeader)}`
      : undefined,
    paperLeader
      ? `Paper board blockers: ${formatPaperBoardBlockerDensity(paperLeader)}`
      : undefined,
    paperLeader
      ? `Paper qualification: observations ${paperLeader.evidence_window.observation_count}, failed ${paperLeader.evidence_window.failed_observation_count}, elapsed ${paperLeader.evidence_window.elapsed_ms}ms / ${paperLeader.qualification_reasons.length ? paperLeader.qualification_reasons.join(", ") : "qualified"}`
      : undefined,
    paperLeader
      ? `Paper board quality: paper runner ${paperLeader.runner_status}, market provenance ${paperLeader.market_data_source}${paperLeader.latest_public_execution_source ? ` / ${paperLeader.latest_public_execution_source}` : ""}, paper fill ${paperLeader.latest_fill_status ?? "none"}, paper open orders ${paperLeader.open_order_count}`
      : undefined,
    `Paper runner: ${formatPaperRunner(paper)}`,
    market
      ? `Paper market snapshot: ${market.symbol} ${formatUsdt(market.price)} @ ${market.observed_at}`
      : undefined,
    `Gateway market data: ${paper.market_data_source}${market?.source_priority ? ` / ${market.source_priority}` : ""}${market?.rest_fallback_used ? " / REST fallback" : ""}${market?.ws_connected === true ? " / WS connected" : ""}${market?.ws_connected === false ? " / WS disconnected" : ""}`,
    paper.latest_public_execution_snapshot
      ? `Public execution evidence: ${formatPublicExecutionEvidence(paper.latest_public_execution_snapshot)}`
      : undefined,
    paper.latest_public_execution_snapshot?.order_book
      ? `Public order book evidence: ${paper.latest_public_execution_snapshot.order_book.sync_status} / update ${paper.latest_public_execution_snapshot.order_book.last_update_id ?? "unknown"}${paper.latest_public_execution_snapshot.order_book.gap_detected ? " / gap recovered" : ""}`
      : undefined,
    decision ? `Paper decision: ${formatPaperDecision(decision)}` : undefined,
    paper.paper_account_snapshot
      ? `Paper account: equity ${formatUsdt(Number(paper.paper_account_snapshot.equity_usdt))} / ${formatPaperPosition(paper.paper_account_snapshot.position)} / open orders ${paper.paper_account_snapshot.open_order_count}`
      : undefined,
    paper.latest_fill
      ? `Paper fill: ${formatPaperFill(paper.latest_fill)}`
      : undefined,
    formatPaperFailure(paper),
    lastCommand
      ? `Latest command: ${lastCommand.command_kind} ${lastCommand.error ? `${lastCommand.status} / ${lastCommand.error}` : lastCommand.status}`
      : "Latest command: none",
    lastCommandRemediation
      ? `Latest command remediation: ${formatCommandRemediation(lastCommandRemediation)}`
      : undefined
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function formatResearchGeneralizationSummary(
  generalization: ResearchGeneralizationReadModel
): string {
  const prefix = [
    `Research generalization: ${generalization.status}`,
    `protocols ${generalization.protocol_count}`,
    `outcomes ${generalization.outcome_count}`
  ];
  if (generalization.active_protocol) {
    prefix.push(
      `assigned ${generalization.active_protocol.assigned_study_count}/${generalization.active_protocol.planned_study_count}`,
      `terminal ${generalization.active_protocol.terminal_study_count}/${generalization.active_protocol.planned_study_count}`
    );
  }
  if (generalization.latest_outcome) {
    prefix.push(`inference ${generalization.latest_outcome.inference_status}`);
  }
  if (generalization.latest_policy_decision) {
    prefix.push(
      `latest decision ${generalization.latest_policy_decision.decision_status}`,
      `latest mode ${generalization.latest_policy_decision.effective_default_mode ?? "none"}`
    );
  }
  if (generalization.effective_policy_decision) {
    const effective = generalization.effective_policy_decision;
    prefix.push(
      `effective mode ${effective.effective_default_mode}`,
      `application ${effective.application.application_status}`,
      `allocations ${effective.application.allocation_count}`,
      `completed ticks ${effective.application.completed_tick_count}`
    );
  } else if (generalization.latest_policy_decision) {
    prefix.push("effective mode none");
  }
  if (generalization.active_protocol) {
    prefix.push(`next ${generalization.active_protocol.next_action}`);
  } else if (generalization.latest_outcome) {
    prefix.push(`next ${generalization.latest_outcome.next_action}`);
  }
  prefix.push(generalization.authority_status);
  return prefix.join(" / ");
}

function formatCommandRemediation(
  remediation: NonNullable<ReturnType<typeof commandRemediation>>
): string {
  return [
    remediation.group,
    remediation.surface,
    remediation.remediation,
    remediation.authority_status
  ].join(" / ");
}

function formatTradingReviewRunner(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.runner.runner_status ?? (packet.runner.runner_active ? "active" : "unknown"),
    packet.runner.trading_run_status ? `run ${packet.runner.trading_run_status}` : undefined,
    packet.runner.last_observed_at ? `last ${packet.runner.last_observed_at}` : undefined,
    packet.runner.next_observation_at ? `next ${packet.runner.next_observation_at}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewSubject(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.subject.display_name ?? packet.subject.candidate_id ?? "no Trading review target",
    packet.subject.promoted_at ? `promoted ${packet.subject.promoted_at}` : undefined,
    `selected ${packet.subject.selected_matches_trading_review ? "matches" : "differs"}`
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewEvidenceWindow(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const window = packet.evidence_quality.evidence_window;
  if (!window) {
    return "paper required";
  }
  return [
    `${window.observation_count} obs`,
    `${window.failed_observation_count} failed`,
    `${window.elapsed_ms}ms`,
    window.first_observed_at ? `first ${window.first_observed_at}` : undefined,
    window.last_observed_at ? `last ${window.last_observed_at}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewAuthority(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const noAuthority = packet.authority.no_authority;
  return [
    packet.authority.authority_status,
    packet.authority.live_disabled_reason,
    `live_exchange=${String(noAuthority.live_exchange_authority)}, private_read=${String(noAuthority.private_read_authority)}, order_submission=${String(noAuthority.order_submission_authority)}, credentials=${String(noAuthority.credentials)}`
  ].join(" / ");
}

function formatTradingReviewBlockers(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  if (packet.evidence_quality.blocker_groups.length === 0) {
    return "none";
  }
  return packet.evidence_quality.blocker_groups
    .map((group) => [
      group.group_kind,
      group.severity,
      group.blockers.join(", "),
      group.summary,
      `next ${group.next_action}`
    ].join(" / "))
    .join("; ");
}

function formatTradingReviewLedger(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.ledger.evidence_status,
    packet.ledger.ledger_chain_complete ? "chain complete" : "chain incomplete",
    packet.ledger.latest_order_request_id ? `order ${packet.ledger.latest_order_request_id}` : undefined,
    packet.ledger.latest_gateway_outcome ? `gateway ${packet.ledger.latest_gateway_outcome}` : undefined,
    packet.ledger.latest_execution_status ? `execution ${packet.ledger.latest_execution_status}` : undefined,
    packet.ledger.latest_decision_kind ? `decision ${packet.ledger.latest_decision_kind}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewLineage(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.lineage.lineage_status,
    packet.lineage.direction_kind,
    packet.lineage.parent_candidate_id ? `parent ${packet.lineage.parent_candidate_id}` : undefined,
    packet.lineage.latest_finding,
    packet.lineage.evaluation_status ? `evaluation ${packet.lineage.evaluation_status}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewLineageLearning(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const learning = packet.lineage.paper_board_learning;
  if (!learning) {
    return "none";
  }
  return [
    learning.rank ? `rank #${learning.rank}` : "unranked",
    learning.qualification_status,
    `${learning.net_revenue_usdt} net USDT`,
    `${learning.observation_count} obs`,
    learning.top_blocker ? `top ${learning.top_blocker}` : undefined,
    `next ${learning.next_research_focus}`
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewProvenance(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const orderBook = packet.provenance.order_book;
  return [
    packet.provenance.market_data_source ?? "no market",
    packet.provenance.latest_public_execution_source ?? "no public execution",
    packet.provenance.latest_public_execution_freshness,
    packet.provenance.latest_public_execution_ws_connected === true ? "WS connected" : undefined,
    packet.provenance.latest_public_execution_ws_connected === false ? "WS disconnected" : undefined,
    packet.provenance.latest_public_execution_rest_fallback_used ? "REST fallback" : undefined,
    packet.provenance.latest_public_execution_stream_marker
      ? `marker ${packet.provenance.latest_public_execution_stream_marker}`
      : undefined,
    `fill ${packet.provenance.latest_fill_status ?? "none"}`,
    orderBook ? formatTradingReviewOrderBook(orderBook) : "order book missing"
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewOrderBook(
  orderBook: NonNullable<OperatorReadModel["trading_review"]["review_packet"]["provenance"]["order_book"]>
): string {
  return [
    `order book ${orderBook.sync_status}`,
    orderBook.last_update_id ? `update ${orderBook.last_update_id}` : undefined,
    orderBook.previous_final_update_id ? `prev ${orderBook.previous_final_update_id}` : undefined,
    orderBook.depth_level_count !== undefined ? `depth ${orderBook.depth_level_count}` : undefined,
    orderBook.gap_detected ? "gap recovered" : undefined
  ].filter(Boolean).join(" ");
}

function formatTradingReviewRisk(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.risk.account ? `equity ${packet.risk.account.equity_usdt} USDT` : "account missing",
    packet.risk.account ? `available ${packet.risk.account.available_balance_usdt} USDT` : undefined,
    packet.risk.position
      ? `position ${packet.risk.position.side} ${packet.risk.position.quantity} ${packet.risk.position.symbol} notional ${packet.risk.position.notional_usdt}`
      : "position missing",
    `open ${packet.risk.open_order_count}`,
    `fill ${packet.risk.latest_fill_status ?? "none"}`,
    packet.risk.latest_failure || packet.risk.latest_failure_reason
      ? `failure ${formatPaperFailure(packet.risk)?.replace(/^Paper failure: /, "")}`
      : undefined
  ].filter(Boolean).join(" / ");
}

function formatPublicExecutionEvidence(
  snapshot: NonNullable<OperatorReadModel["selected_paper_trading_evaluation"]["latest_public_execution_snapshot"]>
): string {
  return [
    snapshot.source_kind,
    snapshot.source_priority,
    snapshot.freshness,
    snapshot.ws_connected === true ? "WS connected" : undefined,
    snapshot.ws_connected === false ? "WS disconnected" : undefined,
    snapshot.rest_fallback_used ? "REST fallback" : undefined,
    snapshot.gap_detected ? "gap detected" : undefined,
    snapshot.stream_marker ? `marker ${snapshot.stream_marker}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatPaperRunner(
  paper: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const runnerStatus = paperRunnerStatus(paper);
  return [
    runnerStatus,
    runnerStatus === "needs resume" ? "persisted running, timer inactive" : undefined,
    paper.interval_ms ? `interval ${paper.interval_ms}ms` : undefined,
    paper.next_observation_at ? `next ${paper.next_observation_at}` : undefined
  ].filter(Boolean).join(" / ");
}

function paperRunnerStatus(
  paper: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  if (paper.runner_active) {
    return "active";
  }
  if (paper.status === "running") {
    return "needs resume";
  }
  if (paper.status === "not_started") {
    return "not started";
  }
  return paper.status;
}

function formatPaperFill(
  fill: NonNullable<OperatorReadModel["selected_paper_trading_evaluation"]["latest_fill"]>
): string {
  return [
    `${fill.fill_status} ${fill.fill_quantity} @ ${fill.fill_price}`,
    fill.source_trade_id ? `trade ${fill.source_trade_id}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatPaperFailure(input: {
  latest_failure?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_failure"];
  latest_failure_reason?: string;
}): string | undefined {
  if (input.latest_failure) {
    return `Paper failure: ${input.latest_failure.failure_kind} / ${input.latest_failure.summary} / next ${input.latest_failure.next_action} / raw ${input.latest_failure.reason}`;
  }
  return input.latest_failure_reason ? `Paper failure: ${input.latest_failure_reason}` : undefined;
}

function formatPaperDecision(
  decision: OperatorReadModel["selected_paper_trading_evaluation"]["latest_decision"]
): string {
  if (!decision) {
    return "none";
  }
  if (decision.decision_kind !== "order_request" || !decision.order_request) {
    return `${decision.decision_kind} (${decision.reason})`;
  }
  return [
    "order_request",
    `${decision.order_request.side} ${decision.order_request.order_type}`,
    decision.order_request.quantity,
    decision.order_request.limit_price ? `@ ${decision.order_request.limit_price}` : undefined,
    `(${decision.reason})`
  ].filter(Boolean).join(" ");
}

function formatPaperPosition(
  position: NonNullable<OperatorReadModel["selected_paper_trading_evaluation"]["paper_account_snapshot"]>["position"]
): string {
  return `${position.side} ${position.quantity} BTCUSDT${position.average_entry_price ? ` @ ${position.average_entry_price}` : ""}`;
}

function agentProfileNextStep(profile: AgentProfileReadModel): string | undefined {
  if (profile.status === "not_configured") {
    return `ouroboros agent setup ${profile.provider}`;
  }
  if (profile.status === "configured" || profile.status === "login_required" || profile.status === "unavailable") {
    return `ouroboros agent login ${profile.provider}`;
  }
  return undefined;
}

function formatCommandHttpError(text: string): string {
  try {
    const body = JSON.parse(text) as OuroborosCommandEndpointResponse;
    const paperEvidenceHint = body.error === "trading_run_failed"
      ? "Next step: select an accepted candidate with runnable paper evidence, or run arena tick until one is available."
      : undefined;
    return [
      `Ouroboros command failed: ${body.error ?? "unknown_error"}`,
      body.reason ? `Reason: ${body.reason}` : undefined,
      body.system_id ? `Candidate: ${body.system_id}` : body.candidate_id ? `Candidate: ${body.candidate_id}` : undefined,
      body.required_command ? `Next step: ${body.required_command}` : undefined,
      paperEvidenceHint,
      body.message ? `Message: ${body.message}` : undefined
    ].filter(Boolean).join("\n");
  } catch {
    return text;
  }
}

function runtimeFetch(
  fetcher: FetchLike,
  input: string,
  init: RequestInit | undefined,
  operatorApiToken: string | undefined
): Promise<Response> {
  if (!operatorApiToken) {
    return init ? fetcher(input, init) : fetcher(input);
  }
  const headers = new Headers(init?.headers);
  headers.set("x-ouroboros-operator-token", operatorApiToken);
  return fetcher(input, {
    ...init,
    headers
  });
}

function resolveOperatorApiToken(configuredToken: string | false | undefined): string | undefined {
  if (configuredToken === false) {
    return undefined;
  }
  return trimmedString(configuredToken) ?? trimmedString(process.env.OUROBOROS_OPERATOR_API_TOKEN);
}

function trimmedString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function formatUsdt(value: number): string {
  return `${value.toFixed(2)} USDT`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(4)}%`;
}

function formatPaperBoardTrend(entry: OperatorReadModel["paper_trading_board"]["entries"][number]): string {
  return [
    entry.trend.direction,
    `delta ${formatSignedUsdt(entry.trend.net_revenue_delta_usdt)}`,
    `return ${formatSignedPercent(entry.trend.net_return_delta_pct)}`,
    `${entry.trend.observation_count_delta} obs`,
    entry.trend.authority_status
  ].join(" / ");
}

function formatPaperBoardBlockerDensity(entry: OperatorReadModel["paper_trading_board"]["entries"][number]): string {
  return [
    `${entry.blocker_density.blocker_count} blockers`,
    `density ${entry.blocker_density.blocker_density}`,
    `failed ${entry.blocker_density.failed_observation_ratio}`,
    `top ${entry.blocker_density.top_blocker ?? "none"}`,
    entry.blocker_density.authority_status
  ].join(" / ");
}

function formatSignedUsdt(value: number): string {
  return `${value > 0 ? "+" : ""}${formatUsdt(value)}`;
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatCandidateArenaTickSummary(tick: OperatorReadModel["candidate_arena"]["latest_ticks"][number]): string {
  const failedCount = tick.direction_results.filter((result) => result.status === "failed").length;
  return [
    tick.tick_id,
    tick.status,
    `${tick.created_candidate_ids.length} created`,
    `${failedCount} failed`,
    tick.authority_status
  ].join(" / ");
}

function formatCandidateArenaTickSource(tick: OperatorReadModel["candidate_arena"]["latest_ticks"][number]): string {
  const source = tick.source_candidate;
  if (!source) {
    return "not recorded";
  }
  return [
    `${source.source_kind} -> ${source.candidate_id}`,
    source.display_name,
    source.net_revenue_usdt === undefined ? undefined : formatUsdt(source.net_revenue_usdt),
    source.authority_status
  ].filter(Boolean).join(" / ");
}

function formatCandidateArenaTickDirections(tick: OperatorReadModel["candidate_arena"]["latest_ticks"][number]): string {
  return tick.direction_results.map((result) => {
    const outcome = result.candidate_id ?? result.error ?? result.finding ?? "no output";
    return `${result.direction_kind}:${result.status} -> ${outcome}`;
  }).join("; ");
}

function formatCandidateArenaTickEfficiency(tick: OperatorReadModel["candidate_arena"]["latest_ticks"][number]): string {
  const summaries = tick.direction_results
    .filter((result) => result.research_efficiency)
    .map((result) => {
      const efficiency = result.research_efficiency!;
      return `${result.direction_kind}: ${efficiency.provider_request_total} provider / ${efficiency.runner_command_total} runner / ${efficiency.scenario_count} scenarios / ${efficiency.elapsed_ms}ms / ${efficiency.authority_status}`;
    });
  return summaries.length ? summaries.join("; ") : "not recorded";
}

function formatRuntimeFetchError(runtimeBaseUrl: string, error: unknown): string {
  const cause = error instanceof Error && "cause" in error
    ? (error as Error & { cause?: unknown }).cause
    : undefined;
  const code = typeof cause === "object" && cause && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const suffix = code ? ` (${code})` : "";
  return [
    `Ouroboros runtime is not reachable at ${runtimeBaseUrl}${suffix}.`,
    "Start it in another terminal with: ouroboros runtime serve",
    `Original error: ${message}`
  ].join("\n");
}

function isArenaAction(value: string | undefined): value is "status" | "start" | "stop" | "tick" | "cycle" {
  return value === "status"
    || value === "start"
    || value === "stop"
    || value === "tick"
    || value === "cycle";
}

function isAgentAction(value: string | undefined): value is "status" | "setup" | "login" | "probe" {
  return value === "status" || value === "setup" || value === "login" || value === "probe";
}

function normalizeAgentProvider(value: string): AgentProfileProviderKind {
  const provider = parseAgentProfileId(value);
  if (provider) {
    return provider;
  }
  throw new Error(usage());
}

function normalizeResearcherProvider(value: string): "codex" | "fixture" {
  const provider = parseAgentProfileId(value);
  if (provider === "codex" || provider === "fixture") {
    return provider;
  }
  throw new Error(usage());
}

function usage(): string {
  return [
    "Usage: ouroboros <command>",
    "",
    "Commands:",
    "  ouroboros runtime serve",
    "  ouroboros status [--json]",
    "  ouroboros arena status|start|stop|tick|cycle",
    "  ouroboros candidate select <candidate-id>",
    "  ouroboros candidate promote <candidate-id>",
    "  ouroboros candidate paper start <candidate-id>",
    "  ouroboros candidate evidence run <candidate-id>",
    "  ouroboros trading-run observe|stop <trading-run-id>",
    "  ouroboros agent status|setup|login|probe codex|fixture",
    "  ouroboros researcher provider set codex|fixture",
    "  ouroboros tui"
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await runOuroborosCli();
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}
