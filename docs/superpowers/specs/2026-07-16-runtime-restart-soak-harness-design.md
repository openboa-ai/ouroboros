# Runtime Restart Soak Harness Design

**Status:** Approved for implementation on 2026-07-16

## Goal

Build a time-bounded operational harness that injects restart and dependency faults around the
existing always-on runtime, samples external state, and produces an append-only report proving or
rejecting recovery invariants. A short deterministic scenario must exercise the complete protocol
in CI without claiming that a production-duration soak has passed.

The harness creates the executable environment for OURO-189. It does not itself provide 24-hour
evidence, multi-host fencing, economic evidence, or new trading authority.

## Current Gap

The runtime supervisor now owns selected paper, CandidateArena, and research scheduling under one
same-host owner and immutable checkpoint chain. Existing tests prove focused restart behavior, but
there is no reusable controller that can:

1. run one bounded fault schedule against an actual runtime target;
2. preserve elapsed time and evidence when the harness itself restarts;
3. continuously evaluate cross-cutting process, Ledger, evidence, Sandbox, and cleanup invariants;
4. stop at the first violation and retain it despite later environmental recovery; or
5. distinguish a passing run from invariant, target-control, and duration failures.

## Vocabulary

- `RuntimeSoakHarness`: external operational test controller. It never becomes a runtime lane or a
  product decision service.
- `RuntimeSoakScenario`: immutable run ID, duration, sampling interval, and ordered fault schedule.
- `RuntimeSoakSample`: normalized read-only snapshot returned by a target probe.
- `RuntimeSoakReport`: immutable manifest plus a linear append-only event chain.
- `RuntimeSoakTarget`: adapter boundary for fault commands and read-only probes.

These are new operational test terms. They have no compatibility aliases and do not rename any
existing runtime, CandidateArena, TradingSystem, Evaluation, Gateway, Sandbox, or Ledger concept.

## Considered Approaches

### Add soak behavior to RuntimeSupervisor

Rejected. Fault scheduling and pass/fail classification are test authority. Adding them to the
product supervisor would mix operational experiments with the process that is being evaluated.

### Hard-code provider, Sandbox, and Gateway failure rules

Rejected. The concrete environment changes across local Docker Sandboxes, real providers, and
deployed hosts. Hard-coded failure mechanisms would make the harness brittle and encourage policy
rules unrelated to the invariant contract.

### Use a command-driven target behind a typed sample protocol

Selected. The application harness owns schedule, persistence, and invariant semantics. A
subprocess adapter executes configured argv arrays without a shell and parses one structured probe
snapshot. Real environments can supply their own control commands without changing harness logic.

## Architecture

### Application harness

`packages/application/src/runtime-soak.ts` owns:

- scenario and sample contracts;
- schedule validation and required fault coverage;
- the pure invariant evaluator;
- target and journal ports;
- resume reconstruction;
- bounded sampling and action execution; and
- terminal classification.

The service contains no filesystem, subprocess, HTTP, provider, exchange, or trading strategy
implementation.

### Filesystem and subprocess adapter

`packages/adapters/src/runtime-soak.ts` owns:

- create-only manifest publication;
- sequence-named, create-only event publication through temporary files and hard links;
- full digest, predecessor, sequence, timestamp, and run-ID validation on every load;
- argv-based `execFile` control commands with bounded timeout and no shell; and
- strict JSON parsing of probe output into a validated sample.

The adapter inherits the launching process environment. Scenario files must not contain raw secret
values. Every command receives only non-secret run/action metadata added by the adapter.

### Runtime composition

`apps/runtime/src/run-runtime-soak.ts` is a CLI composition root. It reads an explicit JSON config,
constructs the report journal and subprocess target, runs or resumes one report root, prints the
terminal summary, and returns non-zero for every classification except `passed`.

The CLI is not an Ouroboros public mutation command and does not add an Operator action. It is an
operations entry point for bounded evidence collection.

## Scenario Contract

A scenario fixes:

- a stable `run_id`;
- positive `duration_ms` and `sample_interval_ms`;
- unique action IDs in nondecreasing `at_ms` order; and
- complete coverage of `clean_restart`, `crash`, `delayed_cleanup`, `provider_loss`,
  `sandbox_loss`, `gateway_unavailable`, `recovery`, and `terminal_cleanup`.

Every disruptive fault must have a later `recovery` action naming the exact fault it restores.
`terminal_cleanup` is unique and last. Its scheduled time must be below the duration bound.

Actions are journaled as intent before target control and completion after target success. If the
harness process dies with an unresolved intent, resume records `target_failed` with
`ambiguous_incomplete_action` and never blindly repeats the side effect.

