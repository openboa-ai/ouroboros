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
  | "run_paper_evidence"
  | "toggle_provider"
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
        <Text>{`Authority: ${props.operator.authority_status} / live ${props.operator.live_disabled ? "disabled" : "enabled"}`}</Text>
        <Text dimColor>Keys: r refresh, t tick, s start/stop, up/down move, enter select, e evidence, p provider, q quit</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Leaderboard</Text>
        {props.operator.candidate_arena.leaderboard.length
          ? visibleLeaderboard.map(({ entry, index }) => (
              <Text
                key={entry.candidate_id}
                color={index === props.cursor ? "yellow" : undefined}
              >
                {`${index === props.cursor ? ">" : " "} #${entry.rank} ${entry.display_name} ${entry.direction_kind} ${entry.profit_loss.net_revenue_usdt.toFixed(2)} USDT ${entry.status}`}
              </Text>
            ))
          : <Text>No candidates yet. Press t to run a tick.</Text>}
      </Box>
      <Box flexDirection="column">
        <Text bold>Selected Candidate</Text>
        <Text>{selectedCandidateId ?? "none"}</Text>
        <Text>{`Paper evidence: ${props.operator.selected_paper_evidence.status}`}</Text>
        <Text>{`Ledger chain: ${props.operator.selected_paper_evidence.ledger_chain_complete ? "complete" : "not complete"}`}</Text>
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
    return "run_paper_evidence";
  }
  if (input === "p") {
    return "toggle_provider";
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
  if (action === "run_paper_evidence") {
    const candidateId = operator?.selected_candidate_id
      ?? operator?.candidate_arena.leaderboard[cursor]?.candidate_id;
    return candidateId
      ? { command_kind: "candidate.paper_evidence.run", payload: { candidate_id: candidateId } }
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
