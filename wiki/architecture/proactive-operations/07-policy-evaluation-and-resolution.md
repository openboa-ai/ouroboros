# Policy Evaluation And Resolution

This page defines how autokairos should evaluate proactive policy programs without hardening the
upper layer into one closed scheduler implementation.

It follows:

- [05-policy-programs-and-extensibility.md](05-policy-programs-and-extensibility.md)
- [06-clause-model-and-registries.md](06-clause-model-and-registries.md)
- [04-precedence-and-overlap.md](04-precedence-and-overlap.md)
- [../specs/35-policy-program-evaluation-and-resolution-contract.md](../specs/35-policy-program-evaluation-and-resolution-contract.md)

It is also informed by additional official documentation:

- [OpenClaw: Automation & Tasks](https://docs.openclaw.ai/automation)
- [OpenClaw: Standing Orders](https://docs.openclaw.ai/automation/standing-orders)
- [Claude Code: Automate work with routines](https://code.claude.com/docs/en/web-scheduled-tasks)
- [Codex web](https://developers.openai.com/codex/cloud)

## Purpose

Define the stable evaluation pipeline that turns:

- substrate observations
- periodic cadence checks
- standing authority
- wake-policy programs
- governed self-scheduling proposals

into:

- emitted wake-trigger history
- suppressed or coalesced wake outcomes
- governed execution requests
- review or escalation work when authority is exceeded

## Scope And Non-Goals

This page covers:

- the evaluation phases for proactive authority
- the boundary between clause programs and emitted work
- deterministic resolution behavior that should stay stable across implementations

This page does not cover:

- one expression language
- one scheduler process
- one database schema
- one runtime driver

## Responsibilities

- keep policy-program interpretation explainable
- keep evaluation deterministic even while clause families remain extensible
- separate authority checks from timing checks
- separate wake emission from execution launch
- preserve chronology for both emitted and suppressed outcomes

## System Boundaries

This layer sits between:

- the always-on trading substrate and other wake-candidate sources
- durable proactive truth in the control plane

And upstream of:

- `WakeTriggerRecord`
- `ExecutionRequest`
- review or escalation intake when proactive authority is exceeded

It should not collapse into:

- runtime-local timer logic
- one hidden scheduler implementation
- one opaque "evaluate policy" blob with no explainable phases

## Primary Abstractions

- input normalization
- applicable-authority selection
- clause evaluation
- precedence resolution
- emission decision
- durable recording

## Primary Flows

The stable proactive evaluation flow should be read as:

`candidate cause -> normalized wake candidate -> applicable authority and policy programs -> clause evaluation -> precedence and coalescing -> emit | suppress | escalate -> durable history and current projections`

## Failure And Recovery Model

The evaluation model has failed when:

- scheduler implementations silently invent their own authority rules
- clause programs cannot be explained as to why a wake did or did not happen
- suppressed candidates disappear without durable reason
- one new trigger family requires redesigning the whole evaluation path

Recovery means:

- keep the evaluation phases stable
- keep clauses and registries extensible inside those phases
- push implementation-specific behavior back below the evaluation contract

## Dependencies On Other Subsystems

- depends on trading substrate for live state surfaces and signals
- depends on control plane for durable proactive truth
- depends on foundation for invariants and extensibility doctrine
- feeds the agent system through governed execution requests

## What Is Still Delegated To Specs / ADRs

- the narrow canonical evaluation contract remains in
  [../specs/35-policy-program-evaluation-and-resolution-contract.md](../specs/35-policy-program-evaluation-and-resolution-contract.md)
- overlap-specific ordering remains in
  [04-precedence-and-overlap.md](04-precedence-and-overlap.md)
- the durable decision to keep evaluation multi-phase remains in
  [../adrs/0012-multi-phase-policy-evaluation.md](../adrs/0012-multi-phase-policy-evaluation.md)

## Core Evaluation Phases

### 1. Normalize incoming causes

Every incoming cause should first become a normalized wake candidate.

Examples:

- time-based cadence tick
- market or order event
- self-scheduling proposal
- operator change request

The point is to avoid mixing raw input formats directly into wake emission logic.

### 2. Select applicable authority and policy programs

For each normalized wake candidate, select:

- active standing orders
- active wake policies
- relevant stage or scope bounds

This phase decides what authority applies before any wake is emitted.

### 3. Evaluate clause programs

Evaluate the selected clause programs in a decomposed way.

At minimum, evaluation should keep distinct:

- scope selectors
- timing clauses
- trigger clauses
- obligations
- constraints and clamps
- approval or escalation clauses

This phase should answer:

- is the candidate in scope?
- is it in-bounds?
- is it mandatory, allowed, clamped, or forbidden?
- does it require review before auto-apply?

### 4. Resolve overlap and precedence

If more than one still-eligible interpretation remains, apply deterministic overlap rules:

- authority first
- specificity second
- urgency third
- coalescing last

This should reduce many possible wakes into one explainable primary outcome.

### 5. Decide outcome

The evaluation layer should be able to produce only a small set of stable outcomes:

- emit wake trigger
- emit wake trigger and execution request
- coalesce into existing work
- suppress with reason
- escalate for review or approval

### 6. Persist history and refresh projections

Finally:

- append durable history for the evaluated outcome
- update rebuildable current-state projections

Chronology should remain append-only even when current standing is overwritten later.

## One Sentence Summary

autokairos should keep proactive authority extensible at the clause level but deterministic at the
evaluation-pipeline level, so new policy kinds can be added without making wake behavior fuzzy.
