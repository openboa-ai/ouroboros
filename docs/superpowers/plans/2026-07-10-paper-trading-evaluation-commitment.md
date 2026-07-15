# PaperTradingEvaluation Commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every paper session commit its evidence purpose and frozen execution envelope before any evidence-producing side effect, then prevent research-feedback evidence from qualifying or promoting a candidate.

**Architecture:** Add an append-only `PaperTradingEvaluationCommitmentRecord` ahead of the mutable evaluation and observation chain. The application creates and verifies commitments, an injected adapter resolves executable artifact bytes, the local store enforces immutability and reference consistency, and qualification/research projections consume only evidence eligible for their committed purpose.

**Tech Stack:** TypeScript 5.9, Node.js crypto/fs, Vitest 4, Fastify runtime composition, JSON local store

## Global Constraints

- Every currently reachable paper start commits `evidence_purpose: "research_feedback"`; no public payload may select `qualification`.
- Purpose, candidate, candidate version, SystemCode, executable bytes, runtime, provider, capability, secret, market, Gateway, cost, risk, account, event, and window policy identities are immutable for one evidence window.
- Commitment verification runs before provider startup, sandbox startup, market reads, Gateway/Ledger writes, score changes, or observation append.
- A mismatch terminally invalidates the evaluation and records no new paper observation.
- `PaperTradingQualification` remains an evidence-quality gate and cannot turn research feedback into qualification evidence.
- Existing `EvidenceSealingDecision` remains a separate post-evaluation backtest record.
- Qualification-purpose evidence remains sealed from CandidateArena research context until a future adjudicator releases it.
- All authority remains `not_live`; private exchange and live order access remain forbidden.

---

## File Map

- `packages/domain/src/index.ts`: canonical types, statuses, read-model fields, and digest input serialization.
- `packages/domain/src/paper-trading-evaluation-commitment.test.ts`: canonical serialization and purpose-integrity tests.
- `packages/application/src/ports/store.ts`: commitment persistence port.
- `packages/local-store/src/index.ts`: append-only commitment collection and paper reference invariants.
- `packages/local-store/test/local-store.test.ts`: persistence, idempotency, conflict, and terminal-state tests.
- `packages/application/src/ports/system-code-artifact.ts`: executable artifact digest port.
- `packages/adapters/src/artifact/system-code-artifact-resolver.ts`: filesystem/container digest adapter.
- `packages/adapters/src/artifact/system-code-artifact-resolver.test.ts`: real-byte mutation and immutable-image tests.
- `packages/adapters/src/index.ts`: resolver export.
- `packages/application/src/trading/paper/commitment.ts`: policy identity, commitment creation, verification, and invalidation decisions.
- `packages/application/src/trading/paper/commitment.test.ts`: unit tests for identity mismatch classification.
- `packages/application/src/trading/paper/commands.ts`: pre-start commitment lifecycle, resume verification, and terminal cleanup.
- `packages/application/src/trading/paper/observation.ts`: pre-observation verification and no-observation invalidation path.
- `apps/runtime/src/server.ts`: concrete artifact resolver composition.
- `apps/runtime/test/paper-trading-evaluation-commitment.test.ts`: start ordering, mutation invalidation, restart, and no-side-effect scenarios.
- `packages/application/src/trading/paper/qualification.ts`: purpose-aware quality gate.
- `packages/application/src/trading/paper/qualification-blockers.ts`: canonical purpose/freeze blocker groups.
- `packages/application/src/services/operator.ts`: promotion gate and shared commitment read models.
- `packages/application/src/candidate/arena.ts`: released research-feedback-only context.
- `apps/runtime/test/paper-trading-qualification.test.ts`: qualification-purpose unit coverage.
- `apps/runtime/test/operator-paper-trading-board.test.ts`: board, promotion, and read-model coverage.
- `apps/runtime/test/candidate-arena-paper-context.test.ts`: sealed qualification exclusion coverage.
- `docs/naming-taxonomy.md`: canonical noun and purpose enum.
- `docs/api-command-contract.md`: start, observation, qualification, and promotion behavior.
- `docs/candidate-arena-evaluation-protocol.md`: implemented P0 status and remaining paired-comparison gap.

---

### Task 1: Domain Commitment Contract and Canonical Digest Input

