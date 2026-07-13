import { isDeepStrictEqual } from "node:util";
import type {
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  ResearchGeneralizationOutcomeService
} from "./research-generalization-outcome";

export type ResearchGeneralizationOutcomeCoordinationResult =
  | {
      status: "ensured";
      outcomeId: string;
      protocolId: string;
      inferenceStatus: ResearchGeneralizationOutcomeRecord["inference_status"];
    }
  | {
      status: "up_to_date";
      protocolCount: number;
      outcomeCount: number;
    };

export interface ResearchGeneralizationOutcomeCoordinatorLifecycle {
  ensureNextOutcome(): Promise<ResearchGeneralizationOutcomeCoordinationResult>;
}

export class ResearchGeneralizationOutcomeCoordinatorError extends Error {
  readonly code = "research_generalization_outcome_coordination_failed";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchGeneralizationOutcomeCoordinatorError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ResearchGeneralizationOutcomeCoordinator
implements ResearchGeneralizationOutcomeCoordinatorLifecycle {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async ensureNextOutcome(): Promise<
    ResearchGeneralizationOutcomeCoordinationResult
  > {
    try {
      return await this.reconcile();
    } catch (error) {
      if (error instanceof ResearchGeneralizationOutcomeCoordinatorError) {
        throw error;
      }
      throw coordinationFailed(
        "ResearchGeneralizationOutcome automatic reconciliation failed closed.",
        error
      );
    }
  }

  private async reconcile(): Promise<
    ResearchGeneralizationOutcomeCoordinationResult
  > {
    const observedAt = canonicalTime(this.now());
    const [protocols, studies, studyOutcomes, generalizationOutcomes] =
      await Promise.all([
        this.options.store.listResearchGeneralizationProtocols(),
        this.options.store.listResearchControlStudies(),
        this.options.store.listResearchControlStudyOutcomes(),
        this.options.store.listResearchGeneralizationOutcomes()
      ]);
    const protocolsById = uniqueBy(
      protocols,
      (protocol) => protocol.research_generalization_protocol_id,
      "ResearchGeneralizationProtocol list contains duplicate identities."
    );
    const studiesById = uniqueBy(
      studies,
      (study) => study.research_control_study_id,
      "ResearchControlStudy list contains duplicate identities."
    );
    const studyOutcomesByStudyId = uniqueBy(
      studyOutcomes,
      (outcome) => outcome.study_ref.id,
      "ResearchControlStudyOutcome list contains duplicate study refs."
    );
    uniqueBy(
      studyOutcomes,
      (outcome) => outcome.research_control_study_outcome_id,
      "ResearchControlStudyOutcome list contains duplicate identities."
    );
    const outcomesByProtocolId = uniqueBy(
      generalizationOutcomes,
      (outcome) => outcome.protocol_ref.id,
      "ResearchGeneralizationOutcome list contains duplicate protocol refs."
    );
    uniqueBy(
      generalizationOutcomes,
      (outcome) => outcome.research_generalization_outcome_id,
      "ResearchGeneralizationOutcome list contains duplicate identities."
    );
    for (const outcome of studyOutcomes) {
      if (!studiesById.has(outcome.study_ref.id)) {
        throw coordinationFailed(
          "ResearchControlStudyOutcome references an absent study."
        );
      }
    }
    for (const study of studies) {
      const protocolId = study.generalization_assignment?.protocol_ref.id;
      if (!protocolId) continue;
      const protocol = protocolsById.get(protocolId);
      if (!protocol || !protocol.study_slots.some((slot) =>
        slot.study_ref.id === study.research_control_study_id
      )) {
        throw coordinationFailed(
          "ResearchControlStudy references an absent generalization slot."
        );
      }
    }
    for (const outcome of generalizationOutcomes) {
      if (!protocolsById.has(outcome.protocol_ref.id)) {
        throw coordinationFailed(
          "ResearchGeneralizationOutcome references an absent protocol."
        );
      }
    }

    const orderedProtocols = [...protocols].sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_generalization_protocol_id.localeCompare(
        right.research_generalization_protocol_id
      )
    );
    for (const protocol of orderedProtocols) {
      const source = sourceGraph(
        protocol,
        studiesById,
        studyOutcomesByStudyId
      );
      const existing = outcomesByProtocolId.get(
        protocol.research_generalization_protocol_id
      );
      if (existing) {
        const reloaded = await new ResearchGeneralizationOutcomeService({
          store: this.options.store
        }).adjudicate(source);
        if (!isDeepStrictEqual(reloaded, existing)) {
          throw coordinationFailed(
            "ResearchGeneralizationOutcome differs from exact reconciliation."
          );
        }
        continue;
      }
      const terminal = source.studyOutcomes.length ===
        protocol.study_slots.length;
      const expired = Date.parse(observedAt) >=
        Date.parse(protocol.timing_policy.collection_deadline_at);
      if (!terminal && !expired) continue;
      const adjudicatedAt = deterministicAdjudicationTime(
        protocol,
        source.studyOutcomes,
        terminal
      );
      if (Date.parse(observedAt) < Date.parse(adjudicatedAt)) {
        throw coordinationFailed(
          "ResearchGeneralizationOutcome clock precedes terminal evidence."
        );
      }
      const outcome = await new ResearchGeneralizationOutcomeService({
        store: this.options.store,
        now: () => adjudicatedAt
      }).adjudicate(source);
      return {
        status: "ensured",
        outcomeId: outcome.research_generalization_outcome_id,
        protocolId: protocol.research_generalization_protocol_id,
        inferenceStatus: outcome.inference_status
      };
    }
    return {
      status: "up_to_date",
      protocolCount: protocols.length,
      outcomeCount: generalizationOutcomes.length
    };
  }
}

function sourceGraph(
  protocol: ResearchGeneralizationProtocolRecord,
  studiesById: Map<string, ResearchControlStudyRecord>,
  outcomesByStudyId: Map<string, ResearchControlStudyOutcomeRecord>
) {
  const studies = protocol.study_slots.flatMap((slot) => {
    const study = studiesById.get(slot.study_ref.id);
    return study ? [study] : [];
  });
  const studyOutcomes = studies.flatMap((study) => {
    const outcome = outcomesByStudyId.get(study.research_control_study_id);
    return outcome ? [outcome] : [];
  });
  return { protocol, studies, studyOutcomes };
}

function deterministicAdjudicationTime(
  protocol: ResearchGeneralizationProtocolRecord,
  outcomes: ResearchControlStudyOutcomeRecord[],
  terminal: boolean
): string {
  const latestOutcome = outcomes.reduce(
    (latest, outcome) => outcome.adjudicated_at > latest
      ? outcome.adjudicated_at
      : latest,
    protocol.committed_at
  );
  if (terminal) return latestOutcome;
  return latestOutcome > protocol.timing_policy.collection_deadline_at
    ? latestOutcome
    : protocol.timing_policy.collection_deadline_at;
}

function uniqueBy<T>(
  values: T[],
  identity: (value: T) => string,
  message: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = identity(value);
    if (result.has(id)) throw coordinationFailed(message);
    result.set(id, value);
  }
  return result;
}

function canonicalTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw coordinationFailed(
      "ResearchGeneralizationOutcome coordinator clock is invalid."
    );
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    throw coordinationFailed(
      "ResearchGeneralizationOutcome coordinator clock is invalid."
    );
  }
  return value;
}

function coordinationFailed(
  message: string,
  cause?: unknown
): ResearchGeneralizationOutcomeCoordinatorError {
  return new ResearchGeneralizationOutcomeCoordinatorError(
    message,
    cause === undefined ? undefined : { cause }
  );
}
