# Evaluation, Governance, And Promotion

This page synthesizes the sources most relevant to external truth, audit, staged progression, and
promotion discipline.

## Sources Used

- [anthropic-automated-alignment-researchers.md](../library/anthropic-automated-alignment-researchers.md)
- [anthropic-automated-w2s-researcher.md](../library/anthropic-automated-w2s-researcher.md)
- [repo-safety-research-automated-w2s-research.md](../library/repo-safety-research-automated-w2s-research.md)
- [repo-paperclip.md](../library/repo-paperclip.md)

## Comparison Table

| Source | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives |
| --- | --- | --- | --- | --- |
| [Automated Alignment Researchers](../library/anthropic-automated-alignment-researchers.md) | A parallel research system of independent automated researchers | Shared artifacts, evaluator outputs, and human review outside any single sandbox | Independent AAR sandboxes | External evaluator and human oversight |
| [Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md) | A detailed long-running research loop for W2S work | Remote evaluation API, external logs, synced findings | Individual researcher sandboxes | Remote truth, sandbox boundaries, human review |
| [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md) | A concrete sandbox/evaluation stack for automated W2S experiments | Server-side ground truth, dashboard records, findings forum | Containerized or hosted worker environments | Docker/RunPod legitimacy boundaries, evaluation server, run configuration |
| [Paperclip repo](../library/repo-paperclip.md) | A governance-heavy persistent agent company/control plane | Goal lineage, budgets, approvals, audit trail, rollback surfaces | Persistent agents pursuing company goals | Human approvals, budgets, rollback, organizational control |

## Shared Principles

### Truth should sit outside the sandbox

[Automated Alignment Researchers](../library/anthropic-automated-alignment-researchers.md) frames
the central issue as scalable oversight, not just agent productivity. [Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md)
goes further: logs live outside the sandbox, evaluation is remote, and reward hacking pressure is
real. The [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md)
makes this concrete by placing ground truth on the server side and distinguishing legit Docker or
RunPod runs from less trustworthy local subprocess mode. [Paperclip](../library/repo-paperclip.md)
reaches the same destination from a product angle by keeping approvals, budgets, and rollback
outside the active agent loop.

All four sources point to the same rule: the thing that decides whether a run counts should not be
fully writable by the run itself.

### Sandboxes should be disposable; evidence should not be

[Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md) and the
[automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md) both
assume that an agent workspace is an instrumented execution environment, not the final source of
truth. Logs, findings, and evaluation results matter more than the continued life of a particular
sandbox. [Paperclip](../library/repo-paperclip.md) similarly treats running agents as governed
actors whose state is meaningful only because a higher layer records ancestry, approvals, and
limits.

### Search and progression are not the same thing

[Automated Alignment Researchers](../library/anthropic-automated-alignment-researchers.md) shows
that parallel search can scale idea generation. [Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md)
shows that even strong search loops need careful external scoring and log preservation. The
[automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md) encodes
this in modes and infrastructure legitimacy. [Paperclip](../library/repo-paperclip.md) encodes it
as explicit approvals, budgets, and rollback.

The shared pattern is that exploration is relatively cheap, but advancement is expensive and
governed.

### Containerization can be a legitimacy boundary, not just an ops detail

The [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md)
adds an especially useful lesson: local subprocess mode and Docker mode are not presented as
equally legitimate. Docker exists there to restrict what the worker can see and touch. That means
containerization is part of the evaluation architecture, not merely deployment.

## What Each Source Treats As The Hard Part

- [Automated Alignment Researchers](../library/anthropic-automated-alignment-researchers.md):
  evaluation becomes the bottleneck as search scales.
- [Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md):
  maintaining tamper-resistant evaluation and avoiding reward hacking.
- [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md):
  enforcing legitimate execution conditions and preserving trustworthy server-side scoring.
- [Paperclip](../library/repo-paperclip.md):
  operating persistent agents under explicit company-style governance rather than trusting
  self-report.

## Governance Surfaces That Recur

- External evaluator or scoring service
- Logs outside the active workspace
- Explicit boundaries between local convenience mode and trustworthy evaluation mode
- Human approval surfaces
- Budget or resource limits
- Rollback or demotion path when the system deviates

These surfaces show up with different names, but they are functionally similar across the sources.

## Vocabulary Comparison

| Concept | AAR article | W2S write-up | automated-w2s-research repo | Paperclip |
| --- | --- | --- | --- | --- |
| success metric | `PGR` in [anthropic-automated-alignment-researchers.md](../library/anthropic-automated-alignment-researchers.md) | `PGR` in [anthropic-automated-w2s-researcher.md](../library/anthropic-automated-w2s-researcher.md) | `Evaluation API` returning `PGR` in [repo-safety-research-automated-w2s-research.md](../library/repo-safety-research-automated-w2s-research.md) | not a single scalar; budgets, approvals, ticket outcomes in [repo-paperclip.md](../library/repo-paperclip.md) |
| worker unit | `AAR` | `AAR` in independent sandbox | automated researcher process / worker run | agent employee / company worker |
| external truth | remote score server | remote evaluation API and anti-tamper concerns | server-side ground truth and dashboard | approvals, budgets, audit, rollback |
| progression | improved PGR and transfer tests | hill-climbing on a remote metric | execution mode legitimacy and leaderboard | governed advancement through approvals and outcomes |
| governance language | human oversight | reward hacking, evaluator design | legit vs non-legit modes | governance, board, budget, rollback |

The terminology shift matters. The research sources talk about `evaluation`, `PGR`, and `reward
hacking`, while Paperclip talks about `governance`, `approvals`, and `budgets`. They point at
overlapping control problems, but they are not the same abstraction layer.

## Source Classification

- Research-pattern references:
  [anthropic-automated-alignment-researchers.md](../library/anthropic-automated-alignment-researchers.md),
  [anthropic-automated-w2s-researcher.md](../library/anthropic-automated-w2s-researcher.md)
- Concrete evaluation-stack reference:
  [repo-safety-research-automated-w2s-research.md](../library/repo-safety-research-automated-w2s-research.md)
- Governance and promotion reference:
  [repo-paperclip.md](../library/repo-paperclip.md)

## Tensions To Preserve

- How much governance should be infrastructural versus product-level workflow?
- How strong does a legitimacy boundary need to be before results can count as promotable?
- How much agent-visible memory is helpful before it becomes a reward-hacking surface?
- What belongs in an external evaluator versus in a human approval layer?
