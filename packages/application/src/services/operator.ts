import { randomUUID } from "node:crypto";
import {
  OUROBOROS_COMMAND_DESCRIPTORS,
  type AgentProfileProviderKind,
  type CandidateInspectReadModel,
  type OperatorReadModel,
  type OuroborosCommandKind,
  type OuroborosCommandReadModel,
  type OuroborosCommandRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type ResearcherProviderReadModel
} from "@ouroboros/domain";
import {
  listAgentProfileReadModels,
  parseAgentProfileProvider,
  probeAgentProfile,
  setupAgentProfile,
  UnsupportedAgentProviderError,
  type AgentProfileExecFile
} from "../agent/profiles";
import { buildCandidateArenaReadModel, type CandidateArenaRunner } from "../candidate/arena";
import type {
  OperatorCommandExecution,
  OperatorCommandHandlerRegistry,
  OperatorMutationPort,
  SelectedCandidatePaperEvidencePort
} from "../ports/operator";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import type { TradingResearchRuntimeAgent } from "../trading/research/runtime-config";

export class OperatorCommandError extends Error {
  constructor(
    readonly statusCode: number,
    readonly error: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(error);
    this.name = "OperatorCommandError";
  }
}

export interface OperatorServiceOptions {
  store: OuroborosStorePort;
  candidateArenaRunner: CandidateArenaRunner;
  paperEvidenceAdapter: SelectedCandidatePaperEvidencePort;
  mutationPort?: OperatorMutationPort;
  agentProfileExecFile?: AgentProfileExecFile;
  paperTradingEvaluationRunner?: {
    active(tradingRunId: string): boolean;
  };
}

export class OperatorService {
  private selectedCandidateId: string | undefined;

  constructor(private readonly options: OperatorServiceOptions) {}

  async readOperator(): Promise<OperatorReadModel> {
    const arena = await buildCandidateArenaReadModel(
      this.options.store,
      this.options.candidateArenaRunner.status(),
      this.options.candidateArenaRunner.ticks()
    );
    const candidateId = this.selectedCandidateId ?? arena.leaderboard[0]?.candidate_id;
    const selectedCandidate = candidateId
      ? await this.options.store.getCandidate(candidateId)
      : undefined;
    const selectedEvaluation = selectedCandidate
      ? await this.options.store.getLatestPaperTradingEvaluationForCandidate(selectedCandidate.candidate_id)
      : undefined;
    const selectedObservations = selectedEvaluation
      ? await this.options.store.listPaperTradingObservations(selectedEvaluation.paper_trading_evaluation_id)
      : [];
    const selectedEvaluationRunnerActive = selectedEvaluation
      ? this.options.paperTradingEvaluationRunner?.active(selectedEvaluation.trading_run_ref.id) ??
        selectedEvaluation.status === "running"
      : false;
    if (this.selectedCandidateId && candidateId === this.selectedCandidateId && !selectedCandidate) {
      this.selectedCandidateId = undefined;
    }
    const latestCommands = (await this.options.store.listOuroborosCommands())
      .slice(0, 8)
      .map(toOuroborosCommandReadModel);
    return {
      operator_kind: "ouroboros_operator",
      command_descriptors: OUROBOROS_COMMAND_DESCRIPTORS,
      candidate_arena: arena,
      selected_candidate_id: selectedCandidate?.candidate_id ?? null,
      selected_candidate: selectedCandidate ?? null,
      selected_paper_evidence: selectedPaperEvidence(selectedCandidate),
      selected_paper_trading_evaluation: selectedPaperTradingEvaluation(
        selectedCandidate,
        selectedEvaluation,
        selectedObservations,
        selectedEvaluationRunnerActive
      ),
      researcher_provider: await this.readResearcherProvider(),
      agent_profiles: await listAgentProfileReadModels(this.options.store),
      latest_commands: latestCommands,
      live_disabled: true,
      authority_status: "not_live"
    };
  }

