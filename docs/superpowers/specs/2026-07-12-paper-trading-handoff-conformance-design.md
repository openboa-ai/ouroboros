# Paper Trading Handoff Conformance Design

**Status:** Implemented and verified as external paper handoff conformance

## Goal

Require external, bounded proof that submitted `SystemCode` can execute the target paper event
protocol before CandidateArena admission can claim `runnable_paper_handoff`, before candidate
materialization, and before any generated candidate can start a `PaperTradingEvaluation`.

## Why This Frontier Is Next

The sealed ResearchPreflight path already removes `expected_direction`, hidden target risk, and
outcome fields from candidate-facing replay payloads. It hides scenario-level evaluator output from
the ResearchWorker and quarantines evaluator probing, lookahead fields, and candidate-authored
economic evidence.

One P0 gap remains between that replay proof and the target runtime. The same artifact can branch on
`--output-events`: it may behave correctly in one-shot replay while crashing, emitting malformed
events, omitting heartbeats, probing undeclared endpoints, or attempting forbidden authority under
the long-running paper CLI. Current admission marks an externally accepted replay as
`runnable_paper_handoff`, materializes it, and lets the operator immediately attempt paper start.
The first paper observation is therefore acting as an implicit compatibility test after the handoff
claim has already been made.

This frontier makes target-protocol compatibility explicit and external. It does not turn
ResearchPreflight into qualification, does not count conformance as economic evidence, and does not
grant paper, order, private, or live authority.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher supports autonomous candidate generation only when
the evaluator remains external to the worker. In Ouroboros, externality must cover both the scoring
task and the runtime contract that carries a selected candidate into prospective paper evidence.
A worker-authored claim that its artifact is paper-compatible is trace, not proof.

The probe must remain minimally prescriptive. It checks the stable target boundary, not the
candidate's strategy, internal tools, model use, or research method. It must not reward a specific
direction or improve leaderboard score.

## Considered Approaches

### 1. Treat the first paper observation as conformance

Rejected. It creates commitments, starts a sandbox, changes runtime lifecycle, and records paper
failure before the pre-handoff claim is validated. Automatic continuation can also select the
candidate before the failure is known.

### 2. Check only manifest fields and declared outputs

Rejected. Static declarations cannot prove CLI parsing, provider use, event envelopes, heartbeat,
bounded shutdown, or the absence of replay-versus-paper branching.

### 3. Reuse ResearchPreflight replay success

Rejected. Replay and paper invoke different artifact modes. A candidate can pass replay while
failing or exploiting the paper mode.

### 4. Run an external bounded paper-protocol probe before admission

Selected. The same submitted bytes run with the target paper CLI against a candidate-only provider
view. The probe is isolated, time and request bounded, externally parsed, persisted, and required by
both admission and generated-candidate paper start.

## Canonical Vocabulary

The new canonical noun is `PaperTradingHandoffConformance`.

It is an external `ResearchPreflight` proof that one exact `SystemCode` artifact can cross the
paper-runtime handoff boundary. It is not `PaperTradingEvaluation`, qualification, economic rank,
promotion, or execution authority.

Use `passed`, `rejected`, and `infrastructure_failed` for outcomes:

- `passed`: exact target protocol requirements were externally observed;
- `rejected`: the candidate process or output violated the target protocol;
- `infrastructure_failed`: the external runner/provider could not produce attributable candidate
  evidence and the direction must remain a platform failure rather than a strategy finding.

## Threat Model

The conformance gate must detect:

- undeclared artifact files, directories, symlinks, editable paths, manifest drift, or dependency
  closure changes outside the submitted single-file SystemCode contract;
- replay-only behavior that crashes or exits incorrectly in paper mode;
- missing or malformed `order_request`, `hold`, or `no_action` event;
- missing runtime heartbeat or bounded `runtime_stopped` evidence;
- mismatched `instance_id`, invalid timestamp, wrong authority, or malformed order envelope;
- provider bypass, undeclared endpoint probing, excess provider requests, or self-authored
  validation evidence;
- evaluator-only, future-outcome, candidate-authored profit, private, credential, direct-order, or
  live fields in requests or output;
