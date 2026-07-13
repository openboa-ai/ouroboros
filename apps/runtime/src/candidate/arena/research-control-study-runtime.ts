import { isDeepStrictEqual } from "node:util";
import {
  decideResearchControlCampaign
} from "@ouroboros/application/candidate/research-control-campaign";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import {
  ResearchControlStudyService,
  researchControlStudyConditionFromCampaign
} from "@ouroboros/application/candidate/research-control-study";
import type { ManagedResearchAgent } from
  "@ouroboros/application/trading/research/types";
import type {
  ResearchControlCampaignArmKind,
  ResearchControlStudyRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  collectResearchControlCampaignOutcome,
  prepareResearchControlCampaignCommitRequest,
  runResearchControlCampaign,
  type CollectResearchControlCampaignOutcomeResult,
  type PrepareResearchControlCampaignCommitRequestInput,
  type RunResearchControlCampaignInput
} from "./research-control-campaign";
import {
  createResearchControlCampaignPaperRuntime,
  type ResearchControlCampaignPaperRuntime,
  type ResearchControlCampaignPaperRuntimeArm
} from "./research-control-campaign-paper-runtime";
import {
  createResearchControlCampaignPaperRuntimeArm,
  type ResearchControlCampaignPaperRuntimeArmSessions
} from "./research-control-campaign-paper-runtime-arm";
import { ResearchControlStudyExecutor } from
  "./research-control-study-executor";
import { ResearchControlStudyRunner } from
  "./research-control-study-runner";

export type ResearchControlStudyRuntimeErrorCode =
  | "research_control_study_runtime_condition_invalid"
  | "research_control_study_runtime_commitment_invalid"
  | "research_control_study_runtime_arm_composition_invalid"
  | "research_control_campaign_to_outcome_paper_failed"
  | "research_control_campaign_to_outcome_paper_incomplete"
  | "research_control_campaign_to_outcome_closure_mismatch";

export class ResearchControlStudyRuntimeError extends Error {
  constructor(
    readonly code: ResearchControlStudyRuntimeErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudyRuntimeError";
  }
}

export interface CommitResearchControlStudyRuntimeInput {
  store: LocalStore;
  studyIdempotencyKey: string;
  replicationIdempotencyKeys: string[];
  sourceCandidateId?: string;
  researchAgentIdentity: ManagedResearchAgent;
  tickCountPerArm: number;
  maximumBaselineRegularFileCount?: number;
  maximumBaselineTotalBytes?: number;
  paperEvaluationProtocol?:
    PrepareResearchControlCampaignCommitRequestInput["paperEvaluationProtocol"];
  now?: () => string;
  repoRoot?: string;
}

