# ResearchWorker Autonomous Session Design

Status: approved for autonomous implementation under the active CandidateArena goal.

## Goal

Replace the default host-owned fixed edit loop with one bounded, agent-owned `ResearchWorker`
session:

```text
broad ResearchDirection and released context
-> isolated working artifact and bounded development tools
-> worker-chosen local analysis, edits, and development submissions
-> worker-selected immutable development snapshot
-> one evaluator-owned sealed admission
-> Finding, Lineage, admission, and terminal checkpoint
```

The worker chooses when and how to de-risk, when to spend a development submission, which completed
snapshot to select, and whether to stop without a submission. The evaluator still owns development
feedback, sealed admission, target paper conformance, and every downstream authority.

This frontier is direct implementation evidence for the ResearchWorker autonomy axis. It does not
claim long-duration soak, causal memory lift, AI-agent superiority, economic improvement, or
real-market generalization.

## Current Gap

`runTradingResearchLoop` currently owns a `for` loop of one or two iterations. On every iteration it
starts a fresh provider process, asks for one small edit, immediately runs the same development
suite, and chooses `keep` or `discard` by score. The prompt explicitly says to make at most one edit
and stop. A worker can inspect prior aggregate feedback, but it cannot:

- run one autonomous session over its bounded workspace;
- choose whether a cheap local check should precede external evaluation;
- decide when to spend each development submission;
- stop early without another forced evaluation;
- explicitly select one immutable completed submission for sealed admission;
- choose a lower-scoring development snapshot for a defensible reason.

The current implementation is a bounded mutation operator controlled by the host, not yet the
autonomous researcher described by the product goal.

## Unbiased AAR Interpretation

