# ResearchControlCampaign Design

**Status:** Implemented and repository-wide verified

## Goal

Create a causal experiment boundary for CandidateArena research policy. The first campaign compares
the existing `adaptive_default` allocation with the equal-bound `static_control` allocation from one
exact starting state, without letting research-phase proxy metrics declare a winner.

The campaign must make a later claim about qualified discovery yield possible. It does not make
that claim itself. The primary outcome remains unadjudicated until candidates reserved by a
precommitted rule complete prospective paper comparison and qualification evidence.

## Why This Frontier

CandidateArena already persists adaptive allocations and a static control with the same three
worker slots, concurrency limit of two, and total development submission budget of five per tick.
Running those modes sequentially in the primary store is not a valid ablation: the first run changes
Finding, Lineage, exploration history, behavior-duplicate baselines, and worker checkpoints consumed
by the second run.

Anthropic's Automated Weak-to-Strong Researcher results are controlled comparisons over researcher
conditions. Its entropy and research score plots are useful process diagnostics, while held-out
transfer, reward hacking, and evaluator leakage remain caveats. Ouroboros therefore needs an exact
treatment/control boundary before treating adaptive scheduling as an improvement.

## Hypothesis And Estimand

The version-1 hypothesis is:

> Under the same starting evidence, source candidate, managed research agent identity, worker and
> submission bounds, adaptive allocation increases prospective qualified challenger discovery yield
> relative to a static equal-bound allocation.

The primary estimand is not preflight score, admission count, or entropy. It is the difference in
the fraction of precommitted paper candidate slots that later produce exact prospective,
comparison-backed, qualified improvement evidence.

Version 1 creates the treatment/control research population and reserves its candidate slots. A
later frontier schedules and adjudicates those slots through the existing paper comparison and
confirmation protocol.

## Canonical Vocabulary

`ResearchControlCampaign` is an append-only pre-effect commitment for one bounded CandidateArena
policy ablation.

`ResearchControlCampaignArmIntent` binds one isolated arm to the campaign, baseline snapshot,
allocation mode, and exact tick sequence before arm effects.

`ResearchControlCampaignReport` is a terminal research-phase report over both exact arms. It may
contain diagnostics and paper candidate reservations, but its primary result is always
`unadjudicated` and its causal conclusion is always `not_available_from_research_phase`.

Avoid `winner`, `lift`, `better`, `successful`, or `causal_result` for research-phase fields.

## Considered Approaches

### Sequential modes in the primary store

Rejected. The second arm consumes evidence created by the first arm, so the treatment assignment is
confounded by population and memory order.

### Filter the primary store read model per arm

Rejected. CandidateArena reads and writes many linked collections and artifact workspaces. A partial
projection filter is easy to bypass and does not isolate append-only duplicate or worker lifecycle
state.

### Clone one frozen LocalStore baseline into isolated arm roots

Selected. The complete evidence and artifact state is copied once into an immutable baseline root,
then copied to treatment and control roots. Each arm writes only to its own root. A bounded canonical
snapshot digest proves both roots started from the same regular-file state.

### Use admission or preflight score as the campaign outcome

Rejected. Those are development and admission proxies over replay evidence. Optimizing them would
recreate the evaluator-overfitting failure the campaign is intended to detect.

## Pre-Effect Commitment

The campaign record freezes:

- one idempotency key and deterministic campaign ID;
- the exact baseline snapshot digest, regular-file count, and total byte count;
- the exact source TradingSystem candidate, CandidateVersion, SystemCode record digest, original
  artifact identity, and actual single-file research artifact closure digest;
- the managed research agent provider, model when present, and permission policy;
- exactly two arms: `adaptive_treatment/adaptive_default` and
  `static_control/static_control`;
- an equal positive tick count per arm, bounded to at most five;
- exact deterministic tick IDs for every arm and sequence;
- the existing `bounded_adaptive_v1` allocation policy digest and therefore three worker slots,
  concurrency two, and at most five development submissions per tick;
- a maximum baseline file count and byte count;
- `first_admitted_per_tick_in_allocation_order` as the paper candidate reservation rule;
- one paper candidate slot per tick and the required future evidence kind
  `confirmed_comparison_research_release`;
- research-only, no-order, no-promotion, and no-live authority.

The campaign ID and digest do not include a filesystem path. Local paths are execution placement,
not portable evidence identity.

## Snapshot Protocol

1. Stop or avoid concurrent primary-store mutation while capturing the baseline.
2. Walk regular files in canonical relative-path order.
3. Reject symlinks, non-regular entries, temporary files, path escape, excessive file count, and
   excessive total bytes.
4. Exclude only the three `ResearchControlCampaign` evidence collections from the baseline digest,
   preventing campaign self-reference. All candidate, artifact, Finding, Lineage, checkpoint, and
   duplicate-baseline state remains included.
5. Persist the campaign commitment in the coordinator store.
6. Resolve and seal the actual single-file CandidateArena research source, copy it to a separate
   immutable source-artifact root, and verify its closure digest. This is distinct from legacy or
   compatibility `SystemCode.artifact_digest` values.