**Files:**
- Create: `packages/domain/src/paper-trading-evaluation-commitment.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `PaperTradingEvidencePurpose`, `PaperTradingEvaluationCommitmentRecord`, `PaperTradingEvaluationInvalidationReason`, `paperTradingEvaluationCommitmentDigestInput(record): string`.
- Produces: optional persistence-boundary commitment refs on evaluations/observations, `invalidated` evaluation status, purpose-aware qualification statuses/reasons, and commitment fields on operator read models.

- [ ] **Step 1: Write the failing canonicalization tests**

```ts
import { describe, expect, it } from "vitest";
import {
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingEvaluationCommitmentRecord
} from "./index";

describe("PaperTradingEvaluationCommitment", () => {
  it("produces the same digest input for equivalent object key order", () => {
    const left = commitment("research_feedback");
    const right = JSON.parse(JSON.stringify(left)) as PaperTradingEvaluationCommitmentRecord;
    expect(paperTradingEvaluationCommitmentDigestInput(left))
      .toBe(paperTradingEvaluationCommitmentDigestInput(right));
  });

  it("binds evidence purpose into the digest input", () => {
    expect(paperTradingEvaluationCommitmentDigestInput(commitment("research_feedback")))
      .not.toBe(paperTradingEvaluationCommitmentDigestInput(commitment("qualification")));
  });

  it("rejects undefined and non-finite canonical values", () => {
    const invalid = commitment("research_feedback") as unknown as Record<string, unknown>;
    invalid.invalid_value = Number.NaN;
    expect(() => paperTradingEvaluationCommitmentDigestInput(
      invalid as unknown as PaperTradingEvaluationCommitmentRecord
    )).toThrow("paper_trading_commitment_non_canonical_value");
  });
});
```

The local `commitment()` fixture must populate every field from the design spec with fixed IDs,
fixed policy versions, `initial_account_snapshot`, and a fixed precomputed digest string.

- [ ] **Step 2: Run the test and confirm the contract is absent**

Run: `npx vitest run packages/domain/src/paper-trading-evaluation-commitment.test.ts`

Expected: FAIL because the record and digest-input function are not exported.

- [ ] **Step 3: Add the domain types and deterministic canonical serializer**

```ts
export type PaperTradingEvidencePurpose = "research_feedback" | "qualification";

export type PaperTradingEvaluationInvalidationReason =
  | "commitment_missing"
  | "commitment_digest_mismatch"
  | "candidate_identity_mismatch"
  | "candidate_version_identity_mismatch"
  | "system_code_identity_mismatch"
  | "stored_artifact_digest_mismatch"
  | "resolved_artifact_digest_mismatch"
  | "runtime_identity_mismatch"
  | "provider_identity_mismatch"
  | "capability_policy_mismatch"
  | "secret_policy_mismatch"
  | "evaluation_policy_identity_mismatch"
  | "initial_account_identity_mismatch"
  | "paper_only_authority_violation";

export function paperTradingEvaluationCommitmentDigestInput(
  record: PaperTradingEvaluationCommitmentRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    paper_trading_evaluation_commitment_id: _id,
    committed_at: _committedAt,
    commitment_digest: _commitmentDigest,
    ...payload
  } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}
```

`canonicalPaperTradingCommitmentJson` recursively sorts object keys, preserves array order, and
throws `paper_trading_commitment_non_canonical_value` for `undefined`, non-finite numbers, functions,
or symbols. Add the full record fields from the approved design and include the new record in
`FixtureRecord`.

Extend the existing statuses exactly as follows:

```ts
export type PaperTradingEvaluationStatus =
  | "not_started"
  | "running"
  | "stopped"
  | "failed"
  | "invalidated";

export type PaperTradingQualificationStatus =
  | "collecting_evidence"
  | "qualified"
  | "needs_resume"
  | "blocked_by_quality"
  | "paper_failed"
  | "not_qualification_evidence";
```

- [ ] **Step 4: Run the domain test and typecheck**

Run: `npx vitest run packages/domain/src/paper-trading-evaluation-commitment.test.ts`

Expected: PASS.

Run: `npm run typecheck -w @ouroboros/domain`

Expected: PASS.

- [ ] **Step 5: Commit the domain contract**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-evaluation-commitment.test.ts
git commit -m "feat: define paper evaluation commitments"
```