## Sample And Invariants

The target probe returns one cumulative `RuntimeSoakSample` with normalized operational facts. The
harness checks a fixed infrastructure protocol, not TradingSystem behavior:

1. `no_duplicate_effects`: every durable effect ID has exactly one occurrence;
2. `contiguous_chains`: Ledger and evidence entries are sequence-contiguous and predecessor-linked;
3. `exact_ownership`: each scope has at most one active owner and an active owner has exact identity;
4. `bounded_retries`: attempts and no-progress counts stay within the declared budget and exhausted
   lanes are blocked;
5. `no_order_continuity`: paper observation sequences are contiguous and zero-order observations
   explicitly record no-order continuity;
6. `egress_attestation`: active provider-generated Sandboxes carry verified version 2 attestation;
7. `terminal_cleanup`: the final sample has no active owner, nonterminal resource, or active
   Sandbox; and
8. `sample_contract`: malformed or incomplete probe output is a target failure before authority is
   inferred.

Invariant priority is stable. The first failed invariant is appended to the report and immediately
terminalizes the run. Later target recovery cannot overwrite or replace it.

## Report And Resume

The report root contains one immutable manifest and one sequence-numbered event directory. Every
event records:

- run ID, sequence, predecessor digest, timestamp, and elapsed milliseconds;
- one typed payload: run start, action intent, action completion, sample, or terminal result;
- its own SHA-256 digest; and
- explicit false evaluation, promotion, order-submission, private, and live authority.

Load validates the complete chain. Unexpected files, malformed JSON, digest drift, sequence gaps,
forks, run mismatch, or backward time fail closed. Publication compares the expected predecessor
and uses create-only writes so concurrent writers cannot overwrite one another.

Resume derives elapsed time from the first run event and the current wall clock. Completed actions
are not replayed. If restart follows action completion but precedes its sample, the harness records
that missing observation before another effect. If restart follows a failing sample but precedes
terminal publication, persisted samples restore the first failure before another effect. Samples
and elapsed time remain in the same report chain. A terminal report is idempotent and causes no
further target calls.

## Terminal Classifications

- `passed`: every action completed, every sample passed, and terminal cleanup passed;
- `invariant_failed`: the first exact invariant failure;
- `target_failed`: control command, probe, malformed sample, or ambiguous action failure; and
- `duration_exhausted`: the wall-clock bound expired before complete terminal cleanup.

Report corruption or publication conflict is not converted into a new terminal event because the
existing chain cannot safely accept evidence. The CLI fails closed and reports the journal error.

## Security And Authority

- Commands are argv arrays executed without a shell.
- Raw command stdout and stderr are not persisted; only a digest is retained for successful control.
- Probe output is parsed as structured JSON and shape-validated.
- No secret-bearing environment values are copied into the report.
- Fault injection grants no Evaluation, promotion, order, private, or live authority.
- Invariants constrain infrastructure safety and evidence continuity only; they do not constrain a
  TradingSystem strategy, model, tool, direction, decision cadence, or profitability.

## Verification

- pure evaluator tests cover every invariant and stable first-failure order;
- scenario tests cover every required fault and recovery relationship;
- harness tests cover all terminal classifications, periodic samples, sticky first failure,
  duration, completed-action replay prevention, and restart-preserved elapsed time;
- filesystem tests cover create-only publication, reload, corruption, predecessor conflict, and
  manifest mismatch;
- subprocess tests cover argv execution, timeout/error mapping, JSON parsing, and malformed output;
- one short end-to-end fixture executes every fault kind and produces a passing terminal report;
- full tests, workspace typecheck, and repository guards remain required before merge.

## Non-Goals

- no production-duration pass claim;
- no 24-hour run inside CI;
- no multi-host fencing or distributed consensus;
- no built-in provider, Sandbox daemon, Gateway, or deployment mutation policy;
- no provider-session resumption or external Sandbox adoption claim;
- no strategy, model, tool, candidate selection, rank, qualification, promotion, or economic rule;
- no private or live exchange authority.

## Acceptance Criteria

1. One immutable scenario can execute all required fault and recovery kinds within a fixed duration.
2. Every sample checks all required invariants and the first failure remains terminal and exact.
3. Restart resumes the same report without replaying completed effects or erasing elapsed time.
4. An ambiguous in-flight action fails closed instead of repeating a possible side effect.
5. The report is append-only, digest-linked, reload-validated, and explicitly authority-free.
6. A deterministic CI fixture proves the complete passing path and every terminal classification.
7. The harness remains externally configurable and does not encode trading-system behavior.
