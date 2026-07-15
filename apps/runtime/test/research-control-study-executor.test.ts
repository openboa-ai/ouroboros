import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import { researchControlStudyOutcomeId } from
  "@ouroboros/application/candidate/research-control-study-outcome";
import type {
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord
} from "@ouroboros/domain";
import {
  ResearchControlStudyExecutor,
  type ResearchControlStudyExecutorCampaignAction
} from "../src/candidate/arena/research-control-study-executor";
import type {
  ProjectResearchControlStudyNextActionInput,
  ResearchControlStudyNextAction
} from "../src/candidate/arena/research-control-study-next-action";

describe("ResearchControlStudyExecutor", () => {
  it("runs one exact replication per advance before one adjudication", async () => {
    const fixture = executorFixture();
    const campaignCalls: ResearchControlStudyExecutorCampaignAction[] = [];
    let adjudicationCount = 0;
    const executor = executorFor(fixture, {
      async runCampaign(action) {
        campaignCalls.push(action);
        const closure = fixture.closures[action.replication.replication_index - 1]!;
        fixture.store.persistClosure(closure);
        return structuredClone(closure);
      },
      async adjudicateStudy() {
        adjudicationCount += 1;
        const outcome = fixture.studyOutcome();
        fixture.store.studyOutcome = outcome;
        return structuredClone(outcome);
      }
    });

    for (let index = 0; index < 6; index += 1) {
      await expect(executor.advance({
        studyId: fixture.study.research_control_study_id
      })).resolves.toMatchObject({
        status: "advanced",
        action: "run_campaign",
        replicationIndex: index + 1
      });
      expect(adjudicationCount).toBe(0);
    }
    await expect(executor.advance({
      studyId: fixture.study.research_control_study_id
    })).resolves.toMatchObject({
      status: "advanced",
      action: "study_adjudicated"
    });
    await expect(executor.advance({
      studyId: fixture.study.research_control_study_id
    })).resolves.toMatchObject({
      status: "complete",
      action: "complete"
    });

    expect(campaignCalls.map((call) => ({
      index: call.replication.replication_index,
      resume: call.resume
    }))).toEqual(Array.from({ length: 6 }, (_, index) => ({
      index: index + 1,
      resume: false
    })));
    expect(adjudicationCount).toBe(1);
  });

  it("resumes one persisted campaign without outcome", async () => {
    const fixture = executorFixture();
    fixture.store.campaigns.set(
      fixture.closures[0]!.campaign.research_control_campaign_id,
      fixture.closures[0]!.campaign
    );
    const calls: ResearchControlStudyExecutorCampaignAction[] = [];
    const executor = executorFor(fixture, {
      async runCampaign(action) {
        calls.push(action);
        fixture.store.persistClosure(fixture.closures[0]!);
        return fixture.closures[0]!;
      }
    });

    await executor.advance({ studyId: fixture.study.research_control_study_id });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ resume: true });
  });

  it("starts after an exact terminal prefix", async () => {
    const fixture = executorFixture();
    fixture.store.persistClosure(fixture.closures[0]!);
    fixture.store.persistClosure(fixture.closures[1]!);
    const calls: ResearchControlStudyExecutorCampaignAction[] = [];
    const executor = executorFor(fixture, {
      async runCampaign(action) {
        calls.push(action);
        const closure = fixture.closures[2]!;
        fixture.store.persistClosure(closure);
        return closure;
      }
    });

    await executor.advance({ studyId: fixture.study.research_control_study_id });

    expect(calls[0]!.replication.replication_index).toBe(3);
  });

  it("replays an existing study outcome without effects", async () => {
    const fixture = executorFixture();
    fixture.closures.forEach((closure) => fixture.store.persistClosure(closure));
    fixture.store.studyOutcome = fixture.studyOutcome();
    let effectCount = 0;
    const executor = executorFor(fixture, {
      async runCampaign() {
        effectCount += 1;
        throw new Error("unexpected_campaign_effect");
      },
      async adjudicateStudy() {
        effectCount += 1;
        throw new Error("unexpected_adjudication_effect");
      }
    });

    await expect(executor.advance({
      studyId: fixture.study.research_control_study_id
    })).resolves.toMatchObject({ status: "complete" });
    expect(effectCount).toBe(0);
  });

  it("rejects a missing study and ambiguous campaign outcomes", async () => {
    const fixture = executorFixture();
    const executor = executorFor(fixture, {});
    fixture.store.study = undefined;
    await expect(executor.advance({ studyId: "missing-study" }))
      .rejects.toMatchObject({
        code: "research_control_study_executor_graph_invalid"
      });

    fixture.store.study = fixture.study;
    fixture.store.persistClosure(fixture.closures[0]!);
    fixture.store.outcomes.push({
      ...structuredClone(fixture.closures[0]!.outcome),
      research_control_campaign_outcome_id: "duplicate-outcome"
    });
    await expect(executor.advance({
      studyId: fixture.study.research_control_study_id
    })).rejects.toMatchObject({
      code: "research_control_study_executor_graph_invalid"
    });
  });

  it.each([
    ["wrong callback closure", true],
    ["unpersisted callback closure", false]
  ])("rejects %s", async (_label, persist) => {
    const fixture = executorFixture();
    const executor = executorFor(fixture, {
      async runCampaign() {
        if (persist) fixture.store.persistClosure(fixture.closures[0]!);
        const returned = structuredClone(fixture.closures[0]!);
        returned.campaign.research_control_campaign_id = "wrong-campaign";
        return returned;
      }
    });

    await expect(executor.advance({
      studyId: fixture.study.research_control_study_id
    })).rejects.toMatchObject({
      code: "research_control_study_executor_persistence_conflict"
    });
  });

  it("wraps campaign and adjudication action failures", async () => {
    const campaignFixture = executorFixture();
    const campaignExecutor = executorFor(campaignFixture, {
      async runCampaign() { throw new Error("campaign_failed"); }
    });
    await expect(campaignExecutor.advance({
      studyId: campaignFixture.study.research_control_study_id
    })).rejects.toMatchObject({
      code: "research_control_study_executor_action_failed"
    });

    const adjudicationFixture = executorFixture();
    adjudicationFixture.closures.forEach((closure) =>
      adjudicationFixture.store.persistClosure(closure)
    );
    const adjudicationExecutor = executorFor(adjudicationFixture, {
      async adjudicateStudy() { throw new Error("adjudication_failed"); }
    });
    await expect(adjudicationExecutor.advance({
      studyId: adjudicationFixture.study.research_control_study_id
    })).rejects.toMatchObject({
      code: "research_control_study_executor_action_failed"
    });
  });
});

