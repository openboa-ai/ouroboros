import { randomUUID } from "node:crypto";
import {
  OUROBOROS_COMMAND_DESCRIPTORS,
  type AgentProfileProviderKind,
  type ArenaTradingSystemDetailReadModel,
  type CandidateArenaReadModel,
  type CandidateArenaTickPaperTradingContinuationReadModel,
  type CandidateInspectReadModel,
  type OperatorReadModel,
  type OuroborosCommandKind,
  type OuroborosCommandReadModel,
  type OuroborosCommandRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type PaperTradingQualificationStatus,
  type ResearcherProviderReadModel,
  type RuntimeSupervisorReadModel,
  type TradingProfitLossReadModel,
  type TradingPromotionComparisonConfirmationReadModel,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import {
  listAgentProfileReadModels,
  parseAgentProfileProvider,
  probeAgentProfile,
  setupAgentProfile,
  UnsupportedAgentProviderError,
  type AgentProfileExecFile
} from "../agent/profiles";
import {
  buildCandidateArenaReadModel,
  candidateArenaRunnerTickCountFromTicks,
  type CandidateArenaRunner,
  type CandidateArenaTickOutcome
} from "../candidate/arena";
import type {
  OperatorCommandExecution,
  OperatorCommandHandlerRegistry,
  OperatorMutationPort,
  SelectedCandidatePaperEvidencePort
} from "../ports/operator";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import type { TradingResearchRuntimeAgent } from "../trading/research/runtime-config";
import { classifyPaperTradingFailure } from "../trading/paper/failures";
import { paperTradingEvaluationCommitmentMatchesEvaluation } from "../trading/paper/commitment";
import { paperTradingLearningSummary } from "../trading/paper/learning";
import { paperTradingQualificationBlockerGroups } from "../trading/paper/qualification-blockers";
import { qualifyPaperTradingEvaluation } from "../trading/paper/qualification";
import {
  PaperTradingComparisonPromotionService,
  PaperTradingComparisonPromotionServiceError
} from "../trading/paper/comparison-promotion-service";
import type {
  ArenaPaperRuntimeService,
  ArenaPaperRuntimeSystem
} from "../trading/paper/arena-runtime";
import { ArenaOperationsProjectionService } from "./arena-operations";

const AUTONOMOUS_PAPER_CONTINUATION_ACK_TIMEOUT_MS = 1_000;
const AUTONOMOUS_PAPER_CONTINUATION_DRAIN_TIMEOUT_MS = 1_000;

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
  arenaPaperRuntime?: Pick<
    ArenaPaperRuntimeService,
    "snapshot" | "reconcile" | "fencePendingStarts"
  >;
  paperTradingComparisonPromotionService?: Pick<
    PaperTradingComparisonPromotionService,
    "promote"
  >;
  runtimeSupervisor?: {
    status(): RuntimeSupervisorReadModel;
  };
}

export class OperatorService {
  private selectedCandidateId: string | undefined;
  private readonly pendingAutonomousPaperStarts = new Set<Promise<unknown>>();
  private autonomousPaperStartFence = 0;

  constructor(private readonly options: OperatorServiceOptions) {}

  async readOperator(): Promise<OperatorReadModel> {
    const arena = await buildCandidateArenaReadModel(
      this.options.store,
      this.options.candidateArenaRunner.status(),
      this.options.candidateArenaRunner.ticks()
    );
    const candidateId = this.selectedCandidateId
      ?? selectedPaperContinuationCandidateId(arena)
      ?? arena.leaderboard[0]?.candidate_id;
    const selectedCandidate = candidateId
      ? await this.options.store.getCandidate(candidateId)
      : undefined;
    const selectedEvaluation = selectedCandidate
      ? await this.options.store.getLatestPaperTradingEvaluationForCandidate(selectedCandidate.candidate_id)
      : undefined;
    const selectedObservations = selectedEvaluation
      ? await this.options.store.listPaperTradingObservations(selectedEvaluation.paper_trading_evaluation_id)
      : [];
    const selectedCommitment = selectedEvaluation
      ? await paperTradingCommitmentForEvaluation(this.options.store, selectedEvaluation)
      : undefined;
    const selectedEvaluationRunnerActive = selectedEvaluation
      ? this.options.paperTradingEvaluationRunner?.active(selectedEvaluation.trading_run_ref.id) ??
        selectedEvaluation.status === "running"
      : false;
    const paperTradingBoard = await buildPaperTradingBoard(
      this.options.store,
      this.options.paperTradingEvaluationRunner
    );
    const arenaOperations = this.options.arenaPaperRuntime
      ? await this.arenaOperationsProjection().readOperations()
      : undefined;
    const tradingPromotion = await buildTradingPromotionReadModel({
      store: this.options.store,
      paperTradingBoard,
      runner: this.options.paperTradingEvaluationRunner
    });
    if (this.selectedCandidateId && candidateId === this.selectedCandidateId && !selectedCandidate) {
      this.selectedCandidateId = undefined;
    }
    const latestCommands = (await this.options.store.listOuroborosCommands())
      .slice(0, 8)
      .map(toOuroborosCommandReadModel);
    const selectedCandidateOverview = selectedCandidate
      ? toOperatorSelectedCandidateOverview(selectedCandidate)
      : undefined;
    return {
      operator_kind: "ouroboros_operator",
      command_descriptors: OUROBOROS_COMMAND_DESCRIPTORS,
      runtime_supervisor: this.options.runtimeSupervisor?.status() ??
        stoppedRuntimeSupervisorReadModel(),
      candidate_arena: arena,
      selected_candidate_id: selectedCandidate?.candidate_id ?? null,
      selected_candidate: selectedCandidateOverview ?? null,
      selected_paper_evidence: selectedPaperEvidence(selectedCandidate),
      selected_paper_trading_evaluation: selectedPaperTradingEvaluation(
        selectedCandidate,
        selectedEvaluation,
        selectedCommitment,
        selectedObservations,
        selectedEvaluationRunnerActive
      ),
      paper_trading_board: paperTradingBoard,
      ...(arenaOperations ? { arena_operations: arenaOperations } : {}),
      trading_promotion: tradingPromotion,
      trading_review: await buildTradingReviewReadModel({
        store: this.options.store,
        candidateArena: arena,
        selectedCandidateId: selectedCandidate?.candidate_id ?? null,
        tradingPromotion,
        paperTradingBoard,
        runner: this.options.paperTradingEvaluationRunner
      }),
      researcher_provider: await this.readResearcherProvider(),
      agent_profiles: await listAgentProfileReadModels(this.options.store),
      latest_commands: latestCommands,
      live_disabled: true,
      authority_status: "not_live"
    };
  }

