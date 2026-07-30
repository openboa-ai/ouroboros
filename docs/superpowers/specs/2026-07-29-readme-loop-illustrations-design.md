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
WORKFLOW ORCHESTRATION  target composition; bounded workflow orchestration
CANDIDATE GENERATION    CandidateArena + ResearchWorkerSession; proposes SystemCode
EXTERNAL EVALUATION     CandidateAdmissionDecision; admission gate
                        PaperTradingEvaluation; prospective evidence
PERSISTED EVIDENCE      Finding + Lineage + Gateway + Ledger; informs the next frontier
```

The image explains the target composition, not every persisted record or an already implemented
generic scheduling policy. It must make four facts visible:

1. Target workflow orchestration can observe market and Arena evidence.
2. Candidate generation, admission authority, and prospective paper evidence remain distinct.
3. Only externally admitted work reaches paper evaluation, and its evidence informs the next frontier.
4. The current `RuntimeSupervisor` reconciles three fixed persisted lanes: selected paper,
   `arena.start` intent, and research-study scheduling.

### 2. Agentic Loop — Turn-based

```text
CONTEXT -> MODEL INFERENCE -> TOOL EXECUTION -> OBSERVATION -> CONTEXT
```

- Representative mode: `TURN-BASED`
- Small mapping: `ResearchWorkerSession`; one bounded provider session producing a candidate artifact
- Stop: `final output`, enforced session timeout, more context required, or terminal failure

### 3. Evaluation Loop — Goal-based

```text
SUCCESS CRITERIA -> ITERATION -> EVALUATION
                       ^              |
                       +--------------+
                                      |
                                      +-> terminal SELECTION
```

- Representative mode: `GOAL-BASED`
- Small mapping: `ResearchPreflightCommitment`; declared methodology plus development and
  sealed-admission suite identities, submission limits, and feedback-release policies
- Small mapping: `SystemCode`; frozen candidate artifact selected explicitly before admission
- Stop: explicit selection or no submission is terminal; budget exhaustion or fail-closed
  termination also closes the session

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
- The illustrated generic workflow choice is a target composition, not current runtime policy
- Small mapping: current `RuntimeSupervisor`; reconciles selected paper, persisted `arena.start`
  intent, and research-study scheduling as fixed lanes
- `BOUNDED RUN` visibly offers `Agent workflow`, `Evaluation workflow`, and `Research workflow`
- Target Operations is the outer loop that observes market/Arena signals and creates or reopens
  bounded Agent, Evaluation, and Research work.
- It does not grant admission, paper rank, private exchange access, or live trading authority.

The four mode-to-scope pairings are representative explanatory matches, not exclusive runtime type
constraints. Ouroboros may start a scope from another persisted trigger when the product contract
allows it.

## README Integration

- Keep the section immediately after Quickstart.
- Use the function-structure image first.
- Follow with Agentic, Evaluation, Research, and Operations purpose images in that order.
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
- The target Operations image visibly selects or launches Agentic, Evaluation, or Research
  improvement from market/Arena evidence, while the current `RuntimeSupervisor` remains separately
  labeled with its three fixed lanes.
- README alt text and prose explain every image without requiring text extraction from the bitmap.
- Local image links, Markdown checks, repository guards, and `git diff --check` pass.