  async readResearcherProvider(): Promise<ResearcherProviderReadModel> {
    const selection = await this.options.store.getResearcherProviderSelection();
    const selectedProvider = isTradingResearchRuntimeAgent(selection?.selected_provider)
      ? selection.selected_provider
      : this.options.candidateArenaRunner.researchAgent();
    return {
      selected_provider: selectedProvider,
      available_providers: ["codex", "fixture"],
      authority_status: "research_only"
    };
  }

  async recordCommand(input: {
    commandKind: OuroborosCommandKind;
    requestId?: string;
    status: "succeeded" | "failed";
    requestedAt: string;
    summary?: string;
    error?: string;
  }): Promise<OuroborosCommandReadModel> {
    const completedAt = new Date().toISOString();
    const record: OuroborosCommandRecord = {
      record_kind: "ouroboros_command",
      version: 1,
      ouroboros_command_id: [
        "ouroboros-command",
        safeId(input.commandKind),
        safeId(input.requestId ?? randomUUID())
      ].join("-"),
      command_kind: input.commandKind,
      request_id: input.requestId,
      status: input.status,
      requested_at: input.requestedAt,
      completed_at: completedAt,
      summary: input.summary,
      error: input.error,
      authority_status: "not_live"
    };
    return toOuroborosCommandReadModel(await this.options.store.recordOuroborosCommand(record));
  }

  async executeCommand(
    commandKind: OuroborosCommandKind,
    payload: Record<string, unknown> | undefined
  ): Promise<OperatorCommandExecution> {
    return this.commandHandlers()[commandKind](payload);
  }