- timeout, unbounded output, or failure to stop;
- runner/provider infrastructure failure being mislabeled as candidate failure.

## Probe Contract

Extend the research `TradingArtifactRunner` boundary with a paper handoff probe over the same
artifact directory and manifest used by replay.

The probe uses:

- one sealed `single_file_python_v1` artifact closure containing only `manifest.json` and the
  declared entrypoint; the canonical SystemCode artifact digest covers both files;
- protocol version `paper_trading_event_protocol_v1`;
- one fixed opaque probe instance ID and start time;
- `--ticks 1`, bounded interval, and paper-only order request mode;
- the candidate-only `TradingApiProvider` payload, which excludes evaluator direction, outcome,
  hidden target risk, private state, credentials, and live authority;
- a five-second execution deadline, eight-request maximum, and existing output buffer bounds;
- isolated host execution only when explicitly enabled, otherwise Docker Sandboxes `sbx`;
- cleanup on success, rejection, timeout, and parser failure.

The provider must observe successful market snapshot, account state, and order validation requests.
Only declared provider routes are allowed. The candidate must emit exactly one accepted paper
decision event, at least one matching heartbeat, and one matching bounded stop event. The external
parser reuses the production `paper_trading_event_protocol_v1` event contract.

Host and `sbx` runners return the same result shape. Runner availability, sandbox creation, and
provider startup failures throw an infrastructure-classified error. Candidate exit, timeout after
startup, malformed output, forbidden fields, or protocol incompleteness return attributable
rejection evidence.

## Persisted Evidence

Add version-1 `PaperTradingHandoffConformanceRecord`:

```ts
export interface PaperTradingHandoffConformanceRecord extends BaseRecord {
  record_kind: "paper_trading_handoff_conformance";
  paper_trading_handoff_conformance_id: string;
  system_code_ref: Ref;
  system_code_artifact_digest: string; // canonical manifest plus entrypoint closure digest
  experiment_run_ref: Ref;
  trading_evaluation_task_ref: Ref;
  protocol_version: "paper_trading_event_protocol_v1";
  runner_kind: TradingArtifactRunnerKind;
  status: "passed" | "rejected";
  reason: PaperTradingHandoffConformanceReason;
  provider_request_count: number;
  decision_event_kind?: "order_request" | "hold" | "no_action";
  heartbeat_count: number;
  runtime_stopped: boolean;
  started_at: string;
  completed_at: string;
  evidence_digest: string;
  research_preflight_authority: true;
  runnable_paper_handoff: boolean;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}
```

The SystemCode artifact digest freezes the canonical manifest plus entrypoint closure. Research
rejects undeclared files, directories, symlinks, and editable-path drift before provider or runner
effects, then detects and restores closure mutation after every replay/probe. The evidence digest
freezes identity, protocol, result, bounded evidence summary, timestamps, and authority.
The record never stores raw secrets, candidate-authored profit, hidden evaluator state, or live
credentials. Bounded raw runner evidence remains under the CandidateArena research run directory
and is not shown to the ResearchWorker.

LocalStore must enforce runtime shape, canonical digest, append-only exact replay, SystemCode digest,
ExperimentRun/SystemCode/evaluation-task linkage, and admission linkage.

## Evaluation And Admission

For each research iteration:

1. run the sealed replay set;
2. if replay is externally accepted, run the bounded paper handoff probe over the same bytes;
3. compose a generic `paper_handoff_conformance` metric into ResearchPreflight feedback;
4. keep an iteration only when replay and handoff conformance both pass;
5. persist the selected SystemCode, ExperimentRun, handoff conformance, external evaluation,
   Finding, Lineage, and admission in that order;
6. materialize only an admission bound to an exact passed conformance record.

A candidate rejection maps to external evaluation disqualification and admission reason
`paper_handoff_conformance_failed`. The Finding preserves a stable failure summary for later
ResearchWorkers. Raw probe output, evaluator internals, and exact hidden fixture state remain sealed.

