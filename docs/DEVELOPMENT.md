# Developing Ouroboros

This guide connects development intent, implementation, evidence, delivery and observation.
It does not replace governing product sources, approve architecture, or authorize operation.

## Plan and design

Start from the requested outcome or observed failure and the repository's current state.
For a substantive proposal, apply the operating test below and read the relevant governing
sources in their authority order. Clarify consequential unknowns; do not turn a proposed method
into the user's purpose. An unresolved dependent decision does not block independent authorized
research.

Use the existing PR as the durable record for purpose, scope, accepted decisions, validation
and next action. A small correction can keep all of these in one record. For a larger change,
make the design and implementation plan reviewable: affected responsibilities and interfaces,
alternatives, compatibility, failure/recovery behavior, and acceptance evidence. Keep the record
current when a reviewed assumption changes; no fixed set of intent/spec/plan filenames is required.

Use the minimum structure required by the approved specification and current evidence. Do not
add speculative schemas, roles, services or abstractions. Organizations, models and methods
remain revisable choices; retain the evidence and rationale needed to reassess them.

For detailed design, enter through the [architecture reading map](../ARCHITECTURE.md#3-detail-map-and-reading-order)
and read [shared contracts and state](architecture/CONTRACTS_AND_STATE.md) before the affected
component. Components own mechanisms, not competing authority or state definitions.

## Build and test

Implement only the accepted scope in an isolated worktree. Independent work needs separate
ownership and mutable runtime resources; concurrent edits to shared files need coordination.
The applicable host decides whether delegation is available and authorized. No fixed worker graph
or handoff after every edit is required.

Use [Testing Ouroboros](../tests/README.md) for the existing selector, prerequisites, runners and
evidence contract. Run affected local checks, fix failures caused by the change, and rerun relevant
checks within the authorized disposable fixture boundary. Do not run the full inventory after
every edit or execute fixture servers through indiscriminate test discovery.

A bug fix should reproduce the relevant failure and demonstrate the corrected outcome where
practical. Changes to an oracle need independent justification and code-owner review; weakening
it is not a fix. Required checks, real-platform requirements, scenario IDs and fail-closed reporting
remain unchanged. A missing environment stays NOT RUN and cannot establish approval readiness.

For agent instruction changes, compare fixed realistic tasks under old and new instructions.
Inspect artifacts, relevant tool actions, unwanted actions, unnecessary reading and early stops;
keep outcome, time and token observations separate. Model feedback does not replace deterministic
system verification or the required independent review.

## Deploy: deliver the actual requested outcome

Use the [GitHub delivery contract](../.github/README.md) for review, current-base CI, scanning,
human approval and native auto-merge. Keep working through actionable findings instead of treating
the first implementation or push as completion. Do not duplicate the ruleset in a second script.

A local result, merged source, installable artifact, installation, deployment and qualified company
operation are different outcomes. For authorized installation or deployment work, use the
[integration guide](architecture/INTEGRATION_AND_DEPLOYMENT.md) and establish the exact artifact,
target, current authority, observation and recovery path. Its design examples are not live bindings.
Prepare everything authorized before the real release/operating gate; do not infer production
access or invent a rollback permission from a merge.

## Maintain: feed evidence back into the next intent

Observe only the environment and period authorized by the task. Existing CI, requested runtime
checks, incidents and user feedback supply evidence; no always-on monitor or automatic production
rollback is installed by this guide. Record unavailable observation instead of claiming health.

Reconcile effects before retrying a failed action. A regression record identifies symptom,
revision/environment, impact, evidence and competing explanations, then states the next intended
outcome and unresolved decision in the relevant PR. A proposed correction does not authorize itself.
Preserve useful failures as regression cases and put a recurring lesson in its narrow source,
not a new universal restriction or duplicated product document.

Stop owned fixtures and processes when their work ends. Where workspace lifecycle tooling exists,
release the final PR head for verified merge cleanup and reclaim it before resuming edits.
Preserve dirty, active, unmerged and unregistered work. Report what was delivered, what remains to
observe, and the responsible next action without claiming a merge proves operation.

## Source design

The development lifecycle follows the [Claude AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook).
The instruction form follows [OpenAI's Astra guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra):
task-specific reading, concise discovery, proportionate methods, and explicit completion.
These are development methods, subordinate to Ouroboros's governing sources.

## Operating Test

Before proposing or making a substantive change, establish how it:

- contributes to long-term growth in profits withdrawn by the owner and net capital remaining in
  operation through authorized live trading, with a current case against realistic alternatives;
- distinguishes owner-controlled initial and additional contributions, returns of principal,
  realized and unrealized gains, and withdrawals without double-counting profit or mistaking
  capital flows for trading performance;
- accounts for whole-firm costs and outstanding obligations, including owner-paid and shared
  costs, without hiding them through omission, reallocation, or uncertain valuation;
- preserves live trading as the product's condition of existence without requiring a trade,
  change, or withdrawal in every period;
- distinguishes valid learning from the justification for further capital and considers cumulative
  firm-level costs rather than merely increasing activity;
- distinguishes AI-led operation, actual owner outcomes, AI contribution, conditional earning
  ability, and the next allocation case, with evidence appropriate to each judgment;
- establishes purpose relevance, valid authority, and the current resource case separately,
  including for indirect research, maintenance, and recovery;
- preserves human sovereignty over the objective, accepted risk, capital, authority, and effective
  revocation, including economic history and outstanding consequences across replacement and
  additional funding;
- preserves independent evaluation for both internal changes and changes to external controls,
  without treating multiple agents or agreement alone as verification; and
- grants the least authority sufficient for the purpose and the greatest autonomy within it.

If this relationship cannot yet be established, gather evidence only within an authorized and
justified resource commitment, or leave the proposal uncommitted. Maintaining a simpler method,
waiting, reducing exposure, and stopping unnecessary work can serve the same objective.
For any sovereign-only action, verify the identity, explicit authorization, and scope required by
`SOVEREIGN.md`; repository access or maintainer status is not sufficient.

## Current Repository Stage

The Core Doctrine, Whitepaper, and Product Specification are the current product truth.
[`ARCHITECTURE.md`](../ARCHITECTURE.md) proposes the next provisional design layer, including
independent firm operation, common execution mechanics, mandatory domain enforcement, capability
connectors, dependency isolation, observation, and succession. Check its adoption status in the
reviewing pull request before treating it as an approved implementation basis.

The current implementation direction separates public execution and enforcement from private
agent-led operation while retaining company-wide feedback, obligations, and evidence. Evaluate
external implementation, internal performance, and their connected actual effects separately;
these are verification responsibilities, not a third execution layer. Public code does not prove
the state of a live deployment, and private operation does not remove authorized access to evidence.
Astra is the planned implementation agent; this does not select the firm's internal operating
model. Follow the Whitepaper and Product Specification for the boundaries of this direction.

Until architecture is approved, do not implement product runtime, schemas, services, or
compatibility surfaces. Work may continue on architecture and on repository security and integrity
required to preserve a trustworthy foundation.

## Authorized Local First-Connection Work

The owner explicitly instructed this task to continue locally without posting a PR after the
architecture-adoption prerequisite was presented. For this bounded first-connection task, local
Rust implementation and fixture/reference-backend testing may proceed against the detailed design.
This scoped instruction supersedes the pre-adoption implementation restriction above for this task;
it does not record a published architecture adoption, authorize a PR/commit/merge, or alter doctrine,
sovereign designation, financial authority, or production acceptance. Actual subscription calls
still require the confirmed connection candidate and the owner's finite usage limit. Preserve the
original design worktree and report incomplete implementation and NOT RUN cases explicitly.