  private commandHandlers(): OperatorCommandHandlerRegistry {
    return {
      "arena.status": async () => ({
        result: {
          arena: await buildCandidateArenaReadModel(
            this.options.store,
            this.options.candidateArenaRunner.status(),
            this.options.candidateArenaRunner.ticks()
          )
        },
        summary: "Candidate Arena status read."
      }),
      "arena.start": async () => {
        await this.requireResearcherProviderReady();
        const status = this.options.candidateArenaRunner.start();
        return {
          result: {
            status,
            candidate_arena: await buildCandidateArenaReadModel(
              this.options.store,
              this.options.candidateArenaRunner.status(),
              this.options.candidateArenaRunner.ticks()
            )
          },
          summary: `Candidate Arena ${status}.`
        };
      },
      "arena.stop": async () => {
        const status = this.options.candidateArenaRunner.stop();
        return {
          result: {
            status,
            candidate_arena: await buildCandidateArenaReadModel(
              this.options.store,
              this.options.candidateArenaRunner.status(),
              this.options.candidateArenaRunner.ticks()
            )
          },
          summary: `Candidate Arena ${status}.`
        };
      },
      "arena.tick": async () => {
        await this.requireResearcherProviderReady();
        const outcome = await this.options.candidateArenaRunner.tick();
        return {
          result: outcome,
          summary: `Candidate Arena tick created ${outcome.created_candidate_count} candidates.`
        };
      },
      "candidate.select": async (payload) => {
        const candidateId = parseCommandCandidateId(payload);
        const candidate = await this.options.store.getCandidate(candidateId);
        if (!candidate) {
          throw new OperatorCommandError(404, "candidate_not_found", { candidate_id: candidateId });
        }
        this.selectedCandidateId = candidateId;
        return {
          result: { candidate },
          summary: `Selected candidate ${candidateId}.`
        };
      },
      "candidate.paper_evidence.run": async (payload) => {
        const candidateId = parseCommandCandidateId(payload);
        const candidate = await this.options.store.getCandidate(candidateId);
        if (!candidate) {
          throw new OperatorCommandError(404, "candidate_not_found", { candidate_id: candidateId });
        }
        this.selectedCandidateId = candidateId;
        const response = await this.options.paperEvidenceAdapter.run(candidateId);
        if (response.statusCode >= 400) {
          throw new OperatorCommandError(response.statusCode, "paper_evidence_failed", response.body);
        }
        return {
          result: response.body,
          summary: `Paper evidence recorded for ${candidateId}.`
        };
      },
      "candidate.evaluation.run": (payload) => this.executeMutationPort("candidate.evaluation.run", payload),
      "candidate.replay.run": (payload) => this.executeMutationPort("candidate.replay.run", payload),
      "trading_run.start": async (payload) => {
        this.selectedCandidateId = parseCommandCandidateId(payload);
        return this.executeMutationPort("trading_run.start", payload);
      },
      "trading_run.observe": (payload) => this.executeMutationPort("trading_run.observe", payload),
      "trading_run.stop": (payload) => this.executeMutationPort("trading_run.stop", payload),
      "run_control.record": (payload) => this.executeMutationPort("run_control.record", payload),
      "private_readiness_posture.record": (payload) => this.executeMutationPort("private_readiness_posture.record", payload),
      "sandbox.start": (payload) => this.executeMutationPort("sandbox.start", payload),
      "sandbox.stop": (payload) => this.executeMutationPort("sandbox.stop", payload),
      "agent_provider.status": async (payload) => {
        const provider = optionalCommandProvider(payload);
        const profiles = await listAgentProfileReadModels(this.options.store);
        return {
          result: provider
            ? { profile: profiles.find((profile) => profile.profile_id === provider) }
            : { profiles },
          summary: "Agent provider status read."
        };
      },
      "agent_provider.setup": async (payload) => {
        const provider = requiredCommandProvider(payload);
        const profile = await mapUnsupportedAgentProvider(() =>
          setupAgentProfile({ store: this.options.store, profileId: provider })
        );
        return {
          result: { profile },
          summary: `Agent provider ${provider} configured.`
        };
      },
      "agent_provider.login.start": async (payload) => {
        const provider = requiredCommandProvider(payload);
        throw new OperatorCommandError(403, "agent_provider_login_requires_local_cli", {
          provider,
          required_command: `ouroboros agent login ${provider}`
        });
      },
      "agent_provider.probe": async (payload) => {
        const provider = requiredCommandProvider(payload);
        const profile = await mapUnsupportedAgentProvider(() =>
          probeAgentProfile({
            store: this.options.store,
            profileId: provider,
            execFile: this.options.agentProfileExecFile
          })
        );
        return {
          result: { profile },
          summary: `Agent provider ${provider} probed.`
        };
      },
      "researcher.provider.select": async (payload) => {
        const provider = requiredResearcherProvider(payload);
        const profiles = await listAgentProfileReadModels(this.options.store);
        const profile = profiles.find((item) => item.profile_id === provider);
        if (!profile || profile.status === "not_configured" || profile.status === "unsupported") {
          throw new OperatorCommandError(409, "agent_provider_not_configured", {
            provider,
            required_command: `ouroboros agent setup ${provider}`
          });
        }
        if (profile.status !== "authenticated") {
          throw new OperatorCommandError(409, "agent_provider_not_authenticated", {
            provider,
            profile_status: profile.status,
            required_command: `ouroboros agent login ${provider}`
          });
        }
        const selected = await this.options.store.recordResearcherProviderSelection({
          record_kind: "researcher_provider_selection",
          version: 1,
          researcher_provider_selection_id: "researcher",
          selected_provider: provider,
          updated_at: new Date().toISOString(),
          authority_status: "research_only"
        });
        this.options.candidateArenaRunner.setResearchAgent(provider);
        return {
          result: {
            researcher_provider: await this.readResearcherProvider(),
            selection: selected
          },
          summary: `Researcher provider selected: ${provider}.`
        };
      }
    };
  }

