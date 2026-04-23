# Containerized Execution

This page defines how autokairos should use containers as part of its execution architecture.

It follows:

- [05-agent-execution-architecture.md](05-agent-execution-architecture.md)
- [03-staged-evaluation.md](03-staged-evaluation.md)
- [04-boundaries.md](04-boundaries.md)
- [../sources/library/repo-safety-research-automated-w2s-research.md](../../sources/library/repo-safety-research-automated-w2s-research.md)
- [../sources/synthesis/evaluation-governance-and-promotion.md](../../sources/synthesis/evaluation-governance-and-promotion.md)

## Thesis

autokairos should treat containerization as more than deployment convenience.

For execution that is meant to count as legitimate staged evidence, the bounded workspace should be
container-backed by default.

The core lesson from the W2S implementation is not merely "Docker is useful." It is:

- local subprocess execution is convenient but weakly trustworthy
- containerized execution creates a stronger legitimacy boundary
- cloud execution can extend the same container model outward

autokairos should preserve that distinction.

## Why This Spec Exists

This spec exists to answer one question:

**how should autokairos use containers so execution legitimacy is stronger than raw host-local
convenience?**

## Why Containers Matter Here

The execution architecture already says that workspaces are bounded execution surfaces rather than
sources of truth. Containers make that statement operational.

Containers give autokairos a practical way to control:

- filesystem visibility
- tool and connector exposure
- stage-specific mount policy
- network posture
- process isolation
- non-root execution posture

That is exactly what the W2S repo uses local Docker mode for: not speed alone, but legitimacy.

## Legitimacy Levels

autokairos should distinguish three execution-environment legitimacy levels.

1. `host-local`
2. `containerized-local`
3. `containerized-remote`

These are not the same as `backtesting`, `paper`, and `live`. They are execution-environment
levels that can support those stages differently.

### 1. Host-local

Host-local execution is the weakest legitimacy mode.

Use it for:

- quick debugging
- harness iteration
- runtime development

Do not treat it as default promotable evidence.

This directly follows the W2S repo, which states that local subprocess mode may not be legitimate
because the worker can reach labels.

### 2. Containerized-local

Containerized-local execution should be the default serious mode for local development and
evaluation.

Use it for:

- most `backtesting`
- most `paper`
- reproducible execution while still on local hardware

This is the autokairos equivalent of the W2S repo's `Local Docker` mode.

### 3. Containerized-remote

Containerized-remote execution extends the same worker-image model into a remote environment.

Use it for:

- parallel candidate sweeps
- expensive backtests
- paper fleets
- controlled remote live-adjacent operations if later justified

This is the autokairos equivalent of the W2S repo's `RunPod` pattern: the image stays the same,
but orchestration, artifact transport, and supervision move outward.

## Default Rule

The default autokairos rule should be:

- host-local is for convenience
- containerized-local is for legitimate local runs
- containerized-remote is for scalable legitimate runs

This means `host-local` should not silently become the same thing as a stage-valid run.

## Container As Workspace Host

In autokairos, the bounded workspace should normally be hosted inside a container.

That means:

- the control plane resolves `StageBinding`
- the runtime bridge selects a worker image
- the container starts with a prepared mount set
- the runtime session executes inside that container-backed workspace

The container is not the source of truth.

It is the host for the bounded workspace.

## Mount Policy

The W2S repo is especially useful here because it treats visibility as the core question.

autokairos should define container mount policy explicitly.

### Inputs

Inputs should be mounted or materialized intentionally:

- candidate-specific instructions
- stage-specific tool surfaces
- datasets or market data views
- prior approved artifacts that are safe to expose

### Restricted inputs

Some material must remain outside the container unless the stage explicitly permits it:

- promotion decisions
- evaluator secrets
- approval credentials
- raw ground truth not meant for the current run
- privileged live connector secrets

### Outputs

Outputs should land in container-visible output locations, but then be extracted into external
trace and artifact stores.

The container should not be the only place they exist.

## Image Strategy

autokairos should prefer a stable worker-image strategy.

### The worker image should contain

- the runtime binary or client
- baseline dependencies needed for the stage
- a non-root execution user
- standard bootstrap and entrypoint logic
- common filesystem locations for inputs, outputs, and traces

### The worker image should not contain

- stage-valid durable truth
- approval state
- promotion history
- the only copy of candidate state

The W2S repo is useful here because it uses the same image idea across local Docker and RunPod.
autokairos should copy that posture, even if it uses different infrastructure.

## What This Spec Is Not

This spec is not:

- a Dockerfile
- a compose file contract
- the full runtime-bridge interface
- a complete secret-management policy

## Non-Root Execution

The W2S Dockerfile explicitly avoids running Claude Code as root.

autokairos should adopt the same default:

- containerized execution should run as a non-root user
- mounted workspaces should be writable by that user where necessary
- privileged host access should not be granted by default

This is not just Linux hygiene. It is part of the execution trust boundary.

## Container Lifecycle

The runtime bridge should treat containers as cattle, not pets.

Container lifecycle should look like this:

1. select worker image
2. materialize mount set
3. start container
4. bootstrap workspace
5. attach runtime session
6. stream trace outward
7. stop and discard container or archive limited artifacts

The container may survive long enough for a session continuation, but the architecture should not
depend on one specific container instance being immortal.

## Stage Interaction

Containerization does not replace stages. It supports them.

### Backtesting

Backtesting should usually run in `containerized-local` or `containerized-remote` mode.

The container can expose:

- replay data
- simulation tools
- strategy code

without exposing higher-stage secrets.

### Paper

Paper should also default to containerized execution.

The container can expose:

- mock or simulated execution connectors
- current market data
- approval interaction surfaces if needed

without exposing real-money credentials directly.

### Live

Live may still use containerized execution, but its binding rules must be stricter.

The important point is that `live` should not imply "run directly on the host with every secret
available." It should still be a bounded execution surface, only with stronger stage bindings and
more tightly governed side effects.

## Execution-Mode Table

| Mode | Main purpose | Trust posture | Typical use |
| --- | --- | --- | --- |
| `host-local` | debugging and iteration | weak legitimacy | runtime development, harness debugging |
| `containerized-local` | local legitimate runs | strong local legitimacy | backtesting, paper, evaluation runs |
| `containerized-remote` | scalable legitimate runs | strong remote legitimacy | parallel sweeps, remote workers, expensive evaluations |

## Failure Modes / Invariants

The key invariants are:

- containerization is a legitimacy boundary, not only a packaging choice
- promotable execution must be distinguishable from convenience execution
- the container hosts the workspace but does not become the source of truth

The design is failing if:

- host-local debug runs are treated as equivalent to serious staged runs
- worker images silently contain durable governance truth
- the only copy of outputs remains inside a container
- compose becomes the system contract instead of a convenience layer

## Design Consequence

If autokairos follows this document, then:

1. the bounded workspace becomes concretely enforceable
2. local convenience mode is clearly separated from promotable execution
3. the same image model can support both local and remote execution
4. stage legitimacy can build on top of execution legitimacy instead of assuming it
5. later runtime-bridge interfaces can target container-backed workspaces directly

## Relationship To Adjacent Specs

This spec depends on:

- [03-staged-evaluation.md](03-staged-evaluation.md)
- [05-agent-execution-architecture.md](05-agent-execution-architecture.md)

It is operationalized by:

- [07-runtime-bridge-interface.md](07-runtime-bridge-interface.md)
