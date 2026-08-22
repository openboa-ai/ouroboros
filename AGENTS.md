# Agent Development Context

This file is the operational entry point for agents developing Ouroboros. It routes work to the
project's governing sources; it does not replace, summarize, or reinterpret them.

## Source of Truth

Read and apply project authority in this order:

1. [`CORE_DOCTRINE.md`](CORE_DOCTRINE.md) defines the immutable purpose, identity, and
   constitutional boundaries of Ouroboros.
2. [`WHITEPAPER.md`](WHITEPAPER.md) explains the doctrine and the design space it establishes.
3. An approved Product Specification will define required product behavior.
4. Approved architecture and engineering documents will define provisional implementation
   choices.

When sources conflict, the higher source governs. Lower sources may refine but may not redefine
higher ones.

## Operating Test

Before proposing or making a substantive change, establish how it:

- contributes to the sustained compound growth of actual capital through authorized live trading;
- preserves live trading as the product's condition of existence;
- enables valid iteration instead of merely increasing activity;
- keeps claims of improvement accountable to independent evidence and market reality;
- preserves human sovereignty over the objective, capital, authority, and revocation; and
- grants the least authority sufficient for the purpose and the greatest autonomy within it.

If this relationship cannot yet be established, gather evidence or leave the proposal uncommitted.

## Skills

Skills are mutable methods for repeatable execution. Use an existing skill when it materially
improves the reliability or efficiency of an authorized task. Add a repository-local skill only
after recurring use demonstrates a stable need that cannot be met more simply.

A skill cannot create product authority, override a governing source, expand permissions, or turn
its current method into a permanent architectural commitment. Its outputs remain subject to the
same evidence and review as any other work.

## Plugins

Plugins provide external capabilities, not decision authority. Availability does not grant
permission to use credentials, write to external systems, deploy software, trade, move capital, or
expand an agent's authority. Those actions require authority already established for the task.

Treat plugin output as evidence to verify, not truth to inherit. Prefer the narrowest capability
sufficient for the authorized purpose. Linear is not part of the Ouroboros workflow and must not
be introduced as a dependency or source of project state.

## Change Discipline

Use the minimum structure sufficient for the distinction the system must currently express. Do
not create enums, schemas, roles, services, workflows, or abstractions before that distinction is
required by an approved specification and supported by evidence.

No organization, model, tool, or method is permanent. A candidate change may not be its sole
evaluator or approver. Preserve favorable, null, negative, and contradictory evidence together
with the decision rationale so later iterations can reconstruct what was learned.

## Current Repository Stage

The Core Doctrine and Whitepaper are the current product truth. The next authority document is the
Product Specification.

Until that specification is approved, do not implement product runtime, schemas, services,
architecture, or compatibility surfaces. Work may continue on product direction and on repository
security and integrity required to preserve a trustworthy foundation.
