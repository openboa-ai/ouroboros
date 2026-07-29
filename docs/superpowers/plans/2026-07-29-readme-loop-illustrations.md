# README Loop Illustrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current nine README diagrams with one Ouroboros function-structure image and four purpose-led loop images that pair Agent, Experiment, Research, and Operations with representative turn, goal, time, and proactive modes.

**Architecture:** Generate five project-bound PNGs through the built-in image generator, inspect every output, then crop each non-destructively to a consistent 1536x698 wide composition. Every loop uses a wide rounded-rectangle route rather than circles. Large labels use portable agent-system vocabulary; small labels bind each concept to exact Ouroboros components and roles. Keep the rejected v2 images until all replacements pass visual and text checks, then replace them atomically.

**Tech Stack:** Built-in image generation, PNG raster assets, macOS `sips`, Markdown, repository documentation guards.

## Global Constraints

- Use generated PNG artwork, not SVG.
- Final images are 1536x698 pixels, an approximately 2.2:1 landscape ratio.
- Use warm mist/off-white, `#17120F`, `#F37021`, and Inter-like sans-serif typography.
- Use orange only for active returns, admission, and focused signals.
- Use generous whitespace, restrained hand-ink lines, and one primary explanatory purpose per image.
- Use wide rounded-rectangle routes with softened corners. Do not use circular loop arrows or
  circular process nodes.
- Make portable agent-system concepts large and Ouroboros component/role mappings small.
- Do not use hero headlines, slogans, hands, people, robots, market charts, gradients, dark backgrounds, nested UI cards, shadows, or poster layouts.
- README prose and alt text remain authoritative when generated text is imperfect.
- The loop-to-mode mapping is representative, not an exclusive runtime constraint.
- Never show a path that bypasses admission before Paper Arena.
- Operations may choose and start bounded Agent, Experiment, or Research improvement, but it gains no admission, paper-rank, private, or live authority.

---

### Task 1: Generate the Ouroboros function-structure image

**Files:**
- Create: `docs/assets/ouroboros-system-structure-v3.png`
- Reference: `docs/superpowers/specs/2026-07-29-readme-loop-illustrations-design.md`
- Reference: `/Users/sangjoon/.codex/attachments/ed3508d3-bb79-4340-bbdd-28ba0a54865c/codex-clipboard-5cf639bf-1335-4302-846e-0803bd031e62.png`

**Interfaces:**
- Consumes: the user-provided image as a composition and scale reference, plus the repository design-system colors and typography.
- Produces: one visually approved 1536x698 PNG referenced by the README structure section.

- [x] **Step 1: Generate one high-resolution source image with the built-in image generator**

Use the attachment as a composition reference, not an edit target. Use this exact production prompt:

```text
Use case: infographic-diagram
Asset type: Ouroboros README engineering-blog architecture figure
Primary request: Explain the functional structure of Ouroboros in one calm horizontal workflow without enumerating every persisted record.
Input image: use the supplied wide Ouroboros evidence-loop image only for its approximately 2.2:1 composition, whitespace, line weight, and information scale.
Scene/backdrop: warm mist off-white #F8F7F5 with faint paper-like support shapes.
Style/medium: restrained editorial technical diagram, precise black ink #17120F, Inter-like sans-serif, one controlled orange #F37021. Rounded rectangles with generous corner radius; no circles.
Composition: five evenly spaced rounded-rectangle groups from left to right on one horizontal route. Draw one orange return path with rounded corners from the final group back to WORKFLOW ORCHESTRATION.
Large text verbatim: "EXTERNAL SIGNALS", "WORKFLOW ORCHESTRATION", "CANDIDATE GENERATION", "EXTERNAL EVALUATION", "PERSISTED EVIDENCE".
Small text verbatim: "MarketDataPort + Arena evidence", "Target composition · bounded workflow orchestration", "CandidateArena + ResearchWorkerSession · proposes SystemCode", "CandidateAdmissionDecision · admission gate", "PaperTradingEvaluation · prospective evidence", "Finding + Lineage + Gateway + Ledger · informs the next frontier", "CURRENT RUNTIME · RuntimeSupervisor reconciles selected paper · arena.start intent · research-study scheduler".
Authority rule: the only path into PaperTradingEvaluation passes through CandidateAdmissionDecision. CandidateAdmissionDecision is the admission gate; PaperTradingEvaluation is prospective evidence consumed by separate qualification, comparison, and promotion decisions. Target workflow orchestration chooses bounded work. The current RuntimeSupervisor is separately labeled with its three fixed lanes.
Constraints: one primary idea, large readable spacing, no node crowding, no bypass connection, orange only for the operations return and admission gate.
Avoid: headline, slogan, hands, people, robots, candlestick charts, currency, gradient, dark background, UI cards, 3D, shadow, logo, watermark.
```

