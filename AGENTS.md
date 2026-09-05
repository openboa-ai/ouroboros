# Agent Development Context

This file is the operational entry point for agents developing Ouroboros. It routes work to the
project's governing sources; it does not replace, summarize, or reinterpret them.

## Source of Truth

Read and apply project authority in this order:

1. [`CORE_DOCTRINE.md`](CORE_DOCTRINE.md) defines the constitutionally governing purpose, identity,
   and boundaries of Ouroboros. Agents may not modify this authority; the human sovereign alone
   may amend the doctrine.
2. [`SOVEREIGN.md`](SOVEREIGN.md) resolves the current repository representation of the human
   sovereign and the conditions for valid succession. Ambiguity creates no authority.
3. [`WHITEPAPER.md`](WHITEPAPER.md) explains the doctrine and the design space it establishes.
4. [`PRODUCT_SPECIFICATION.md`](PRODUCT_SPECIFICATION.md) defines the required product identity,
   behavior, and proof.
5. Approved architecture and engineering documents will define provisional implementation
   choices.

When sources conflict, the higher source governs. Lower sources may refine but may not redefine
higher ones.

## Operating Test

Before proposing or making a substantive change, establish how it:

- contributes to economically worthwhile shareholder returns through authorized live trading,
  including growth in distributions and retained capital and a current case against alternatives;
- accounts for firm-level costs, obligations, and external capital flows without mistaking them for
  trading performance;
- preserves live trading as the product's condition of existence;
- distinguishes valid learning from the justification for further capital and considers cumulative
  firm-level costs rather than merely increasing activity;
- distinguishes actual outcomes, conditional earning ability, and the next allocation case while
  keeping improvement claims accountable to independent evidence and market reality;
- preserves human sovereignty over the objective, accepted risk, capital, authority, and effective
  revocation, including outstanding consequences across replacement; and
- grants the least authority sufficient for the purpose and the greatest autonomy within it.

If this relationship cannot yet be established, gather evidence or leave the proposal uncommitted.
For any sovereign-only action, verify the identity, explicit authorization, and scope required by
`SOVEREIGN.md`; repository access or maintainer status is not sufficient.

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

The Core Doctrine, Whitepaper, and Product Specification are the current product truth. Architecture
is the next provisional design layer.

Until architecture is approved, do not implement product runtime, schemas, services, or
compatibility surfaces. Work may continue on architecture and on repository security and integrity
required to preserve a trustworthy foundation.