---

### Task 2: Append-only Store and Paper Evidence References

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: `PaperTradingEvaluationCommitmentRecord` and `paperTradingEvaluationCommitmentDigestInput` from Task 1.
- Produces: `recordPaperTradingEvaluationCommitment`, `getPaperTradingEvaluationCommitment`, and `listPaperTradingEvaluationCommitments` store methods.

- [ ] **Step 1: Write failing local-store tests**

Add one test that records a valid fixture commitment twice, reloads it from a new `LocalStore`, and
asserts one stored record. Add a second test that changes only `evidence_purpose` under the same ID
and expects `paper_trading_evaluation_commitment_conflict`. Add a third test that asserts:

```ts
await expectStoreError(
  store.recordPaperTradingEvaluation({
    ...validPaperEvaluation(commitment),
    paper_trading_evaluation_commitment_ref: undefined
  }),
  "paper_trading_evaluation_commitment_required"
);

await expectStoreError(
  store.recordPaperTradingObservation(
    {
      ...validPaperObservation(commitment),
      paper_trading_evaluation_commitment_ref: ref(
        "paper_trading_evaluation_commitment",
        "different-commitment"
      )
    },
    validPaperEvaluation(commitment)
  ),
  "paper_trading_observation_commitment_mismatch"
);
```

The fixture commitment must reference the initialized fixture candidate, version, SystemCode, and
TradingRun. Compute its digest with Node SHA-256 over
`paperTradingEvaluationCommitmentDigestInput(record)`.

- [ ] **Step 2: Run the focused store tests and confirm failure**

Run: `npx vitest run packages/local-store/test/local-store.test.ts -t "paper trading commitment"`

Expected: FAIL because the collection and methods do not exist.

- [ ] **Step 3: Implement collection, digest validation, and append-only writes**

Add `"paper-trading-evaluation-commitments"` to `Collection`, import the record and digest-input
function, and implement:

```ts
async recordPaperTradingEvaluationCommitment(
  commitment: PaperTradingEvaluationCommitmentRecord
): Promise<PaperTradingEvaluationCommitmentRecord> {
  const expectedDigest = `sha256:${createHash("sha256")
    .update(paperTradingEvaluationCommitmentDigestInput(commitment))
    .digest("hex")}`;
  if (commitment.commitment_digest !== expectedDigest) {
    throw new LocalStoreError("paper_trading_evaluation_commitment_digest_mismatch", "invalid commitment digest");
  }
  const existing = await this.getPaperTradingEvaluationCommitment(
    commitment.paper_trading_evaluation_commitment_id
  );
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(commitment)) {
      throw new LocalStoreError("paper_trading_evaluation_commitment_conflict", "commitment is append-only");
    }
    return existing;
  }
  await this.writeJson(
    this.itemPath(
      "paper-trading-evaluation-commitments",
      commitment.paper_trading_evaluation_commitment_id
    ),
    commitment
  );
  return commitment;
}
```

Validate candidate/version/SystemCode refs before the first write. Make `recordPaperTradingEvaluation`
require a matching existing commitment for every status except legacy `invalidated` with
`invalidation_reason: "commitment_missing"`. Reject identity changes on updates and reject any
transition out of `invalidated`. Make `recordPaperTradingObservation` validate all refs, sequence,
non-invalidated state, and account lineage before writing either file. For sequence one, the prior
evaluation account must equal the commitment's initial account. For later sequences, the prior
evaluation account must equal the latest stored observation account, and the updated evaluation
account must equal the new observation account.

- [ ] **Step 4: Run local-store tests and typechecks**

Run: `npx vitest run packages/local-store/test/local-store.test.ts -t "paper trading commitment"`

Expected: PASS.

Run: `npm run typecheck -w @ouroboros/local-store`

Expected: PASS.

