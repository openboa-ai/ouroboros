import type {
  ResearchWorkerDevelopmentEvaluationEvidence,
  ResearchWorkerDevelopmentSelectionInput,
  ResearchWorkerDevelopmentSubmissionInput,
  ResearchWorkerDevelopmentSubmissionRequest,
  ResearchWorkerDevelopmentSubmissionResult,
  ResearchWorkerFinishInput,
  ResearchWorkerFinishResult,
  ResearchWorkerSelectionResult,
  ResearchWorkerSessionStatus,
  ResearchWorkerToolPort,
  ResearchWorkerToolStatus
} from "./types";

const MAX_SUBMISSION_LIMIT = 100;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_RESEARCH_TEXT_LENGTH = 500;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type ResearchWorkerSessionErrorCode =
  | "research_worker_session_invalid_input"
  | "research_worker_tool_invalid_request"
  | "research_worker_tool_idempotency_conflict"
  | "research_worker_tool_budget_exhausted"
  | "research_worker_tool_submission_not_found"
  | "research_worker_tool_session_closed"
  | "research_worker_tool_evaluator_evidence_invalid"
  | "research_worker_tool_operation_in_progress";

export class ResearchWorkerSessionError extends Error {
  constructor(
    readonly code: ResearchWorkerSessionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchWorkerSessionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ResearchWorkerDevelopmentSessionOptions {
  submissionLimit: number;
  evaluate(
    input: ResearchWorkerDevelopmentSubmissionRequest
  ): Promise<ResearchWorkerDevelopmentEvaluationEvidence>;
}

type IdempotentOperation = {
  kind: "submit" | "select" | "finish";
  fingerprint: string;
  promise: Promise<unknown>;
};

export class ResearchWorkerDevelopmentSession implements ResearchWorkerToolPort {
  private sessionStatus: ResearchWorkerSessionStatus = "open";
  private consumedSubmissionCount = 0;
  private selectedSubmissionSequence: number | null = null;
  private terminalReason?: string;
  private operationQueue: Promise<void> = Promise.resolve();
  private activeOperationCount = 0;
  private readonly submissions: ResearchWorkerDevelopmentEvaluationEvidence[] = [];
  private readonly idempotentOperations = new Map<string, IdempotentOperation>();

  constructor(private readonly options: ResearchWorkerDevelopmentSessionOptions) {
    if (!Number.isInteger(options.submissionLimit) ||
      options.submissionLimit < 1 ||
      options.submissionLimit > MAX_SUBMISSION_LIMIT ||
      typeof options.evaluate !== "function") {
      throw new ResearchWorkerSessionError(
        "research_worker_session_invalid_input",
        "ResearchWorker development session input is invalid."
      );
    }
  }

  async status(): Promise<ResearchWorkerToolStatus> {
    await this.operationQueue;
    return this.currentStatus();
  }

  submitDevelopment(
    input: ResearchWorkerDevelopmentSubmissionInput
  ): Promise<ResearchWorkerDevelopmentSubmissionResult> {
    const normalized = {
      idempotency_key: validIdempotencyKey(input?.idempotency_key),
      research_note: validResearchText(input?.research_note)
    };
    return this.idempotent(
      "submit",
      normalized.idempotency_key,
      normalized,
      async () => {
        this.assertOpen();
        if (this.consumedSubmissionCount >= this.options.submissionLimit) {
          throw new ResearchWorkerSessionError(
            "research_worker_tool_budget_exhausted",
            "ResearchWorker development submission budget is exhausted."
          );
        }
        const submissionSequence = this.consumedSubmissionCount + 1;
        this.consumedSubmissionCount = submissionSequence;
        let evidence: ResearchWorkerDevelopmentEvaluationEvidence;
        try {
          evidence = await this.options.evaluate({
            ...normalized,
            submission_sequence: submissionSequence
          });
          assertEvaluationEvidence(evidence, submissionSequence);
        } catch (error) {
          this.sessionStatus = "failed";
          this.terminalReason = error instanceof Error
            ? error.message
            : String(error);
          throw error;
        }
        const stored = structuredClone(evidence);
        this.submissions.push(stored);
        return {
          session_status: "open",
          submission_sequence: submissionSequence,
          remaining_submission_count:
            this.options.submissionLimit - this.consumedSubmissionCount,
          feedback: structuredClone(stored.feedback)
        };
      }
    );
  }

  selectDevelopment(
    input: ResearchWorkerDevelopmentSelectionInput
  ): Promise<ResearchWorkerSelectionResult> {
    const normalized = {
      idempotency_key: validIdempotencyKey(input?.idempotency_key),
      submission_sequence: validSubmissionSequence(input?.submission_sequence),
      reason: validResearchText(input?.reason)
    };
    return this.idempotent(
      "select",
      normalized.idempotency_key,
      normalized,
      async () => {
        this.assertOpen();
        if (!this.submissions.some((submission) =>
          submission.submission_sequence === normalized.submission_sequence
        )) {
          throw new ResearchWorkerSessionError(
            "research_worker_tool_submission_not_found",
            "Selected ResearchWorker development submission does not exist."
          );
        }
        this.sessionStatus = "selected";
        this.selectedSubmissionSequence = normalized.submission_sequence;
        this.terminalReason = normalized.reason;
        return {
          session_status: "selected",
          submission_sequence: normalized.submission_sequence,
          reason: normalized.reason
        };
      }
    );
  }

  finishWithoutSubmission(
    input: ResearchWorkerFinishInput
  ): Promise<ResearchWorkerFinishResult> {
    const normalized = {
      idempotency_key: validIdempotencyKey(input?.idempotency_key),
      reason: validResearchText(input?.reason)
    };
    return this.idempotent(
      "finish",
      normalized.idempotency_key,
      normalized,
      async () => {
        this.assertOpen();
        this.sessionStatus = "finished_without_submission";
        this.terminalReason = normalized.reason;
        return {
          session_status: "finished_without_submission",
          reason: normalized.reason
        };
      }
    );
  }

  closeAfterProviderExit(): ResearchWorkerFinishResult | ResearchWorkerSelectionResult {
    if (this.activeOperationCount > 0) {
      throw new ResearchWorkerSessionError(
        "research_worker_tool_operation_in_progress",
        "ResearchWorker provider exited while a tool operation was in progress."
      );
    }
    if (this.sessionStatus === "selected" && this.selectedSubmissionSequence !== null) {
      return {
        session_status: "selected",
        submission_sequence: this.selectedSubmissionSequence,
        reason: this.terminalReason ?? "selected_development_submission"
      };
    }
    if (this.sessionStatus !== "open" &&
      this.sessionStatus !== "finished_without_submission") {
      throw new ResearchWorkerSessionError(
        "research_worker_tool_session_closed",
        "ResearchWorker development session is closed."
      );
    }
    if (this.sessionStatus === "open") {
      this.sessionStatus = "finished_without_submission";
      this.terminalReason = "provider_exited_without_terminal_action";
    }
    return {
      session_status: "finished_without_submission",
      reason: this.terminalReason ?? "provider_exited_without_terminal_action"
    };
  }

  completedSubmissions(): ResearchWorkerDevelopmentEvaluationEvidence[] {
    return structuredClone(this.submissions);
  }

  selectedSubmission(): ResearchWorkerDevelopmentEvaluationEvidence | null {
    if (this.selectedSubmissionSequence === null) return null;
    const selected = this.submissions.find((submission) =>
      submission.submission_sequence === this.selectedSubmissionSequence
    );
    return selected ? structuredClone(selected) : null;
  }

  private currentStatus(): ResearchWorkerToolStatus {
    return {
      session_status: this.sessionStatus,
      submission_limit: this.options.submissionLimit,
      completed_submission_count: this.submissions.length,
      remaining_submission_count:
        this.options.submissionLimit - this.consumedSubmissionCount,
      selected_submission_sequence: this.selectedSubmissionSequence
    };
  }

  private assertOpen(): void {
    if (this.sessionStatus !== "open") {
      throw new ResearchWorkerSessionError(
        "research_worker_tool_session_closed",
        "ResearchWorker development session is closed."
      );
    }
  }

  private idempotent<T>(
    kind: IdempotentOperation["kind"],
    key: string,
    payload: unknown,
    operation: () => Promise<T>
  ): Promise<T> {
    const fingerprint = JSON.stringify(payload);
    const prior = this.idempotentOperations.get(key);
    if (prior) {
      if (prior.kind !== kind || prior.fingerprint !== fingerprint) {
        return Promise.reject(new ResearchWorkerSessionError(
          "research_worker_tool_idempotency_conflict",
          "ResearchWorker tool idempotency key was reused with a different request."
        ));
      }
      return prior.promise as Promise<T>;
    }
    const promise = this.enqueue(operation);
    this.idempotentOperations.set(key, { kind, fingerprint, promise });
    return promise;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(async () => {
      this.activeOperationCount += 1;
      try {
        return await operation();
      } finally {
        this.activeOperationCount -= 1;
      }
    });
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function validIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new ResearchWorkerSessionError(
      "research_worker_tool_invalid_request",
      "ResearchWorker tool idempotency key is invalid."
    );
  }
  return value;
}

function validResearchText(value: unknown): string {
  if (typeof value !== "string") {
    throw new ResearchWorkerSessionError(
      "research_worker_tool_invalid_request",
      "ResearchWorker tool text is invalid."
    );
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > MAX_RESEARCH_TEXT_LENGTH) {
    throw new ResearchWorkerSessionError(
      "research_worker_tool_invalid_request",
      "ResearchWorker tool text is invalid."
    );
  }
  return normalized;
}

function validSubmissionSequence(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ResearchWorkerSessionError(
      "research_worker_tool_invalid_request",
      "ResearchWorker development submission sequence is invalid."
    );
  }
  return Number(value);
}

function assertEvaluationEvidence(
  value: ResearchWorkerDevelopmentEvaluationEvidence,
  expectedSequence: number
): void {
  const feedback = value?.feedback;
  const evaluation = value?.evaluation;
  if (!value || value.submission_sequence !== expectedSequence ||
    typeof value.artifact_dir !== "string" || value.artifact_dir.length === 0 ||
    !DIGEST_PATTERN.test(value.artifact_digest) ||
    !isCanonicalIso(value.started_at) || !isCanonicalIso(value.completed_at) ||
    Date.parse(value.completed_at) < Date.parse(value.started_at) ||
    !evaluation || !feedback ||
    (feedback as { scenario_results?: unknown }).scenario_results !== undefined ||
    (feedback as { paper_handoff_conformance?: unknown })
      .paper_handoff_conformance !== undefined ||
    feedback.status !== evaluation.status || feedback.score !== evaluation.score ||
    feedback.summary !== evaluation.summary ||
    feedback.risk_decision !== evaluation.risk_decision ||
    JSON.stringify(feedback.metrics) !== JSON.stringify(evaluation.metrics) ||
    JSON.stringify(feedback.profit_loss) !== JSON.stringify(evaluation.profit_loss) ||
    feedback.disqualification_reason !== evaluation.disqualification_reason) {
    throw new ResearchWorkerSessionError(
      "research_worker_tool_evaluator_evidence_invalid",
      "ResearchWorker development evaluator evidence is invalid."
    );
  }
}

function isCanonicalIso(value: unknown): value is string {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}