  private async requireResearcherProviderReady(): Promise<void> {
    const provider = (await this.readResearcherProvider()).selected_provider;
    if (provider === "fixture") {
      return;
    }
    const profile = (await listAgentProfileReadModels(this.options.store))
      .find((item) => item.profile_id === provider);
    if (!profile || profile.status === "not_configured" || profile.status === "unsupported") {
      throw new OperatorCommandError(409, "agent_provider_not_configured", {
        provider,
        profile_status: profile?.status ?? "not_configured",
        required_command: `ouroboros agent setup ${provider}`
      });
    }
    if (profile.status !== "authenticated") {
      throw new OperatorCommandError(409, "agent_provider_not_authenticated", {
        provider,
        profile_status: profile.status,
        required_command: `ouroboros agent login ${provider}`
      });
    }
  }

  private async executeMutationPort(
    commandKind: OuroborosCommandKind,
    payload: Record<string, unknown> | undefined
  ): Promise<OperatorCommandExecution> {
    if (!this.options.mutationPort) {
      throw new OperatorCommandError(501, "operator_mutation_not_configured", { command_kind: commandKind });
    }
    const response = await this.options.mutationPort.run(commandKind, payload);
    if (response.statusCode >= 400) {
      throw new OperatorCommandError(response.statusCode, "operator_mutation_failed", response.body);
    }
    return {
      result: response.body,
      summary: `${commandKind} completed.`
    };
  }
}

function parseCommandCandidateId(payload: Record<string, unknown> | undefined): string {
  const candidateId = payload?.candidate_id;
  if (typeof candidateId === "string" && candidateId.trim()) {
    return candidateId;
  }
  throw new OperatorCommandError(400, "invalid_candidate_id", {
    required_payload: { candidate_id: "string" }
  });
}

async function mapUnsupportedAgentProvider<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof UnsupportedAgentProviderError) {
      throw new OperatorCommandError(422, "unsupported_agent_provider", {
        provider: error.provider,
        supported_providers: ["codex", "fixture"]
      });
    }
    throw error;
  }
}

function optionalCommandProvider(payload: Record<string, unknown> | undefined): AgentProfileProviderKind | undefined {
  if (!payload || payload.provider === undefined) {
    return undefined;
  }
  const provider = parseAgentProfileProvider(payload?.provider);
  if (provider) {
    return provider;
  }
  throw new OperatorCommandError(400, "invalid_agent_provider", {
    allowed_values: ["codex", "fixture", "claude_code"]
  });
}

function requiredCommandProvider(payload: Record<string, unknown> | undefined): AgentProfileProviderKind {
  const provider = optionalCommandProvider(payload);
  if (provider) {
    return provider;
  }
  throw new OperatorCommandError(400, "invalid_agent_provider", {
    allowed_values: ["codex", "fixture", "claude_code"]
  });
}

function requiredResearcherProvider(payload: Record<string, unknown> | undefined): TradingResearchRuntimeAgent {
  const provider = requiredCommandProvider(payload);
  if (isTradingResearchRuntimeAgent(provider)) {
    return provider;
  }
  throw new OperatorCommandError(422, "unsupported_researcher_provider", {
    provider,
    supported_providers: ["codex", "fixture"]
  });
}

export function isTradingResearchRuntimeAgent(value: unknown): value is TradingResearchRuntimeAgent {
  return value === "codex" || value === "fixture";
}

export function toOuroborosCommandReadModel(record: OuroborosCommandRecord): OuroborosCommandReadModel {
  return {
    command_id: record.ouroboros_command_id,
    command_kind: record.command_kind,
    request_id: record.request_id,
    status: record.status,
    requested_at: record.requested_at,
    completed_at: record.completed_at,
    error: record.error,
    summary: record.summary,
    authority_status: "not_live"
  };
}

