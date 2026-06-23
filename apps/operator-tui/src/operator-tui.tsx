import React, { useEffect, useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import type {
  OperatorReadModel,
  OuroborosCommandKind,
  OuroborosCommandRequest
} from "@ouroboros/domain";
import { commandRemediation } from "@ouroboros/domain";

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export type OperatorTuiAction =
  | "refresh"
  | "tick"
  | "toggle_running"
  | "select_previous"
  | "select_next"
  | "select_current"
  | "promote_trading_candidate"
  | "start_paper_trading"
  | "observe_paper_trading"
  | "stop_paper_trading"
  | "toggle_provider"
  | "setup_provider"
  | "start_provider_login"
  | "probe_provider"
  | "quit";

export async function runOperatorTui(input: {
  runtimeBaseUrl: string;
  fetch?: FetchLike;
  operatorApiToken?: string | false;
}): Promise<void> {
  const instance = render(
    <OperatorTui
      runtimeBaseUrl={input.runtimeBaseUrl}
      fetcher={input.fetch ?? fetch}
      operatorApiToken={resolveOperatorApiToken(input.operatorApiToken)}
    />
  );
  await instance.waitUntilExit();
}

export function OperatorTui(props: {
  runtimeBaseUrl: string;
  fetcher: FetchLike;
  operatorApiToken?: string;
}) {
  const [operator, setOperator] = useState<OperatorReadModel | null>(null);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const app = useApp();

  const refresh = async () => {
    try {
      const nextOperator = await fetchOperatorReadModel(
        props.runtimeBaseUrl,
        props.fetcher,
        props.operatorApiToken
      );
      setOperator(nextOperator);
      setCursor((current) => clampCursor(current, nextOperator));
      setError(null);
      return nextOperator;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return undefined;
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetchOperatorReadModel(props.runtimeBaseUrl, props.fetcher, props.operatorApiToken)
      .then((nextOperator) => {
        if (!cancelled) {
          setOperator(nextOperator);
          setCursor((current) => clampCursor(current, nextOperator));
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.runtimeBaseUrl, props.fetcher, props.operatorApiToken]);

  useInput((input, key) => {
    const action = operatorTuiActionForInput(input, key);
    if (!action) {
      return;
    }
    if (action === "quit") {
      app.exit();
      return;
    }
    if (action === "select_previous") {
      setCursor((current) => Math.max(0, current - 1));
      return;
    }
    if (action === "select_next") {
      setCursor((current) => {
        const max = Math.max((operator?.candidate_arena.leaderboard.length ?? 1) - 1, 0);
        return Math.min(max, current + 1);
      });
      return;
    }
    void runTuiAction(action, operator, cursor, props.runtimeBaseUrl, props.fetcher, props.operatorApiToken)
      .then(async (outcome) => {
        if (outcome === "refreshed") {
          setMessage("Refreshed operator state.");
        } else if (outcome) {
          setMessage(outcome);
        }
        await refresh();
      });
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
        <Text dimColor>Start runtime with: ouroboros runtime serve</Text>
        <Text dimColor>Press q to quit.</Text>
      </Box>
    );
  }
  if (!operator) {
    return <Text>Loading Ouroboros operator...</Text>;
  }

  return (
    <OperatorTuiScreen
      operator={operator}
      cursor={cursor}
      message={message}
    />
  );
}

export function OperatorTuiScreen(props: {
  operator: OperatorReadModel;
  cursor: number;
  message?: string | null;
}) {
  const leader = props.operator.candidate_arena.leaderboard[0];
  const selectedEntry = props.operator.candidate_arena.leaderboard[props.cursor] ?? leader;
  const selectedCandidateId = props.operator.selected_candidate_id ?? selectedEntry?.candidate_id;
  const selectedProfile = props.operator.agent_profiles.find((profile) =>
    profile.profile_id === props.operator.researcher_provider.selected_provider
  );
  const paperEvaluation = props.operator.selected_paper_trading_evaluation;
  const marketSnapshot = paperEvaluation.latest_market_snapshot;
  const paperDecision = paperEvaluation.latest_decision;
  const visibleLeaderboard = visibleLeaderboardWindow(
    props.operator.candidate_arena.leaderboard,
    props.cursor
  );
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Ouroboros Action Console</Text>
      <Box flexDirection="column">
        <Text>{`Arena: ${props.operator.candidate_arena.runner_status} / ticks ${props.operator.candidate_arena.tick_count}`}</Text>
        <Text>
          {`Researcher provider: ${props.operator.researcher_provider.selected_provider} / available ${props.operator.researcher_provider.available_providers.join(", ")}`}
        </Text>
        <Text>
          {`Agent profile: ${selectedProfile?.label ?? "unknown"} / ${selectedProfile?.status ?? "missing"}`}
        </Text>
        <Text>{`Operator authority: ${props.operator.authority_status} / live ${props.operator.live_disabled ? "disabled" : "enabled"}`}</Text>
        <Text dimColor>Keys: r refresh, t tick, s arena, up/down move, enter select, m promote, e paper start, o observe, x stop, p provider, a setup, l login, v probe, q quit</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Leaderboard</Text>
        {props.operator.candidate_arena.leaderboard.length
          ? visibleLeaderboard.map(({ entry, index }) => (
              <Box key={entry.candidate_id} flexDirection="column">
                <Text color={index === props.cursor ? "yellow" : undefined}>
                  {`${index === props.cursor ? ">" : " "} #${entry.rank} ${entry.display_name}`}
                </Text>
                <Text dimColor>
                  {`   ${entry.direction_kind} | net ${entry.profit_loss.net_revenue_usdt.toFixed(2)} USDT | ${entry.status}`}
                </Text>
              </Box>
            ))
          : <Text>No candidates yet. Press t to run a tick.</Text>}
      </Box>
      <Box flexDirection="column">
        <Text bold>Selected Candidate</Text>
        <Text>{selectedCandidateId ?? "none"}</Text>
        <Text>
          {`Trading review: ${props.operator.trading_review.status} / ${props.operator.trading_review.display_name ?? props.operator.trading_review.active_candidate_id ?? "none"} / selected ${props.operator.trading_review.selected_matches_trading_review ? "matches" : "differs"}`}
        </Text>
        <Text>
          {`Trading review packet: ${props.operator.trading_review.review_packet.verdict.severity} / top ${props.operator.trading_review.review_packet.verdict.top_blocker ?? "none"} / next ${props.operator.trading_review.review_packet.next_action}`}
        </Text>
        <Text>
          {`Review subject: ${formatTradingReviewSubject(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review evidence window: ${formatTradingReviewEvidenceWindow(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review blockers: ${formatTradingReviewBlockers(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review authority: ${formatTradingReviewAuthority(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review runner: ${formatTradingReviewRunner(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review ledger: ${formatTradingReviewLedger(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review lineage: ${formatTradingReviewLineage(props.operator.trading_review.review_packet)}`}
        </Text>
        {props.operator.trading_review.review_packet.lineage.paper_board_learning ? (
          <Text>
            {`Review lineage learning: ${formatTradingReviewLineageLearning(props.operator.trading_review.review_packet)}`}
          </Text>
        ) : null}
        <Text>
          {`Review provenance: ${formatTradingReviewProvenance(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Review risk: ${formatTradingReviewRisk(props.operator.trading_review.review_packet)}`}
        </Text>
        <Text>
          {`Trading promotion: ${props.operator.trading_promotion?.status ?? "not_promoted"} / ${props.operator.trading_promotion?.readiness_status ?? "paper_required"}`}
        </Text>
        <Text>{`Paper Trading Evaluation: ${paperEvaluation.status}`}</Text>
        <Text>
          {`Paper runner: ${formatPaperRunner(paperEvaluation)}`}
        </Text>
        <Text>
          {`Paper score: ${paperEvaluation.profit_loss.net_revenue_usdt.toFixed(2)} USDT / observations ${paperEvaluation.observation_count}`}
        </Text>
        <Text>{`Paper market snapshot: ${marketSnapshot ? `${marketSnapshot.symbol} ${marketSnapshot.price.toFixed(2)} @ ${marketSnapshot.observed_at}` : "not observed"}`}</Text>
        <Text>{`Gateway market data: ${paperEvaluation.market_data_source}${marketSnapshot?.source_priority ? ` / ${marketSnapshot.source_priority}` : ""}${marketSnapshot?.rest_fallback_used ? " / REST fallback" : ""}${marketSnapshot?.ws_connected === true ? " / WS connected" : ""}${marketSnapshot?.ws_connected === false ? " / WS disconnected" : ""}`}</Text>
        <Text>{`Public execution evidence: ${formatPublicExecutionEvidence(paperEvaluation)}`}</Text>
        <Text>{`Public order book evidence: ${formatOrderBook(paperEvaluation)}`}</Text>
        <Text>{`Paper decision: ${formatPaperDecision(paperDecision)}`}</Text>
        <Text>{`Paper account: ${formatPaperAccount(paperEvaluation)}`}</Text>
        <Text>{`Paper fill: ${formatPaperFill(paperEvaluation)}`}</Text>
        {formatPaperFailure(paperEvaluation) ? (
          <Text>{formatPaperFailure(paperEvaluation)}</Text>
        ) : null}
        <Text>{`Paper ledger chain: ${paperEvaluation.ledger_chain_complete ? "complete" : "not complete"}`}</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Paper Board</Text>
        {props.operator.paper_trading_board.entries.length
          ? props.operator.paper_trading_board.entries.slice(0, 5).map((entry) => (
              <Box key={entry.evaluation_id} flexDirection="column">
                <Text>
                  {`#${entry.rank} ${entry.display_name} ${entry.profit_loss.net_revenue_usdt.toFixed(2)} USDT / ${entry.qualification_status} / gate ${entry.promotion_gate_status}`}
                </Text>
                <Text dimColor>
                  {`   window ${entry.evidence_window.observation_count} obs, ${entry.evidence_window.failed_observation_count} failed, ${entry.evidence_window.elapsed_ms}ms`}
                </Text>
                <Text dimColor>
                  {`   paper runner ${entry.runner_status}, market provenance ${entry.market_data_source}${entry.latest_public_execution_source ? ` / ${entry.latest_public_execution_source}` : ""}, paper fill ${entry.latest_fill_status ?? "none"}, paper open orders ${entry.open_order_count}`}
                </Text>
                <Text dimColor>
                  {`   trend ${formatPaperBoardTrend(entry)}; blockers ${formatPaperBoardBlockerDensity(entry)}`}
                </Text>
                {entry.qualification_reasons.length ? (
                  <Text dimColor>{`   ${entry.qualification_reasons.join(", ")}`}</Text>
                ) : null}
              </Box>
            ))
          : <Text>No paper evaluations yet.</Text>}
      </Box>
      <Box flexDirection="column">
        <Text bold>Agent Providers</Text>
        {props.operator.agent_profiles.map((profile) => (
          <Text key={profile.profile_id}>
            {`${profile.label}: ${profile.status} (${profile.provider})`}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text bold>Latest Ticks</Text>
        {props.operator.candidate_arena.latest_ticks.length
          ? props.operator.candidate_arena.latest_ticks.slice(0, 3).map((tick) => (
              <Box key={tick.tick_id} flexDirection="column">
                <Text>{formatCandidateArenaTickSummary(tick)}</Text>
                <Text dimColor>{formatCandidateArenaTickSource(tick)}</Text>
                <Text dimColor>{formatCandidateArenaTickDirections(tick)}</Text>
                <Text dimColor>{formatCandidateArenaTickEfficiency(tick)}</Text>
              </Box>
            ))
          : <Text>No Candidate Arena ticks recorded.</Text>}
      </Box>
      <Box flexDirection="column">
        <Text bold>Latest Commands</Text>
        {props.operator.latest_commands.length
          ? props.operator.latest_commands.slice(0, 4).map((command) => {
              const remediation = commandRemediation(command);
              return (
                <Box key={command.command_id} flexDirection="column">
                  <Text>
                    {`${command.command_kind}: ${command.error ? `${command.status} / ${command.error}` : command.status}`}
                  </Text>
                  {remediation ? (
                    <>
                      <Text dimColor>{`${remediation.group} / ${remediation.surface}`}</Text>
                      <Text dimColor>{`${remediation.remediation} / ${remediation.authority_status}`}</Text>
                    </>
                  ) : null}
                </Box>
              );
            })
          : <Text>none</Text>}
      </Box>
      {props.message && <Text color="green">{props.message}</Text>}
    </Box>
  );
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

function formatPaperBoardTrend(entry: OperatorReadModel["paper_trading_board"]["entries"][number]): string {
  return [
    entry.trend.direction,
    `delta ${formatSignedFixed(entry.trend.net_revenue_delta_usdt)} USDT`,
    `return ${formatSignedFixed(entry.trend.net_return_delta_pct)}%`,
    `${entry.trend.observation_count_delta} obs`,
    entry.trend.authority_status
  ].join(" / ");
}

function formatPaperBoardBlockerDensity(entry: OperatorReadModel["paper_trading_board"]["entries"][number]): string {
  return [
    `${entry.blocker_density.blocker_count}`,
    `density ${entry.blocker_density.blocker_density}`,
    `failed ${entry.blocker_density.failed_observation_ratio}`,
    `top ${entry.blocker_density.top_blocker ?? "none"}`,
    entry.blocker_density.authority_status
  ].join(" / ");
}

function formatSignedFixed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatUsdt(value: number): string {
  return `${value.toFixed(2)} USDT`;
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
      ? `failure ${formatPaperFailure(packet.risk)?.replace(/^Failure: /, "")}`
      : undefined
  ].filter(Boolean).join(" / ");
}

function formatPaperDecision(
  decision: OperatorReadModel["selected_paper_trading_evaluation"]["latest_decision"]
): string {
  if (!decision) {
    return "not observed";
  }
  if (decision.decision_kind !== "order_request" || !decision.order_request) {
    return `${decision.decision_kind} (${decision.reason})`;
  }
  return [
    "order_request",
    `${decision.order_request.side} ${decision.order_request.order_type}`,
    decision.order_request.quantity,
    decision.order_request.limit_price ? `@ ${decision.order_request.limit_price}` : undefined
  ].filter(Boolean).join(" ");
}

function formatPaperAccount(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const account = paperEvaluation.paper_account_snapshot;
  if (!account) {
    return "not observed";
  }
  return `equity ${account.equity_usdt} USDT / ${account.position.side} ${account.position.quantity} BTCUSDT / open ${account.open_order_count}`;
}

function formatPaperFill(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const fill = paperEvaluation.latest_fill;
  if (!fill) {
    return "none";
  }
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
    return `Failure: ${input.latest_failure.failure_kind} / ${input.latest_failure.summary} / next ${input.latest_failure.next_action} / raw ${input.latest_failure.reason}`;
  }
  return input.latest_failure_reason ? `Failure: ${input.latest_failure_reason}` : undefined;
}

function formatPaperRunner(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const runnerStatus = paperRunnerStatus(paperEvaluation);
  return [
    runnerStatus,
    runnerStatus === "needs resume" ? "persisted running, timer inactive" : undefined,
    paperEvaluation.next_observation_at ? `next ${paperEvaluation.next_observation_at}` : undefined
  ].filter(Boolean).join(" / ");
}

function paperRunnerStatus(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  if (paperEvaluation.runner_active) {
    return "active";
  }
  if (paperEvaluation.status === "running") {
    return "needs resume";
  }
  if (paperEvaluation.status === "not_started") {
    return "not started";
  }
  return paperEvaluation.status;
}

function formatPublicExecutionEvidence(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const snapshot = paperEvaluation.latest_public_execution_snapshot;
  if (!snapshot) {
    return "not observed";
  }
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

function formatOrderBook(
  paperEvaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): string {
  const orderBook = paperEvaluation.latest_public_execution_snapshot?.order_book;
  if (!orderBook) {
    return "not observed";
  }
  return `${orderBook.sync_status} / update ${orderBook.last_update_id ?? "unknown"}${orderBook.gap_detected ? " / gap recovered" : ""}`;
}

export function operatorTuiActionForInput(
  input: string,
  key: { upArrow?: boolean; downArrow?: boolean; return?: boolean }
): OperatorTuiAction | undefined {
  if (input === "q") {
    return "quit";
  }
  if (input === "r") {
    return "refresh";
  }
  if (input === "t") {
    return "tick";
  }
  if (input === "s") {
    return "toggle_running";
  }
  if (input === "e") {
    return "start_paper_trading";
  }
  if (input === "m") {
    return "promote_trading_candidate";
  }
  if (input === "o") {
    return "observe_paper_trading";
  }
  if (input === "x") {
    return "stop_paper_trading";
  }
  if (input === "p") {
    return "toggle_provider";
  }
  if (input === "a") {
    return "setup_provider";
  }
  if (input === "l") {
    return "start_provider_login";
  }
  if (input === "v") {
    return "probe_provider";
  }
  if (key.upArrow) {
    return "select_previous";
  }
  if (key.downArrow) {
    return "select_next";
  }
  if (key.return) {
    return "select_current";
  }
  return undefined;
}

export function operatorTuiCommandForAction(
  action: OperatorTuiAction,
  operator: OperatorReadModel | null,
  cursor: number
): OuroborosCommandRequest | undefined {
  if (action === "tick") {
    return { command_kind: "arena.tick" };
  }
  if (action === "toggle_running") {
    return {
      command_kind: operator?.candidate_arena.runner_status === "running"
        ? "arena.stop"
        : "arena.start"
    };
  }
  if (action === "select_current") {
    const candidateId = operator?.candidate_arena.leaderboard[cursor]?.candidate_id;
    return candidateId
      ? { command_kind: "candidate.select", payload: { candidate_id: candidateId } }
      : undefined;
  }
  if (action === "start_paper_trading") {
    const candidateId = operator?.selected_candidate_id
      ?? operator?.candidate_arena.leaderboard[cursor]?.candidate_id;
    return candidateId
      ? { command_kind: "trading_run.start", payload: { candidate_id: candidateId } }
      : undefined;
  }
  if (action === "promote_trading_candidate") {
    const candidateId = operator?.selected_candidate_id
      ?? operator?.candidate_arena.leaderboard[cursor]?.candidate_id;
    return candidateId
      ? { command_kind: "trading_candidate.promote", payload: { candidate_id: candidateId } }
      : undefined;
  }
  if (action === "observe_paper_trading") {
    const tradingRunId = operator?.trading_review.paper_trading_evaluation.trading_run_id ??
      operator?.selected_paper_trading_evaluation.trading_run_id;
    return tradingRunId
      ? { command_kind: "trading_run.observe", payload: { trading_run_id: tradingRunId } }
      : undefined;
  }
  if (action === "stop_paper_trading") {
    const tradingRunId = operator?.trading_review.paper_trading_evaluation.trading_run_id ??
      operator?.selected_paper_trading_evaluation.trading_run_id;
    return tradingRunId
      ? { command_kind: "trading_run.stop", payload: { trading_run_id: tradingRunId } }
      : undefined;
  }
  if (action === "toggle_provider") {
    const selected = operator?.researcher_provider.selected_provider;
    return {
      command_kind: "researcher.provider.select",
      payload: {
        provider: selected === "codex" ? "fixture" : "codex"
      }
    };
  }
  if (action === "setup_provider") {
    const provider = operator?.researcher_provider.selected_provider;
    return provider
      ? { command_kind: "agent_provider.setup", payload: { provider } }
      : undefined;
  }
  if (action === "start_provider_login") {
    const provider = operator?.researcher_provider.selected_provider;
    return provider
      ? { command_kind: "agent_provider.login.start", payload: { provider } }
      : undefined;
  }
  if (action === "probe_provider") {
    const provider = operator?.researcher_provider.selected_provider;
    return provider
      ? { command_kind: "agent_provider.probe", payload: { provider } }
      : undefined;
  }
  return undefined;
}

async function runTuiAction(
  action: OperatorTuiAction,
  operator: OperatorReadModel | null,
  cursor: number,
  runtimeBaseUrl: string,
  fetcher: FetchLike,
  operatorApiToken?: string
): Promise<string | undefined> {
  if (action === "refresh") {
    return "refreshed";
  }
  const command = operatorTuiCommandForAction(action, operator, cursor);
  if (!command) {
    return "No candidate selected.";
  }
  const response = await runtimeFetch(fetcher, `${runtimeBaseUrl}/api/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command.payload ? command : { command_kind: command.command_kind })
  }, operatorApiToken);
  const body = await response.json() as {
    command?: { command_kind: OuroborosCommandKind; status: string; summary?: string };
    error?: string;
    required_command?: string;
  };
  if (!response.ok) {
    return body.required_command
      ? `${body.error ?? "command_failed"}; next: ${body.required_command}`
      : body.error ?? "command_failed";
  }
  return body.command?.summary ?? `${command.command_kind} ${body.command?.status ?? "sent"}.`;
}

async function fetchOperatorReadModel(
  runtimeBaseUrl: string,
  fetcher: FetchLike,
  operatorApiToken?: string
): Promise<OperatorReadModel> {
  const response = await runtimeFetch(fetcher, `${runtimeBaseUrl}/api/operator`, undefined, operatorApiToken);
  if (!response.ok) {
    throw new Error(`operator read failed: ${response.status}`);
  }
  const body = await response.json() as { operator: OperatorReadModel };
  return body.operator;
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
  return configuredToken?.trim() || process.env.OUROBOROS_OPERATOR_API_TOKEN?.trim() || undefined;
}

function clampCursor(cursor: number, operator: OperatorReadModel): number {
  const max = Math.max(operator.candidate_arena.leaderboard.length - 1, 0);
  return Math.max(0, Math.min(cursor, max));
}

function visibleLeaderboardWindow(
  leaderboard: OperatorReadModel["candidate_arena"]["leaderboard"],
  cursor: number
): Array<{ entry: OperatorReadModel["candidate_arena"]["leaderboard"][number]; index: number }> {
  const windowSize = 8;
  const start = Math.max(
    0,
    Math.min(cursor - windowSize + 1, Math.max(leaderboard.length - windowSize, 0))
  );
  return leaderboard
    .slice(start, start + windowSize)
    .map((entry, offset) => ({
      entry,
      index: start + offset
    }));
}
