import { isDeepStrictEqual } from "node:util";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperStartBatchRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";

export type ResearchControlCampaignPaperGraphErrorCode =
  | "research_control_campaign_paper_graph_coordinator_invalid"
  | "research_control_campaign_paper_graph_arm_conflict"
  | "research_control_campaign_paper_graph_readback_mismatch";

export class ResearchControlCampaignPaperGraphError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperGraphErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperGraphError";
  }
}

export async function installResearchControlCampaignPaperGraph(input: {
  coordinator: OuroborosStorePort;
  arms: Record<ResearchControlCampaignArmKind, OuroborosStorePort>;
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
}): Promise<void> {
  const graph = await loadCoordinatorGraph(input);
  await Promise.all((Object.entries(input.arms) as [
    ResearchControlCampaignArmKind,
    OuroborosStorePort
  ][]).map(([armKind, store]) => preflightArmGraph({
    armKind,
    store,
    ...graph
  })));

  for (const [armKind, store] of Object.entries(input.arms) as [
    ResearchControlCampaignArmKind,
    OuroborosStorePort
  ][]) {
    await installArmGraph({ armKind, store, ...graph });
  }
}

interface SealedPaperGraph {
  campaign: ResearchControlCampaignRecord;
  intents: [
    ResearchControlCampaignArmIntentRecord,
    ResearchControlCampaignArmIntentRecord
  ];
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
  batches: ResearchControlCampaignPaperStartBatchRecord[];
}

async function loadCoordinatorGraph(input: {
  coordinator: OuroborosStorePort;
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
}): Promise<SealedPaperGraph> {
  const campaign = await input.coordinator.getResearchControlCampaign(
    input.campaign.research_control_campaign_id
  );
  const report = await input.coordinator.getResearchControlCampaignReport(
    input.report.research_control_campaign_report_id
  );
  const schedule = await input.coordinator.getResearchControlCampaignPaperSchedule(
    input.schedule.research_control_campaign_paper_schedule_id
  );
  if (!isDeepStrictEqual(campaign, input.campaign) ||
    !isDeepStrictEqual(report, input.report) ||
    !isDeepStrictEqual(schedule, input.schedule)) {
    throw graphError(
      "research_control_campaign_paper_graph_coordinator_invalid",
      "Coordinator campaign, report, or schedule differs from the sealed input."
    );
  }

  const intents = await Promise.all(input.campaign.arms.map((arm) =>
    input.coordinator.getResearchControlCampaignArmIntent(
      arm.research_control_campaign_arm_intent_id
    )
  ));
  if (!intents[0] || !intents[1] || !intentMatchesArm(
    intents[0],
    input.campaign,
    input.campaign.arms[0]
  ) || !intentMatchesArm(
    intents[1],
    input.campaign,
    input.campaign.arms[1]
  )) {
    throw graphError(
      "research_control_campaign_paper_graph_coordinator_invalid",
      "Coordinator arm intents do not match the sealed campaign."
    );
  }
  if (input.report.campaign_ref.id !== input.campaign.research_control_campaign_id ||
    input.report.campaign_digest !== input.campaign.campaign_digest ||
    input.schedule.campaign_ref.id !== input.campaign.research_control_campaign_id ||
    input.schedule.campaign_digest !== input.campaign.campaign_digest ||
    input.schedule.report_ref.id !==
      input.report.research_control_campaign_report_id ||
    input.schedule.report_digest !== input.report.report_digest) {
    throw graphError(
      "research_control_campaign_paper_graph_coordinator_invalid",
      "Coordinator report or schedule source graph is inconsistent."
    );
  }

  const batches = (await input.coordinator
    .listResearchControlCampaignPaperStartBatches(
      input.schedule.research_control_campaign_paper_schedule_id
    )).slice().sort(compareBatches);
  const batchIds = new Set<string>();
  const batchSequences = new Set<number>();
  for (const batch of batches) {
    if (batch.schedule_ref.id !==
      input.schedule.research_control_campaign_paper_schedule_id ||
      batch.schedule_digest !== input.schedule.schedule_digest ||
      batchIds.has(batch.research_control_campaign_paper_start_batch_id) ||
      batchSequences.has(batch.sequence)) {
      throw graphError(
        "research_control_campaign_paper_graph_coordinator_invalid",
        "Coordinator start batches are ambiguous or do not match the schedule."
      );
    }
    batchIds.add(batch.research_control_campaign_paper_start_batch_id);
    batchSequences.add(batch.sequence);
  }

  return {
    campaign: input.campaign,
    intents: [intents[0], intents[1]],
    report: input.report,
    schedule: input.schedule,
    batches
  };
}

