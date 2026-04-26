# Evaluation, Governance, And Promotion

This page synthesizes the sources most relevant to external truth, audit, staged progression, and
promotion discipline.

For autokairos, this source cluster is not just helpful background. It is the primary thesis spine
for product truth.

## Sources Used

- [proactive-agent-research-papers.md](../library/proactive-agent-research-papers.md)
- [anthropic-2026-runtime-and-managed-agent-stack.md](../library/anthropic-2026-runtime-and-managed-agent-stack.md)
- [openai-2026-agent-codex-workspace-stack.md](../library/openai-2026-agent-codex-workspace-stack.md)
- [051-anthropic-project-deal.md](../library/url-notes/051-anthropic-project-deal.md)
- [anthropic-automated-alignment-researchers.md](../library/anthropic-automated-alignment-researchers.md)
- [anthropic-automated-w2s-researcher.md](../library/anthropic-automated-w2s-researcher.md)
- [repo-safety-research-automated-w2s-research.md](../library/repo-safety-research-automated-w2s-research.md)
- [repo-paperclip.md](../library/repo-paperclip.md)

## Post-URL-Ingestion Evaluation Rules

The URL-level notes strengthen the evidence boundary:

| Source pressure | autokairos evaluation rule |
| --- | --- |
| OpenAI agent evals and observability | traces, runs, and eval outputs are inputs to judgment; they are not automatically `EvidenceRecord` |
| Google Agent Evaluation and observability | platform evaluation records must still be sealed by autokairos evaluation rules before promotion |
| Google Memory Bank and OpenAI memory/context docs | memory can explain context, but memory is not objective evidence |
| A2A task/message/artifact protocols | remote-agent output is communication until evaluated |
| Project Deal | subjective user satisfaction can hide objective disadvantage, so comparable outcomes and provider/model attribution matter |

The hard rule is:

```text
Trace / AgentEvent / ProgramEvent / A2AArtifact / tool result / memory summary
-> EvaluationRunRecord
-> EvidenceSealingDecision
-> EvidenceRecord
-> PromotionDecision
```

No runtime, provider, memory system, or remote agent can bypass that chain.

Sealing is now an explicit active design boundary:

- `EvaluationRunRecord` preserves what the evaluator saw and under which run conditions.
- `EvaluationComparisonSet` preserves whether results are comparable enough for the claim.
- `EvidenceSealingDecision` decides whether output becomes counted, non-counted, or quarantined.
- `EvidenceRecord` is created only after sealing.

This is the autokairos translation of the W2S/AAR lesson that evaluation is the bottleneck and of
the Project Deal lesson that subjective satisfaction can hide objectively worse outcomes.

## Reference Impact Audit 2026-04 Result

[reference-impact-audit-2026-04.md](reference-impact-audit-2026-04.md) confirms that the current
evaluation boundary is directionally correct but not yet implementation-complete.

The strongest required future hardening is:

- comparable runs must preserve provider, model, runtime, stage binding, data window, and capability
  package attribution.
- evidence must account for reward-hacking and leakage pressure, especially when memory, generated
  scripts, or remote agents influenced behavior.
- operator satisfaction and convenience must be stored separately from objective trading evidence.
- OpenAI eval outputs, Google evaluation records, A2A artifacts, and provider traces are inputs to
  judgment, not `EvidenceRecord` until autokairos seals them.

This hardening is promoted into active architecture by
[../../architecture/specs/17-evaluation-comparability-and-sealing-contract.md](../../architecture/specs/17-evaluation-comparability-and-sealing-contract.md).

## Source Role In autokairos

The role split should be explicit:

- [Automated Alignment Researchers](../library/anthropic-automated-alignment-researchers.md),
  [Automated W2S Researcher](../library/anthropic-automated-w2s-researcher.md), and the
  [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md)
  define the primary product mindset for:
  weak supervision, evaluation bottlenecks, external truth, and legitimacy.
- [Paperclip](../library/repo-paperclip.md)
  is the strongest adjacent governance reference for:
  approval, intervention, audit, and runtime lifecycle control surfaces.

This means autokairos should treat this page as upstream of product rules, not as a nice-to-have
architecture comparison.

## Comparison Table