function executorFor(
  fixture: ReturnType<typeof executorFixture>,
  actions: Partial<{
    runCampaign(action: ResearchControlStudyExecutorCampaignAction): Promise<{
      campaign: ResearchControlCampaignRecord;
      outcome: ResearchControlCampaignOutcomeRecord;
    }>;
    adjudicateStudy(input: {
      study: ResearchControlStudyRecord;
      replications: Array<{
        campaign: ResearchControlCampaignRecord;
        outcome: ResearchControlCampaignOutcomeRecord;
      }>;
    }): Promise<ResearchControlStudyOutcomeRecord>;
  }>
) {
  return new ResearchControlStudyExecutor({
    store: fixture.store as unknown as OuroborosStorePort,
    runCampaign: actions.runCampaign ?? (async () => {
      throw new Error("unexpected_campaign_effect");
    }),
    projectNextAction: testProjector,
    adjudicateStudy: actions.adjudicateStudy ?? (async () => {
      const outcome = fixture.studyOutcome();
      fixture.store.studyOutcome = outcome;
      return outcome;
    })
  });
}

function testProjector(
  input: ProjectResearchControlStudyNextActionInput
): ResearchControlStudyNextAction {
  if (input.studyOutcome) return { action: "complete" };
  for (let index = 0; index < input.replications.length; index += 1) {
    const evidence = input.replications[index]!;
    if (!evidence.outcome) {
      const planned = input.study.replications[index]!;
      return {
        action: "run_campaign",
        replicationIndex: index + 1,
        campaignId: planned.campaign_ref.id,
        campaignIdempotencyKey: planned.campaign_idempotency_key,
        resume: Boolean(evidence.campaign)
      };
    }
  }
  return { action: "adjudicate_study" };
}

function executorFixture() {
  const replications = Array.from({ length: 6 }, (_, index) => ({
    replication_index: index + 1,
    campaign_idempotency_key: `executor-replication-${index + 1}`,
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: `executor-campaign-${index + 1}`
    },
    expected_baseline_snapshot_digest: digest("1")
  }));
  const study = {
    research_control_study_id: "executor-study",
    study_digest: digest("2"),
    replications
  } as unknown as ResearchControlStudyRecord;
  const closures = replications.map((replication) => {
    const campaign = {
      research_control_campaign_id: replication.campaign_ref.id,
      idempotency_key: replication.campaign_idempotency_key,
      campaign_digest: digest(String(replication.replication_index))
    } as ResearchControlCampaignRecord;
    const outcome = {
      research_control_campaign_outcome_id:
        `${replication.campaign_ref.id}-outcome`,
      campaign_ref: { ...replication.campaign_ref },
      campaign_digest: campaign.campaign_digest,
      outcome_digest: digest("a")
    } as ResearchControlCampaignOutcomeRecord;
    return { campaign, outcome };
  });
  const store = new ExecutorStore(study);
  return {
    study,
    closures,
    store,
    studyOutcome(): ResearchControlStudyOutcomeRecord {
      return {
        research_control_study_outcome_id: researchControlStudyOutcomeId(study),
        study_ref: {
          record_kind: "research_control_study",
          id: study.research_control_study_id
        },
        study_digest: study.study_digest,
        study_outcome_digest: digest("f")
      } as ResearchControlStudyOutcomeRecord;
    }
  };
}

class ExecutorStore {
  campaigns = new Map<string, ResearchControlCampaignRecord>();
  outcomes: ResearchControlCampaignOutcomeRecord[] = [];
  studyOutcome?: ResearchControlStudyOutcomeRecord;

  constructor(public study?: ResearchControlStudyRecord) {}

  async getResearchControlStudy(studyId: string) {
    return this.study?.research_control_study_id === studyId
      ? structuredClone(this.study)
      : undefined;
  }

  async getResearchControlCampaign(campaignId: string) {
    return structuredClone(this.campaigns.get(campaignId));
  }

  async listResearchControlCampaignOutcomes() {
    return structuredClone(this.outcomes);
  }

  async getResearchControlStudyOutcome(outcomeId: string) {
    return this.studyOutcome?.research_control_study_outcome_id === outcomeId
      ? structuredClone(this.studyOutcome)
      : undefined;
  }

  persistClosure(closure: {
    campaign: ResearchControlCampaignRecord;
    outcome: ResearchControlCampaignOutcomeRecord;
  }): void {
    this.campaigns.set(
      closure.campaign.research_control_campaign_id,
      structuredClone(closure.campaign)
    );
    const index = this.outcomes.findIndex((outcome) =>
      outcome.research_control_campaign_outcome_id ===
        closure.outcome.research_control_campaign_outcome_id
    );
    if (index < 0) this.outcomes.push(structuredClone(closure.outcome));
  }
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
