# ResearchControlStudy Arm Session Factory Design

**Status:** Approved under the standing CandidateArena Goal authority

## Goal

Provide the missing runtime composition that creates one real
`PaperTradingSessionService` for each isolated `ResearchControlCampaign` arm. The factory must bind
every provider, sandbox, runner, artifact lookup, and Store effect to the exact copied arm root so
`runResearchControlCampaignToOutcome` can execute its existing real arm/session path.

This frontier proves composition and lifecycle ownership. It does not by itself prove that adaptive
research improves qualified discovery, generalizes across market conditions, or earns positive
prospective net revenue.

## Alternatives

### Reuse the root server session service

Rejected. `PaperTradingSessionService` is constructed around one Store and owns process-local
provider sessions, runtime bindings, runners, and checkpoint state. Reusing it for copied arms would
write evidence into the wrong root and merge independent process ownership.

### Build one Fastify runtime server per arm

Rejected. An arm needs application services, not another HTTP transport or root candidate runner.
This would add ports, recovery loops, and unrelated controller state to every campaign replication.

### Create one arm-local session factory

Selected. A runtime-layer factory accepts shared read-only market data and dependency builders, then
constructs a fresh `PaperTradingEvaluationRunner` and `PaperTradingSessionService` for the exact arm
Store on every invocation. It implements the existing `createArmSessions` dependency without
changing campaign, study, or paper domain contracts.

## API

Add
`createResearchControlStudyArmSessionFactory(options)` in
`apps/runtime/src/candidate/arena/research-control-study-arm-session-factory.ts`.

The returned function has the existing `createArmSessions` input:

```ts
{
  root: string;
  armKind: "adaptive_treatment" | "static_control";
  store: LocalStore;
}
```

The factory options provide:

- one shared `GatewayMarketDataPort`;
- an arm-context `createSandboxAdapters` function;
- an arm-context `createArtifactResolver` function;
- optional paper interval, sandbox interval, observation-drain timeout, provider factory, provider
  network options, and error logger;
- an optional runner factory for deterministic ownership tests.

The factory returns a real `PaperTradingSessionService`, which already satisfies
`ResearchControlCampaignPaperRuntimeArmSessions`.

## Ownership And Data Flow

1. `runResearchControlCampaignToOutcome` opens and initializes the exact copied arm Store.
2. It calls the returned factory with that Store and arm identity.
3. Dependency builders receive the same immutable context and bind allowed artifact roots and
   filesystem resolution to it.
4. A new evaluation runner and session service are created for that arm only.
5. Existing arm composition owns comparison preparation, activation, checkpoints, qualification,
   verdict, confirmation, release, and cleanup.
6. Restart creates new process-local services and reconstructs durable progress from the arm Store;
   it never adopts an unowned running attempt.

No service instance, evaluation runner, provider-session map, runtime binding, or sandbox adapter
registry is shared implicitly between arms.

## Failure Semantics

- Missing or invalid dependency builders fail during arm composition before paper effects.
- A builder failure remains wrapped by
  `research_control_study_runtime_arm_composition_invalid` at the existing runtime boundary.
- Provider, sandbox, or checkpoint failures continue through existing comparison failure and
  ineligibility records; the factory adds no alternate recovery path.
- The factory grants paper comparison authority only. It grants no default-session, promotion,
  private exchange, order-submission, or live authority.

## Verification

1. A focused unit test creates adaptive and static services from two Store roots and proves that
   dependency builders receive the exact root/arm context.
2. The services are distinct and calls route to their own Store rather than the coordinator Store.
3. Builder failure is covered by the existing study-runtime fail-closed arm-composition contract.
4. A following integration frontier uses this factory with the deterministic sandbox and a real
   listener-backed paper provider to execute one precommitted six-replication study.
5. The listener integration must label fixture results as protocol evidence, not economic or causal
   success. A managed-agent/public-market study is still required for a product-effect claim.

## Non-Goals

- server auto-start or a public study command;
- cross-process leases or distributed ownership;
- changes to study inference, allocation policy, or campaign scheduling;
- synthetic positive outcomes presented as research success;
- TradingPromotion, private exchange access, or live execution.