export function selectedPaperEvidence(
  candidate: CandidateInspectReadModel | undefined
): OperatorReadModel["selected_paper_evidence"] {
  const ledger = candidate?.ledger;
  if (!candidate || !ledger?.has_activity) {
    return {
      status: "not_run",
      ledger_chain_complete: false,
      authority_status: "not_live"
    };
  }
  return {
    status: ledger.chain_complete ? "ledger_chain_complete" : "failed",
    ledger_chain_complete: ledger.chain_complete,
    ledger_chain_count: ledger.chain_count,
    latest_order_request_id: ledger.latest_order_request?.order_request_id,
    latest_gateway_outcome: ledger.latest_gateway_result?.decision_outcome,
    latest_execution_status: ledger.latest_execution_result?.status,
    trading_run_status: candidate.trading_run?.lifecycle_status
      ?? candidate.runtime.runtime_lifecycle_status,
    failure_reason: ledger.chain_complete ? undefined : "ledger_chain_incomplete",
    authority_status: "not_live"
  };
}

export function selectedPaperTradingEvaluation(
  candidate: CandidateInspectReadModel | undefined,
  evaluation?: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[] = [],
  runnerActive = false
): OperatorReadModel["selected_paper_trading_evaluation"] {
  if (!candidate) {
    return paperTradingEvaluationReadModel({
      status: "not_started",
      runnerActive: false,
      observationCount: 0,
      ledgerChainComplete: false,
      profitLoss: zeroProfitLoss()
    });
  }

  const ledger = candidate.ledger;
  const latestObservation = observations.at(-1);
  if (evaluation) {
    return paperTradingEvaluationReadModel({
      evaluationId: evaluation.paper_trading_evaluation_id,
      candidateId: evaluation.candidate_ref.id,
      candidateVersionId: evaluation.candidate_version_ref.id,
      status: evaluation.status,
      tradingRunId: evaluation.trading_run_ref.id,
      tradingRunStatus: candidate.trading_run?.lifecycle_status,
      runnerActive,
      intervalMs: evaluation.interval_ms,
      observationCount: evaluation.observation_count,
      startedAt: evaluation.started_at,
      lastObservedAt: evaluation.last_observed_at,
      nextObservationAt: evaluation.next_observation_at,
      stoppedAt: evaluation.stopped_at,
      ledgerChainComplete: ledger?.chain_complete ?? false,
      profitLoss: evaluation.latest_score,
      latestMarketSnapshot: latestObservation?.market_snapshot,
      latestOrderRequestId: ledger?.latest_order_request?.order_request_id,
      latestGatewayOutcome: ledger?.latest_gateway_result?.decision_outcome,
      latestExecutionStatus: ledger?.latest_execution_result?.status,
      latestFailureReason: evaluation.latest_failure_reason
    });
  }

  const tradingRunStatus = candidate.trading_run?.lifecycle_status;
  const status = paperTradingEvaluationStatus(tradingRunStatus, ledger?.has_activity ?? false);
  return paperTradingEvaluationReadModel({
    status,
    runnerActive: false,
    tradingRunId: candidate.trading_run?.ref.id,
    tradingRunStatus,
    observationCount: ledger?.chain_count ?? 0,
    ledgerChainComplete: ledger?.chain_complete ?? false,
    profitLoss: paperTradingProfitLoss(candidate),
    latestOrderRequestId: ledger?.latest_order_request?.order_request_id,
    latestGatewayOutcome: ledger?.latest_gateway_result?.decision_outcome,
    latestExecutionStatus: ledger?.latest_execution_result?.status
  });
}

function paperTradingEvaluationStatus(
  tradingRunStatus: string | undefined,
  hasLedgerActivity: boolean
): OperatorReadModel["selected_paper_trading_evaluation"]["status"] {
  if (tradingRunStatus === "running" || tradingRunStatus === "starting") {
    return "running";
  }
  if (tradingRunStatus === "stopped" || tradingRunStatus === "stopping" || tradingRunStatus === "paused") {
    return "stopped";
  }
  if (tradingRunStatus === "failed" || tradingRunStatus === "killed" || tradingRunStatus === "human_review_required") {
    return "failed";
  }
  return hasLedgerActivity ? "stopped" : "not_started";
}