7. Copy the coordinator store to an immutable baseline root and verify the same digest.
8. Copy that baseline to two empty arm roots and verify each digest before writing arm intent.
9. Never copy one arm from the other.

The campaign workspace must be outside the source root. Existing roots are reusable only when their
persisted campaign/arm intent matches exactly; conflicting or unexplained content fails closed.

## Arm Execution

Arms execute sequence by sequence. The matching treatment and control ticks start concurrently,
and each tick uses its precommitted ID and allocation mode. Each arm has an independent LocalStore,
candidate artifact workspace, worker notebook, allocations, fingerprints, admissions, and ticks.

Restart does not invent a result. Exact completed ticks are reused. A missing tick is rerun under
the same persisted arm intent; CandidateArena's existing orphan commitment recovery closes any lost
worker attempt before a new effect. A report is unavailable until every exact arm tick is present
and matches the committed allocation mode.

Version 1 does not pair sealed preflight random seeds. Those sealed results remain diagnostics only,
and the primary paper outcome uses prospective external evidence. Pairing seeds while tick,
direction, allocation, and worker identities differ would not make the sealed suites identical.

## Research-Phase Report

For each arm, the report binds exact tick and allocation refs and records:

- assigned worker attempt count;
- admitted/materialized, duplicate, quarantined, and failed counts;
- provider request, runner command, scenario, and elapsed-time totals;
- the campaign-only `ResearchPopulationDiversity` read model;
- one deterministic paper candidate slot per tick.

The slot selects the first `created` direction result in persisted allocation order. It binds the
exact candidate, active CandidateVersion, SystemCode, artifact digest, and admission decision. If a
tick has no admitted candidate, the slot is explicitly `no_admitted_candidate`; it cannot be filled
after seeing later results.

The whole report freezes:

```text
primary_outcome_status = unadjudicated
causal_conclusion = not_available_from_research_phase
next_action = schedule_prospective_paper_slots
```

Research diagnostics must never feed rank, admission, qualification, promotion, order, private, or
live authority.

## Future Outcome Gate

A later `ResearchControlCampaignOutcome` may consume only releases that bind the exact reserved
candidate and complete the existing prospective paper comparison, qualification, verdict, and
confirmation graph. It must count every precommitted slot, including `no_admitted_candidate`, and
must not reuse research feedback as qualification evidence.

No outcome may be derived from preflight score, admission status alone, raw confirmation records,
unreleased paper evidence, or a different candidate version or SystemCode.

## Failure And Recovery

- Invalid or unstable baseline: no arm effect.
- Snapshot copy or digest mismatch: delete only the newly created temporary root and fail closed.
- One arm tick fails before terminal tick persistence: preserve evidence; rerun only the missing
  exact tick, invoking existing worker recovery first.
- One arm finishes before the other: no report and no inference.
- Report persistence conflict: fail closed; records are append-only under deterministic identity.
- Campaign rerun after terminal report: return the exact report without another worker effect.

## Non-Goals

- Directed versus undirected scaffolding comparison.
- Memory versus no-memory ablation.
- Agent versus random/template baseline.
- Semantic method-family classification.
- Paper slot scheduling or campaign outcome adjudication in this frontier.
- Automatic allocation policy replacement, ranking, qualification, promotion, or champion handoff.
- Private or live exchange behavior.

## Acceptance

1. Runtime shape rejects malformed, unequal, unbounded, non-canonical, or authority-widened
   campaign, arm intent, and report records.
2. Campaign commitment is persisted before baseline or arm effects.
3. Treatment and control roots verify against one exact bounded baseline snapshot and cannot nest
   under the source root.
4. Arm intents precede CandidateArena effects and freeze exact tick IDs and allocation modes.
5. A fixture campaign runs both arms end to end, persists exact ticks, and yields a restart-stable
   research report.
6. Mutation in one arm does not appear in the other arm or coordinator store.
7. Research report diagnostics conserve exact tick totals and reserve candidates by the declared
   rule.
8. The report cannot express a winner or adjudicated primary outcome.
9. Focused tests, workspace type checks, repository guards, and the full suite pass.

## Verification Evidence

- Domain runtime-shape contract: 58 tests passed.
- Application decision, idempotency, diagnostics, reservation, and gate behavior: 22 tests passed.
- LocalStore append/reload/conflict/corruption graph: 8 tests passed.
- Runtime snapshot, isolation, terminal replay, and interrupted-arm recovery: 10 tests passed.
- Combined new frontier: 98 tests passed.
- Existing CandidateArena plus campaign runtime regression: 73 tests passed.
- Every workspace typecheck passed, including the Operator Desktop Rust build.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full repository suite passed 298 of 298 suites and 2215 of 2215 tests with zero failed,
  pending, or todo tests. The first sandboxed run was invalidated by loopback `listen EPERM`; the
  approved local-port run passed completely.
