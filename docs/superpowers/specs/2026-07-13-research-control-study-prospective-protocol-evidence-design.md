# ResearchControlStudy Prospective Protocol Evidence Design

**Status:** Approved under the standing CandidateArena Goal authority

## Goal

Execute one six-replication `ResearchControlStudy` from a pre-effect commitment through exact
terminal outcome using copied LocalStore arms, real CandidateArena ticks, arm-local
`PaperTradingSessionService` instances, loopback paper-provider listeners, deterministic sandbox
processes, external comparison services, and restart readback.

This is Level 0 protocol evidence plus the execution prerequisite for Level 1. It must not relabel a
fixture result as proof that adaptive allocation improves discovery, that managed agents create
alpha, or that a TradingSystem earns prospective net revenue.

## Alternatives

### Inject campaign outcomes into the study executor

Rejected. Existing unit tests already prove ordering, replay, exact sign-test inference, and process
supervision with injected outcomes. Another mock cannot prove real arm/session composition.

### Override TradingPromotion getters in a LocalStore subclass

Rejected. The paper comparator depends on an exact confirmation campaign, final verdict,
qualification commitment, observation chain, admission, candidate version, and SystemCode graph.
Synthetic getters would bypass the evidence integrity being tested.

### Copy a LocalStore-validated TradingReview fixture and run real arms

Selected. Generate a stable fixture from the existing LocalStore comparison-backed promotion
fixture builder, copy it to a fresh test root, and require ordinary LocalStore readback to validate
it. The study then operates only through product services and the new arm-session factory.

## Fixture Boundary

The checked-in fixture contains one fully linked, paper-only TradingPromotion and its complete
comparison evidence graph. It is input state, not a claimed study result. The integration test must:

- copy rather than mutate the checked-in fixture;
- initialize an ordinary `LocalStore` over the copy;
- read the latest promotion, confirmation campaign, outcome, final verdict, qualification
  evaluation, commitment, observations, candidate, admission, and SystemCode through Store APIs;
- use `FIXTURE_CANDIDATE_ID` as the ResearchControlStudy source artifact while the persisted
  TradingPromotion remains the external paper comparator;
- retain fixture authority as `not_live`.

Fixture generation is a mechanical test-data operation. The retained test validates semantic graph
readback so a stale fixture fails closed.

## Prospective Study Flow

1. Copy and initialize the validated TradingReview fixture Store.
2. Construct a deterministic read-only `GatewayMarketDataPort` and derive its exact configuration
   digest for the paper protocol.
3. Commit six exact replication idempotency keys with `commitResearchControlStudyRuntime` before
   any `ResearchControlCampaign` exists.
4. Assert the study exists and campaign, report, paper schedule, and study outcome collections are
   empty.
5. Build `createResearchControlStudyArmSessionFactory` with, per arm:
   - a fresh deterministic sandbox adapter restricted to the copied arm's generated artifact root
     plus the repository fixture-artifact root;
   - a filesystem artifact resolver;
   - the default loopback paper provider wrapped only to count starts and closes;
   - a fresh paper evaluation runner.
6. Build `createResearchControlStudyRuntime` with the fixture research agent, existing controlled
   campaign runtime, real CandidateArena tick implementation, bounded networkless ResearchPreflight
   runner, real paper arm/session factory, and a controlled clock that advances only at executor
   wait boundaries.
7. Run the study runner to terminal state.
8. Assert all six planned campaigns and outcomes exist in fixed order, every reserved slot is
   terminal, provider starts equal provider closes, sandboxes stop, and the study outcome consumes
   exactly all six replications.
9. Reopen the root and arm stores, replay the study outcome, and assert byte-equivalent semantic
   readback with no new effects.

## Time And Market Control

The market port returns deterministic BTCUSDT public market and execution snapshots for the exact
requested observation time. It has no private endpoint and no live-order authority. The test clock
starts after the fixture promotion and advances monotonically by scheduled paper wait duration.

Sandbox cadence may be reduced for test execution, but the committed comparison policy retains
positive interval, elapsed-time, observation-count, retry, request-count, skew, and confirmation
bounds. Clock advancement cannot inject orders or scores; candidate output and Gateway/Ledger
processing remain the only paper evidence path.

## Failure And Cleanup

- Any missing or corrupt fixture record fails before study commitment.
- Any campaign, source batch, provider, sandbox, tick, checkpoint, qualification, confirmation,
  release, or outcome failure fails the integration test with its stable product error.
- The test tracks every provider and sandbox start/stop and performs best-effort cleanup in
  `finally` before deleting temporary roots.
- A non-significant, tied, negative, expired, or ineligible terminal study outcome is valid evidence
  when all precommitted replications are retained. The test must assert the actual classification,
  not force a positive claim.

## Acceptance Criteria

1. Study commitment precedes all six campaign commitments.
2. Six planned campaigns execute through the real campaign, paper, and study runtime path.
3. At least one candidate-bearing paper comparison starts a loopback provider and deterministic
   sandbox in each arm across the study.
4. Every started provider and sandbox is stopped; no process-local ownership leaks after drain.
5. The terminal outcome includes exactly six replication results and passes ordinary LocalStore
   restart replay.
6. No new TradingPromotion, policy decision, private-exchange record, or live authority is created.
7. The evidence report explicitly labels the result as fixture protocol evidence. Adaptive effect,
   managed-agent effect, market generalization, and economic durability remain unproven unless the
   observed outcome independently supports them in a later non-fixture study.

## Non-Goals

- manufacturing an adaptive win;
- using fixture PnL as a product KPI;
- server auto-start, long polling, or cross-process leases;
- distinct-regime or memory/agent factorial schema;
- TradingPromotion or live execution.