function paperTradingProfitLoss(
  candidate: CandidateInspectReadModel
): OperatorReadModel["selected_paper_trading_evaluation"]["profit_loss"] {
  const latestMarkPrice = parseFiniteNumber(
    candidate.trading_substrate?.latest_public_market_liveness_surface?.mark_price
  );
  const totals = (candidate.ledger?.chains ?? [])
    .filter((chain) =>
      chain.chain_complete &&
      chain.gateway_result?.decision_outcome === "dry_run_only" &&
      chain.execution_result?.status === "dry_run_recorded"
    )
    .reduce((acc, chain) => {
      const quantity = parseFiniteNumber(chain.order_request.quantity);
      const entryPrice = parseFiniteNumber(chain.order_request.limit_price) ?? latestMarkPrice;
      if (!quantity || !entryPrice || !chain.order_request.side) {
        return acc;
      }
      const currentPrice = latestMarkPrice ?? entryPrice;
      const revenue = chain.order_request.side === "sell"
        ? (entryPrice - currentPrice) * quantity
        : (currentPrice - entryPrice) * quantity;
      const notional = Math.abs(quantity * entryPrice);
      const cost = notional * 8 / 10_000;
      return {
        revenue_usdt: acc.revenue_usdt + revenue,
        cost_usdt: acc.cost_usdt + cost,
        net_revenue_usdt: acc.net_revenue_usdt + revenue - cost,
        net_return_pct: acc.net_return_pct
      };
    }, zeroProfitLoss());
  return {
    revenue_usdt: roundProfit(totals.revenue_usdt),
    cost_usdt: roundProfit(totals.cost_usdt),
    net_revenue_usdt: roundProfit(totals.net_revenue_usdt),
    net_return_pct: roundProfit(totals.net_revenue_usdt / 10_000 * 100)
  };
}

function paperTradingEvaluationReadModel(input: {
  evaluationId?: string;
  candidateId?: string;
  candidateVersionId?: string;
  status: OperatorReadModel["selected_paper_trading_evaluation"]["status"];
  tradingRunId?: string;
  tradingRunStatus?: OperatorReadModel["selected_paper_trading_evaluation"]["trading_run_status"];
  runnerActive: boolean;
  intervalMs?: number;
  observationCount: number;
  startedAt?: string;
  lastObservedAt?: string;
  nextObservationAt?: string;
  stoppedAt?: string;
  ledgerChainComplete: boolean;
  profitLoss: OperatorReadModel["selected_paper_trading_evaluation"]["profit_loss"];
  latestMarketSnapshot?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_market_snapshot"];
  latestOrderRequestId?: string;
  latestGatewayOutcome?: string;
  latestExecutionStatus?: string;
  latestFailureReason?: string;
}): OperatorReadModel["selected_paper_trading_evaluation"] {
  return {
    evaluation_kind: "paper_trading_evaluation",
    evaluation_id: input.evaluationId,
    status: input.status,
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    trading_run_id: input.tradingRunId,
    trading_run_status: input.tradingRunStatus,
    runner_active: input.runnerActive,
    interval_ms: input.intervalMs,
    observation_count: input.observationCount,
    started_at: input.startedAt,
    last_observed_at: input.lastObservedAt,
    next_observation_at: input.nextObservationAt,
    stopped_at: input.stoppedAt,
    ledger_chain_complete: input.ledgerChainComplete,
    profit_loss: input.profitLoss,
    latest_market_snapshot: input.latestMarketSnapshot,
    latest_order_request_id: input.latestOrderRequestId,
    latest_gateway_outcome: input.latestGatewayOutcome,
    latest_execution_status: input.latestExecutionStatus,
    latest_failure_reason: input.latestFailureReason,
    market_data_source: "binance_production_public_rest",
    account_provider: "fake_paper_account",
    executor: "fake_paper_order_executor",
    score_source: "paper_gateway_ledger",
    authority_status: "not_live"
  };
}

function zeroProfitLoss() {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
