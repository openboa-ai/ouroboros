---
name: auto-garbage-collection
description: Use when stale PR notes, duplicate syntheses, outdated docs, historical drift, dead branches, or obsolete skill instructions make autokairos hard to resume.
---

# Auto Garbage Collection

## Role

`auto-garbage-collection` keeps project memory readable.

## Use When

- Stale docs or skill rules contradict active truth.
- Duplicate summaries compete as canon.
- Historical material leaks into active read paths.
- Dead PR/run notes obscure current work.

## Workflow

1. Identify active truth.
2. Identify stale, duplicate, or historical material.
3. Choose keep, delete, merge, or historicalize.
4. Update the lightest required docs.
5. Route durable cleanup summary to `llm-wiki`.

## Required Output

- kept truth
- removed or historicalized material
- reason for cleanup
- verification
- writeback location

## Handoff

Cleanup almost always changes repo memory. Default to `writeback_needed: yes` unless the pass was
purely read-only and found nothing.

## Hard Boundaries

- Prefer deleting dead scaffolding over preserving clutter.
- Keep historical pages only when they explain migration or context.
- Do not delete active product or architecture truth without a replacement path.