async function preflightArmGraph(input: {
  armKind: ResearchControlCampaignArmKind;
  store: OuroborosStorePort;
} & SealedPaperGraph): Promise<void> {
  const campaign = await input.store.getResearchControlCampaign(
    input.campaign.research_control_campaign_id
  );
  if (!isDeepStrictEqual(campaign, input.campaign)) {
    throw graphError(
      "research_control_campaign_paper_graph_arm_conflict",
      "Arm store does not contain the exact sealed campaign.",
      { arm_kind: input.armKind }
    );
  }
  for (const intent of input.intents) {
    await assertAbsentOrExact(
      input.store.getResearchControlCampaignArmIntent(
        intent.research_control_campaign_arm_intent_id
      ),
      intent,
      input.armKind,
      "intent"
    );
  }
  await assertAbsentOrExact(
    input.store.getResearchControlCampaignReport(
      input.report.research_control_campaign_report_id
    ),
    input.report,
    input.armKind,
    "report"
  );
  await assertAbsentOrExact(
    input.store.getResearchControlCampaignPaperSchedule(
      input.schedule.research_control_campaign_paper_schedule_id
    ),
    input.schedule,
    input.armKind,
    "schedule"
  );
  for (const batch of input.batches) {
    if (!participatesInBatch(input.armKind, batch)) continue;
    await assertAbsentOrExact(
      input.store.getResearchControlCampaignPaperStartBatch(
        batch.research_control_campaign_paper_start_batch_id
      ),
      batch,
      input.armKind,
      "start_batch"
    );
  }
}

async function installArmGraph(input: {
  armKind: ResearchControlCampaignArmKind;
  store: OuroborosStorePort;
} & SealedPaperGraph): Promise<void> {
  try {
    for (const intent of input.intents) {
      await input.store.recordResearchControlCampaignArmIntent(intent);
      await assertExactReadback(
        input.store.getResearchControlCampaignArmIntent(
          intent.research_control_campaign_arm_intent_id
        ),
        intent,
        input.armKind,
        "intent"
      );
    }
    await input.store.recordResearchControlCampaignReport(input.report);
    await assertExactReadback(
      input.store.getResearchControlCampaignReport(
        input.report.research_control_campaign_report_id
      ),
      input.report,
      input.armKind,
      "report"
    );
    await input.store.recordResearchControlCampaignPaperSchedule(input.schedule);
    await assertExactReadback(
      input.store.getResearchControlCampaignPaperSchedule(
        input.schedule.research_control_campaign_paper_schedule_id
      ),
      input.schedule,
      input.armKind,
      "schedule"
    );
    for (const batch of input.batches) {
      if (!participatesInBatch(input.armKind, batch)) continue;
      await input.store.replicateResearchControlCampaignPaperStartBatch(batch);
      await assertExactReadback(
        input.store.getResearchControlCampaignPaperStartBatch(
          batch.research_control_campaign_paper_start_batch_id
        ),
        batch,
        input.armKind,
        "start_batch"
      );
    }
  } catch (error) {
    if (error instanceof ResearchControlCampaignPaperGraphError) throw error;
    throw graphError(
      "research_control_campaign_paper_graph_arm_conflict",
      "Arm store rejected the sealed paper graph.",
      { arm_kind: input.armKind },
      error
    );
  }
}

function intentMatchesArm(
  intent: ResearchControlCampaignArmIntentRecord,
  campaign: ResearchControlCampaignRecord,
  arm: ResearchControlCampaignRecord["arms"][number]
): boolean {
  return intent.research_control_campaign_arm_intent_id ===
      arm.research_control_campaign_arm_intent_id &&
    intent.campaign_ref.id === campaign.research_control_campaign_id &&
    intent.campaign_digest === campaign.campaign_digest &&
    intent.arm_kind === arm.arm_kind &&
    intent.allocation_mode === arm.allocation_mode &&
    intent.baseline_snapshot_digest === campaign.baseline.snapshot_digest &&
    isDeepStrictEqual(intent.tick_ids, arm.tick_ids);
}

async function assertAbsentOrExact<T>(
  actualPromise: Promise<T | undefined>,
  expected: T,
  armKind: ResearchControlCampaignArmKind,
  recordKind: string
): Promise<void> {
  const actual = await actualPromise;
  if (actual !== undefined && !isDeepStrictEqual(actual, expected)) {
    throw graphError(
      "research_control_campaign_paper_graph_arm_conflict",
      "Arm store contains conflicting paper graph evidence.",
      { arm_kind: armKind, record_kind: recordKind }
    );
  }
}

async function assertExactReadback<T>(
  actualPromise: Promise<T | undefined>,
  expected: T,
  armKind: ResearchControlCampaignArmKind,
  recordKind: string
): Promise<void> {
  const actual = await actualPromise;
  if (!isDeepStrictEqual(actual, expected)) {
    throw graphError(
      "research_control_campaign_paper_graph_readback_mismatch",
      "Arm store readback differs from the sealed paper graph.",
      { arm_kind: armKind, record_kind: recordKind }
    );
  }
}

function compareBatches(
  left: ResearchControlCampaignPaperStartBatchRecord,
  right: ResearchControlCampaignPaperStartBatchRecord
): number {
  return left.sequence - right.sequence ||
    left.research_control_campaign_paper_start_batch_id.localeCompare(
      right.research_control_campaign_paper_start_batch_id
    );
}

function participatesInBatch(
  armKind: ResearchControlCampaignArmKind,
  batch: ResearchControlCampaignPaperStartBatchRecord
): boolean {
  return batch.sides.some((side) => side.arm_kind === armKind);
}

function graphError(
  code: ResearchControlCampaignPaperGraphErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): ResearchControlCampaignPaperGraphError {
  return new ResearchControlCampaignPaperGraphError(
    code,
    message,
    details,
    cause === undefined ? undefined : { cause }
  );
}
