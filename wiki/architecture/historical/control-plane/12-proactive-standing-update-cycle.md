# Proactive Standing Update Cycle

This page defines the stable service loop for maintaining current proactive standing above durable
history and active authority.

It follows:

- [10-proactive-record-shapes-and-standing-rebuild.md](10-proactive-record-shapes-and-standing-rebuild.md)
- [11-proactive-standing-updater-and-trust-management.md](11-proactive-standing-updater-and-trust-management.md)
- [../historical/specs/42-proactive-standing-projection-updater-contract.md](../historical/specs/42-proactive-standing-projection-updater-contract.md)
- [../historical/specs/43-proactive-standing-trust-downgrade-contract.md](../historical/specs/43-proactive-standing-trust-downgrade-contract.md)
- [../historical/specs/44-proactive-standing-update-cycle-contract.md](../historical/specs/44-proactive-standing-update-cycle-contract.md)
- [../adrs/0017-proactive-standing-update-cycle.md](../adrs/0017-proactive-standing-update-cycle.md)

## Purpose

Turn the standing projection updater from a boundary description into one stable control-plane
service loop.

## Scope And Non-Goals

This page covers:

- the canonical update cycle for one governed scope
- single-scope mutation ownership during one cycle
- outcome classes after one update attempt
- follow-up actions after update, downgrade, or rebuild request

This page does not cover:

- one queue or worker framework
- one storage vendor
- one distributed lock implementation
- every deployment topology

## Responsibilities

- define the stable order in which standing maintenance should happen
- prevent ad hoc partial updates from many call sites
- separate incremental advance, trust downgrade, and rebuild request outcomes
- keep standing mutation deterministic even when trigger transport is flexible

## System Boundaries

This loop sits:

- above durable proactive evaluation history, active authority, and downstream linkage history
- below current standing reads, wake-context reads, and rebuild orchestration

It should not collapse into:

- one scheduler callback mutating rows directly
- one runtime helper deciding standing trust locally
- one operator tool fixing standing by hand with no canonical cycle

## Primary Abstractions

- update trigger intake
- single-scope claim
- standing snapshot load
- incremental-advance decision
- trust-downgrade decision
- rebuild-request decision
- standing mutation commit
- follow-up signal emission

## Primary Flow

The canonical cycle should be read as:

`trigger intake -> select governed scope -> claim scope for update -> load standing, authority, and relevant history -> evaluate incremental advance vs downgrade vs rebuild -> persist one standing mutation -> emit follow-up signals if needed -> release scope`

## Failure And Recovery Model

This cycle has failed when:

- more than one updater mutates the same governed scope concurrently with no ordering rule
- trust changes but no standing mutation records the result
- rebuild is needed but no explicit rebuild request is raised
- cycle retries can create conflicting current standing outcomes

Recovery means:

- retry the same scope safely
- preserve idempotent standing mutation
- fall back to rebuild request rather than forcing unsafe incremental advancement

## Dependencies On Other Subsystems

- depends on proactive operations for normalized causes and evaluated outcomes
- depends on history/projection doctrine and proactive causality
- feeds operator inspection and execution issuance through refreshed standing reads

## What Is Still Delegated To Specs / ADRs

- the canonical cycle rules remain in
  [../historical/specs/44-proactive-standing-update-cycle-contract.md](../historical/specs/44-proactive-standing-update-cycle-contract.md)
- the design decision remains in
  [../adrs/0017-proactive-standing-update-cycle.md](../adrs/0017-proactive-standing-update-cycle.md)

## Core Rule

Current proactive standing should never be updated by a partial side effect.

It should only change through one explicit cycle that:

- loads the last known standing
- compares it against current authority and durable history
- decides one outcome class
- commits one coherent standing mutation for the governed scope

## One Sentence Summary

autokairos should maintain proactive standing through one stable update cycle per governed scope so
incremental advancement, trust downgrade, and rebuild requests remain deterministic even while the
trigger transport and storage backend stay flexible.