export interface RunResearchControlCampaignToOutcomeInput
  extends Omit<RunResearchControlCampaignInput, "paperExecutor"> {
  marketData: GatewayMarketDataPort;
  openArm?(input: {
    root: string;
    armKind: ResearchControlCampaignArmKind;
  }): ResearchControlCampaignPaperRuntimeArm |
    Promise<ResearchControlCampaignPaperRuntimeArm>;
  openArmStore?(input: {
    root: string;
    armKind: ResearchControlCampaignArmKind;
  }): LocalStore | Promise<LocalStore>;
  createArmSessions?(input: {
    root: string;
    armKind: ResearchControlCampaignArmKind;
    store: LocalStore;
  }): ResearchControlCampaignPaperRuntimeArmSessions |
    Promise<ResearchControlCampaignPaperRuntimeArmSessions>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export type ResearchControlCampaignToOutcomeResult =
  CollectResearchControlCampaignOutcomeResult;

export interface ResearchControlStudyRuntime {
  executor: ResearchControlStudyExecutor;
  runner: ResearchControlStudyRunner;
}

interface ResearchControlCampaignToOutcomeDependencies {
  runCampaign?: typeof runResearchControlCampaign;
  createPaperRuntime?: (
    input: Parameters<typeof createResearchControlCampaignPaperRuntime>[0]
  ) => {
    runner: Pick<
      ResearchControlCampaignPaperRuntime["runner"],
      "start" | "drain" | "status"
    >;
  };
  collectOutcome?: typeof collectResearchControlCampaignOutcome;
}

export async function commitResearchControlStudyRuntime(
  input: CommitResearchControlStudyRuntimeInput
): Promise<ResearchControlStudyRecord> {
  const firstReplicationKey = input?.replicationIdempotencyKeys?.[0];
  if (typeof firstReplicationKey !== "string") {
    throw runtimeError(
      "research_control_study_runtime_commitment_invalid",
      "ResearchControlStudy runtime requires a planned replication sample."
    );
  }
  const prepared = await prepareResearchControlCampaignCommitRequest({
    store: input.store,
    idempotencyKey: firstReplicationKey,
    ...(input.sourceCandidateId
      ? { sourceCandidateId: input.sourceCandidateId }
      : {}),
    researchAgentIdentity: input.researchAgentIdentity,
    tickCountPerArm: input.tickCountPerArm,
    ...(input.maximumBaselineRegularFileCount === undefined
      ? {}
      : {
          maximumBaselineRegularFileCount:
            input.maximumBaselineRegularFileCount
        }),
    ...(input.maximumBaselineTotalBytes === undefined
      ? {}
      : { maximumBaselineTotalBytes: input.maximumBaselineTotalBytes }),
    ...(input.paperEvaluationProtocol
      ? { paperEvaluationProtocol: input.paperEvaluationProtocol }
      : {}),
    ...(input.repoRoot ? { repoRoot: input.repoRoot } : {})
  });
  const committedAt = (input.now ?? (() => new Date().toISOString()))();
  let condition;
  try {
    const template = decideResearchControlCampaign({
      ...prepared.request,
      committedAt
    });
    condition = researchControlStudyConditionFromCampaign(template);
  } catch (error) {
    throw runtimeError(
      "research_control_study_runtime_condition_invalid",
      "ResearchControlStudy runtime requires one bound Trading review condition.",
      error
    );
  }
  const { condition_digest: _conditionDigest, ...conditionInput } = condition;
  try {
    return await new ResearchControlStudyService({
      store: input.store,
      now: () => committedAt
    }).commit({
      idempotencyKey: input.studyIdempotencyKey,
      baselineSnapshotDigest: prepared.request.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: input.replicationIdempotencyKeys
    });
  } catch (error) {
    if (hasErrorCode(
      error,
      "research_control_study_campaign_already_exists"
    )) {
      throw error;
    }
    throw runtimeError(
      "research_control_study_runtime_commitment_invalid",
      "ResearchControlStudy runtime commitment failed closed.",
      error
    );
  }
}

export async function runResearchControlCampaignToOutcome(
  input: RunResearchControlCampaignToOutcomeInput,
  dependencies: ResearchControlCampaignToOutcomeDependencies = {}
): Promise<ResearchControlCampaignToOutcomeResult> {
  const runCampaign = dependencies.runCampaign ?? runResearchControlCampaign;
  const createPaperRuntime = dependencies.createPaperRuntime ??
    createResearchControlCampaignPaperRuntime;
  const collectOutcome = dependencies.collectOutcome ??
    collectResearchControlCampaignOutcome;
  const {
    marketData,
    openArm: configuredOpenArm,
    openArmStore,
    createArmSessions,
    sleep,
    ...campaignInput
  } = input;
  const openArm = resolveRuntimeArmOpener({
    configuredOpenArm,
    openArmStore,
    createArmSessions,
    marketData,
    ...(input.now ? { now: input.now } : {})
  });
  const run = await runCampaign(campaignInput);
  if (run.campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw runtimeError(
      "research_control_campaign_to_outcome_paper_incomplete",
      "ResearchControlCampaign study replication requires a bound paper protocol."
    );
  }
  const adaptive = await openArm({
    root: run.armRoots.adaptive_treatment,
    armKind: "adaptive_treatment"
  });
  const control = await openArm({
    root: run.armRoots.static_control,
    armKind: "static_control"
  });
  const arms: Record<
    ResearchControlCampaignArmKind,
    ResearchControlCampaignPaperRuntimeArm
  > = {
    adaptive_treatment: adaptive,
    static_control: control
  };
  const collect = () => collectOutcome({
    store: input.store,
    workspaceRoot: input.workspaceRoot,
    campaignId: run.campaign.research_control_campaign_id,
    ...(input.now ? { now: input.now } : {}),
    openArmStore: (_root, armKind) => arms[armKind].store
  });
  const paper = createPaperRuntime({
    coordinator: input.store,
    arms,
    marketData,
    collectCampaignOutcome: async () => (await collect()).outcome,
    ...(input.now ? { now: input.now } : {}),
    ...(sleep ? { sleep } : {})
  });
  paper.runner.start({
    campaignId: run.campaign.research_control_campaign_id
  });
  await paper.runner.drain();
  const status = paper.runner.status();
  if (status.status === "failed") {
    throw runtimeError(
      "research_control_campaign_to_outcome_paper_failed",
      `ResearchControlCampaign paper runner failed: ${status.errorCode}.`
    );
  }
  if (status.status !== "completed") {
    throw runtimeError(
      "research_control_campaign_to_outcome_paper_incomplete",
      `ResearchControlCampaign paper runner ended as ${status.status}.`
    );
  }
  const collected = await collect();
  if (!isDeepStrictEqual(collected.campaign, run.campaign) ||
    !isDeepStrictEqual(collected.report, run.report) ||
    collected.campaignRoot !== run.campaignRoot ||
    collected.baselineRoot !== run.baselineRoot ||
    collected.sourceArtifactRoot !== run.sourceArtifactRoot ||
    !isDeepStrictEqual(collected.armRoots, run.armRoots) ||
    collected.outcome.campaign_ref.id !==
      run.campaign.research_control_campaign_id ||
    collected.outcome.campaign_digest !== run.campaign.campaign_digest) {
    throw runtimeError(
      "research_control_campaign_to_outcome_closure_mismatch",
      "ResearchControlCampaign terminal closure differs from its executed graph."
    );
  }
  return collected;
}

function resolveRuntimeArmOpener(input: {
  configuredOpenArm?: RunResearchControlCampaignToOutcomeInput["openArm"];
  openArmStore?: RunResearchControlCampaignToOutcomeInput["openArmStore"];
  createArmSessions?:
    RunResearchControlCampaignToOutcomeInput["createArmSessions"];
  marketData: GatewayMarketDataPort;
  now?: () => string;
}): NonNullable<RunResearchControlCampaignToOutcomeInput["openArm"]> {
  if (input.configuredOpenArm) {
    if (input.openArmStore || input.createArmSessions) {
      throw runtimeError(
        "research_control_study_runtime_arm_composition_invalid",
        "Explicit openArm cannot be combined with default arm composition."
      );
    }
    return input.configuredOpenArm;
  }
  if (!input.createArmSessions) {
    throw runtimeError(
      "research_control_study_runtime_arm_composition_invalid",
      "Default arm composition requires an arm-local session factory."
    );
  }
  const openStore = input.openArmStore ?? ((context: { root: string }) =>
    new LocalStore(context.root));
  return async (context) => {
    let store: LocalStore;
    let sessions: ResearchControlCampaignPaperRuntimeArmSessions;
    try {
      store = await openStore(context);
      if (!store || store.root() !== context.root) {
        throw new Error("arm store root mismatch");
      }
      await store.initialize();
      sessions = await input.createArmSessions!({
        ...context,
        store
      });
      if (!sessions) throw new Error("arm sessions missing");
    } catch (error) {
      throw runtimeError(
        "research_control_study_runtime_arm_composition_invalid",
        `ResearchControlCampaign ${context.armKind} arm could not be composed.`,
        error
      );
    }
    return createResearchControlCampaignPaperRuntimeArm({
      store,
      sessions,
      marketData: input.marketData,
      ...(input.now ? { now: input.now } : {})
    });
  };
}

export function createResearchControlStudyRuntime(input: {
  store: LocalStore;
  campaign: Omit<
    RunResearchControlCampaignToOutcomeInput,
    "store" | "idempotencyKey"
  >;
}): ResearchControlStudyRuntime {
  const executor = new ResearchControlStudyExecutor({
    store: input.store,
    runCampaign: async ({ replication }) => {
      const result = await runResearchControlCampaignToOutcome({
        ...input.campaign,
        store: input.store,
        idempotencyKey: replication.campaign_idempotency_key
      });
      return { campaign: result.campaign, outcome: result.outcome };
    }
  });
  const runner = new ResearchControlStudyRunner({ executor });
  return { executor, runner };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === "object" &&
    (error as { code?: unknown }).code === code;
}

function runtimeError(
  code: ResearchControlStudyRuntimeErrorCode,
  message: string,
  cause?: unknown
): ResearchControlStudyRuntimeError {
  return new ResearchControlStudyRuntimeError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  );
}
