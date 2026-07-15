import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@ouroboros/local-store";

const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  "apps/runtime/test/fixtures/research-control-study/trading-review-store"
);

describe("ResearchControlStudy TradingReview fixture", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-study-fixture-"));
    await cp(FIXTURE_ROOT, root, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a complete paper-only TradingPromotion graph through LocalStore", async () => {
    const store = new LocalStore(root);
    await store.initialize();

    const promotion = await store.getLatestTradingPromotion();
    expect(promotion).toBeDefined();
    expect(promotion?.authority_status).toBe("not_live");

    const campaign = await store.getPaperTradingComparisonConfirmationCampaign(
      promotion!.comparison_confirmation.campaign_ref.id
    );
    const outcome =
      await store.getPaperTradingComparisonConfirmationCampaignOutcome(
        promotion!.comparison_confirmation.campaign_outcome_ref.id
      );
    const verdict = await store.getPaperTradingComparisonVerdict(
      promotion!.comparison_confirmation.final_verdict_ref.id
    );

    expect(campaign?.campaign_digest).toBe(
      promotion!.comparison_confirmation.campaign_digest
    );
    expect(outcome?.outcome_digest).toBe(
      promotion!.comparison_confirmation.campaign_outcome_digest
    );
    expect(verdict?.verdict_digest).toBe(
      promotion!.comparison_confirmation.final_verdict_digest
    );
    expect(verdict?.challenger.paper_trading_evaluation_ref).toEqual(
      promotion!.paper_trading_evaluation_ref
    );

    const candidate = await store.getCandidate(promotion!.candidate_ref.id);
    const candidateVersion = await store.getCandidateVersion(
      promotion!.candidate_version_ref.id
    );
    const systemCode = await store.getSystemCode(
      campaign!.challenger.system_code_ref.id
    );
    const admission = await store.getCandidateAdmissionDecision(
      campaign!.challenger.candidate_admission_decision_ref.id
    );
    const evaluation = await store.getPaperTradingEvaluation(
      promotion!.paper_trading_evaluation_ref.id
    );
    const commitment = evaluation?.paper_trading_evaluation_commitment_ref
      ? await store.getPaperTradingEvaluationCommitment(
        evaluation.paper_trading_evaluation_commitment_ref.id
      )
      : undefined;
    const observations = evaluation
      ? await store.listPaperTradingObservations(
        evaluation.paper_trading_evaluation_id
      )
      : [];

    expect(candidate?.candidate_id).toBe(promotion!.candidate_ref.id);
    expect(candidateVersion?.candidate_version_id).toBe(
      promotion!.candidate_version_ref.id
    );
    expect(candidateVersion?.system_code_ref).toEqual(
      campaign!.challenger.system_code_ref
    );
    expect(systemCode?.artifact_digest).toBe(
      campaign!.challenger.system_code_artifact_digest
    );
    expect(systemCode?.capability_policy_ref.id).toBe(
      "capability-policy-clock-fixture-v1"
    );
    expect(admission?.system_code_ref).toEqual(campaign!.challenger.system_code_ref);
    expect(commitment?.candidate_ref).toEqual(promotion!.candidate_ref);
    expect(commitment?.authority_status).toBe("not_live");
    expect(observations).toHaveLength(evaluation!.observation_count);
    expect(observations.every((observation) =>
      observation.authority_status === "not_live"
    )).toBe(true);
  });
});
