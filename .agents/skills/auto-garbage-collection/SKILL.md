---
name: auto-garbage-collection
description: Use when stale run notes, duplicate syntheses, outdated docs, historical drift, dead branches, obsolete skill instructions, or competing memory records make a repository hard to resume and a cleanup decision is needed.
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

## Required Output

- goal
- owned boundary
- kept truth
- removed or historicalized material
- evidence
- decision: `keep`, `delete`, `merge`, `historicalize`, or `reroute`
- reason for cleanup
- verification
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
