# First Development Kickoff (Bootstrap Substrate)

This page translates the current `mlp-01-bootstrap-substrate` frontier into a practical first
implementation sequence.

## Goal

Deliver one PR-sized bootstrap substrate that supports **read-only inspection** of fixture-backed
trader-system records.

## Step 1 — Lock the frontier before coding

Use the `auto-pm` contract and lock a single bounded scope:

- in scope: `apps/operator-web`, `apps/runtime`, `packages/domain`, `packages/local-store`
- out of scope: provider/program/evaluator execution, promotion, live trading, runtime action APIs

Definition of done for this step:

- acceptance criteria are restated in implementation terms
- validation commands for code checks are written down before first code change

## Step 2 — Build the minimal domain and fixture truth first

Start from `packages/domain` and `packages/local-store` so read models have a stable shape.

- define fixture-oriented candidate/spec/program/package/runtime placeholder records
- keep item files as authoritative source of truth
- build indexes/read models only as projections
- ensure fixture seeding is idempotent

Definition of done for this step:

- a restart rebuilds the same read model from fixture item files

## Step 3 — Add runtime read-only API seam

Implement only the required inspect endpoints in `apps/runtime`:

- `GET /health`
- `GET /api/candidates`
- `GET /api/candidates/:candidate_id`

Definition of done for this step:

- endpoints return fixture-derived read models
- no runtime action APIs (`start`, `pause`, `resume`, `stop`, etc.) are exposed

## Step 4 — Add operator inspect UI

Implement `apps/operator-web` as a fixture-status-aware inspection surface.

- list and detail views for candidate/spec/program/package/runtime placeholder state
- explicit labels that this mode is fixture/convenience mode

Definition of done for this step:

- user can navigate list → candidate detail and inspect placeholder lineage state

## Step 5 — Verify and stop at bootstrap boundary

Run repository and implementation checks:

- `bash scripts/check-docs.sh`
- `bash scripts/check-secrets.sh`
- `git diff --check`
- plus the bootstrap-specific tests/checks defined in Step 1

Promotion gate for this PR-sized frontier:

- keep only if all acceptance criteria pass
- reroute if any change drifts into deferred runtime/provider/evaluator/live scope

## Notes

- This sequence intentionally prioritizes stable fixture truth and inspectability over execution.
- If implementation pressure requires changing product or architecture meaning, update source docs
  first, then ledger/log writeback.
