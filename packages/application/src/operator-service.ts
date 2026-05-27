import { randomUUID } from "node:crypto";
import {
  OUROBOROS_COMMAND_DESCRIPTORS,
  type AgentProfileProviderKind,
  type CandidateInspectReadModel,
  type OperatorReadModel,
  type OuroborosCommandKind,
  type OuroborosCommandReadModel,
  type OuroborosCommandRecord,
  type ResearcherProviderReadModel
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import {
  listAgentProfileReadModels,
  parseAgentProfileProvider,
  probeAgentProfile,
  setupAgentProfile,
  UnsupportedAgentProviderError,
  type AgentProfileExecFile
} from "./agent-profiles";
import { buildCandidateArenaReadModel, type CandidateArenaRunner } from "./candidate-arena";
import type {
  OperatorCommandExecution,
  OperatorCommandHandlerRegistry,
  SelectedCandidatePaperEvidencePort
} from "./ports/operator-ports";
import { safeId } from "./safe-id";
import type { TradingResearchRuntimeAgent } from "./trading-research/runtime-config";

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
  store: LocalStore;
  candidateArenaRunner: CandidateArenaRunner;
  paperEvidenceAdapter: SelectedCandidatePaperEvidencePort;
  agentProfileExecFile?: AgentProfileExecFile;
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
    const selectedCandidate = this.selectedCandidateId
      ? await this.options.store.getCandidate(this.selectedCandidateId)
      : undefined;
    if (this.selectedCandidateId && !selectedCandidate) {
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
