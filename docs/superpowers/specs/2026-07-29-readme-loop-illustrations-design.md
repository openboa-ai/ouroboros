# README Loop Illustration Redesign

## Goal

Replace the current nine-image README sequence with five focused raster illustrations that explain
Ouroboros as an AI-driven quantitative trading system without turning one image into a dense poster.
The reference composition is the user-provided wide evidence-loop image: approximately 2.2:1,
calm, horizontal, and readable at README width.

## Visual System

- Use generated PNG artwork, not SVG.
- Target an approximately 2.2:1 landscape ratio and at least 1500 pixels of source width.
- Use the Ouroboros design contract: warm mist/off-white background, `#17120F` structure and type,
  `#F37021` only for active returns, gates, and focused signals, and an Inter-like sans-serif.
- Use the Anthropic loop article only as editorial guidance: generous whitespace, restrained
  hand-ink lines, faint paper-like support shapes, and one explanatory idea per image.
- Avoid hero headlines, slogans, hands, people, robots, market charts, gradients, dark backgrounds,
  nested UI cards, shadows, and decorative poster layouts.
- Keep in-image text short and exact. README prose and alt text remain the semantic authority.

## Deliverables

### 1. Ouroboros Function Structure

One wide functional overview with five readable groups:

```text
MARKET + ARENA SIGNALS
-> OPERATIONS META-LOOP
-> INNER IMPROVEMENT: RESEARCH / EXPERIMENT / AGENT
-> ADMISSION + PAPER ARENA
-> EVIDENCE MEMORY
-> return to OPERATIONS META-LOOP
```

The image explains ownership, not every persisted record. It must make three facts visible:

1. Operations observes market and Arena evidence.
2. Operations decides which bounded inner improvement loop to start.
3. Only externally admitted work reaches paper evaluation, and its evidence returns to Operations.

### 2. Agent Loop — Turn-based

```text
MODEL -> TOOL -> OBSERVATION -> MODEL
```

- Representative mode: `TURN-BASED`
- Purpose: `COMPLETE ONE BOUNDED TASK`
- Stop: task complete, more context required, or terminal failure

### 3. Experiment Loop — Goal-based

```text
HYPOTHESIS -> ARTIFACT -> MEASURE -> HYPOTHESIS
```

- Representative mode: `GOAL-BASED`
- Purpose: `LEARN WHICH CHANGE SURVIVES MEASUREMENT`
- Stop: explicit selection, goal reached, budget exhausted, or fail-closed termination

### 4. Research Loop — Time-based

```text
DIRECTION -> CANDIDATES -> EXTERNAL EVIDENCE -> MEMORY -> DIRECTION
```

- Representative mode: `TIME-BASED`
- Purpose: `IMPROVE THE NEXT CANDIDATE GENERATION`
- Stop: bounded research window closes or the run is canceled

### 5. Operations Loop — Proactive Meta-loop

```text
MARKET + ARENA SIGNAL
-> INSPECT EVIDENCE
-> CHOOSE AGENT / EXPERIMENT / RESEARCH IMPROVEMENT
-> RUN ONE BOUNDED INNER LOOP
-> PERSIST RESULT + NEXT WAKE
-> wait for the next signal
```

- Representative mode: `PROACTIVE`
- Purpose: `IMPROVE THE LOOPS THAT IMPROVE THE SYSTEM`
- Operations is the outer loop that creates or reopens bounded Agent, Experiment, and Research work.
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
- All five images share the same approximate aspect ratio, scale, visual system, and typography.
- All in-image labels are correctly spelled and match this specification.
- The structure image shows no path that bypasses admission before Paper Arena.
- The Operations image visibly selects or launches Agent, Experiment, or Research improvement from
  market/Arena evidence.
- README alt text and prose explain every image without requiring text extraction from the bitmap.
- Local image links, Markdown checks, repository guards, and `git diff --check` pass.