Infrastructure failure aborts the direction as `failed`; it does not create a duplicate,
quarantine, favorable ResearchEfficiency signal, or runnable handoff.

Historical admission records may omit conformance linkage for read compatibility, but they do not
authorize a generated candidate paper start. Every newly written CandidateArena admission must bind
the exact conformance ref, digest, and status.

## Paper Start Revalidation

`PaperTradingCommandService.start` must fail before commitment, evaluation, provider, sandbox,
runner, or Ledger effects when a materialized generated candidate lacks one exact admitted,
digest-valid, passed conformance record for its active SystemCode and ExperimentRun.

The filesystem artifact resolver recomputes the same canonical closure digest and rejects any
added, removed, symlinked, or manifest-drifted entry before paper preparation. Entrypoint bytes
alone are insufficient for generated CandidateArena SystemCode identity.

Fixture candidates without a materialization attempt retain their existing explicit fixture path.
Conformance grants no start authority by itself: all existing candidate identity, evidence-purpose,
artifact digest, provider identity, risk, Gateway, and paper-only checks still apply.

## Read Model

CandidateArena direction results expose only compact conformance status, reason, and record ID.
They do not expose raw probe output or turn conformance into leaderboard rank. Operator surfaces may
show the compact proof later, but no new UI control is required in this frontier.

## Test Strategy

### Domain and Store

- canonical passed and rejected records validate and hash deterministically;
- protocol, identity, evidence, time, or authority mutation changes digest input;
- malformed shapes, impossible pass/reject combinations, drift, and missing refs fail;
- admission requires exact passed conformance for new CandidateArena records;
- restart preserves exact evidence and paper-start revalidation.

### Pure evaluation

- accept one valid order or hold decision plus heartbeat, stop, and provider protocol;
- reject replay-only exit, malformed event, wrong instance, missing heartbeat/stop, timeout,
  unexpected route, excess requests, hidden fields, self-reported profit, and private/live fields;
- classify runner/provider setup failure as infrastructure rather than candidate rejection.

### CandidateArena and runtime

- prove the probe runs on the same artifact digest before admission and materialization;
- prove manifest-only drift, undeclared helper files/directories/symlinks, and runtime-created
  closure state cannot survive evaluation or paper-start revalidation;
- prove a replay-pass/paper-fail candidate creates no candidate and no paper start;
- prove passed conformance binds admission, materialized candidate, and start revalidation;
- prove tampered, missing, rejected, or cross-SystemCode conformance fails before paper effects;
- prove fixture behavior and valid generated candidates remain runnable;
- prove conformance does not change rank, qualification, Trading review, promotion, orders, private,
  or live authority.

## Acceptance Criteria

This frontier is complete only when current code and tests prove:

1. candidate-facing replay and conformance inputs contain no evaluator-only fields;
2. replay success alone cannot set a new admission's runnable handoff;
3. the exact submitted bytes pass the bounded production paper event parser before materialization;
4. the exact submitted bytes mean one canonical manifest-plus-entrypoint closure, not only the
   entrypoint file;
5. rejected conformance creates no candidate and preserves a causal Finding;
6. infrastructure failure remains a direction failure, not strategy evidence;
7. LocalStore binds conformance to SystemCode, ExperimentRun, evaluation task, and admission;
8. generated-candidate paper start revalidates exact passed evidence before any paper effect;
9. host and `sbx` paths satisfy the same contract and clean up;
10. focused tests, workspace typechecks, repository guards, and the full suite pass.

## Non-Goals

- no economic score, qualification, comparison verdict, promotion, or champion replacement;
- no private exchange read, credential, direct order, or live authority;
- no strategy-specific signal, indicator, model, tool, or workflow requirement;
- no proof of long-duration liveness, profitability, regime robustness, or worker recovery;
- no automatic comparison scheduler or production runner handoff;
- no full adversarial-matrix, P0, or CandidateArena Goal completion claim.

## Next Frontier

After conformance is verified, reassess evaluator side-channel coverage versus durable long-lived
ResearchWorker workspace/recovery ownership. Select the gap that most directly blocks bounded,
recoverable autonomous frontier discovery from current evidence.
