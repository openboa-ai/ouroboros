---
name: auto-garbage-collection
description: "Use when stale run notes, duplicate docs, historical drift, dead branches, obsolete skill instructions, or competing memory records block repository resumption."
---

# Auto Garbage Collection

## Role

`auto-garbage-collection` keeps project memory readable.

## Workflow

1. Identify active truth.
2. Identify stale, duplicate, or historical material.
3. Choose keep, delete, merge, or historicalize.
4. Update the lightest required docs.
5. Route durable cleanup summary to `llm-wiki`.

## Cleanup Classification

- Active truth: current instructions, docs, checks, or source notes future work should read.
- Historical context: useful migration or decision history that should not be in the active path.
- Duplicate memory: multiple pages say the same thing and one should point to the other.
- Stale scaffold: unused files, generated leftovers, obsolete run notes, or broken routes.
- Unknown ownership: material that may be active but lacks evidence.

## Decision Criteria

- `keep`: material is active and discoverable.
- `delete`: material is dead, misleading, or duplicated with no historical value.
- `merge`: material is useful but belongs in an existing active page.
- `historicalize`: material explains past decisions but must not guide new work.
- `reroute`: ownership, risk, or product meaning is unclear.

## Required Output

- goal
- owned boundary
- context read
- kept truth
- removed or historicalized material
- evidence
- decision: `keep`, `delete`, `merge`, `historicalize`, or `reroute`
- reason for cleanup
- verification
- risks
- next owner
- `writeback_needed`
- `llm_wiki_target`

## Handoff

Cleanup almost always changes repo memory. Default to `writeback_needed: yes` unless the pass was
purely read-only and found nothing.

## Hard Boundaries

- Prefer deleting dead scaffolding over preserving clutter.
- Keep historical pages only when they explain migration or context.
- Do not delete active product, design, or architecture truth without a replacement path.
