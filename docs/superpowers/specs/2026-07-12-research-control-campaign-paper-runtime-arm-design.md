# ResearchControlCampaign Paper Runtime Arm Design

**Status:** Implemented and locally verified under the standing CandidateArena Goal authority;
the listener-capable full suite passes, while prospective real-study evidence remains uncollected

## Goal

Compose one arm-local paper comparison runtime from the existing application services and make a
confirmation window advance through one restart-projectable transition per campaign executor
action.

The result must let `runResearchControlCampaignToOutcome` open a real adaptive or control arm with
only its store, paper comparison session port, market data port, and clock. It must preserve the
sealed comparison, qualification, confirmation, and release contracts already enforced by the
application layer.

## Selected Design

Add one runtime-layer `ResearchControlCampaignPaperComparisonAdvancer` and one
`createResearchControlCampaignPaperRuntimeArm` composition factory.

The advancer projects the next legal operation from persisted arm evidence and performs exactly one
of these operations per call:

1. capture the confirmation comparison first tick;
2. authorize the comparison activation;
3. recover stale activation ownership or start the runtime attempt;
4. advance one `PaperTradingComparisonWindowDriver` transition;
5. adjudicate the terminal comparison verdict.

The factory creates and shares the existing:

- `PaperTradingComparisonCoordinator`;
- `PaperTradingComparisonActivationCoordinator`;
- `PaperTradingComparisonRuntimeActivationCoordinator`;
- `LocalStorePaperTradingComparisonWindowStateReader`;
- tick, checkpoint, and window driver services;
- qualification and verdict services;
- confirmation campaign, confirmation window, and research release services.

No comparison, qualification, or release rule is reimplemented in the runtime layer.

## Rejected Approaches

### Run an entire confirmation window inside one action

Rejected. A long internal loop hides durable transition boundaries from the campaign executor,
weakens stop behavior, and makes crash diagnosis ambiguous.

### Persist a second confirmation progress record

Rejected. Tick, activation, attempt, checkpoint, verdict, campaign, and release records already
form the authoritative graph. A parallel progress cursor could drift from those records.

### Duplicate the application comparison protocol in the runtime app

Rejected. The existing services own validation, idempotency, qualification, and sealed release.
The runtime layer should only project and compose them.

## Confirmation Transition Contract

`advanceComparison` first validates that `campaignId`, `slotIndex`, and `comparisonId` identify one
exact reserved confirmation slot. It rejects ambiguous verdict, activation, attempt, or outcome
evidence before effects.

Deterministic idempotency keys are derived from the campaign and slot:

```text
research-control-confirmation:<campaign-id>:<slot-index>:first-tick
research-control-confirmation:<campaign-id>:<slot-index>:activation
research-control-confirmation:<campaign-id>:<slot-index>:runtime
```

The persisted graph determines the operation:

| Evidence | Operation |
| --- | --- |
| No tick, activation, or verdict | Capture first tick |
| One first tick, no activation | Authorize activation |
| Activation, no attempt | Recover store-wide incomplete attempts, then start this attempt |
| Owned `both_running` attempt | Advance one window-driver transition |
| Unowned `both_running` attempt | Recover it to a durable terminal activation outcome |
| Cleanly stopped attempt with prior `both_running` evidence | Evaluate verdict |
| Existing exact verdict | Return an idempotent adjudicated result |

An attempt that never reached `both_running`, a `cleanup_required` outcome, progressed ticks without
activation, or mismatched slot identity fails closed. The runtime does not reinterpret those states
as qualified evidence and does not silently start a replacement attempt over a progressed window.

## Waiting

`PaperTradingComparisonWindowDriver` can return `transition: "none"` with `next_wake_at`. The arm
returns a typed `waiting` result. `ResearchControlCampaignPaperConfirmationCoordinator` preserves
that result, and `ResearchControlCampaignPaperExecutor` maps it to its existing `wait_until` step.
The runner therefore sleeps until the exact wake time instead of repeatedly polling the same
confirmation state.

## Recovery And Ownership

The factory creates one runtime activation coordinator per arm and reuses it for source and
confirmation windows. In-process calls therefore preserve owned running-attempt identity.

After process restart, an unowned persisted `both_running` attempt is never adopted. Recovery stops
it through the existing runtime coordinator. If the attempt had reached a valid running state, the
next action adjudicates its now-terminal evidence, usually as ineligible when the minimum window was
not reached. Cleanup uncertainty remains a terminal error.

This frontier does not add cross-process leases or automatic server startup.

## Authority

The factory receives only an arm-local store, a paper comparison session port, and a read-only
market data port. It creates no private exchange access, credentials, order authority, policy
decision, TradingPromotion, or live behavior. Research release remains sealed until the existing
confirmation adjudication permits it.

## Testing

- exact one-operation progression from empty confirmation slot to verdict;
- deterministic key replay and existing-verdict idempotency;
- strict campaign/slot/comparison identity rejection;
- ambiguous or impossible graph rejection before effects;
- owned window advances exactly one driver transition;
- `next_wake_at` propagates to a runner waiting step;
- unowned running attempt invokes recovery instead of adoption;
- failed start and cleanup-required outcomes fail closed;
- factory exposes all real services and shares one runtime ownership coordinator;
- existing source, confirmation, campaign executor, and study runtime regressions remain green.

## Non-Goals

- Public CLI, HTTP, TUI, or Desktop commands.
- Server auto-start, process polling, or cross-process leases.
- New comparison, qualification, confirmation, or release policy.
- Automatic ResearchControlStudy commitment or allocation policy decision.
- Listener-capable evidence collection in the restricted local environment.
- Distinct-regime, memory/no-memory, or agent/baseline factorial inference.

## Acceptance

1. A caller can create a complete arm from real store, session, market data, and clock dependencies.
2. Each confirmation action performs at most one durable protocol transition.
3. Restart state is derived only from existing persisted comparison evidence.
4. Waiting confirmation windows cause the campaign runner to sleep until their exact wake time.
5. Ambiguous, unowned, failed-start, or cleanup-uncertain evidence cannot be promoted as success.
6. Existing application services remain the sole owners of comparison and release decisions.
