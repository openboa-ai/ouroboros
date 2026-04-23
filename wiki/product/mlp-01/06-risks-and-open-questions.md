# MLP-01 Risks And Open Questions

## Purpose

This page keeps uncertainty explicit without reopening product truth by accident.

It exists to tell the team:

- what is still uncertain
- why it matters
- what evidence would reduce that uncertainty
- which unknowns threaten product thesis
- which unknowns threaten lovable quality only
- which unknowns are still just execution-detail questions

## Uncertainty Thesis

This page does not casually reopen product truth.

It exists to manage uncertainty underneath already locked decisions.

Not all unknowns are equal.

The team must distinguish:

- product-thesis risk
- lovable-quality risk
- execution-detail uncertainty

That distinction matters because `mlp-01` already locked:

- the product category and wedge
- the user, root pain, and value exchange
- the trust journey
- the trust-proof milestones
- the lovable-proof cutline
- the launch and success judgment bars

This page should define what is still unresolved **without turning every unresolved thing into a
new product decision**.

## Identity-Blocking Risks

These risks are identity-blocking because, if they flip, they could force a change to product
truth rather than just execution.

They should stay narrow and thesis-level.

| Risk | Why it matters | What evidence would reduce it | If it flips, update first |
| --- | --- | --- | --- |
| The lovable proof does not resonate with the chosen operator | If the operator does not care about one believable delegated live path, the core product thesis is wrong | Evidence that the chosen operator does or does not value trustworthy delegation once shown the end-to-end path | [../05-product-decision-log.md](../05-product-decision-log.md) |
| The live gate still feels ceremonial enough to undermine the thesis | If approval meaning is not serious, the product is not really governing delegation | Operator explanation of what the gate approved, why it was serious, and what changed after approval | [00-mlp-brief.md](00-mlp-brief.md) |
| Trustworthy delegation is not actually valued enough by the first ICP | If the chosen operator still prefers to stay the runtime, the product promise is misframed | Strong evidence that the first ICP either embraces or rejects bounded delegation as the main value | [../05-product-decision-log.md](../05-product-decision-log.md) |
| The wedge is mismatched enough that the first product thesis fails, not just the implementation | If the wedge cannot support one believable proof, the problem is strategy-level rather than feature-level | Evidence that the chosen user and market wedge either can or cannot support the lovable proof | [../02-market-icp-and-alternatives.md](../02-market-icp-and-alternatives.md) |

Identity-blocking risks should remain rare.

Ordinary execution friction or UX roughness does not belong here unless it would force a change to
user, wedge, lovable proof, gate meaning, or delegation thesis.

## Lovable-Quality Risks

These risks do not overturn the product thesis directly, but they could still prevent the product
from feeling lovable enough to count.

| Risk | Why it matters | What evidence would reduce it | If it flips, update first |
| --- | --- | --- | --- |
| Counted versus non-counted evidence is still too subtle | The trust loop can fail even if the underlying mechanics work | Operator review showing the distinction is understandable in practice | [02-journey-map.md](02-journey-map.md) |
| Bounded autonomy still feels emotionally unsafe | The product can collapse back into babysitting even if it is technically correct | Operator can let the system run without shadowing normal live actions | [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md) |
| Wake surfaces are too noisy or too vague | Intervention trust can fail under live conditions | Operator can interpret wake reasons quickly and act decisively | [02-journey-map.md](02-journey-map.md) |
| Trust breaks at intervention moments | The system may appear governed until the exact moment control is needed most | Live intervention tests showing that control returns cleanly without restoring permanent manual supervision | [02-journey-map.md](02-journey-map.md) |
| The product still feels like hidden manual burden in practice | The product can look good on paper while secretly keeping the operator in the loop | Observation that the operator is not still acting as the hidden runtime during normal operation | [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md) |

These are not small issues.

They matter a lot, but they should be treated as lovable-proof risks rather than immediate product
identity reversals.

## Execution-Detail Questions

These are still-open questions that can be answered with evidence without reopening core product
truth.

| Question | Why it matters | What evidence should answer it | If it flips, update first |
| --- | --- | --- | --- |
| What exact initial risk envelope defaults should be used? | Live trust depends on bounded autonomy being credible from the start | Operator review plus early launch validation | [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md) |
| Which wake channels should be first-class initially? | Wake clarity depends on channel fit and operator expectations | Operator feedback during intervention testing | [02-journey-map.md](02-journey-map.md) |
| What minimum evidence window should support the first live gate? | Gate seriousness depends on believable readiness criteria | Early evaluation review plus operator confidence checks | [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md) |
| How much candidate ranking is needed before the first lovable proof? | Too much ranking work can distract from one-path proof | Observation of whether one clear candidate path is enough for the chosen operator | [03-story-map-and-release-slices.md](03-story-map-and-release-slices.md) |

These questions are allowed to stay open because they do not require the team to guess product
identity.

They are execution-detail uncertainties, not thesis questions.

## Evidence Gaps

The main evidence gaps still to close are:

- whether counted versus non-counted evidence is truly legible to the chosen operator
- whether the live gate feels serious enough to justify delegation
- whether bounded autonomy feels like relief rather than disguised risk transfer
- whether wake and intervention preserve control without recreating constant supervision
- whether one delegated live path can produce meaningful live trading behavior rather than merely
  technical live presence

These gaps are the bridge between risk and action.

They describe what still needs to be learned before PRDs and implementation can proceed safely
without drifting from product meaning.

## Questions Already Settled

These are not open for MLP-01:

- who the first user is
- what the first market is
- what the lovable proof is
- where the human gate sits
- what trustworthy delegation means at the product level
- that the product is an operator system rather than a broad platform

If any of these reopen, the team must change product truth first rather than pretending it is a
local implementation question.

## Risk Review Rule

A risk or question belongs here only if:

- it still needs evidence, and
- leaving it open does not force downstream docs to guess product truth

If an unknown would change user, wedge, lovable proof, gate meaning, or delegation thesis, it is
not a casual open question in this page.

It is a product decision.

## Decision Escalation Rule

If new evidence would change:

- the first user
- the first market
- the lovable proof
- the meaning of the live gate
- the trustworthy-delegation thesis

then that change must be escalated in this order:

1. update the product decision layer first
2. update the affected product document next
3. update downstream PRD or architecture docs afterward

The canonical escalation target for thesis-level changes is:

- [../05-product-decision-log.md](../05-product-decision-log.md)

This prevents implementation uncertainty from silently rewriting product truth.

## Read Next

1. [prds/README.md](prds/README.md)
2. [../05-product-decision-log.md](../05-product-decision-log.md)