  async readArenaTradingSystemDetail(
    candidateId: string
  ): Promise<ArenaTradingSystemDetailReadModel | undefined> {
    if (!this.options.arenaPaperRuntime) return undefined;
    return this.arenaOperationsProjection().readSystemDetail(candidateId);
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

  private arenaOperationsProjection(): ArenaOperationsProjectionService {
    return new ArenaOperationsProjectionService({
      store: this.options.store,
      arenaPaperRuntime: this.options.arenaPaperRuntime!
    });
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

  async resumeAutonomousArenaLoop(): Promise<"resumed" | "not_requested" | "blocked"> {
    const desiredStatus = autonomousArenaLoopDesiredStatus(
      await this.options.store.listOuroborosCommands()
    );
    if (desiredStatus !== "running") {
      return "not_requested";
    }

    try {
      await this.requireResearcherProviderReady();
    } catch {
      return "blocked";
    }

    this.installAutonomousArenaTickContinuation();
    await this.restoreCandidateArenaTickCount();
    this.options.candidateArenaRunner.start("recovery");
    return "resumed";
  }

  async drainAutonomousPaperStarts(): Promise<void> {
    this.options.arenaPaperRuntime?.fencePendingStarts();
    this.autonomousPaperStartFence += 1;
    const deadline = Date.now() + AUTONOMOUS_PAPER_CONTINUATION_DRAIN_TIMEOUT_MS;
    while (this.pendingAutonomousPaperStarts.size > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return;
      }
      await Promise.race([
        Promise.allSettled([...this.pendingAutonomousPaperStarts]),
        new Promise((resolve) => setTimeout(resolve, remainingMs))
      ]);
    }
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
        await this.restoreCandidateArenaTickCount();
        this.installAutonomousArenaTickContinuation();
        const status = this.options.candidateArenaRunner.start("goal");
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
        this.options.candidateArenaRunner.setTickContinuation(undefined);
        const status = this.options.candidateArenaRunner.stop();
        await this.drainAutonomousPaperStarts();
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
      "arena.cycle": async () => {
        await this.requireResearcherProviderReady();
        const outcome = await this.options.candidateArenaRunner.tick();
        const paperCycle = await this.startPaperTradingForArenaCycle(outcome);
        return {
          result: {
            arena_tick: outcome,
            selected_candidate_id: paperCycle.selected_candidate_id,
            paper_trading_status: paperCycle.status,
            paper_trading: paperCycle.paper_trading
          },
          summary: paperCycle.status === "started"
            ? `Candidate Arena cycle created ${outcome.created_candidate_count} candidates and started Paper Trading Evaluation for ${paperCycle.selected_candidate_id}.`
            : `Candidate Arena cycle created ${outcome.created_candidate_count} candidates and queued ${paperCycle.selected_candidate_id} for Paper Trading Evaluation.`
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
      "trading_candidate.promote": async (payload) => {
        const candidateId = parseCommandCandidateId(payload);
        const candidate = await this.options.store.getCandidate(candidateId);
        if (!candidate) {
          throw new OperatorCommandError(404, "candidate_not_found", { candidate_id: candidateId });
        }
        const promotionService = this.options.paperTradingComparisonPromotionService ??
          new PaperTradingComparisonPromotionService({ store: this.options.store });
        try {
          const promotion = await promotionService.promote({ candidateId });
          return {
            result: { promotion },
            summary: `Promoted ${candidateId} to Trading review from confirmed paper comparison evidence.`
          };
        } catch (error) {
          if (!(error instanceof PaperTradingComparisonPromotionServiceError)) {
            throw error;
          }
          if (error.code === "paper_trading_comparison_promotion_stale") {
            throw new OperatorCommandError(409, "paper_trading_comparison_stale", {
              candidate_id: candidateId
            });
          }
          if (error.code !== "paper_trading_comparison_promotion_evidence_required") {
            throw new OperatorCommandError(409, "paper_trading_comparison_invalid", {
              candidate_id: candidateId
            });
          }
        }
        const evaluation = await this.options.store.getLatestPaperTradingEvaluationForCandidate(candidateId);
        if (!evaluation) {
          throw new OperatorCommandError(409, "paper_trading_evaluation_required", {
            candidate_id: candidateId,
            required_command: `ouroboros candidate paper start ${candidateId}`
          });
        }
        const observations = await this.options.store.listPaperTradingObservations(
          evaluation.paper_trading_evaluation_id
        );
        const commitment = await paperTradingCommitmentForEvaluation(
          this.options.store,
          evaluation
        );
        const runnerActive = this.options.paperTradingEvaluationRunner?.active(evaluation.trading_run_ref.id) ?? false;
        const qualification = qualifyPaperTradingEvaluation({
          evaluation,
          commitment,
          observations,
          runnerActive
        });
        const previousPromotion = await this.options.store.getLatestTradingPromotion();
        const activeTradingReviewCandidateId = previousPromotion?.candidate_ref.id;
        const attemptedReplacementCandidateId =
          activeTradingReviewCandidateId && activeTradingReviewCandidateId !== candidateId
            ? candidateId
            : undefined;
        if (qualification.qualification_status !== "qualified") {
          throw new OperatorCommandError(409, "paper_trading_qualification_required", {
            candidate_id: candidateId,
            ...(attemptedReplacementCandidateId
              ? {
                  active_trading_review_candidate_id: activeTradingReviewCandidateId,
                  attempted_replacement_candidate_id: attemptedReplacementCandidateId
                }
              : {}),
            paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id,
            paper_qualification_status: qualification.qualification_status,
            paper_qualification_reasons: qualification.qualification_reasons,
            paper_evidence_window: qualification.evidence_window,
            next_action: tradingPromotionNextAction(qualification.qualification_status),
            required_command: `ouroboros candidate paper start ${candidateId}`
          });
        }
        // TradingPromotion authority stays closed until paired verdict records exist.
        throw new OperatorCommandError(409, "paper_trading_comparison_required", {
          candidate_id: candidateId,
          ...(attemptedReplacementCandidateId
            ? {
                active_trading_review_candidate_id: activeTradingReviewCandidateId,
                attempted_replacement_candidate_id: attemptedReplacementCandidateId
              }
            : {}),
          paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id,
          paper_qualification_status: qualification.qualification_status,
          paper_qualification_reasons: qualification.qualification_reasons,
          paper_evidence_window: qualification.evidence_window,
          required_evidence: "promotion_eligible_paper_trading_comparison_verdict",
          next_action: "Run a prospective champion/challenger comparison and obtain a promotion-eligible external verdict."
        });
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
          summary: response.statusCode === 202
            ? `Paper evidence collection queued for ${candidateId}.`
            : `Paper evidence recorded for ${candidateId}.`
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

  private installAutonomousArenaTickContinuation(): void {
    this.options.candidateArenaRunner.setTickContinuation((outcome) =>
      this.startPaperTradingForArenaCycleAck(outcome)
        .catch((error): CandidateArenaTickPaperTradingContinuationReadModel => ({
          status: "failed",
          command_kind: "trading_run.start",
          selected_candidate_id: selectArenaCycleCandidateId(outcome),
          error: commandErrorSummary(error),
          authority_status: "not_live"
        }))
    );
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

  private async startPaperTradingForArenaCycle(
    outcome: CandidateArenaTickOutcome
  ): Promise<{
    selected_candidate_id: string;
    status: "started" | "queued";
    paper_trading: unknown;
  }> {
    const candidateId = selectArenaCycleCandidateId(outcome);
    if (!candidateId) {
      throw new OperatorCommandError(409, "arena_cycle_candidate_required", {
        tick_id: outcome.tick_id,
        created_candidate_count: outcome.created_candidate_count,
        next_action: "Fix Candidate Arena direction failures before starting Paper Trading Evaluation."
      });
    }
    this.selectedCandidateId = candidateId;
    const paperTrading = await this.startArenaPaperCandidate(candidateId);
    return {
      selected_candidate_id: candidateId,
      status: paperTrading.status,
      paper_trading: paperTrading.execution.result
    };
  }

  private async startPaperTradingForArenaCycleAck(
    outcome: CandidateArenaTickOutcome
  ): Promise<CandidateArenaTickPaperTradingContinuationReadModel | void> {
    const candidateId = selectArenaCycleCandidateId(outcome);
    if (!candidateId) {
      throw new OperatorCommandError(409, "arena_cycle_candidate_required", {
        tick_id: outcome.tick_id,
        created_candidate_count: outcome.created_candidate_count,
        next_action: "Fix Candidate Arena direction failures before starting Paper Trading Evaluation."
      });
    }
    this.selectedCandidateId = candidateId;
    const paperStartFence = this.autonomousPaperStartFence;
    const paperStart = this.startArenaPaperCandidate(candidateId);
    const paperStartContinuation = paperStart
      .then((result): CandidateArenaTickPaperTradingContinuationReadModel => ({
        status: result.status,
        command_kind: "trading_run.start",
        selected_candidate_id: candidateId,
        authority_status: "not_live"
      }));
    const trackedPaperStart = paperStart
      .then(
        async (result) => {
          if (paperStartFence !== this.autonomousPaperStartFence) {
            if (result.status === "started") {
              await this.stopLateAutonomousPaperStartAfterShutdown(
                result.execution
              );
            }
            return;
          }
          await this.recordAutonomousPaperContinuation(outcome, {
            status: result.status,
            command_kind: "trading_run.start",
            selected_candidate_id: candidateId,
            authority_status: "not_live"
          });
        },
        async (error) => {
          if (paperStartFence !== this.autonomousPaperStartFence) {
            return;
          }
          await this.recordAutonomousPaperContinuationFailure(outcome, candidateId, error);
        }
      )
      .catch(() => undefined);
    this.pendingAutonomousPaperStarts.add(trackedPaperStart);
    void trackedPaperStart.finally(() => {
      this.pendingAutonomousPaperStarts.delete(trackedPaperStart);
    });
    const acknowledged = new Promise<void>((resolve) => {
      const timer = setTimeout(
        () => resolve(),
        AUTONOMOUS_PAPER_CONTINUATION_ACK_TIMEOUT_MS
      );
      timer.unref?.();
    });
    return Promise.race([paperStartContinuation, acknowledged]);
  }

  private async startArenaPaperCandidate(candidateId: string): Promise<{
    status: "started" | "queued";
    execution: OperatorCommandExecution;
  }> {
    if (!this.options.arenaPaperRuntime) {
      return {
        status: "started",
        execution: await this.executeMutationPort("trading_run.start", {
          candidate_id: candidateId
        })
      };
    }
    const snapshot = await this.options.arenaPaperRuntime.reconcile();
    const system = snapshot.systems.find((entry) =>
      entry.candidate_ref.id === candidateId
    );
    if (!system) {
      throw new OperatorCommandError(409, "arena_paper_candidate_ineligible", {
        candidate_id: candidateId
      });
    }
    if (system.lifecycle_status === "failed" ||
      system.lifecycle_status === "invalidated" ||
      system.lifecycle_status === "stopped") {
      throw arenaPaperRuntimeError(system);
    }
    const status = system.lifecycle_status === "running"
      ? "started"
      : "queued";
    return {
      status,
      execution: {
        result: {
          status,
          trading_run_id: system.trading_run_ref.id,
          arena_paper_system: system,
          arena_paper_runtime: snapshot
        },
        summary: status === "started"
          ? `Arena Paper runtime started ${candidateId}.`
          : `Arena Paper runtime queued ${candidateId}.`
      }
    };
  }

  private async stopLateAutonomousPaperStartAfterShutdown(
    execution: OperatorCommandExecution
  ): Promise<void> {
    const tradingRunId = tradingRunIdFromCommandResult(execution.result);
    if (!tradingRunId) {
      return;
    }
    await this.executeMutationPort("trading_run.stop", { trading_run_id: tradingRunId })
      .catch(() => undefined);
  }

  private async recordAutonomousPaperContinuation(
    outcome: CandidateArenaTickOutcome,
    continuation: CandidateArenaTickPaperTradingContinuationReadModel
  ): Promise<void> {
    const tick = (await this.options.store.listCandidateArenaTicks())
      .find((entry) => entry.tick_id === outcome.tick_id);
    if (!tick) {
      return;
    }
    await this.options.store.recordCandidateArenaTick({
      ...tick,
      paper_trading_continuation: continuation
    });
  }

  private async recordAutonomousPaperContinuationFailure(
    outcome: CandidateArenaTickOutcome,
    candidateId: string,
    error: unknown
  ): Promise<void> {
    await this.recordAutonomousPaperContinuation(
      outcome,
      {
        status: "failed",
        command_kind: "trading_run.start",
        selected_candidate_id: candidateId,
        error: commandErrorSummary(error),
        authority_status: "not_live"
      }
    );
  }

  private async restoreCandidateArenaTickCount(): Promise<void> {
    const [persistedTicks, persistedAllocations] = await Promise.all([
      this.options.store.listCandidateArenaTicks(),
      this.options.store.listCandidateArenaResearchAllocations()
    ]);
    this.options.candidateArenaRunner.restoreTickCount(
      candidateArenaRunnerTickCountFromTicks(
        persistedTicks,
        persistedAllocations
      )
    );
  }
}

export function autonomousArenaLoopDesiredStatus(
  commands: OuroborosCommandRecord[]
): "running" | "stopped" {
  const latestControlCommand = commands
    .filter((command) =>
      command.status === "succeeded" &&
      (command.command_kind === "arena.start" || command.command_kind === "arena.stop")
    )
    .sort((left, right) =>
      right.completed_at.localeCompare(left.completed_at) ||
      right.requested_at.localeCompare(left.requested_at) ||
      right.ouroboros_command_id.localeCompare(left.ouroboros_command_id)
    )
    .at(0);
  return latestControlCommand?.command_kind === "arena.start" ? "running" : "stopped";
}

function selectedPaperContinuationCandidateId(arena: CandidateArenaReadModel): string | undefined {
  return arena.latest_ticks.find((tick) =>
    (tick.paper_trading_continuation?.status === "started"
      || tick.paper_trading_continuation?.status === "queued")
    && tick.paper_trading_continuation.selected_candidate_id
  )?.paper_trading_continuation?.selected_candidate_id;
}

function selectArenaCycleCandidateId(outcome: CandidateArenaTickOutcome): string | undefined {
  const createdCandidateIds = new Set(outcome.created_candidate_ids);
  return outcome.arena.leaderboard.find((entry) => createdCandidateIds.has(entry.candidate_id))?.candidate_id
    ?? outcome.created_candidate_ids[0];
}

function commandErrorSummary(error: unknown): string {
  if (error instanceof OperatorCommandError) {
    const reason = error.details.reason;
    if (typeof reason === "string" && reason.trim()) {
      return reason;
    }
    return error.error;
  }
  if (error instanceof Error) {
    return error.message.split("\n")[0] || error.name;
  }
  return String(error);
}

function arenaPaperRuntimeError(
  system: ArenaPaperRuntimeSystem
): OperatorCommandError {
  return new OperatorCommandError(422, "arena_paper_runtime_failed", {
    candidate_id: system.candidate_ref.id,
    lifecycle_status: system.lifecycle_status,
    reason: system.failure_reason ?? `arena_paper_${system.lifecycle_status}`
  });
}

function tradingRunIdFromCommandResult(result: unknown): string | undefined {
  if (!isRecord(result)) {
    return undefined;
  }
  if (typeof result.trading_run_id === "string" && result.trading_run_id.trim()) {
    return result.trading_run_id;
  }
  if (!isRecord(result.trading_run)) {
    return undefined;
  }
  const ref = result.trading_run.ref;
  return isRecord(ref) && typeof ref.id === "string" && ref.id.trim()
    ? ref.id
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

const OPERATOR_SANDBOX_ENTRY_LIMIT = 5;
const OPERATOR_SANDBOX_LOG_LINE_LIMIT = 5;
const OPERATOR_TRANSCRIPT_ITEM_LIMIT = 20;
const OPERATOR_RUNTIME_TEXT_LIMIT = 500;
const OPERATOR_RUNTIME_OVERVIEW_TRUNCATED_MARKER = "[runtime overview truncated: full detail available from candidate inspect]";

function toOperatorSelectedCandidateOverview(candidate: CandidateInspectReadModel): CandidateInspectReadModel {
  const sandbox = candidate.runtime.sandbox
    ? {
        ...candidate.runtime.sandbox,
        logs: tail(candidate.runtime.sandbox.logs, OPERATOR_SANDBOX_ENTRY_LIMIT).map((log) => ({
          ...log,
          lines: runtimeOverviewLogLines(log.lines)
        })),
        heartbeats: tail(candidate.runtime.sandbox.heartbeats, OPERATOR_SANDBOX_ENTRY_LIMIT),
        command_evidence: tail(candidate.runtime.sandbox.command_evidence, OPERATOR_SANDBOX_ENTRY_LIMIT)
          .map((evidence) => ({
            ...evidence,
            stdout: truncateRuntimeOverviewText(evidence.stdout),
            stderr: truncateRuntimeOverviewText(evidence.stderr)
          }))
      }
    : undefined;
  const transcript = candidate.runtime.transcript
    ? {
        ...candidate.runtime.transcript,
        latest_item: candidate.runtime.transcript.latest_item
          ? toOperatorTranscriptItemOverview(candidate.runtime.transcript.latest_item)
          : null,
        items: tail(candidate.runtime.transcript.items, OPERATOR_TRANSCRIPT_ITEM_LIMIT)
          .map(toOperatorTranscriptItemOverview)
      }
    : undefined;

  return {
    ...candidate,
    runtime: {
      ...candidate.runtime,
      sandbox,
      transcript
    }
  };
}

function toOperatorTranscriptItemOverview(
  item: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number]
): NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number] {
  return {
    ...item,
    label: truncateRuntimeOverviewText(item.label),
    summary: truncateRuntimeOverviewText(item.summary)
  };
}

function tail<T>(items: T[], limit: number): T[] {
  return items.length <= limit ? items : items.slice(-limit);
}

function runtimeOverviewLogLines(lines: string[]): string[] {
  if (lines.length <= OPERATOR_SANDBOX_LOG_LINE_LIMIT) {
    return lines.map(truncateRuntimeOverviewText);
  }
  return [
    OPERATOR_RUNTIME_OVERVIEW_TRUNCATED_MARKER,
    ...tail(lines, OPERATOR_SANDBOX_LOG_LINE_LIMIT - 1).map(truncateRuntimeOverviewText)
  ];
}

function truncateRuntimeOverviewText(value: string): string {
  return value.length <= OPERATOR_RUNTIME_TEXT_LIMIT
    ? value
    : `${value.slice(0, OPERATOR_RUNTIME_TEXT_LIMIT)}...`;
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

async function buildPaperTradingBoard(
  store: OuroborosStorePort,
  runner?: OperatorServiceOptions["paperTradingEvaluationRunner"]
): Promise<OperatorReadModel["paper_trading_board"]> {
  const latestByCandidate = new Map<string, PaperTradingEvaluationRecord>();
  for (const evaluation of await store.listPaperTradingEvaluations()) {
    latestByCandidate.set(evaluation.candidate_ref.id, evaluation);
  }

  const entries = await Promise.all([...latestByCandidate.values()].map(async (evaluation) => {
    const candidate = await store.getCandidate(evaluation.candidate_ref.id);
    const observations = await store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id);
    const commitment = await paperTradingCommitmentForEvaluation(store, evaluation);
    const latestObservation = observations.at(-1);
    const latestMarketSnapshot = latestObservation?.market_snapshot;
    const latestPublicExecutionSnapshot = latestObservation?.public_execution_snapshot ??
      evaluation.latest_public_execution_snapshot;
    const runnerActive = runner?.active(evaluation.trading_run_ref.id) ?? false;
    const runnerStatus = paperTradingBoardRunnerStatus(evaluation, runnerActive);
    const openOrderCount = latestObservation?.open_orders?.length ??
      evaluation.open_orders?.length ??
      evaluation.paper_account_snapshot?.open_order_count ??
      0;
    const paperAccountSnapshot = latestObservation?.paper_account_snapshot ?? evaluation.paper_account_snapshot;
    const qualification = qualifyPaperTradingEvaluation({
      evaluation,
      commitment,
      observations,
      runnerActive
    });
    const latestFillStatus = (latestObservation?.latest_fill ?? evaluation.latest_fill)?.fill_status;
    const latestFailureReason = latestObservation?.failure_reason ?? evaluation.latest_failure_reason;
    const latestFailure = classifyPaperTradingFailure(latestFailureReason);
    return {
      rank: 0,
      candidate_id: evaluation.candidate_ref.id,
      display_name: candidate?.display_name ?? evaluation.candidate_ref.id,
      evaluation_id: evaluation.paper_trading_evaluation_id,
      status: evaluation.status,
      runner_status: runnerStatus,
      promotion_gate_status: paperTradingPromotionGateStatus(
        evaluation,
        runnerStatus,
        qualification.qualification_status
      ),
      evidence_purpose: commitment?.evidence_purpose,
      commitment_id: commitment?.paper_trading_evaluation_commitment_id,
      commitment_digest: commitment?.commitment_digest,
      freeze_status: paperTradingEvaluationFreezeStatus(evaluation, commitment),
      invalidation_reason: evaluation.invalidation_reason,
      qualification_status: qualification.qualification_status,
      qualification_reasons: qualification.qualification_reasons,
      evidence_window: qualification.evidence_window,
      risk_summary: paperTradingRiskSummary({
        openOrderCount,
        paperAccountSnapshot,
        latestFillStatus,
        latestFailureReason,
        latestFailure
      }),
      trend: paperTradingBoardTrend(observations, evaluation.latest_score),
      blocker_density: paperTradingBoardBlockerDensity(
        qualification.qualification_reasons,
        qualification.evidence_window
      ),
      observation_count: evaluation.observation_count,
      trading_run_id: evaluation.trading_run_ref.id,
      last_observed_at: evaluation.last_observed_at,
      next_observation_at: evaluation.next_observation_at,
      profit_loss: evaluation.latest_score,
      market_data_source: latestMarketSnapshot?.source_kind ??
        latestPublicExecutionSnapshot?.source_kind ??
        "binance_production_public_rest",
      latest_public_execution_source: latestPublicExecutionSnapshot?.source_priority,
      latest_fill_status: latestFillStatus,
      open_order_count: openOrderCount,
      latest_failure_reason: latestFailureReason,
      latest_failure: latestFailure,
      authority_status: "not_live" as const
    };
  }));

  const rankedEntries = entries
    .sort((a, b) =>
      b.profit_loss.net_revenue_usdt - a.profit_loss.net_revenue_usdt ||
      b.profit_loss.net_return_pct - a.profit_loss.net_return_pct ||
      b.observation_count - a.observation_count ||
      a.candidate_id.localeCompare(b.candidate_id)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    board_kind: "paper_trading_board",
    primary_rank_metric: "net_revenue_usdt",
    secondary_rank_metric: "net_return_pct",
    evaluation_authority: "continuous_paper_trading",
    entries: rankedEntries,
    live_disabled: true,
    authority_status: "not_live"
  };
}

function paperTradingBoardTrend(
  observations: PaperTradingObservationRecord[],
  latestProfitLoss: TradingProfitLossReadModel
): OperatorReadModel["paper_trading_board"]["entries"][number]["trend"] {
  if (observations.length < 2) {
    return {
      direction: "insufficient_history",
      net_revenue_delta_usdt: 0,
      net_return_delta_pct: 0,
      observation_count_delta: 0,
      authority_status: "not_promotion_authority"
    };
  }
  const firstObservation = observations[0]!;
  const latestObservation = observations.at(-1)!;
  const firstProfitLoss = firstObservation.cumulative_score;
  const latestObservedProfitLoss = latestObservation.cumulative_score ?? latestProfitLoss;
  const netRevenueDelta = roundPaperSignal(
    latestObservedProfitLoss.net_revenue_usdt - firstProfitLoss.net_revenue_usdt
  );
  const netReturnDelta = roundPaperSignal(
    latestObservedProfitLoss.net_return_pct - firstProfitLoss.net_return_pct
  );
  return {
    direction: paperTrendDirection(netRevenueDelta),
    net_revenue_delta_usdt: netRevenueDelta,
    net_return_delta_pct: netReturnDelta,
    observation_count_delta: Math.max(0, latestObservation.sequence - firstObservation.sequence),
    authority_status: "not_promotion_authority"
  };
}

function paperTradingBoardBlockerDensity(
  qualificationReasons: OperatorReadModel["paper_trading_board"]["entries"][number]["qualification_reasons"],
  evidenceWindow: OperatorReadModel["paper_trading_board"]["entries"][number]["evidence_window"]
): OperatorReadModel["paper_trading_board"]["entries"][number]["blocker_density"] {
  const observationCount = Math.max(1, evidenceWindow.observation_count);
  return {
    blocker_count: qualificationReasons.length,
    blocker_density: roundPaperSignal(qualificationReasons.length / observationCount),
    failed_observation_ratio: roundPaperSignal(evidenceWindow.failed_observation_count / observationCount),
    top_blocker: qualificationReasons[0],
    authority_status: "not_promotion_authority"
  };
}

function paperTrendDirection(netRevenueDelta: number): OperatorReadModel["paper_trading_board"]["entries"][number]["trend"]["direction"] {
  if (netRevenueDelta > 0) {
    return "improving";
  }
  if (netRevenueDelta < 0) {
    return "declining";
  }
  return "flat";
}

function roundPaperSignal(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function paperTradingRiskSummary(input: {
  openOrderCount: number;
  paperAccountSnapshot?: OperatorReadModel["selected_paper_trading_evaluation"]["paper_account_snapshot"];
  latestFillStatus?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_fill"] extends infer Fill
    ? Fill extends { fill_status: infer Status } ? Status : never
    : never;
  latestFailureReason?: string;
  latestFailure?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_failure"];
}): OperatorReadModel["paper_trading_board"]["entries"][number]["risk_summary"] {
  const account = input.paperAccountSnapshot
    ? {
        equity_usdt: input.paperAccountSnapshot.equity_usdt,
        available_balance_usdt: input.paperAccountSnapshot.available_balance_usdt,
        wallet_balance_usdt: input.paperAccountSnapshot.wallet_balance_usdt,
        margin_reserved_usdt: input.paperAccountSnapshot.margin_reserved_usdt,
        authority_status: "not_live" as const
      }
    : undefined;
  const position = input.paperAccountSnapshot
    ? {
        symbol: input.paperAccountSnapshot.position.symbol,
        side: input.paperAccountSnapshot.position.side,
        quantity: input.paperAccountSnapshot.position.quantity,
        notional_usdt: input.paperAccountSnapshot.position.notional_usdt,
        average_entry_price: input.paperAccountSnapshot.position.average_entry_price,
        mark_price: input.paperAccountSnapshot.position.mark_price,
        authority_status: "not_live" as const
      }
    : undefined;
  return {
    open_order_count: input.openOrderCount,
    account,
    position,
    latest_fill_status: input.latestFillStatus,
    latest_failure_reason: input.latestFailureReason,
    latest_failure: input.latestFailure
  };
}

async function buildTradingPromotionReadModel(input: {
  store: OuroborosStorePort;
  paperTradingBoard: OperatorReadModel["paper_trading_board"];
  runner?: OperatorServiceOptions["paperTradingEvaluationRunner"];
}): Promise<NonNullable<OperatorReadModel["trading_promotion"]>> {
  const promotion = await input.store.getLatestTradingPromotion();
  if (!promotion) {
    return {
      promotion_kind: "trading_promotion",
      status: "not_promoted",
      readiness_status: "paper_required",
      paper_qualification_reasons: [],
      next_action: "Promote a selected Paper Trading Evaluation candidate from Arena to Trading review.",
      live_disabled_reason: "mlp_paper_only",
      authority_status: "not_live"
    };
  }

  const candidate = await input.store.getCandidate(promotion.candidate_ref.id);
  const comparisonConfirmation =
    await buildTradingPromotionComparisonConfirmationReadModel(
      input.store,
      promotion
    );
  const boardEntry = input.paperTradingBoard.entries.find((entry) =>
    entry.candidate_id === promotion.candidate_ref.id &&
    entry.evaluation_id === promotion.paper_trading_evaluation_ref.id
  );
  if (boardEntry) {
    return {
      promotion_kind: "trading_promotion",
      status: "promoted_for_trading_review",
      readiness_status: tradingPromotionReadinessFromQualification(boardEntry.qualification_status),
      candidate_id: promotion.candidate_ref.id,
      candidate_version_id: promotion.candidate_version_ref.id,
      display_name: candidate?.display_name ?? boardEntry.display_name,
      promoted_at: promotion.promoted_at,
      paper_trading_evaluation_id: boardEntry.evaluation_id,
      paper_qualification_status: boardEntry.qualification_status,
      paper_qualification_reasons: boardEntry.qualification_reasons,
      paper_evidence_window: boardEntry.evidence_window,
      paper_profit_loss: boardEntry.profit_loss,
      runner_status: boardEntry.runner_status,
      latest_failure_reason: boardEntry.latest_failure_reason,
      comparison_confirmation: comparisonConfirmation,
      next_action: tradingPromotionNextAction(boardEntry.qualification_status),
      live_disabled_reason: "mlp_paper_only",
      authority_status: "not_live"
    };
  }

  const promotionEvaluation = await input.store.getPaperTradingEvaluation(
    promotion.paper_trading_evaluation_ref.id
  );
  const evaluation = promotionEvaluation &&
    promotionEvaluation.candidate_ref.id === promotion.candidate_ref.id &&
    promotionEvaluation.candidate_version_ref.id ===
      promotion.candidate_version_ref.id
    ? promotionEvaluation
    : undefined;
  const observations = evaluation
    ? await input.store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id)
    : [];
  const commitment = evaluation
    ? await paperTradingCommitmentForEvaluation(input.store, evaluation)
    : undefined;
  const runnerActive = evaluation
    ? input.runner?.active(evaluation.trading_run_ref.id) ?? false
    : false;
  const qualification = evaluation
    ? qualifyPaperTradingEvaluation({ evaluation, commitment, observations, runnerActive })
    : undefined;
  const runnerStatus = evaluation
    ? paperTradingBoardRunnerStatus(evaluation, runnerActive)
    : undefined;
  return {
    promotion_kind: "trading_promotion",
    status: "promoted_for_trading_review",
    readiness_status: qualification
      ? tradingPromotionReadinessFromQualification(qualification.qualification_status)
      : "paper_required",
    candidate_id: promotion.candidate_ref.id,
    candidate_version_id: promotion.candidate_version_ref.id,
    display_name: candidate?.display_name ?? promotion.candidate_ref.id,
    promoted_at: promotion.promoted_at,
    paper_trading_evaluation_id: promotion.paper_trading_evaluation_ref.id,
    paper_qualification_status: qualification?.qualification_status,
    paper_qualification_reasons: qualification?.qualification_reasons ?? [],
    paper_evidence_window: qualification?.evidence_window,
    paper_profit_loss: evaluation?.latest_score,
    runner_status: runnerStatus,
    latest_failure_reason: evaluation?.latest_failure_reason,
    comparison_confirmation: comparisonConfirmation,
    next_action: qualification
      ? tradingPromotionNextAction(qualification.qualification_status)
      : "Start continuous paper trading before promotion can be trusted.",
    live_disabled_reason: "mlp_paper_only",
    authority_status: "not_live"
  };
}

async function buildTradingPromotionComparisonConfirmationReadModel(
  store: OuroborosStorePort,
  promotion: TradingPromotionRecord
): Promise<TradingPromotionComparisonConfirmationReadModel | undefined> {
  const basis = promotion.comparison_confirmation;
  const campaign = await store.getPaperTradingComparisonConfirmationCampaign(
    basis.campaign_ref.id
  );
  if (!campaign ||
    campaign.paper_trading_comparison_confirmation_campaign_id !==
      basis.campaign_ref.id ||
    campaign.campaign_digest !== basis.campaign_digest ||
    campaign.evaluation_authority !== "external_to_trading_systems" ||
    campaign.authority_status !== "not_live") {
    return undefined;
  }
  const outcome = await store
    .getPaperTradingComparisonConfirmationCampaignOutcome(
      basis.campaign_outcome_ref.id
    );
  const requiredWindowCount = campaign.campaign_policy.required_window_count;
  const finalResult = outcome?.slot_results.at(-1);
  if (!outcome ||
    outcome.paper_trading_comparison_confirmation_campaign_outcome_id !==
      basis.campaign_outcome_ref.id ||
    outcome.outcome_digest !== basis.campaign_outcome_digest ||
    outcome.campaign_ref.id !==
      campaign.paper_trading_comparison_confirmation_campaign_id ||
    outcome.campaign_digest !== campaign.campaign_digest ||
    outcome.campaign_outcome !== "confirmed_improvement" ||
    outcome.promotion_eligibility !== "eligible" ||
    outcome.next_action !== "review_for_trading_promotion" ||
    outcome.evaluation_authority !== "external_to_trading_systems" ||
    outcome.authority_status !== "not_live" ||
    !Number.isInteger(requiredWindowCount) ||
    requiredWindowCount <= 0 ||
    campaign.slots.length !== requiredWindowCount ||
    outcome.slot_results.length !== requiredWindowCount ||
    outcome.improved_count !== requiredWindowCount ||
    outcome.not_improved_count !== 0 ||
    outcome.ineligible_count !== 0 ||
    outcome.expired_count !== 0 ||
    outcome.slot_results.some((result, index) =>
      result.slot_index !== campaign.slots[index]?.slot_index ||
      result.status !== "challenger_improved" ||
      !result.verdict_ref ||
      !result.verdict_digest
    ) ||
    finalResult?.verdict_ref?.id !== basis.final_verdict_ref.id ||
    finalResult.verdict_digest !== basis.final_verdict_digest ||
    campaign.comparison_policy.primary_metric !== "net_revenue_usdt" ||
    !Number.isFinite(
      campaign.comparison_policy.minimum_net_revenue_lift_usdt
    ) ||
    !Number.isFinite(Date.parse(outcome.evaluated_at))) {
    return undefined;
  }
  return {
    campaign_id: campaign
      .paper_trading_comparison_confirmation_campaign_id,
    campaign_outcome_id: outcome
      .paper_trading_comparison_confirmation_campaign_outcome_id,
    final_verdict_id: basis.final_verdict_ref.id,
    required_window_count: requiredWindowCount,
    improved_window_count: outcome.improved_count,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt:
      campaign.comparison_policy.minimum_net_revenue_lift_usdt,
    evaluated_at: outcome.evaluated_at,
    evaluation_authority: "external_to_trading_systems",
    authority_status: "not_live"
  };
}

async function buildTradingReviewReadModel(input: {
  store: OuroborosStorePort;
  candidateArena: OperatorReadModel["candidate_arena"];
  selectedCandidateId: string | null;
  tradingPromotion: NonNullable<OperatorReadModel["trading_promotion"]>;
  paperTradingBoard: OperatorReadModel["paper_trading_board"];
  runner?: OperatorServiceOptions["paperTradingEvaluationRunner"];
}): Promise<OperatorReadModel["trading_review"]> {
  const activeCandidateId = input.tradingPromotion.status === "promoted_for_trading_review"
    ? input.tradingPromotion.candidate_id
    : undefined;
  const activeCandidate = activeCandidateId
    ? await input.store.getCandidate(activeCandidateId)
    : undefined;
  const promotionEvaluation = activeCandidateId &&
      input.tradingPromotion.paper_trading_evaluation_id
    ? await input.store.getPaperTradingEvaluation(
        input.tradingPromotion.paper_trading_evaluation_id
      )
    : undefined;
  const activeEvaluation = promotionEvaluation &&
    promotionEvaluation.candidate_ref.id === activeCandidateId &&
    promotionEvaluation.candidate_version_ref.id ===
      input.tradingPromotion.candidate_version_id
    ? promotionEvaluation
    : undefined;
  const activeObservations = activeEvaluation
    ? await input.store.listPaperTradingObservations(activeEvaluation.paper_trading_evaluation_id)
    : [];
  const activeCommitment = activeEvaluation
    ? await paperTradingCommitmentForEvaluation(input.store, activeEvaluation)
    : undefined;
  const activeRunner = activeEvaluation
    ? input.runner?.active(activeEvaluation.trading_run_ref.id) ?? activeEvaluation.status === "running"
    : false;
  const paperBoardEntry = activeCandidateId
    ? input.paperTradingBoard.entries.find((entry) =>
        entry.candidate_id === activeCandidateId &&
        entry.evaluation_id === input.tradingPromotion.paper_trading_evaluation_id
      )
    : undefined;
  const arenaEntry = activeCandidateId
    ? input.candidateArena.leaderboard.find((entry) => entry.candidate_id === activeCandidateId)
    : undefined;
  const paperEvaluation = selectedPaperTradingEvaluation(
    activeCandidate,
    activeEvaluation,
    activeCommitment,
    activeObservations,
    activeRunner
  );
  const selectedMatchesTradingReview = Boolean(activeCandidateId && input.selectedCandidateId === activeCandidateId);

  return {
    review_kind: "trading_review",
    status: input.tradingPromotion.status,
    readiness_status: input.tradingPromotion.readiness_status,
    active_candidate_id: activeCandidateId,
    active_candidate_version_id: input.tradingPromotion.candidate_version_id,
    display_name: input.tradingPromotion.display_name ?? activeCandidate?.display_name,
    promoted_at: input.tradingPromotion.promoted_at,
    paper_trading_evaluation_id: input.tradingPromotion.paper_trading_evaluation_id,
    paper_qualification_status: input.tradingPromotion.paper_qualification_status,
    paper_qualification_reasons: input.tradingPromotion.paper_qualification_reasons,
    paper_evidence_window: input.tradingPromotion.paper_evidence_window,
    paper_profit_loss: input.tradingPromotion.paper_profit_loss,
    paper_trading_evaluation: paperEvaluation,
    paper_board_entry: paperBoardEntry,
    runner_status: input.tradingPromotion.runner_status,
    latest_failure_reason: input.tradingPromotion.latest_failure_reason,
    comparison_confirmation: input.tradingPromotion.comparison_confirmation,
    selected_candidate_id: input.selectedCandidateId,
    selected_matches_trading_review: selectedMatchesTradingReview,
    review_packet: buildTradingReviewPacket({
      tradingPromotion: input.tradingPromotion,
      activeCandidate,
      arenaEntry,
      paperEvaluation,
      paperBoardEntry,
      selectedCandidateId: input.selectedCandidateId,
      selectedMatchesTradingReview
    }),
    next_action: input.tradingPromotion.next_action,
    live_disabled_reason: "mlp_paper_only",
    authority_status: "not_live"
  };
}

function buildTradingReviewPacket(input: {
  tradingPromotion: NonNullable<OperatorReadModel["trading_promotion"]>;
  activeCandidate?: CandidateInspectReadModel;
  arenaEntry?: OperatorReadModel["candidate_arena"]["leaderboard"][number];
  paperEvaluation: OperatorReadModel["trading_review"]["paper_trading_evaluation"];
  paperBoardEntry?: OperatorReadModel["paper_trading_board"]["entries"][number];
  selectedCandidateId: string | null;
  selectedMatchesTradingReview: boolean;
}): OperatorReadModel["trading_review"]["review_packet"] {
  const qualificationStatus = input.tradingPromotion.paper_qualification_status ??
    input.paperBoardEntry?.qualification_status;
  const qualificationReasons = input.tradingPromotion.paper_qualification_reasons.length > 0
    ? input.tradingPromotion.paper_qualification_reasons
    : input.paperBoardEntry?.qualification_reasons ?? [];
  const reviewMismatch = input.tradingPromotion.status === "promoted_for_trading_review" &&
    !input.selectedMatchesTradingReview;
  const blockerGroups = tradingReviewPacketBlockerGroups({
    reviewMismatch,
    qualificationStatus,
    qualificationReasons,
    promotionStatus: input.tradingPromotion.status
  });
  const risk = input.paperBoardEntry?.risk_summary ?? paperTradingRiskSummary({
    openOrderCount: input.paperEvaluation.open_orders?.length ??
      input.paperEvaluation.paper_account_snapshot?.open_order_count ??
      0,
    paperAccountSnapshot: input.paperEvaluation.paper_account_snapshot,
    latestFillStatus: input.paperEvaluation.latest_fill?.fill_status,
    latestFailureReason: input.paperEvaluation.latest_failure_reason,
    latestFailure: input.paperEvaluation.latest_failure
  });
  const latestPublicExecutionSnapshot = input.paperEvaluation.latest_public_execution_snapshot;
  const paperBoardLearning = input.paperBoardEntry
    ? paperTradingLearningSummary({
        rank: input.paperBoardEntry.rank,
        profitLoss: input.paperBoardEntry.profit_loss,
        observationCount: input.paperBoardEntry.observation_count,
        qualificationStatus: input.paperBoardEntry.qualification_status,
        qualificationReasons: input.paperBoardEntry.qualification_reasons,
        latestFailure: input.paperBoardEntry.latest_failure
      })
    : undefined;

  return {
    packet_kind: "trading_review_packet",
    verdict: {
      readiness_status: input.tradingPromotion.readiness_status,
      qualification_status: qualificationStatus,
      severity: tradingReviewPacketSeverity({
        reviewMismatch,
        qualificationStatus,
        promotionStatus: input.tradingPromotion.status
      }),
      top_blocker: blockerGroups[0]?.blockers[0]
    },
    subject: {
      candidate_id: input.tradingPromotion.candidate_id,
      candidate_version_id: input.tradingPromotion.candidate_version_id,
      display_name: input.tradingPromotion.display_name,
      paper_trading_evaluation_id: input.tradingPromotion.paper_trading_evaluation_id,
      promoted_at: input.tradingPromotion.promoted_at,
      selected_candidate_id: input.selectedCandidateId,
      selected_matches_trading_review: input.selectedMatchesTradingReview
    },
    performance: {
      rank: input.paperBoardEntry?.rank,
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      profit_loss: input.tradingPromotion.paper_profit_loss ??
        input.paperBoardEntry?.profit_loss ??
        (input.paperEvaluation.evaluation_id ? input.paperEvaluation.profit_loss : undefined)
    },
    evidence_quality: {
      evidence_window: input.tradingPromotion.paper_evidence_window ?? input.paperBoardEntry?.evidence_window,
      qualification_reasons: qualificationReasons,
      blocker_groups: blockerGroups,
      comparison_confirmation: input.tradingPromotion.comparison_confirmation
    },
    provenance: {
      market_data_source: input.paperBoardEntry?.market_data_source ?? input.paperEvaluation.market_data_source,
      latest_public_execution_source: input.paperBoardEntry?.latest_public_execution_source ??
        latestPublicExecutionSnapshot?.source_priority,
      latest_public_execution_freshness: latestPublicExecutionSnapshot?.freshness,
      latest_public_execution_ws_connected: latestPublicExecutionSnapshot?.ws_connected,
      latest_public_execution_rest_fallback_used: latestPublicExecutionSnapshot?.rest_fallback_used,
      latest_public_execution_stream_marker: latestPublicExecutionSnapshot?.stream_marker,
      latest_fill_status: input.paperBoardEntry?.latest_fill_status ?? input.paperEvaluation.latest_fill?.fill_status,
      order_book: latestPublicExecutionSnapshot?.order_book
        ? {
            sync_status: latestPublicExecutionSnapshot.order_book.sync_status,
            last_update_id: latestPublicExecutionSnapshot.order_book.last_update_id,
            previous_final_update_id: latestPublicExecutionSnapshot.order_book.previous_final_update_id,
            gap_detected: latestPublicExecutionSnapshot.order_book.gap_detected,
            depth_level_count: latestPublicExecutionSnapshot.order_book.depth_level_count,
            authority_status: "read_only"
          }
        : undefined
    },
    risk,
    runner: {
      runner_status: input.tradingPromotion.runner_status ??
        input.paperBoardEntry?.runner_status ??
        (input.paperEvaluation.evaluation_id ? tradingReviewPacketRunnerStatus(input.paperEvaluation) : undefined),
      runner_active: input.paperEvaluation.runner_active,
      trading_run_status: input.paperEvaluation.trading_run_status,
      last_observed_at: input.paperBoardEntry?.last_observed_at ?? input.paperEvaluation.last_observed_at,
      next_observation_at: input.paperBoardEntry?.next_observation_at ?? input.paperEvaluation.next_observation_at,
      authority_status: "not_live"
    },
    ledger: {
      evidence_status: tradingReviewPacketLedgerEvidenceStatus(input.paperEvaluation),
      ledger_chain_complete: input.paperEvaluation.ledger_chain_complete,
      latest_order_request_id: input.paperEvaluation.latest_order_request_id,
      latest_gateway_outcome: input.paperEvaluation.latest_gateway_outcome,
      latest_execution_status: input.paperEvaluation.latest_execution_status,
      latest_decision_kind: input.paperEvaluation.latest_decision?.decision_kind,
      authority_status: "not_live"
    },
    lineage: tradingReviewPacketLineage(input.activeCandidate, input.arenaEntry, paperBoardLearning),
    authority: {
      authority_status: "not_live",
      live_disabled_reason: "mlp_paper_only",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      }
    },
    next_action: input.tradingPromotion.next_action
  };
}

function tradingReviewPacketLineage(
  activeCandidate: CandidateInspectReadModel | undefined,
  arenaEntry: OperatorReadModel["candidate_arena"]["leaderboard"][number] | undefined,
  paperBoardLearning: OperatorReadModel["trading_review"]["review_packet"]["lineage"]["paper_board_learning"]
): OperatorReadModel["trading_review"]["review_packet"]["lineage"] {
  const lineage = activeCandidate?.full_cycle_lineage;
  if (!lineage) {
    return {
      lineage_status: "missing",
      direction_kind: arenaEntry?.direction_kind,
      parent_candidate_id: arenaEntry?.parent_candidate_id,
      latest_finding: arenaEntry?.latest_finding,
      paper_board_learning: paperBoardLearning,
      authority_status: "lineage_only"
    };
  }

  return {
    lineage_status: lineage.handoff_status === "blocked" ? "blocked" : "available",
    direction_kind: lineage.evidence?.direction_kind ?? arenaEntry?.direction_kind,
    parent_candidate_id: lineage.source.trading_system_id,
    parent_candidate_version_id: lineage.source.candidate_version_id,
    source_system_code_ref: lineage.source.system_code_ref,
    generated_system_code_ref: lineage.generated?.system_code_ref,
    generated_artifact_digest: lineage.generated?.artifact_digest,
    generated_by_agent: lineage.generated?.generated_by_agent,
    materialized_candidate_id: lineage.materialized?.trading_system_id,
    materialized_candidate_version_id: lineage.materialized?.candidate_version_id,
    latest_finding: arenaEntry?.latest_finding,
    evaluation_status: lineage.evidence?.evaluation_status,
    evaluation_score: lineage.evidence?.evaluation_score,
    profit_loss: lineage.evidence?.profit_loss,
    paper_board_learning: paperBoardLearning,
    authority_status: "lineage_only"
  };
}

function tradingReviewPacketRunnerStatus(
  paperEvaluation: OperatorReadModel["trading_review"]["paper_trading_evaluation"]
): OperatorReadModel["trading_review"]["review_packet"]["runner"]["runner_status"] {
  if (paperEvaluation.runner_active) {
    return "active";
  }
  return paperEvaluation.status === "running" ? "needs_resume" : "inactive";
}

function tradingReviewPacketLedgerEvidenceStatus(
  paperEvaluation: OperatorReadModel["trading_review"]["paper_trading_evaluation"]
): OperatorReadModel["trading_review"]["review_packet"]["ledger"]["evidence_status"] {
  if (paperEvaluation.ledger_chain_complete) {
    return "complete_chain";
  }
  const latestDecisionKind = paperEvaluation.latest_decision?.decision_kind;
  if (latestDecisionKind === "hold" || latestDecisionKind === "no_action") {
    return "no_order_checkpoint";
  }
  if (
    paperEvaluation.latest_order_request_id ||
    paperEvaluation.latest_gateway_outcome ||
    paperEvaluation.latest_execution_status ||
    paperEvaluation.latest_fill
  ) {
    return "incomplete_chain";
  }
  return "not_observed";
}

function tradingReviewPacketSeverity(input: {
  reviewMismatch: boolean;
  qualificationStatus: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"];
  promotionStatus: NonNullable<OperatorReadModel["trading_promotion"]>["status"];
}): OperatorReadModel["trading_review"]["review_packet"]["verdict"]["severity"] {
  if (input.reviewMismatch) {
    return "mismatch";
  }
  if (input.qualificationStatus === "qualified") {
    return "ready";
  }
  if (input.qualificationStatus === "needs_resume") {
    return "needs_resume";
  }
  if (input.qualificationStatus === "paper_failed") {
    return "failed";
  }
  if (input.qualificationStatus === "blocked_by_quality") {
    return "blocked";
  }
  return "collecting";
}

function tradingReviewPacketBlockerGroups(input: {
  reviewMismatch: boolean;
  qualificationStatus: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"];
  qualificationReasons: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_reasons"];
  promotionStatus: NonNullable<OperatorReadModel["trading_promotion"]>["status"];
}): OperatorReadModel["trading_review"]["review_packet"]["evidence_quality"]["blocker_groups"] {
  const groups: OperatorReadModel["trading_review"]["review_packet"]["evidence_quality"]["blocker_groups"] = [];
  if (input.reviewMismatch) {
    groups.push({
      group_kind: "selection",
      severity: "mismatch",
      blockers: ["arena_selection_mismatch"],
      summary: "Arena selection differs from the active Trading review target.",
      next_action: "Open the active Trading review target or replace it with a qualified selected candidate."
    });
  }
  groups.push(...paperTradingQualificationBlockerGroups(input.qualificationReasons));

  if (input.promotionStatus === "not_promoted" && !input.qualificationStatus) {
    groups.push({
      group_kind: "evidence_window",
      severity: "collecting",
      blockers: ["paper_required"],
      summary: "No paper-backed Trading review target has been promoted.",
      next_action: "Start or continue Paper Trading Evaluation, then promote a qualified candidate to Trading review."
    });
  }

  return groups;
}

function tradingPromotionReadinessFromQualification(
  status: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"]
): NonNullable<OperatorReadModel["trading_promotion"]>["readiness_status"] {
  if (status === "qualified") {
    return "promoted_for_trading_review";
  }
  if (status === "needs_resume") {
    return "needs_resume";
  }
  if (status === "not_qualification_evidence") {
    return "paper_required";
  }
  if (status === "blocked_by_quality" || status === "paper_failed") {
    return "blocked_by_quality";
  }
  return "collecting_paper_evidence";
}

function tradingPromotionNextAction(
  status: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"]
): string {
  if (status === "qualified") {
    return "Keep live disabled; review paper score, fills, risk, and authority boundary.";
  }
  if (status === "needs_resume") {
    return "Resume paper trading before treating this Trading review candidate as current.";
  }
  if (status === "not_qualification_evidence") {
    return "Run a prospective qualification comparison; research feedback cannot authorize promotion.";
  }
  if (status === "blocked_by_quality" || status === "paper_failed") {
    return "Fix paper evidence quality before this candidate can be trusted.";
  }
  return "Continue paper trading until the evidence window qualifies.";
}

function paperTradingBoardRunnerStatus(
  evaluation: PaperTradingEvaluationRecord,
  runnerActive: boolean
): OperatorReadModel["paper_trading_board"]["entries"][number]["runner_status"] {
  if (evaluation.status === "running" && runnerActive) {
    return "active";
  }
  if (evaluation.status === "running") {
    return "needs_resume";
  }
  return "inactive";
}

async function paperTradingCommitmentForEvaluation(
  store: OuroborosStorePort,
  evaluation: PaperTradingEvaluationRecord
) {
  const commitmentId = evaluation.paper_trading_evaluation_commitment_ref?.id;
  if (!commitmentId) {
    return undefined;
  }
  const commitment = await store.getPaperTradingEvaluationCommitment(commitmentId);
  return commitment && paperTradingEvaluationCommitmentMatchesEvaluation(commitment, evaluation)
    ? commitment
    : undefined;
}

function paperTradingEvaluationFreezeStatus(
  evaluation: PaperTradingEvaluationRecord,
  commitment: Awaited<ReturnType<OuroborosStorePort["getPaperTradingEvaluationCommitment"]>>
): OperatorReadModel["selected_paper_trading_evaluation"]["freeze_status"] {
  if (evaluation.status === "invalidated") {
    return "invalidated";
  }
  if (!commitment || !paperTradingEvaluationCommitmentMatchesEvaluation(commitment, evaluation)) {
    return undefined;
  }
  return evaluation.status === "not_started" ? "committed" : "verified";
}

function paperTradingPromotionGateStatus(
  evaluation: PaperTradingEvaluationRecord,
  runnerStatus: OperatorReadModel["paper_trading_board"]["entries"][number]["runner_status"],
  qualificationStatus: PaperTradingQualificationStatus
): OperatorReadModel["paper_trading_board"]["entries"][number]["promotion_gate_status"] {
  if (evaluation.status === "invalidated") {
    return "invalidated";
  }
  if (qualificationStatus === "not_qualification_evidence") {
    return "not_qualification_evidence";
  }
  if (qualificationStatus === "qualified") {
    return "prospective_comparison_required";
  }
  if (evaluation.status === "failed") {
    return "paper_failed";
  }
  if (runnerStatus === "active") {
    return "collecting_paper_evidence";
  }
  if (runnerStatus === "needs_resume") {
    return "needs_resume";
  }
  return evaluation.observation_count > 0 ? "paper_evidence_recorded" : "not_evaluated";
}

export function selectedPaperTradingEvaluation(
  candidate: CandidateInspectReadModel | undefined,
  evaluation?: PaperTradingEvaluationRecord,
  commitment?: Awaited<ReturnType<OuroborosStorePort["getPaperTradingEvaluationCommitment"]>>,
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
  const latestDecision = [...observations].reverse()
    .find((observation) => observation.decision)?.decision;
  if (evaluation) {
    const latestFailureReason = latestObservation?.failure_reason ?? evaluation.latest_failure_reason;
    return paperTradingEvaluationReadModel({
      evaluationId: evaluation.paper_trading_evaluation_id,
      candidateId: evaluation.candidate_ref.id,
      candidateVersionId: evaluation.candidate_version_ref.id,
      status: evaluation.status,
      evidencePurpose: commitment?.evidence_purpose,
      commitmentId: commitment?.paper_trading_evaluation_commitment_id,
      commitmentDigest: commitment?.commitment_digest,
      freezeStatus: paperTradingEvaluationFreezeStatus(evaluation, commitment),
      invalidationReason: evaluation.invalidation_reason,
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
      latestPublicExecutionSnapshot: latestObservation?.public_execution_snapshot ??
        evaluation.latest_public_execution_snapshot,
      latestDecision,
      paperAccountSnapshot: latestObservation?.paper_account_snapshot ?? evaluation.paper_account_snapshot,
      openOrders: latestObservation?.open_orders ?? evaluation.open_orders,
      latestFill: latestObservation?.latest_fill ?? evaluation.latest_fill,
      latestOrderRequestId: ledger?.latest_order_request?.order_request_id,
      latestGatewayOutcome: ledger?.latest_gateway_result?.decision_outcome,
      latestExecutionStatus: ledger?.latest_execution_result?.status,
      latestFailureReason
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
  evidencePurpose?: OperatorReadModel["selected_paper_trading_evaluation"]["evidence_purpose"];
  commitmentId?: string;
  commitmentDigest?: string;
  freezeStatus?: OperatorReadModel["selected_paper_trading_evaluation"]["freeze_status"];
  invalidationReason?: OperatorReadModel["selected_paper_trading_evaluation"]["invalidation_reason"];
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
  latestPublicExecutionSnapshot?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_public_execution_snapshot"];
  latestDecision?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_decision"];
  paperAccountSnapshot?: OperatorReadModel["selected_paper_trading_evaluation"]["paper_account_snapshot"];
  openOrders?: OperatorReadModel["selected_paper_trading_evaluation"]["open_orders"];
  latestFill?: OperatorReadModel["selected_paper_trading_evaluation"]["latest_fill"];
  latestOrderRequestId?: string;
  latestGatewayOutcome?: string;
  latestExecutionStatus?: string;
  latestFailureReason?: string;
}): OperatorReadModel["selected_paper_trading_evaluation"] {
  const latestFailure = classifyPaperTradingFailure(input.latestFailureReason);
  return {
    evaluation_kind: "paper_trading_evaluation",
    evaluation_id: input.evaluationId,
    status: input.status,
    evidence_purpose: input.evidencePurpose,
    commitment_id: input.commitmentId,
    commitment_digest: input.commitmentDigest,
    freeze_status: input.freezeStatus,
    invalidation_reason: input.invalidationReason,
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
    latest_public_execution_snapshot: input.latestPublicExecutionSnapshot,
    latest_decision: input.latestDecision,
    paper_account_snapshot: input.paperAccountSnapshot,
    open_orders: input.openOrders,
    latest_fill: input.latestFill,
    latest_order_request_id: input.latestOrderRequestId,
    latest_gateway_outcome: input.latestGatewayOutcome,
    latest_execution_status: input.latestExecutionStatus,
    latest_failure_reason: input.latestFailureReason,
    latest_failure: latestFailure,
    market_data_source: input.latestMarketSnapshot?.source_kind ??
      input.latestPublicExecutionSnapshot?.source_kind ??
      "binance_production_public_rest",
    account_provider: "fake_paper_account",
    executor: "fake_paper_order_executor",
    score_source: "paper_trading_engine",
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

function stoppedRuntimeSupervisorReadModel(): RuntimeSupervisorReadModel {
  return {
    status: "stopped",
    lanes: [],
    recorded_at: new Date().toISOString(),
    checkpoint_sequence: 0,
    checkpoint_digest: `sha256:${"0".repeat(64)}`,
    runtime_coordination_authority: true,
    evaluation_authority: false,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
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
