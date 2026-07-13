import { describe, expect, it } from "vitest";
import type {
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord
} from "@ouroboros/domain";
import {
  discoverResearchControlStudyProcessQueue,
  ResearchControlStudyProcessDiscoveryError
} from "../src/candidate/arena/research-control-study-process-discovery";
import {
  researchControlStudyFixture,
  researchControlStudyOutcomeFixture,
  resealResearchControlStudyOutcome
} from "./helpers/research-control-study";

describe("discoverResearchControlStudyProcessQueue", () => {
  it("returns no work for an empty store", () => {
    expect(discoverResearchControlStudyProcessQueue({
      studies: [],
      outcomes: []
    })).toEqual([]);
  });

  it("filters exact terminal studies and orders pending work deterministically", () => {
    const earlier = researchControlStudyFixture({
      suffix: "earlier",
      committedAt: "2026-07-12T08:00:00.000Z"
    });
    const terminal = researchControlStudyFixture({
      suffix: "terminal",
      committedAt: "2026-07-12T09:00:00.000Z"
    });
    const sameTimeB = researchControlStudyFixture({
      suffix: "same-b",
      committedAt: "2026-07-12T10:00:00.000Z"
    });
    const sameTimeA = researchControlStudyFixture({
      suffix: "same-a",
      committedAt: "2026-07-12T10:00:00.000Z"
    });

    const discovered = discoverResearchControlStudyProcessQueue({
      studies: [sameTimeB, terminal, earlier, sameTimeA],
      outcomes: [researchControlStudyOutcomeFixture({ study: terminal })]
    });

    expect(discovered.map((study) => study.research_control_study_id)).toEqual([
      earlier.research_control_study_id,
      sameTimeA.research_control_study_id,
      sameTimeB.research_control_study_id
    ]);
    expect(discovered[0]).not.toBe(earlier);
  });

  it.each([
    ["duplicate study", (graph: DiscoveryGraph) => {
      graph.studies.push(structuredClone(graph.studies[0]!));
    }],
    ["duplicate outcome", (graph: DiscoveryGraph) => {
      graph.outcomes.push(structuredClone(graph.outcomes[0]!));
    }],
    ["orphan outcome", (graph: DiscoveryGraph) => {
      graph.outcomes[0]!.study_ref.id = "missing-study";
      resealResearchControlStudyOutcome(graph.outcomes[0]!);
    }],
    ["study digest drift", (graph: DiscoveryGraph) => {
      graph.outcomes[0]!.study_digest = `sha256:${"f".repeat(64)}`;
      resealResearchControlStudyOutcome(graph.outcomes[0]!);
    }],
    ["time inversion", (graph: DiscoveryGraph) => {
      graph.outcomes[0]!.adjudicated_at = "2026-07-12T08:59:59.999Z";
      resealResearchControlStudyOutcome(graph.outcomes[0]!);
    }],
    ["malformed study", (graph: DiscoveryGraph) => {
      graph.studies[0]!.study_digest = "sha256:short";
    }],
    ["malformed outcome digest", (graph: DiscoveryGraph) => {
      graph.outcomes[0]!.study_outcome_digest = `sha256:${"e".repeat(64)}`;
    }]
  ])("rejects %s", (_label, mutate) => {
    const study = researchControlStudyFixture({ suffix: "invalid" });
    const graph: DiscoveryGraph = {
      studies: [study],
      outcomes: [researchControlStudyOutcomeFixture({ study })]
    };
    mutate(graph);

    expect(() => discoverResearchControlStudyProcessQueue(graph))
      .toThrowError(ResearchControlStudyProcessDiscoveryError);
  });

  it("rejects two differently identified outcomes for one study", () => {
    const study = researchControlStudyFixture({ suffix: "ambiguous" });
    const first = researchControlStudyOutcomeFixture({ study });
    const second = structuredClone(first);
    second.research_control_study_outcome_id = `${
      first.research_control_study_outcome_id
    }-other`;

    expect(() => discoverResearchControlStudyProcessQueue({
      studies: [study],
      outcomes: [first, second]
    })).toThrowError(ResearchControlStudyProcessDiscoveryError);
  });
});

interface DiscoveryGraph {
  studies: ResearchControlStudyRecord[];
  outcomes: ResearchControlStudyOutcomeRecord[];
}
