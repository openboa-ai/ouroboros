import { fileURLToPath } from "node:url";
import type {
  AgentProfileProviderKind,
  AgentProfileReadModel,
  OperatorReadModel,
  OuroborosCommandReadModel,
  OuroborosCommandRequest
} from "@ouroboros/domain";
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
      fetch: deps.fetch ?? fetch
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
  if (parsed.mode === "status") {
    const operator = await fetchOperatorStatus(runtimeBaseUrl, deps.fetch ?? fetch);
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
    response = await (deps.fetch ?? fetch)(`${runtimeBaseUrl}/api/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(commandRequestBody(parsed.request))
    });
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
  fetcher: FetchLike
): Promise<OuroborosCliResult & { operator?: OperatorReadModel }> {
  let response: Response;
  try {
    response = await fetcher(`${runtimeBaseUrl}/api/operator`);
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
    `Authority: ${profile.authority_status}`
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
  const market = paper.latest_market_snapshot;
  const decision = paper.latest_decision;
  return [
    "Ouroboros status",
    `Arena: ${arena.runner_status} (${arena.tick_count} ticks, ${arena.leaderboard.length} candidates)`,
    `Researcher provider: ${operator.researcher_provider.selected_provider} (available: ${operator.researcher_provider.available_providers.join(", ")})`,
    selectedProfile
      ? `Agent profile: ${selectedProfile.label} ${selectedProfile.status}${selectedProfileNextStep ? `; next: ${selectedProfileNextStep}` : ""}`
      : undefined,
    `Live authority: ${operator.live_disabled ? "disabled" : "enabled"} / ${operator.authority_status}`,
    leader
      ? `Leader: #${leader.rank} ${leader.display_name} ${formatUsdt(leader.profit_loss.net_revenue_usdt)} (${formatPercent(leader.profit_loss.net_return_pct)})`
      : "Leader: none",
    `Selected candidate: ${operator.selected_candidate_id ?? "none"}`,
    `Paper evidence: ${operator.selected_paper_evidence.status}`,
    `PaperTradingEvaluation: ${paper.status} (${paper.observation_count} observations, ${formatUsdt(paper.profit_loss.net_revenue_usdt)})`,
    paperLeader
      ? `Paper board: #${paperLeader.rank} ${paperLeader.display_name} ${formatUsdt(paperLeader.profit_loss.net_revenue_usdt)} / ${paperLeader.promotion_gate_status}`
      : "Paper board: no paper evaluations",
    `Paper runner: ${formatPaperRunner(paper)}`,
    market
      ? `Market snapshot: ${market.symbol} ${formatUsdt(market.price)} @ ${market.observed_at}`
      : undefined,
    `Market data: ${paper.market_data_source}${market?.source_priority ? ` / ${market.source_priority}` : ""}${market?.rest_fallback_used ? " / REST fallback" : ""}${market?.ws_connected === true ? " / WS connected" : ""}${market?.ws_connected === false ? " / WS disconnected" : ""}`,
    paper.latest_public_execution_snapshot
      ? `Public execution: ${formatPublicExecutionEvidence(paper.latest_public_execution_snapshot)}`
      : undefined,
    paper.latest_public_execution_snapshot?.order_book
      ? `Order book: ${paper.latest_public_execution_snapshot.order_book.sync_status} / update ${paper.latest_public_execution_snapshot.order_book.last_update_id ?? "unknown"}${paper.latest_public_execution_snapshot.order_book.gap_detected ? " / gap recovered" : ""}`
      : undefined,
    decision ? `Paper decision: ${formatPaperDecision(decision)}` : undefined,
    paper.paper_account_snapshot
      ? `Paper account: equity ${formatUsdt(Number(paper.paper_account_snapshot.equity_usdt))} / ${formatPaperPosition(paper.paper_account_snapshot.position)} / open orders ${paper.paper_account_snapshot.open_order_count}`
      : undefined,
    paper.latest_fill
      ? `Paper fill: ${formatPaperFill(paper.latest_fill)}`
      : undefined,
    paper.latest_failure_reason ? `Paper failure: ${paper.latest_failure_reason}` : undefined,
    lastCommand
      ? `Latest command: ${lastCommand.command_kind} ${lastCommand.status}`
      : "Latest command: none"
  ].filter((line): line is string => Boolean(line)).join("\n");
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

function formatUsdt(value: number): string {
  return `${value.toFixed(2)} USDT`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(4)}%`;
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

function isArenaAction(value: string | undefined): value is "status" | "start" | "stop" | "tick" {
  return value === "status" || value === "start" || value === "stop" || value === "tick";
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
    "  ouroboros arena status|start|stop|tick",
    "  ouroboros candidate select <candidate-id>",
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
