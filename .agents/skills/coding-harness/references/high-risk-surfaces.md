# High-Risk Surfaces

These surfaces need stronger caution before editing.

## Execution Core

Why it is risky:

- it owns live order placement
- it enforces critical invariants
- mistakes here can directly affect funds

Read before editing:

- `ARCHITECTURE.md`
- `docs/RELIABILITY.md`
- `docs/product-specs/live-trading.md`

## Protective Stops And Invariants

Why it is risky:

- every live position must have an exchange-native protective stop
- missing or inconsistent invariant enforcement can trigger unsafe exposure

Read before editing:

- `docs/RELIABILITY.md`
- `docs/product-specs/live-trading.md`

## Credentials And Provider Boundaries

Why it is risky:

- exchange credentials must stay outside experimental workspaces
- provider credentials must stay outside execution sandboxes

Read before editing:

- `docs/SECURITY.md`
- `ARCHITECTURE.md`

## Kill Switches And Emergency Controls

Why it is risky:

- emergency controls outrank agent convenience
- weakening them breaks the trust model of the app

Read before editing:

- `docs/SECURITY.md`
- `docs/RELIABILITY.md`

## Promotion And Rollback Logic

Why it is risky:

- this controls what becomes live
- mistakes here can promote unproven behavior or break recovery

Read before editing:

- `ARCHITECTURE.md`
- `docs/exec-plans/active/product-definition.md`
- `docs/RELIABILITY.md`
