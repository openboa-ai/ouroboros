import { createHash } from "node:crypto";
import type { ResearchDirectionKind } from "@ouroboros/domain";

export interface ResearchWorkItemIdentityInput {
  research_allocation_id: string;
  direction_kind: ResearchDirectionKind;
}

export function canonicalResearchWorkItemIdentityKey(
  input: ResearchWorkItemIdentityInput
): string {
  return JSON.stringify({
    research_allocation_id: input.research_allocation_id,
    direction_kind: input.direction_kind
  });
}

export function researchWorkItemId(input: ResearchWorkItemIdentityInput): string {
  return `research-session-v1-${createHash("sha256")
    .update(canonicalResearchWorkItemIdentityKey(input))
    .digest("hex")}`;
}

export type CandidateArenaActiveResearchWorkItemPhase =
  | "allocating"
  | "running"
  | "failed_closed_pending_tick";

export interface CandidateArenaActiveResearchWorkItemReadModel
  extends ResearchWorkItemIdentityInput {
  identity_kind: "derived_projection";
  research_work_item_id: string;
  phase: CandidateArenaActiveResearchWorkItemPhase;
  commitment_id?: string;
  failure_code?: "candidate_arena_research_precommit_failed";
}

export interface CandidateArenaResearchWorkObserver {
  directionStarted(input: ResearchWorkItemIdentityInput): void;
  commitmentPersisted(input: ResearchWorkItemIdentityInput & {
    commitment_id: string;
  }): void;
  directionFailed(input: ResearchWorkItemIdentityInput): void;
  terminalEvidencePersisted(input: ResearchWorkItemIdentityInput): void;
  tickPersisted(): void;
  clearMatchingTick(): void;
}

export class CandidateArenaResearchWorkRegistry {
  private activeTickId?: string;
  private readonly items = new Map<
    string,
    CandidateArenaActiveResearchWorkItemReadModel
  >();

  beginTick(tickId: string): CandidateArenaResearchWorkObserver {
    this.activeTickId = tickId;
    this.items.clear();
    return this.observerForTick(tickId);
  }

  observerForTick(tickId: string): CandidateArenaResearchWorkObserver {
    const matches = () => this.activeTickId === tickId;
    return {
      directionStarted: (input) => {
        if (!matches()) return;
        const id = researchWorkItemId(input);
        this.items.set(id, {
          ...input,
          identity_kind: "derived_projection",
          research_work_item_id: id,
          phase: "allocating"
        });
      },
      commitmentPersisted: (input) => {
        if (!matches()) return;
        const id = researchWorkItemId(input);
        const current = this.items.get(id);
        if (!current) return;
        this.items.set(id, {
          ...current,
          phase: "running",
          commitment_id: input.commitment_id
        });
      },
      directionFailed: (input) => {
        if (!matches()) return;
        const id = researchWorkItemId(input);
        const current = this.items.get(id);
        if (!current || current.commitment_id) return;
        this.items.set(id, {
          ...current,
          phase: "failed_closed_pending_tick",
          failure_code: "candidate_arena_research_precommit_failed"
        });
      },
      terminalEvidencePersisted: (input) => {
        if (!matches()) return;
        this.items.delete(researchWorkItemId(input));
      },
      tickPersisted: () => {
        if (!matches()) return;
        this.items.clear();
      },
      clearMatchingTick: () => {
        if (!matches()) return;
        this.activeTickId = undefined;
        this.items.clear();
      }
    };
  }

  snapshot(): {
    active_tick_id?: string;
    active_research_work_items: CandidateArenaActiveResearchWorkItemReadModel[];
  } {
    return {
      active_tick_id: this.activeTickId,
      active_research_work_items: [...this.items.values()].map((item) => ({
        ...item
      }))
    };
  }
}
