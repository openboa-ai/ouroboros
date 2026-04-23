# Source Note: safety-research/automated-w2s-research

## Source

- Title: `safety-research/automated-w2s-research`
- Primary URL: [https://github.com/safety-research/automated-w2s-research](https://github.com/safety-research/automated-w2s-research)
- Source type: implementation repository
- Checked: `2026-04-18`
- Research scope:
  - root `README.md`
  - `Dockerfile`
  - `entrypoint.sh`
  - `scripts/docker-build-push.sh`
  - repository structure shown in the README
  - execution mode descriptions in the README

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | W2S framing, environment setup, baselines | establishes benchmark and external-evaluation model |
| `README.md` | repo root readme | `Automated Researcher` and execution modes | clarifies trust boundaries across local/Docker/RunPod |
| `README.md` | repo root readme | dashboard responsibilities and project structure | identifies server/control surfaces vs agent loop |
| `Dockerfile` | container build spec | runtime image, non-root user, Claude CLI install, plugin setup, code staging | clarifies what the repo treats as the legitimate worker image |
| `entrypoint.sh` | container entrypoint | workspace copy, permission fixing, non-root execution, git update option | clarifies container lifecycle and workspace bootstrap |
| `scripts/docker-build-push.sh` | operational script | image build, publish flow, local GPU run example | clarifies how Docker is operationalized for local and cloud modes |

## What This Source Is

This repository is the released implementation companion to Anthropic's automated W2S research. It
is one of the clearest concrete references in the source set for an external evaluator, multiple
execution legitimacy levels, and a shared findings surface separate from the active agent loop.

## Core Thesis

- Automated W2S research needs a sandboxed system, not only a prompt and a model.
- Evaluation should remain server-side, with ground truth hidden from the agent.
- Execution mode changes trustworthiness, not only deployment convenience.
- Docker is not just packaging here; it is the first legitimacy boundary above raw local execution.
- Findings sharing, experiment management, and scoring are separate concerns from the internal
  agent loop.
- The system explicitly distinguishes debugging convenience from legitimate experimental setup.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Dashboard / server` | central Flask service for launching runs, monitoring them, serving evaluation, and hosting findings | `README.md`, `Automated Researcher` |
| `Evaluation API` | returns PGR while keeping ground truth server-side | `README.md`, `Automated Researcher` and data-prep sections |
| `Local subprocess mode` | easiest but not fully trustworthy because labels are reachable | `README.md`, `Mode A: Local (subprocess)` |
| `Local Docker mode` | isolated single-agent local mode with restricted mounts | `README.md`, `Mode B: Local Docker` |
| `RunPod mode` | cloud deployment with S3-backed artifacts and multiple concurrent pods | `README.md`, `Mode C: RunPod` |
| `Worker image` | shared Docker image used for both local Docker and RunPod execution | `README.md`, `Mode B/C`; `Dockerfile`; `scripts/docker-build-push.sh` |
| `Container bootstrap` | entrypoint that prepares `/workspace`, sets permissions, copies code, and drops to a non-root user | `entrypoint.sh` |
| `Findings forum` | shared surface for workers to publish/read findings | `README.md`, dashboard description |
| `Ideas` | concrete W2S method implementations under `w2s_research/ideas/` | `README.md`, `Create your own idea` and project structure |

### Architectural Reading

- The authoritative evaluator lives in the server/dashboard layer, not in the worker.
- The repo makes legitimacy a first-class property of execution mode.
- The agent-facing workspace is intentionally weaker than the server's full knowledge.
- Docker is treated as the first serious isolation boundary; cloud execution then extends the same image model outward.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| the README says `data/` is what the automated researcher sees and that ground truth is held server-side through the evaluation API | `README.md`, data preparation section |
| the dashboard server is required in all execution modes | `README.md`, `Start the dashboard (required for all modes)` |
| the dashboard provides experiment management, an evaluation API, a leaderboard, and a findings forum | `README.md`, dashboard description |
| local subprocess mode is explicitly described as potentially illegitimate because the AAR can find labeled data | `README.md`, `Mode A: Local (subprocess)` |
| local Docker mode is justified as isolation: only `data/` and read-only cached artifacts are visible | `README.md`, `Mode B: Local Docker` |
| RunPod mode adds S3 artifact syncing, pod monitoring, and concurrent cloud execution | `README.md`, `Mode C: RunPod` |
| findings are synced between workers in RunPod mode | `README.md`, RunPod description |
| the project structure separates core training, ideas, research loop, tools, web backend, and infrastructure | `README.md`, `Project Structure` |
| the same Docker image is used for both local Docker mode and RunPod mode | `README.md`, `Mode B: Local Docker` |
| the Dockerfile installs Claude Code, a specific plugin, Python dependencies, and stages the repo under `/opt/automated-w2s-research` before copying it into `/workspace` at container start | `Dockerfile` |
| the Dockerfile explicitly creates a non-root `ubuntu-cmd` user and notes that Claude Code should not run as root in this setup | `Dockerfile` |
| the entrypoint copies the repo into `/workspace/automated-w2s-research`, fixes permissions, optionally pulls latest git state, and always executes as the non-root user | `entrypoint.sh` |
| the build script documents a local GPU Docker invocation with mounted `data/` and `results/` directories | `scripts/docker-build-push.sh` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `PGR` | performance gap recovered | opening framing | external success metric |
| `idea` | concrete W2S method implementation | `Create your own idea`, project structure | main experimental unit |
| `execution mode` | trust boundary plus deployment style | `Mode A/B/C` | stronger than mere runtime choice |
| `local Docker mode` | first isolated local legitimacy mode | `Mode B` | containerization as an evaluation boundary |
| `evaluation API` | scoring interface that keeps ground truth server-side | dashboard and data-prep sections | authoritative external truth surface |
| `findings forum` | cross-agent knowledge-sharing surface | dashboard description | shared memory layer outside a single run |
| `RunPod` | cloud execution environment for parallel pods | `Mode C` | scalable isolated execution mode |
| `worker image` | Docker image that standardizes the worker runtime across local and cloud execution | `Mode B/C`, `Dockerfile` | execution-environment primitive |
| `/workspace` | mounted runtime workspace that is populated at container start | `entrypoint.sh` | bounded execution surface |

## Transferable Lessons

- Separate evaluator, launcher, and findings surfaces from the agent loop.
- Make execution legitimacy explicit instead of assuming every run is equally trustworthy.
- Keep ground truth or authoritative scoring outside the worker sandbox.
- Treat shared findings as a distinct systems primitive.
- Use execution modes to distinguish debugging convenience from trusted evaluation.
- Use containerization as a legitimacy boundary, not only as an ops convenience.
- Keep the worker image consistent across local isolated mode and more scalable remote execution.
- Prefer non-root execution and explicit workspace copying/mounting over giving the agent raw host access.

## Non-transferable Baggage

- The repo is highly specific to W2S research and ML-training infrastructure.
- PGR, data format, and the benchmark setup are domain-specific.
- The specific Docker/RunPod/S3 stack is illustrative, not universally required.
- The concrete image contents, Claude-specific CLI/plugin setup, and RunPod assumptions are implementation-specific.

## Open Questions / Tensions

- How should downstream systems signal that a convenient local mode is no longer trustworthy enough
  for promotion?
- Which findings-sharing features are essential versus dashboard UX niceties?
- How much infrastructure is enough before a research environment becomes too heavy to iterate on?
- What is the right balance between evaluator secrecy and useful feedback to the agent?
- Which parts of container isolation are essential to legitimacy, and which are just operational detail?