- [x] **Step 2: Inspect the generated source image**

Open the generated source at original detail. Reject it unless all five functional groups are readable, Operations visibly selects the inner-improvement group, admission is on the only path into Paper Arena, and the evidence return ends at Operations.

- [x] **Step 3: Copy and crop the approved source into the repository**

Copy the approved generated PNG to `docs/assets/ouroboros-system-structure-v3.png`, then run:

```bash
sips --resampleWidth 1536 docs/assets/ouroboros-system-structure-v3.png
sips -c 698 1536 docs/assets/ouroboros-system-structure-v3.png
sips -g pixelWidth -g pixelHeight docs/assets/ouroboros-system-structure-v3.png
```

Expected: `pixelWidth: 1536` and `pixelHeight: 698` with no clipped label or arrow.

- [x] **Step 4: Keep or regenerate**

Keep the image only if topology, exact labels, crop, and palette pass. Otherwise regenerate with one targeted correction and repeat Steps 2-3.

### Task 2: Generate the four purpose-led loop images

**Files:**
- Create: `docs/assets/ouroboros-agentic-loop-v3.png`
- Create: `docs/assets/ouroboros-evaluation-loop-v3.png`
- Create: `docs/assets/ouroboros-research-loop-v3.png`
- Create: `docs/assets/ouroboros-orchestration-loop-v3.png`
- Reference: `docs/superpowers/specs/2026-07-29-readme-loop-illustrations-design.md`

**Interfaces:**
- Consumes: the approved structure image from Task 1 as the series style reference.
- Produces: four visually consistent 1536x698 PNGs, each with one loop, one representative mode, and one purpose.

- [x] **Step 1: Generate the Agent / Turn-based image**

```text
Use case: infographic-diagram
Asset type: Ouroboros README engineering-blog loop figure
Primary request: Explain one Agent Loop and why it repeats.
Style reference: match the approved Ouroboros system-structure image exactly in background, line weight, typography, spacing, and orange use.
Composition: one clockwise path around a wide soft rounded rectangle, never a circle. Large stages run left to right across the top and return along the bottom.
Large text verbatim: "AGENTIC LOOP", "TURN-BASED", "CONTEXT", "MODEL INFERENCE", "TOOL EXECUTION", "OBSERVATION".
Small text verbatim: "ResearchWorkerSession", "bounded provider session · candidate artifact", "stop · final output / max turns / terminal failure".
Color: black structure, orange return path from OBSERVATION to CONTEXT.
Constraints: one loop only, strong hierarchy between large portable terms and small Ouroboros mapping, large calm whitespace.
Avoid: other scopes, comparison grid, legend, headline, hands, people, robot, chart, logo, gradient, dark background, UI cards, shadow, 3D.
```

Inspect it at original detail. Reject misspelled labels, extra nodes, broken arrow order, or a poster-like layout.

- [x] **Step 2: Generate the Experiment / Goal-based image**

