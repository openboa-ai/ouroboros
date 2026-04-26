---
name: auto-promotion-protocol
description: Shared promotion protocol for autokairos PR work. Use when deciding whether a frontier can move to final signoff, ready to land, reroute, or discard.
---

# Auto Promotion Protocol

## Role

`auto-promotion-protocol` decides whether the current frontier can move forward.

## Promotion States

- `looping`: more bounded work is needed
- `final-signoff`: acceptance appears met and owner review is needed
- `ready-to-land`: final checklist and current checks are green
- `reroute`: next best owner differs from current owner
- `discarded`: change should not continue

## Required Evidence

- acceptance status
- latest verification
- latest QA judgment when applicable
- latest CI status
- wiki/writeback status when durable truth changed
- open risks

## Hard Boundaries

- Do not promote stale evidence.
- Do not promote with critical regressions.
- Do not promote when the current owner or scope is unclear.
