# Knowledge Index

This is the navigation layer for the LLM-maintained wiki.

It should answer one question first:

```text
what should a reader open next?
```

It is not a full file inventory. Use directory READMEs as catalogs.

## Default Design Read Path

Read these in order when orienting to the current active design:

1. [README.md](README.md)
2. [wiki/sources/synthesis/index.md](wiki/sources/synthesis/index.md)
3. [wiki/product/README.md](wiki/product/README.md)
4. [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md)
5. [wiki/architecture/README.md](wiki/architecture/README.md)
6. [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
7. [wiki/architecture/09-trader-system-runtime-operating-model.md](wiki/architecture/09-trader-system-runtime-operating-model.md)
8. [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)

This path is intentionally short. It gives a reader the source posture, product truth, architecture
map, runtime operating model, and active spec gate without forcing them through every product,
source, or slice document.

## When To Add More

Use these add-ons only when the task needs them:

| Task | Read next |
| --- | --- |
| Source-grounded architecture change | [wiki/sources/reference-ledger.md](wiki/sources/reference-ledger.md), [wiki/sources/synthesis/reference-impact-audit-2026-04.md](wiki/sources/synthesis/reference-impact-audit-2026-04.md) |
| Bootstrap substrate planning | [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md), [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md) |
| Provider execution | [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md), [wiki/architecture/specs/07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md) |
| Production readiness | [wiki/architecture/07-production-design-method.md](wiki/architecture/07-production-design-method.md) |
| Delivery slicing | [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md), then the matching architecture slice note |
| Decision history | [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md) |

## Catalog

Use these pages as directory-level catalogs:

- [wiki/index.md](wiki/index.md)
  Internal wiki root.
- [wiki/sources/README.md](wiki/sources/README.md)
  Source notes, reference ledger, and synthesis layer.
- [wiki/sources/library/index.md](wiki/sources/library/index.md)
  Source-note library catalog.
- [wiki/sources/synthesis/index.md](wiki/sources/synthesis/index.md)
  Cross-source synthesis and source-role rules.
- [wiki/product/README.md](wiki/product/README.md)
  Product strategy, MLP-01, PRDs, and decision log.
- [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
  MLP-01 planning pack.
- [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
  PRD-level product contracts.
- [wiki/architecture/README.md](wiki/architecture/README.md)
  Technical design workspace.
- [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
  Diagram-first architecture map and locked boundaries.
- [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)
  Active spec gate.
- [wiki/architecture/historical/](wiki/architecture/historical/)
  Historical/background architecture material, not default truth.
- [docs/README.md](docs/README.md)
  Reserved future home for external service docs.
- [knowledge-log.md](knowledge-log.md)
  Append-only chronology.
- [.agents/AGENTS.md](.agents/AGENTS.md)
  Repo-local workflow and design gate.

## Current Guardrails

- autokairos is an automated weak-to-strong trader, not a generic agent platform.
- `TraderSystemCandidate` is the candidate identity.
- `TraderSystemRuntime` is the logical stage-bound runtime; `RuntimePlacement` is replaceable
  physical execution.
- `TraderSystemProgram` is agent-authored executable behavior, not a human-authored strategy DSL.
- executable trader-system programs require manifest and validation records before mounting or
  execution.
- `RuntimeControl` is lifecycle/governance: register, deploy, start, pause, resume, stop, inspect,
  override, and kill.
- autokairos does not wake or route the trader-system's internal loop; `TraderSystemProgram`
  decides whether/when to call provider-backed agents.
- provider-backed execution is
  `AgentSession -> RuntimeProviderAdapter -> AgentRun -> AgentEvent -> Trace`.
- provider labels are not runnable without `ProviderReadinessRecord`; the first narrow assumption is
  `codex_cli + gpt-5.4 + schema output`.
- `RuntimeMemorySurface` is scoped context, not evidence, promotion truth, live authority, or
  provider-private memory.
- `Trace -> EvaluationRunRecord -> EvidenceSealingDecision -> EvidenceRecord -> PromotionDecision`
  is the evaluation truth path.
- `CapabilityPackage -> CapabilityManifest -> CapabilityPackageAdmissionRecord -> CapabilityGrant ->
  CapabilityMountRecord -> Trace` is the package trust path.
- `OrderIntent -> GatewayDecision -> ExecutionAttempt` is the live authority path.
- A2A is remote agent communication; MCP is tool/resource access; ACP/OpenClaw is an external
  harness bridge.
- Historical docs are background unless an active page explicitly promotes them.

## Maintenance Rule

Keep this file short.

If the index starts becoming a complete file list again, move detail into the nearest directory
README and keep this page focused on read path, catalog entrypoints, and current guardrails.