| Source | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives |
| --- | --- | --- | --- | --- |
| [Proactive agent research](../library/proactive-agent-research-papers.md) | Benchmarks and mechanisms for proactive assistance, memory/reflection, and timing/content evaluation | datasets, labels, memory/reflection records, benchmark traces | proactive agent decides when and how to assist | human labels, accepted/rejected predictions, timing/content evaluation |
| [Anthropic 2026 runtime stack](../library/anthropic-2026-runtime-and-managed-agent-stack.md) | Managed-agent runtime, long-running harnesses, skills, memory, and autonomy measurement | session/events, files/memory, handoff artifacts, autonomy measurement records | provider-backed agent and hands environment | environment/session/vault boundaries plus empirical autonomy measurement |
| [OpenAI 2026 agent stack](../library/openai-2026-agent-codex-workspace-stack.md) | Agent runs, sandboxes, traces, guardrails, evals, tools, and workspace agents | sessions, traces, eval records, review/admin surfaces | agent runs through provider/tool surfaces | guardrails, approvals, evals, observability, sandbox/tool policy |
| [Project Deal](../library/url-notes/051-anthropic-project-deal.md) | A real-world agent-mediated marketplace where Claude agents represented humans in negotiations | transaction outcomes, participant surveys, run assignments, and analysis outside any one agent | AI representatives negotiating without human intervention during runs | experiment design, post-run evaluation, disclosure, and real-world exchange constraints |
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

For autokairos, that translates directly into a product rule:

- candidate, evidence, promotion, and audit truth must remain outside runtime self-report

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

For autokairos, that means:

- idea generation is not the primary product value
- one path counting credibly is the primary product value

The newer eval/autonomy references sharpen this into an implementation rule. A trace, run result,
autonomy score, or proactive-assistance label can be input to judgment, but it does not become
autokairos `EvidenceRecord` until the evaluation boundary seals what counted, what did not count,
and why. Runtime activity and provider observability are necessary inputs, not promotion authority.

### Subjective satisfaction can miss objective disadvantage

[Project Deal](../library/url-notes/051-anthropic-project-deal.md) adds a product-critical warning:
humans may be represented by weaker agents and still not perceive that they got worse outcomes. In
autokairos, the solo operator may feel that a trader-system runtime is "reasonable" while it is
objectively worse than another candidate under comparable conditions.

This strengthens the requirement for:

- comparable candidate runs
- provider/model attribution in trace
- objective counted evidence
- explicit promotion decisions
- operator-visible distinction between satisfaction, convenience, and performance

The product implication is strict: an operator liking a runtime, a provider producing a clean report,
or a dashboard showing a plausible run is not enough. Promotion needs sealed counted evidence from
comparable evaluation conditions.

### Containerization can be a legitimacy boundary, not just an ops detail

The [automated-w2s-research repo](../library/repo-safety-research-automated-w2s-research.md)
adds an especially useful lesson: local subprocess mode and Docker mode are not presented as
equally legitimate. Docker exists there to restrict what the worker can see and touch. That means
containerization is part of the evaluation architecture, not merely deployment.

The repo README makes this very concrete. It says local subprocess mode is useful for quick
debugging, but the result "might not be legit" because the agent could read labeled data, while
Docker mode restricts visibility so the agent cannot cheat by reading ground truth. This is the
strongest current reference for the rule that convenience mode and legitimate mode must be kept
separate. [Source](https://github.com/safety-research/automated-w2s-research)

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
- Autonomy measurement that is based on observed behavior, not architecture labels
- Proactive-assistance evaluation that separates timing quality from action/content quality

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

For autokairos, the right translation is:

- W2S/AAR language should anchor the product thesis
- Paperclip language should anchor the governance surface
- Paperclip should not displace the W2S/AAR framing of the core problem

## Source Classification

- Research-pattern references:
  [anthropic-automated-alignment-researchers.md](../library/anthropic-automated-alignment-researchers.md),
  [anthropic-automated-w2s-researcher.md](../library/anthropic-automated-w2s-researcher.md)
- Concrete evaluation-stack reference:
  [repo-safety-research-automated-w2s-research.md](../library/repo-safety-research-automated-w2s-research.md)
- Governance and promotion reference:
  [repo-paperclip.md](../library/repo-paperclip.md)

## Transferable Mindset Vs Non-Transferable Baggage

What is transferable:

- evaluation is the bottleneck
- weak supervisors need external truth they can rely on
- counted and non-counted outcomes must be distinguishable
- legitimate execution conditions matter before advancement should count
- governance must sit above the worker/runtime
- evaluator output needs a sealing act before it becomes evidence
- non-comparable, partial, or leakage-tainted results must remain visible but cannot open live gate

What is not transferable by default:

- the exact AAR benchmark setup
- PGR as a literal trading KPI
- the exact dashboard structure of the automated-w2s-research repo
- Paperclip's company metaphor or org chart as product language

The point is to extract the constraint system, not to clone the research stack.

## Tensions To Preserve

- How much governance should be infrastructural versus product-level workflow?
- How strong does a legitimacy boundary need to be before results can count as promotable?
- How much agent-visible memory is helpful before it becomes a reward-hacking surface?
- What belongs in an external evaluator versus in a human approval layer?