Anthropic's
[Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)
and its
[public implementation](https://github.com/safety-research/automated-w2s-research)
show an agent operating in an independent workspace with external evaluation, leaderboard,
finding-sharing, and snapshot tools. The agent owns its internal research sequence while external
infrastructure owns labels, logs, and execution bounds. The same work also reports evaluator gaming,
seed cherry-picking, label exfiltration, and dataset shortcuts.

Ouroboros should preserve the useful structure without transferring the result:

- broad directions instead of prescribed concrete ideas;
- one agent-owned workspace session instead of one provider call per host iteration;
- bounded external development tools instead of direct evaluator access;
- immutable snapshots and logs outside candidate authority;
- one hidden rotating sealed submission after worker selection;
- negative, failed, duplicate, and no-submission outcomes retained;
- prospective paper evidence, not replay score, remains economic authority.

This does not justify an unbounded evaluation API, repeated sealed queries, raw scenario feedback,
or trusting an agent-selected snapshot as good.

## Approaches Considered

### Keep the fixed host loop and improve the prompt

Rejected. Better wording cannot transfer control of submission timing or final snapshot selection to
the worker. The host would still prescribe the research sequence and select the artifact.

### Add a required propose-plan-edit-evaluate state machine

Rejected. It creates auditable steps but hard-codes one workflow for every hypothesis. That is the
same prescriptive scaffolding the reference work found could prevent cheap hypothesis checks and
adaptive research behavior. Ouroboros needs bounded capabilities, not a mandatory scientific
ceremony.

### Give the worker direct evaluator and sealed-suite access

Rejected. It would collapse the ResearchWorker/evaluator boundary, permit repeated sealed probing,
and make query limits the only defense against reward hacking.

### Run one agent-owned session through bounded capability tools

Selected. The application owns capabilities and budgets; a provider adapter exposes them to one
managed agent process. Tool call order remains worker-chosen. The final selected snapshot is only an
input to the existing one-shot sealed admission.

## Taxonomy Decision

No new persisted canonical record is introduced.

- `ResearchWorkerSession` is the runtime lifetime of one ResearchWorker under one exact
  `ResearchPreflightCommitment`. It is not the stable logical ResearchWorker and does not survive
  restart.
- A `development submission` remains one bounded ResearchPreflight evaluation of an immutable
  artifact snapshot.
- `selected_development_submission` is a local/session result that identifies which completed
  snapshot the worker chose for sealed admission. Selection grants no admission or trading
  authority.
- `ResearchWorkerToolPort` is an application capability port, not a product command surface.

Do not call the session an autonomous trading agent, a policy, an evaluation, or a promotion. Do
not call a selected development snapshot a winner or champion.

`writeback_needed: true` because the default ResearchWorker execution model and provider boundary
change.

## Application Port

Add one provider-independent session adapter contract in `packages/application`:

```ts
interface ResearchWorkerSessionAdapter {
  readonly agent: ManagedResearchAgent;
  runSession(input: ResearchWorkerSessionInput): Promise<ResearchWorkerSessionResult>;
}

interface ResearchWorkerToolPort {
  status(): Promise<ResearchWorkerToolStatus>;
  submitDevelopment(input: {
    idempotency_key: string;
    research_note: string;
  }): Promise<ResearchWorkerDevelopmentSubmissionResult>;
  selectDevelopment(input: {
    idempotency_key: string;
    submission_sequence: number;
    reason: string;
  }): Promise<ResearchWorkerSelectionResult>;
  finishWithoutSubmission(input: {
    idempotency_key: string;
    reason: string;
  }): Promise<ResearchWorkerFinishResult>;
}
```

The session input supplies the artifact workspace, compact program/context/notebook paths, exact
submission limit, wall-clock timeout, and one injected tool port. The adapter never receives the
evaluator plan, scenarios, seed, sealed suite, store, rank service, paper service, or trading
authority.

Tool request text is bounded and treated as untrusted researcher trace. Tool responses contain only
the same aggregate development feedback already released to the worker, an opaque submission
sequence, remaining submission count, and terminal session state.

## Agent-Owned State Machine

The infrastructure state machine is intentionally small:

```text
open
  -> zero or more completed development submissions, up to the committed limit
  -> selected | finished_without_submission | failed
```

Within `open`, the worker may read and edit its artifact, run candidate-owned local checks, inspect
its notebook, request status, and submit at any order it chooses. The infrastructure does not
require a plan, hypothesis type, smoke test, or full-test sequence.

Rules:

- each accepted development request snapshots the complete declared artifact before evaluation;
- requests are serialized and carry bounded idempotency keys;
- an exact idempotent replay returns the prior response without another evaluation;
- conflicting idempotency reuse fails closed;
- the committed submission limit counts completed or terminally rejected evaluator attempts once;
- only a completed submission sequence can be selected;
- one exact selection or finish action closes the tool port;
- no later submit, selection, or finish call is accepted;
- provider exit without a terminal tool action becomes `finished_without_submission` only when no
  evaluator effect is in flight; it never auto-selects the best score;
- process failure remains `failed` and CandidateArena closes the commitment through the existing
  failed-closed checkpoint path.

## Immutable Development Snapshots

The worker edits one working artifact initialized from the exact source artifact. On each accepted
development submission the application:

1. copies the working artifact to `development-submissions/<sequence>/artifact` outside the
   candidate artifact workspace;
2. validates it against the source-frozen manifest and single-file artifact closure;
3. evaluates that immutable copy against the evaluator-owned development suite;
4. writes only sanitized aggregate feedback to the worker notebook;
5. retains the full external evaluation evidence outside the worker-visible notebook.

Later edits cannot mutate an earlier snapshot. Final selection copies only the selected immutable
snapshot to `submitted-artifact`; it never copies the current mutable working tree implicitly.

Development frontier statistics may still compute the highest aggregate development score for
diagnostics. They do not choose the sealed submission. The worker may deliberately select another
completed snapshot; sealed admission independently decides whether it is admissible.

## Notebook And Checkpoint

The tick-local notebook records one entry per development submission, in exact sequence, with:

- bounded worker research note;
- artifact change status derived externally from snapshot digests;
- sanitized aggregate development feedback;
- external timing and resource counts;
- whether the sequence was selected for sealed submission.

Existing `keep` and `discard` fields remain development-frontier diagnostics in this frontier; they
must not be interpreted as final worker selection. The notebook separately records
`selected_development_submission` and terminal session status. The durable checkpoint continues to
carry only its bounded sanitized version-1 fields; richer causal-memory writeback remains a separate
versioned frontier.

## Codex Tool Adapter

The default Codex adapter runs one `codex exec` process for the whole session. It no longer tells
Codex to make exactly one edit.

The adapter exposes `ResearchWorkerToolPort` through a session-local loopback server:

- bind only `127.0.0.1` on an ephemeral port;
- use a random per-session bearer token and constant-time token comparison;
- accept only exact JSON routes, methods, fields, and bounded body sizes;
- generate a small Node tool client outside the candidate artifact and pass only its absolute path,
  base URL, and token in the managed provider environment;
- close the server and remove the client/output artifacts before returning;
- never place evaluator data, store paths, credentials, private exchange data, or operator API
  authority in the server or provider environment.

The prompt gives the broad direction, released context, sanitized notebook, budget, timeout, and
tool usage. It tells the worker to choose its own research sequence, use local checks when useful,
submit only through the tool, and explicitly select or finish. It does not prescribe a fixed
propose/plan/edit/test workflow.

The tool server is provider-session infrastructure, not a public HTTP route, Ouroboros command, MCP
surface, or candidate TradingApiProvider endpoint.

## Fixture And Compatibility

The deterministic fixture session remains a credible mechanics fixture, not an agent baseline. It
edits, submits, observes aggregate feedback, optionally edits again within budget, and explicitly
selects one completed snapshot. Directional Arena fixtures use the same session contract.

Existing injected one-edit adapters may be supported temporarily behind an explicit legacy session
wrapper so unrelated tests and compatibility callers do not silently change. The default Codex and
fixture paths must use the autonomous session contract. The legacy wrapper must remain bounded by
the same preflight plan and may not be presented as ResearchWorker autonomy evidence.

## Failure And Restart

- A tool server or provider failure does not fabricate a submission, selection, Evaluation,
  Finding, or admission.
- A completed development submission remains in the notebook even when a later provider action
  fails.
- No selection means no sealed suite claim.
- The sealed suite is claimed at most once and only after an exact selected snapshot is frozen.
- CandidateArena records or reconstructs the terminal checkpoint through the existing lifecycle
  rules; it never resumes the old provider process, tool server, timeout, or preflight plan.
- A later tick gets a new commitment and a fresh session, with only existing sanitized checkpoint
  context.

## Authority And Non-Goals

The frontier must not:

- expose raw development scenarios, expected directions, future outcomes, sealed seed/suite/result,
  per-scenario feedback, provider requests, commands, paths, or evaluator internals;
- let the worker change submission limits, timeout, tool routes, evaluation policy, or inclusion;
- auto-select by score when the worker does not select;
- let a selected snapshot bypass sealed admission or paper handoff conformance;
- feed sealed or paper qualification evidence back into the open session;
- add public commands, operator mutations, policy replacement, rank, promotion, private, or live
  authority;
- claim that one fixture sequence proves long-running autonomy, memory causality, agent leverage,
  profitability, or generalization.

## Acceptance

The frontier is complete only when tests prove:

1. default Codex and fixture paths run one agent-owned session rather than a host iteration loop;
2. the worker can submit early, de-risk locally without spending evaluation, stop early, consume the
   full budget, and select a non-highest-scoring completed snapshot;
3. no selection produces no sealed admission and no automatic best-artifact fallback;
4. every development evaluation uses an immutable externally copied snapshot;
5. duplicate, conflicting, concurrent, over-budget, post-terminal, malformed, and oversized tool
   calls fail without duplicate effects;
6. tool responses and notebook context expose only aggregate development feedback;
7. selection claims the sealed suite once and the exact selected artifact reaches existing
   conformance/admission/materialization checks;
8. provider/tool failure and restart preserve completed evidence and close the old commitment
   without process adoption;
9. CandidateArena direction concurrency, allocation, Finding, Lineage, duplicate handling, and
   checkpoint behavior do not regress;
10. focused tests, workspace typechecks, the full suite, and repository guards pass.