```text
Use case: infographic-diagram
Asset type: Ouroboros README engineering-blog loop figure
Primary request: Explain one Experiment Loop and why it repeats.
Style reference: match the approved Ouroboros system-structure image exactly in background, line weight, typography, spacing, and orange use.
Composition: one clockwise path around a wide soft rounded rectangle, never a circle. Large stages run left to right across the top and return along the bottom.
Large text verbatim: "EVALUATION LOOP", "GOAL-BASED", "SUCCESS CRITERIA", "ITERATION", "EVALUATION", "SELECTION".
Small text verbatim: "ResearchPreflightCommitment", "methodology · development + sealed-admission limits", "SystemCode · explicit frozen selection".
Color: black structure, orange return path from EVALUATION to SUCCESS CRITERIA. SELECTION is a
separate terminal node reached by one black arrow from EVALUATION and has no outgoing return.
Constraints: one loop only, one purpose only, large calm whitespace.
Avoid: other scopes, comparison grid, legend, headline, hands, people, robot, trading chart, logo, gradient, dark background, UI cards, shadow, 3D.
```

Inspect it at original detail. Reject misspelled labels, extra nodes, broken arrow order, or a poster-like layout.

- [x] **Step 3: Generate the Research / Time-based image**

```text
Use case: infographic-diagram
Asset type: Ouroboros README engineering-blog loop figure
Primary request: Explain one Research Loop and why it repeats.
Style reference: match the approved Ouroboros system-structure image exactly in background, line weight, typography, spacing, and orange use.
Composition: one clockwise path around a wide soft rounded rectangle, never a circle. Large stages run left to right across the top and return along the bottom.
Large text verbatim: "RESEARCH LOOP", "TIME-BASED", "CANDIDATE POPULATION", "EXTERNAL EVALUATION", "ARENA MEMORY", "NEXT GENERATION".
Small text verbatim: "CandidateArena", "ResearchWorker × ResearchDirection", "Finding + Lineage · retained research evidence".
Color: black structure, orange return path from NEXT GENERATION to CANDIDATE POPULATION.
Constraints: one loop only, one purpose only, large calm whitespace.
Avoid: agent details, experiment details, operations controls, paper-execution topology, comparison grid, legend, headline, hands, people, robot, market chart, logo, gradient, dark background, UI cards, shadow, 3D.
```

Inspect it at original detail. Reject misspelled labels, extra nodes, broken arrow order, or a poster-like layout.

- [x] **Step 4: Generate the Operations / Proactive meta-loop image**

```text
Use case: infographic-diagram
Asset type: Ouroboros README engineering-blog loop figure
Primary request: Explain Operations as the proactive outer loop that improves the other three loops.
Style reference: match the approved Ouroboros system-structure image exactly in background, line weight, typography, spacing, and orange use.
Composition: one clockwise path around a wide soft rounded rectangle, never a circle. Large stages run left to right across the top and return along the bottom. BOUNDED RUN contains three compact choices, not three new diagrams.
Large text verbatim: "ORCHESTRATION LOOP", "PROACTIVE", "TARGET COMPOSITION", "SIGNAL", "WORKFLOW ORCHESTRATION", "BOUNDED RUN", "PERSISTED STATE", "NEXT WAKE".
Small text verbatim: "market + Arena evidence", "target composition", "Agent workflow · Evaluation workflow · Research workflow", "CURRENT RUNTIME · RuntimeSupervisor", "fixed lanes · selected paper / arena.start intent / research-study scheduler", "checkpoint + attributable result".
Color: black structure, orange signal, selected-workflow marker, and final return path.
Authority rule: do not show Operations granting admission, paper rank, private access, or live authority.
Constraints: one meta-loop only; the three inner-loop names are choices inside one node, not three additional diagrams.
Avoid: full system pipeline, paper-arena topology, comparison grid, legend, headline, hands, people, robot, candlestick chart, logo, gradient, dark background, UI cards, shadow, 3D.
```

