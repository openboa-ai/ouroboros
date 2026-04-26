# Source Note: Automated Alignment Researchers

## Source

- Title: `Automated Alignment Researchers: Using large language models to scale scalable oversight`
- Primary URL: [https://www.anthropic.com/research/automated-alignment-researchers](https://www.anthropic.com/research/automated-alignment-researchers)
- Source type: research article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - sections:
    - problem framing
    - `Our setup`
    - `Results`
    - `Implications`
    - reward-hacking discussion and footnotes

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | research overview | opening framing on scalable oversight and W2S | establishes the research motivation |
| Primary article | research overview | `Our setup` | gives the basic AAR environment model |
| Primary article | research overview | `Results` | provides human baseline, AAR performance, and transfer tests |
| Primary article | research overview | `Implications` | states the evaluation bottleneck and alien-science concerns |
| Primary article | research overview | reward-hacking paragraph and footnotes | clarifies the limits of the setup |

## What This Source Is

This is Anthropic's high-level public research article about Automated Alignment Researchers (AARs).
It explains why Anthropic treats weak-to-strong supervision as a practical proxy for scalable
oversight and why a team of parallel autonomous researchers might matter. It is broader and more
implication-heavy than the deeper W2S execution write-up.

## Core Thesis

- Weak-to-strong supervision is used here as a practical proxy for scalable oversight.
- Alignment research may itself need automation because humans are a bottleneck.
- Parallel autonomous researchers can materially accelerate search over a well-scored research
  problem.
- Diversity of starting directions helps more than tightly scripted workflows.
- The real bottleneck can shift from generating ideas to evaluating them well.
- Even in an outcome-gradable domain, reward hacking remains real and human oversight remains
  necessary.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Weak-to-strong supervision` | weak teacher fine-tunes a stronger model; success measured by recovered performance gap | opening framing paragraphs |
| `PGR` | scalar score from 0 to 1 for recovered performance gap | opening framing paragraphs |
| `AAR team` | nine parallel Claude Opus 4.6 researchers | section `Our setup` |
| `Independent sandboxes` | each AAR gets its own place to work | section `Our setup` |
| `Shared forum and storage` | AARs share findings/code through common surfaces | section `Our setup` |
| `Remote score server` | service that returns PGR for proposed methods | section `Our setup` |
| `Ambiguous starting points` | diverse vague initial directions to prevent collapse onto one idea | section `Our setup`, later lesson in `Implications` |

### Architectural Reading

- The system boundary is not only the agent. It includes sandboxes, shared findings surfaces, and
  a remote evaluator.
- The outcome metric is intentionally crisp so progress can be scored outside the agent.
- The article treats evaluation quality as the scarce resource once search gets cheap.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| Anthropic explicitly frames weak-to-strong supervision as mirroring the problem of humans overseeing stronger AIs | opening framing paragraphs |
| the strong model is scored by `performance gap recovered` from 0 to 1 | opening framing paragraphs |
| Anthropic used nine copies of Claude Opus 4.6 as parallel AARs | section `Our setup` |
| each AAR had a sandbox, shared forum, code storage, and remote PGR server | section `Our setup` |
| each AAR received a different intentionally ambiguous starting point | section `Our setup` |
| Anthropic reports a human baseline of PGR 0.23 and AAR performance of 0.97 after 800 cumulative hours | section `Results` |
| the best AAR method generalized to held-out math and coding tasks better than the human baseline | section `Results` |
| Anthropic reports that too much prescribed workflow hurt AAR performance | section `Results` / lessons paragraph after the scaling graph |
| the article explicitly says the core bottleneck may become evaluation rather than generation | section `Implications` |
| the article explicitly warns about reward hacking and says both results and methods require human inspection | section `Implications`, reward-hacking paragraph |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `scalable oversight` | oversight of stronger-than-human systems when humans cannot directly verify everything | opening framing | central research problem |
| `weak-to-strong supervision` | weak teacher supervising a stronger student | opening framing | operational proxy for scalable oversight |
| `PGR` | performance gap recovered | opening framing | externalized success metric |
| `AAR` | Automated Alignment Researcher | `Our setup` | core agent unit |
| `sandbox` | per-researcher working environment | `Our setup` | autonomy boundary |
| `alien science` | model-generated ideas becoming harder for humans to verify | `Implications` | long-run interpretability warning |
| `reward hacking` | gaming the setup rather than solving the intended problem | `Implications` | governance warning |

## Transferable Lessons

- Parallel search is especially powerful when success is externally scoreable.
- Diverse starting assumptions can outperform tightly prescribed workflows.
- Outcome scoring should be separate from the search loop itself.
- The cheapest part of the system can become idea generation; evaluation rigor can become the real
  bottleneck.
- Even a well-scored environment needs anti-tampering and human review.

## Non-transferable Baggage

- This is an unusually outcome-gradable research problem with a single scalar score.
- `PGR` is a domain-specific metric, not a universal product metric.
- The article is a research framing document, not a direct product architecture guide.

## Open Questions / Tensions

- How much of the AAR performance comes from the unusual crispness of the task?
- How broadly do AAR-discovered methods generalize beyond the datasets and models used here?
- Where is the line between productive automation and `alien science` that humans can no longer
  audit well?
- How should systems respond when evaluation becomes the true bottleneck?
