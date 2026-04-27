# Project Frontier Ledger

This is the resumable execution ledger for PR-sized project work.

`auto-project` reads this file before choosing the next frontier. The ledger answers:

```text
which MLP is active?
which frontier is active?
which branch or PR owns it?
what evidence is required to move it forward?
who is the next owner?
where should durable state be written back?
```

## Current State

| Field | Value |
| --- | --- |
| `current_mlp` | `MLP-01` |
| `active_frontier` | `mlp-01-candidate-materialization` |
| `branch` | `feat/mlp-01-candidate-materialization` |
| `pr` | PR #5 |
| `status` | `pr-open` |
| `next_owner` | `auto-promotion-protocol` if checks pass, `ci-recovery` if checks fail |
| `writeback_target` | `wiki/project/frontier-ledger.md`, `knowledge-log.md` when chronology matters |

Current interpretation:

- the docs/process baseline PR is a prerequisite foundation track, not an MLP-01 product slice
- Bootstrap substrate landed through PR #4 and is now the completed substrate frontier
- the next MLP-01 frontier is trader-system candidate materialization
- `auto-pm` locked the candidate materialization implementation plan in
  [frontiers/mlp-01-candidate-materialization.md](frontiers/mlp-01-candidate-materialization.md)
- PR #5 is open for the candidate materialization frontier
- the next owner is `auto-promotion-protocol` if checks pass or `ci-recovery` if checks fail

## Foundation Track

| Frontier | Branch | PR | Status | Next owner | Required evidence |
| --- | --- | --- | --- | --- | --- |
| docs/process baseline lock | `feat/pre-implementation-docs-baseline-lock` | PR #3 | `ready-to-land` after checks are green | user / merge owner | docs-design, gitleaks, CodeQL, action analysis green |

Foundation track updates affect whether implementation branches can be based directly on `main` or
must stay stacked.

## MLP-01 PR Queue

| Order | Frontier | Branch | PR | Status | Prerequisite | Next owner |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Bootstrap substrate | `feat/bootstrap-substrate` | PR #4 | `merged` | docs/process baseline available | `llm-wiki` if retrospective writeback is needed |
| 1 | Trader-system candidate materialization | `feat/mlp-01-candidate-materialization` | PR #5 | `pr-open` | Bootstrap merged | `auto-promotion-protocol` / `ci-recovery` |
| 2 | External evaluation and evidence sealing | TBD | not opened | `queued` | candidate materialization merged | `auto-pm` |
| 3 | Bounded live trader-system runtime | TBD | not opened | `queued` | externally evaluated candidate path merged | `auto-pm` |
| 4 | Runtime control, intervention, and audit | TBD | not opened | `queued` | bounded live runtime merged | `auto-pm` |

## Frontier Details

### `mlp-01-bootstrap-substrate`

Goal:

```text
build the minimal executable substrate for read-only inspection of durable trader-system fixture
records
```

Owned boundary:

- `apps/operator-web`
- `apps/runtime`
- `packages/domain`
- `packages/local-store`
- supporting workspace/package/test configuration required to run those roots

Acceptance:

- local runtime exposes `GET /health`, `GET /api/candidates`, and
  `GET /api/candidates/:candidate_id`
- local store seeds one idempotent fixture candidate lineage
- item files are authoritative and indexes/read models are projections
- restart rebuilds the same inspect read model
- operator UI can inspect candidate/spec/program/package/runtime placeholder state
- UI and API labels make fixture/convenience-mode status explicit
- no provider execution, program execution, evaluator execution, evidence sealing, promotion, live
  execution, marketplace, or runtime action API exists

Validation:

- repo checks: `bash scripts/check-docs.sh`, `bash scripts/check-secrets.sh`, `git diff --check`
- implementation checks: to be defined by the Bootstrap implementation frontier before coding starts
- reader check: [../architecture/05-bootstrap-tech-spec.md](../architecture/05-bootstrap-tech-spec.md)
  alone tells the implementer what is build-now, fixture-only, and deferred

Risks:

- implementation may accidentally turn fixture refs into real authority
- scope may expand into provider, evaluator, live, or runtime-control behavior
- workspace setup may become larger than the Bootstrap substrate needs

Next owner:

```text
merged; no further owner unless retrospective writeback is needed.
```

### `mlp-01-candidate-materialization`

Goal:

```text
materialize one provider-generated trader-system candidate into durable candidate/spec/program/
capability records without treating provider output as product truth
```

Owned boundary:

- locked in
  [frontiers/mlp-01-candidate-materialization.md](frontiers/mlp-01-candidate-materialization.md)
- implementation must preserve the Bootstrap substrate boundary and provider-readiness contract

Acceptance:

- one provider run can produce schema-valid candidate materialization input
- invalid, missing, unsafe, or failed provider output creates trace/debug artifacts but no candidate
- candidate identity, spec/program/package refs, and provider/run attribution are inspectable
- provider output remains `AgentEvent -> Trace`, not evidence, promotion, or live authority

Validation:

- defined in
  [frontiers/mlp-01-candidate-materialization.md](frontiers/mlp-01-candidate-materialization.md)
- must include existing repo checks plus candidate materialization success/failure/idempotency checks

Next owner:

```text
PR #5 is open. Route to auto-promotion-protocol if checks pass, or ci-recovery if checks fail.
```

## Status Vocabulary

- `queued`: valid future work, prerequisite not met yet
- `implementation-ready`: enough product/design truth exists to write a bounded frontier
- `in-progress`: branch has active implementation work
- `pr-open`: PR exists and is waiting for checks/review
- `ready-to-land`: acceptance, validation, QA, CI, and writeback are current
- `merged`: PR landed and the next frontier can be selected
- `blocked`: cannot proceed without named evidence, permission, or decision
- `discarded`: frontier should not continue

## Auto Project Run Packet

`auto-project` should return this packet when routing work from this ledger:

```text
current_mlp:
active_frontier:
branch:
pr:
status:
context_read:
route:
evidence_required:
risks:
next_owner:
writeback_needed:
llm_wiki_target:
```

## Update Rules

- PR opened, checks green/red, `ready-to-land`, merged, blocked, discarded, or next-frontier
  selection must update this ledger.
- `knowledge-log.md` should receive only important chronology, not every transient check output.
- If a frontier changes product or architecture meaning, update the relevant product/architecture
  page first, then update this ledger.
- Do not mark a frontier `ready-to-land` unless the promotion gate has current acceptance,
  verification, QA/CI, and writeback evidence.