- [ ] **Step 5: Commit store invariants**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist immutable paper commitments"
```

---

### Task 3: Artifact Resolver and Commitment Service

**Files:**
- Create: `packages/application/src/ports/system-code-artifact.ts`
- Create: `packages/adapters/src/artifact/system-code-artifact-resolver.ts`
- Create: `packages/adapters/src/artifact/system-code-artifact-resolver.test.ts`
- Modify: `packages/adapters/src/index.ts`
- Create: `packages/application/src/trading/paper/commitment.ts`
- Create: `packages/application/src/trading/paper/commitment.test.ts`

**Interfaces:**
- Produces: `SystemCodeArtifactResolverPort.resolveArtifactDigest(systemCode): Promise<string>`.
- Produces: `createPaperTradingEvaluationCommitment`, `verifyPaperTradingEvaluationCommitment`, `invalidatePaperTradingEvaluation`, and `PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1`.
- Consumes: candidate, SystemCode, market port metadata, initial engine account, interval, and resolved artifact digest.

- [ ] **Step 1: Write failing real-artifact resolver tests**

```ts
it("changes the resolved digest when executable bytes change", async () => {
  const script = path.join(tmpDir, "candidate.py");
  await writeFile(script, "print('first')\n", "utf8");
  const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });
  const first = await resolver.resolveArtifactDigest(pythonSystemCode(script));
  await writeFile(script, "print('second')\n", "utf8");
  const second = await resolver.resolveArtifactDigest(pythonSystemCode(script));
  expect(second).not.toBe(first);
});