Inspect it at original detail. Reject it unless target market/Arena evidence visibly leads to
choosing Agent, Evaluation, or Research improvement, the result persists before the next wake,
and the current `RuntimeSupervisor` is separately described as reconciling three fixed lanes.

- [x] **Step 5: Copy and crop all four approved images**

Copy approved sources to the four declared v3 paths. For each file run the matching command:

```bash
sips --resampleWidth 1536 docs/assets/ouroboros-agentic-loop-v3.png
sips --resampleWidth 1536 docs/assets/ouroboros-evaluation-loop-v3.png
sips --resampleWidth 1536 docs/assets/ouroboros-research-loop-v3.png
sips --resampleWidth 1536 docs/assets/ouroboros-orchestration-loop-v3.png
sips -c 698 1536 docs/assets/ouroboros-agentic-loop-v3.png
sips -c 698 1536 docs/assets/ouroboros-evaluation-loop-v3.png
sips -c 698 1536 docs/assets/ouroboros-research-loop-v3.png
sips -c 698 1536 docs/assets/ouroboros-orchestration-loop-v3.png
sips -g pixelWidth -g pixelHeight docs/assets/ouroboros-agentic-loop-v3.png docs/assets/ouroboros-evaluation-loop-v3.png docs/assets/ouroboros-research-loop-v3.png docs/assets/ouroboros-orchestration-loop-v3.png
```

Expected: every file reports `pixelWidth: 1536` and `pixelHeight: 698`, with no clipped label or arrow.

### Task 3: Replace the README image narrative

**Files:**
- Modify: `README.md:110-205`
- Delete after replacement review: the five rejected untracked `*-v2.png` files.

**Interfaces:**
- Consumes: five approved images from Tasks 1-2.
- Produces: one Markdown-first explanation after Quickstart with five local image references and no superseded image references.

- [x] **Step 1: Rewrite the section around the five-image narrative**

Keep `## How Ouroboros composes loops` immediately after Quickstart. Use this order:

```text
AI-driven quantitative trading introduction
Ouroboros function structure image
Representative mode-to-scope mapping note
Agent Loop / Turn-based image and prose
Experiment Loop / Goal-based image and prose
Research Loop / Time-based image and prose
Operations Loop / Proactive meta-loop image and prose
Implementation-status boundary
```

State explicitly that Operations observes market and Arena evidence, chooses which bounded Agent,
Experiment, or Research improvement to start, persists its result, and waits for the next signal.
State explicitly that external admission and prospective paper evidence retain decision authority.

- [x] **Step 2: Verify local image references before deleting old project copies**

Run:

```bash
rg -o "docs/assets/[^)]+\.png" README.md
bash scripts/check-docs.sh
```

Expected: exactly five Ouroboros loop/structure image references in the new section and `Local markdown links OK`.

- [x] **Step 3: Remove only superseded project copies**

Delete the nine explicitly listed old PNGs after Step 2 passes. Do not delete generated-image originals under the Codex image directory or the user-provided attachment.

- [x] **Step 4: Run focused and repository-wide verification**

```bash
git diff --check
npm run check:repo-guards
```

Expected: no whitespace errors; Markdown links, docs baseline, architecture, naming, environment, and secret guards all pass.

- [x] **Step 5: Review final scope and commit**

```bash
git status --short
git diff -- README.md
git diff --stat
git add README.md docs/superpowers/specs/2026-07-29-readme-loop-illustrations-design.md docs/superpowers/plans/2026-07-29-readme-loop-illustrations.md docs/assets/ouroboros-system-structure-v3.png docs/assets/ouroboros-agentic-loop-v3.png docs/assets/ouroboros-evaluation-loop-v3.png docs/assets/ouroboros-research-loop-v3.png docs/assets/ouroboros-orchestration-loop-v3.png
git commit -m "docs: explain Ouroboros loops with focused diagrams"
```

Expected: the commit contains the README narrative, five final PNGs, and deletion of only the nine superseded project copies.
