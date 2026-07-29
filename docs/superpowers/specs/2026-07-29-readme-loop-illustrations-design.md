# README Loop Illustration Redesign

## Goal

Create five focused raster illustrations that explain Ouroboros as an AI-driven quantitative
trading system without turning one image into a dense poster. The reference composition is the
user-provided wide evidence-loop image: approximately 2.2:1, calm, horizontal, and readable at
README width. The loop grammar follows Anthropic's editorial treatment: a soft rectangular route,
not a literal circle.

## Visual System

- Use generated PNG artwork, not SVG.
- Target an approximately 2.2:1 landscape ratio and at least 1500 pixels of source width.
- Use the Ouroboros design contract: warm mist/off-white background, `#17120F` structure and type,
  `#F37021` only for active returns, gates, and focused signals, and an Inter-like sans-serif.
- Use the Anthropic loop article only as editorial guidance: generous whitespace, restrained
  hand-ink lines, rounded-rectangle routes, faint paper-like support shapes, and one explanatory
  idea per image.
- Do not draw circular cycles or circular process nodes. Each loop travels around a wide rounded
  rectangle with clear direction and a single orange return segment.
- Use two levels of vocabulary. Large labels use portable agent-system language from the OpenAI,
  Anthropic, and repository reference library. Smaller labels pair the concept with the exact
  Ouroboros component name and its role.
- Avoid hero headlines, slogans, hands, people, robots, market charts, gradients, dark backgrounds,
  nested UI cards, shadows, and decorative poster layouts.
- Keep in-image text short and exact. README prose and alt text remain the semantic authority.

## Deliverables

### 1. Ouroboros Function Structure

One wide functional overview with five readable groups:

```text
EXTERNAL SIGNALS
-> WORKFLOW ORCHESTRATION
-> CANDIDATE GENERATION
-> EXTERNAL EVALUATION
-> PERSISTED EVIDENCE
-> return to WORKFLOW ORCHESTRATION
```

Small Ouroboros mappings:

```text
EXTERNAL SIGNALS        MarketDataPort + Arena evidence
WORKFLOW ORCHESTRATION  RuntimeSupervisor; schedules bounded work
CANDIDATE GENERATION    CandidateArena + ResearchWorkerSession; proposes SystemCode
EXTERNAL EVALUATION     CandidateAdmissionDecision + PaperTradingEvaluation; decides what counts
PERSISTED EVIDENCE      Finding + Lineage + Gateway + Ledger; informs the next frontier
```

The image explains ownership, not every persisted record. It must make three facts visible:

1. Workflow orchestration observes market and Arena evidence.
2. RuntimeSupervisor decides which bounded Agent, Experiment, or Research workflow to start.
3. Only externally admitted work reaches paper evaluation, and its evidence returns to Operations.

### 2. Agentic Loop — Turn-based

```text
CONTEXT -> MODEL INFERENCE -> TOOL EXECUTION -> OBSERVATION -> CONTEXT
```

- Representative mode: `TURN-BASED`
- Small mapping: `ResearchWorkerSession`; one bounded provider session producing a candidate artifact
- Stop: `final output`, `max turns`, more context required, or terminal failure

### 3. Evaluation Loop — Goal-based

```text
SUCCESS CRITERIA -> ITERATION -> EVALUATION -> SELECTION -> SUCCESS CRITERIA
```

- Representative mode: `GOAL-BASED`
- Small mapping: `ResearchPreflightCommitment`; precommitted method, budget, submissions, and stop condition
- Small mapping: `SystemCode`; frozen candidate artifact selected explicitly before admission
- Stop: explicit selection, goal reached, budget exhausted, or fail-closed termination

### 4. Research Loop — Time-based

```text
CANDIDATE POPULATION -> EXTERNAL EVALUATION -> ARENA MEMORY -> NEXT GENERATION
```

- Representative mode: `TIME-BASED`
- Small mapping: `CandidateArena`; runs ResearchWorkers across ResearchDirections
- Small mapping: `Finding + Lineage`; retained evidence that informs the next generation
- Stop: bounded research window closes or the run is canceled

### 5. Operations: Orchestration Loop — Proactive

```text
SIGNAL -> WORKFLOW ORCHESTRATION -> BOUNDED RUN -> PERSISTED STATE -> NEXT WAKE
```

- Representative mode: `PROACTIVE`
- Small mapping: `RuntimeSupervisor`; reconciles CandidateArena, selected paper, and research scheduling
- `BOUNDED RUN` visibly offers `Agent workflow`, `Experiment workflow`, and `Research workflow`
- Operations is the outer loop that observes market/Arena signals and creates or reopens bounded
  Agent, Experiment, and Research work.
- It does not grant admission, paper rank, private exchange access, or live trading authority.

The four mode-to-scope pairings are representative explanatory matches, not exclusive runtime type
constraints. Ouroboros may start a scope from another persisted trigger when the product contract
allows it.

## README Integration

- Keep the section immediately after Quickstart.
- Use the function-structure image first.
- Follow with Agent, Experiment, Research, and Operations purpose images in that order.
- Remove the existing four standalone trigger images, four scope-cycle images, and short admission
  image from the final README sequence after the replacements pass review.
- Preserve natural prose for AI-driven quantitative trading, agentic research, quantitative strategy
  discovery, paper trading, market evidence, risk, findings, and lineage.
- Preserve the link to Anthropic's Loop Engineering article without implying an implementation
  dependency on Anthropic or Claude.

## Acceptance Checks

- Exactly five final project-referenced images.
- Every image has one primary explanatory purpose.
- All five images share the same approximate aspect ratio, scale, rounded-rectangle grammar,
  visual system, and typography.
- All in-image labels are correctly spelled and match this specification.
- Large concept labels remain readable at README width; smaller mappings identify an exact
  Ouroboros component and role without turning the figure into a component inventory.
- The structure image shows no path that bypasses admission before Paper Arena.
- The Operations image visibly selects or launches Agent, Experiment, or Research improvement from
  market/Arena evidence.
- README alt text and prose explain every image without requiring text extraction from the bitmap.
- Local image links, Markdown checks, repository guards, and `git diff --check` pass.
