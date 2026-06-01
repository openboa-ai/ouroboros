import React, { useEffect, useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import type {
  OperatorReadModel,
  OuroborosCommandKind,
  OuroborosCommandRequest
} from "@ouroboros/domain";

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
}): Promise<void> {
  const instance = render(
    <OperatorTui
      runtimeBaseUrl={input.runtimeBaseUrl}
      fetcher={input.fetch ?? fetch}
    />
  );
  await instance.waitUntilExit();
}

export function OperatorTui(props: {
  runtimeBaseUrl: string;
  fetcher: FetchLike;
}) {
  const [operator, setOperator] = useState<OperatorReadModel | null>(null);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const app = useApp();

  const refresh = async () => {
    try {
      const nextOperator = await fetchOperatorReadModel(props.runtimeBaseUrl, props.fetcher);
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
    void fetchOperatorReadModel(props.runtimeBaseUrl, props.fetcher)
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
  }, [props.runtimeBaseUrl, props.fetcher]);

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
    void runTuiAction(action, operator, cursor, props.runtimeBaseUrl, props.fetcher)
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
        <Text>{`Authority: ${props.operator.authority_status} / live ${props.operator.live_disabled ? "disabled" : "enabled"}`}</Text>
        <Text dimColor>Keys: r refresh, t tick, s arena, up/down move, enter select, e paper start, o observe, x stop, p provider, a setup, l login, v probe, q quit</Text>
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
        <Text>{`PaperTradingEvaluation: ${paperEvaluation.status}`}</Text>
        <Text>
          {`Runner: ${formatPaperRunner(paperEvaluation)}`}
        </Text>
        <Text>
          {`Paper score: ${paperEvaluation.profit_loss.net_revenue_usdt.toFixed(2)} USDT / observations ${paperEvaluation.observation_count}`}
        </Text>
        <Text>{`Market: ${marketSnapshot ? `${marketSnapshot.symbol} ${marketSnapshot.price.toFixed(2)} @ ${marketSnapshot.observed_at}` : "not observed"}`}</Text>
        <Text>{`Market data: ${paperEvaluation.market_data_source}${marketSnapshot?.source_priority ? ` / ${marketSnapshot.source_priority}` : ""}${marketSnapshot?.rest_fallback_used ? " / REST fallback" : ""}${marketSnapshot?.ws_connected === true ? " / WS connected" : ""}${marketSnapshot?.ws_connected === false ? " / WS disconnected" : ""}`}</Text>
        <Text>{`Public execution: ${formatPublicExecutionEvidence(paperEvaluation)}`}</Text>
        <Text>{`Order book: ${formatOrderBook(paperEvaluation)}`}</Text>
        <Text>{`Decision: ${formatPaperDecision(paperDecision)}`}</Text>
        <Text>{`Account: ${formatPaperAccount(paperEvaluation)}`}</Text>
        <Text>{`Fill: ${formatPaperFill(paperEvaluation)}`}</Text>
        <Text>{`Ledger chain: ${paperEvaluation.ledger_chain_complete ? "complete" : "not complete"}`}</Text>
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
        <Text bold>Latest Commands</Text>
        {props.operator.latest_commands.length
          ? props.operator.latest_commands.slice(0, 4).map((command) => (
              <Text key={command.command_id}>
                {`${command.command_kind}: ${command.status}`}
              </Text>
            ))
          : <Text>none</Text>}
      </Box>
      {props.message && <Text color="green">{props.message}</Text>}
    </Box>
  );
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
  if (action === "observe_paper_trading") {
    const tradingRunId = operator?.selected_paper_trading_evaluation.trading_run_id;
    return tradingRunId
      ? { command_kind: "trading_run.observe", payload: { trading_run_id: tradingRunId } }
      : undefined;
  }
  if (action === "stop_paper_trading") {
    const tradingRunId = operator?.selected_paper_trading_evaluation.trading_run_id;
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
  fetcher: FetchLike
): Promise<string | undefined> {
  if (action === "refresh") {
    return "refreshed";
  }
  const command = operatorTuiCommandForAction(action, operator, cursor);
  if (!command) {
    return "No candidate selected.";
  }
  const response = await fetcher(`${runtimeBaseUrl}/api/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command.payload ? command : { command_kind: command.command_kind })
  });
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
  fetcher: FetchLike
): Promise<OperatorReadModel> {
  const response = await fetcher(`${runtimeBaseUrl}/api/operator`);
  if (!response.ok) {
    throw new Error(`operator read failed: ${response.status}`);
  }
  const body = await response.json() as { operator: OperatorReadModel };
  return body.operator;
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