it("requires a digest-qualified container image", async () => {
  const resolver = new FileSystemCodeArtifactResolver({ repoRoot: tmpDir });
  await expect(resolver.resolveArtifactDigest(containerSystemCode("repo/image:latest")))
    .rejects.toThrow("mutable_container_image_ref");
  await expect(resolver.resolveArtifactDigest(
    containerSystemCode("repo/image@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  )).resolves.toBe("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});
```

- [ ] **Step 2: Run resolver tests and confirm failure**

Run: `npx vitest run packages/adapters/src/artifact/system-code-artifact-resolver.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the resolver port and adapter**

```ts
export interface SystemCodeArtifactResolverPort {
  resolveArtifactDigest(systemCode: SystemCodeRecord): Promise<string>;
}
```

For `python_file`, resolve absolute paths directly and relative paths against `repoRoot`, read bytes,
and return `sha256:<64 lowercase hex>`. For `container_image`, extract the immutable `@sha256:`
digest and reject mutable tags.

- [ ] **Step 4: Write failing commitment creation and verification tests**

Test a valid commitment, then individually mutate candidate ID, version ID, SystemCode ID, stored
artifact digest, resolved digest, entrypoint, runtime provider identity, capability ref, secret ref,
market source/configuration, interval, initial account anchor, and paper-only authority. Assert the exact
`PaperTradingEvaluationInvalidationReason` for each mutation. Assert that purpose is included in the
commitment digest and that all ordinary creation calls produce `research_feedback` plus
`release_policy: "closed_observation"`.

- [ ] **Step 5: Run commitment tests and confirm failure**

Run: `npx vitest run packages/application/src/trading/paper/commitment.test.ts`

Expected: FAIL because commitment creation and verification are absent.

- [ ] **Step 6: Implement commitment creation and verification**

Use fixed v1 policy identifiers:

```ts
export const PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1 = {
  market_data_policy_version: "binance-public-market-v1",
  gateway_policy_version: "paper-gateway-dry-run-v1",
  cost_policy_version: "paper-cost-8bps-v1",
  funding_policy_version: "paper-funding-engine-v1",
  slippage_policy_version: "paper-public-fill-slippage-v1",
  fill_policy_version: "paper-public-execution-fill-v1",
  risk_policy_version: "paper-risk-validation-v1",
  paper_account_policy_version: "fake-paper-account-10000usdt-v1",
  decision_event_protocol_version: "trading-system-paper-events-v1",
  persistent_state_boundary_version: "paper-engine-checkpoint-v1"
} as const;
```

Build `market_data_configuration_digest` from provider kind, source kind, REST base URL, required
endpoints, and read-only authority. Build `commitment_digest` from the Task 1 digest input. Verification
returns `{ status: "verified" }` or `{ status: "invalidated", reason, diagnostic }`; it never mutates
the store itself.

- [ ] **Step 7: Run focused tests and typechecks**

Run: `npx vitest run packages/adapters/src/artifact/system-code-artifact-resolver.test.ts packages/application/src/trading/paper/commitment.test.ts`

Expected: PASS.

Run: `npm run typecheck -w @ouroboros/application`

Expected: PASS.

Run: `npm run typecheck -w @ouroboros/adapters`

Expected: PASS.

- [ ] **Step 8: Commit resolver and commitment service**

```bash
git add packages/application/src/ports/system-code-artifact.ts packages/adapters/src/artifact packages/adapters/src/index.ts packages/application/src/trading/paper/commitment.ts packages/application/src/trading/paper/commitment.test.ts
git commit -m "feat: verify frozen paper execution envelopes"
```

---

### Task 4: Pre-start and Pre-observation Lifecycle Enforcement

**Files:**
- Modify: `packages/application/src/trading/paper/commands.ts`
- Modify: `packages/application/src/trading/paper/observation.ts`
- Modify: `apps/runtime/src/server.ts`
- Create: `apps/runtime/test/paper-trading-evaluation-commitment.test.ts`
- Modify: `apps/runtime/test/long-running-paper-session.test.ts`

**Interfaces:**
- Consumes: Task 2 store methods and Task 3 resolver/commitment service.
- Produces: a persisted commitment and `not_started` evaluation before provider/sandbox startup; `RecordPaperTradingEvaluationObservationResult.observation` becomes optional only for invalidation.

- [ ] **Step 1: Write failing start-order and public-purpose tests**

Create a fake artifact resolver and provider factory with call-order spies. Start the fixture candidate
through `trading_run.start` and assert:

```ts
expect(callOrder).toEqual([
  "resolve_artifact",
  "record_commitment",
  "verify_commitment",
  "start_provider",
  "start_sandbox",
  "read_market"
]);
expect(await store.listPaperTradingEvaluationCommitments()).toEqual([
  expect.objectContaining({
    evidence_purpose: "research_feedback",
    window_policy: expect.objectContaining({ release_policy: "closed_observation" })
  })
]);
expect(startResponse.body).not.toHaveProperty("evidence_purpose");
```

Also POST a payload containing `evidence_purpose: "qualification"` and assert the persisted purpose
is still `research_feedback`.

- [ ] **Step 2: Write failing mutation and restart tests**

Start once with resolver digest A, close the server without deleting the store, rebuild with digest B,
and start/observe again. Assert evaluation status `invalidated`, reason
`resolved_artifact_digest_mismatch`, zero additional observations, no market read, no provider start,
no sandbox start, and no Ledger count increase. Rebuild with digest A in a separate test and assert
the original commitment ID/digest is reused and the running evaluation resumes.

- [ ] **Step 3: Run lifecycle tests and confirm failure**

Run: `npx vitest run apps/runtime/test/paper-trading-evaluation-commitment.test.ts`

Expected: FAIL because current startup reaches provider/sandbox before a commitment exists.

- [ ] **Step 4: Create and persist commitment before provider or sandbox work**

Refactor `PaperTradingCommandService.start` so a new session performs:

```ts
const prepared = await preparePaperTradingEvaluation({
  store: this.options.store,
  candidate,
  tradingRunId,
  intervalMs: this.intervalMs,
  gatewayRuntimeBinding,
  artifactResolver: this.options.artifactResolver
});
const verification = await this.verifyPreparedEvaluation(prepared.evaluation, candidate);
if (verification.status === "invalidated") {
  return this.invalidateAndStop(prepared.evaluation, verification);
}
const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(
  tradingRunId,
  gatewayRuntimeBinding
);
```

The prepared evaluation starts as `not_started`, has zero observations, and uses the commitment's
initial account. Only after provider/sandbox/run-control start succeeds does it transition to
`running` and request the first observation.

- [ ] **Step 5: Verify before every observation**

Remove implicit evaluation creation from `recordPaperTradingEvaluationObservation`. Load the existing
evaluation and commitment, run the injected verifier before `readMarketSnapshot`, and on mismatch:

```ts
const invalidated = await input.store.recordPaperTradingEvaluation({
  ...evaluation,
  status: "invalidated",
  invalidation_reason: verification.reason,
  latest_failure_reason: verification.diagnostic,
  next_observation_at: undefined,
  stopped_at: now
});
return { evaluation: invalidated };
```

Commands and scheduler stop the runner, provider, and sandbox whenever status is `invalidated`.
Record one idempotent run-control inspect audit with the stable invalidation reason, without creating
a Ledger entry or paper observation. A subsequent start on the same invalidated candidate version
returns a conflict; only a new candidate version and new commitment may produce further evidence.
Keep transient market/public-execution/runner failures on the existing failed-observation path only
after commitment verification succeeds.

- [ ] **Step 6: Compose the filesystem resolver in runtime**

Add `paperTradingArtifactResolver?: SystemCodeArtifactResolverPort` to `BuildServerOptions`, default
it to `new FileSystemCodeArtifactResolver({ repoRoot: process.cwd() })`, and inject it into the command
service. This test seam is also used to prove restart behavior without editing tracked fixtures.

- [ ] **Step 7: Run lifecycle and existing long-session tests**

Run: `npx vitest run apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts`

Expected: PASS, including no-order continuity, event deduplication, transient failure restart, and
terminal commitment invalidation.

Run: `npm run typecheck -w @ouroboros/runtime`

Expected: PASS.

- [ ] **Step 8: Commit lifecycle enforcement**

```bash
git add packages/application/src/trading/paper/commands.ts packages/application/src/trading/paper/observation.ts apps/runtime/src/server.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts
git commit -m "feat: enforce paper commitments before evidence"
```

---

### Task 5: Purpose-aware Qualification, Promotion, Research Barrier, and Read Models

**Files:**
- Modify: `packages/application/src/trading/paper/qualification.ts`
- Modify: `packages/application/src/trading/paper/qualification-blockers.ts`
- Modify: `packages/application/src/services/operator.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/paper-trading-qualification.test.ts`
- Modify: `apps/runtime/test/operator-paper-trading-board.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: interface fixture tests that construct `PaperTradingEvaluationReadModel` directly.

**Interfaces:**
- Consumes: commitment lookup from Task 2.
- Produces: `qualifyPaperTradingEvaluation({ evaluation, commitment, observations, runnerActive })`.
- Produces: shared fields `evidence_purpose`, commitment ID/digest, freeze status, and invalidation reason.

- [ ] **Step 1: Write failing qualification-purpose tests**

Add a qualification commitment fixture to existing policy tests. Keep current maturity/quality tests
using `evidence_purpose: "qualification"`. Add three priority tests:

```ts
expect(qualifyPaperTradingEvaluation({
  evaluation: profitableMatureEvaluation,
  commitment: researchFeedbackCommitment,
  observations: recordedObservations(30),
  runnerActive: true
})).toMatchObject({
  qualification_status: "not_qualification_evidence",
  qualification_reasons: ["evidence_purpose_not_qualification"]
});

expect(qualifyPaperTradingEvaluation({
  evaluation: profitableMatureEvaluation,
  commitment: undefined,
  observations: recordedObservations(30),
  runnerActive: true
})).toMatchObject({
  qualification_status: "not_qualification_evidence",
  qualification_reasons: ["paper_evaluation_commitment_missing"]
});

expect(qualifyPaperTradingEvaluation({
  evaluation: { ...profitableMatureEvaluation, status: "invalidated" },
  commitment: qualificationCommitment,
  observations: recordedObservations(30),
  runnerActive: false
})).toMatchObject({
  qualification_status: "blocked_by_quality",
  qualification_reasons: ["paper_evaluation_invalidated"]
});
```

- [ ] **Step 2: Run qualification tests and confirm failure**

Run: `npx vitest run apps/runtime/test/paper-trading-qualification.test.ts`

Expected: FAIL because qualification ignores purpose and freeze state.

- [ ] **Step 3: Implement purpose checks before maturity checks**

Change every call site to load the commitment from the evaluation ref. Return missing, wrong-purpose,
or invalidated results before counting observations. Add blocker group kind `evidence_authority` for
the three new reasons, with deterministic text that says to run the future prospective comparison,
restore the commitment chain, or create a new candidate version.

- [ ] **Step 4: Write failing promotion and read-model tests**

Use the operator board seed helper to create commitments. Existing tests that intentionally prove
promotion use `qualification`; ordinary paper-session tests use `research_feedback`. Add an assertion
that a mature profitable research-feedback row has:

```ts
{
  evidence_purpose: "research_feedback",
  freeze_status: "verified",
  qualification_status: "not_qualification_evidence",
  promotion_gate_status: "not_qualification_evidence"
}
```

Executing `trading_candidate.promote` for that row must fail with
`paper_trading_qualification_required` and reason `evidence_purpose_not_qualification`.

- [ ] **Step 5: Expose commitment state and enforce promotion**

Add commitment fields to selected evaluation and paper-board entry read models. Derive freeze status
as `invalidated` for invalidated records, `verified` for a present digest-matching commitment, and
`committed` only for a `not_started` evaluation. Add explicit promotion-gate status
`not_qualification_evidence`; never map it to collecting qualification evidence.

- [ ] **Step 6: Write and implement the research information-barrier test**

Persist one research-feedback evaluation and one synthetic qualification evaluation. Capture the next
ResearchWorker context and assert it contains the released research-feedback candidate but does not
contain the qualification candidate ID, score, failure, observation, or commitment digest.

Update `arenaPaperEvidenceCandidates` to load each commitment and include evidence only when:

```ts
commitment?.evidence_purpose === "research_feedback" &&
commitment.window_policy.release_policy === "closed_observation"
```

Do not expose any qualification observation even when it is stopped or failed; release requires the
future adjudicator, which is outside this frontier.

- [ ] **Step 7: Run focused policy and projection tests**

Run: `npx vitest run apps/runtime/test/paper-trading-qualification.test.ts apps/runtime/test/operator-paper-trading-board.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/operator-interface-parity.test.ts apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit purpose-aware evidence consumers**

```bash
git add packages/application/src/trading/paper/qualification.ts packages/application/src/trading/paper/qualification-blockers.ts packages/application/src/services/operator.ts packages/application/src/candidate/arena.ts apps/runtime/test/paper-trading-qualification.test.ts apps/runtime/test/operator-paper-trading-board.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/operator-interface-parity.test.ts apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx
git commit -m "feat: separate research and qualification evidence"
```

---

### Task 6: Durable Documentation and Frontier Verification

**Files:**
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-10-paper-trading-evaluation-commitment-design.md`

**Interfaces:**
- Consumes: all implemented behavior from Tasks 1 through 5.
- Produces: repo truth for the implemented commitment frontier and an explicit next frontier for paired prospective comparison.

- [ ] **Step 1: Update canonical docs**

Add `PaperTradingEvaluationCommitment` and `PaperTradingEvidencePurpose` to naming taxonomy. State in
the API contract that current start commands always create research feedback, purpose is not a
payload field, verification precedes evidence work, and promotion remains unavailable until a future
qualification comparison creates eligible evidence. In the evaluation protocol, mark commitment,
freeze, restart verification, purpose separation, and research sealing as implemented while leaving
same-stream paired champion/challenger execution open.

Synchronize the design spec with final field names and any narrower implementation fact discovered
during tests; do not weaken its invariants.

- [ ] **Step 2: Run focused package tests and all workspace typechecks**

Run: `npx vitest run packages/domain/src/paper-trading-evaluation-commitment.test.ts packages/adapters/src/artifact/system-code-artifact-resolver.test.ts packages/application/src/trading/paper/commitment.test.ts packages/local-store/test/local-store.test.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts apps/runtime/test/paper-trading-qualification.test.ts apps/runtime/test/operator-paper-trading-board.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: every workspace typecheck passes.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all test files and tests pass. If a timing-only runner test fails, reproduce it in isolation,
identify the race, fix the implementation or test clock deterministically, and rerun the entire suite.

- [ ] **Step 4: Run repository guards**

Run: `bash scripts/check-docs.sh`

Expected: PASS.

Run: `npm run check:architecture`

Expected: PASS.

Run: `npm run check:naming`

Expected: PASS.

Run: `bash scripts/check-env-files.sh --tracked`

Expected: PASS.

Run: `bash scripts/check-secrets.sh`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit docs and verified frontier**

```bash
git add docs/naming-taxonomy.md docs/api-command-contract.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs/2026-07-10-paper-trading-evaluation-commitment-design.md
git commit -m "docs: record paper commitment frontier"
```

- [ ] **Step 6: Review the next frontier boundary**

Record the next bounded design target as prospective paired paper comparison: create frozen champion
and challenger commitments before a common eligible interval, run independent accounts/cadences over
the same stream and policy versions, seal both result sets until close, then emit a separate economic
comparison verdict. Do not add that comparison to this implementation commit.
