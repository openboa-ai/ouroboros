# MLP-01 Brief

## Purpose

This is the one-document contract for the first lovable autokairos product.

## One-Sentence Promise

**autokairos is an automated weak-to-strong trader: a control plane for evolving agent-built
trader-system pods across backtest, paper, and live bindings.**

MLP-01 proves that first for one serious solo crypto operator on Binance BTC perpetual futures.

## Product Contract

MLP-01 does not prove "AI can write one trading idea."

It proves:

```text
small pool of TraderSystemCandidates
-> one candidate becomes durable
-> the same candidate artifact runs under backtest/paper/live bindings
-> external evidence decides progression
-> one candidate is promoted into bounded live operation
-> the operator can intervene without becoming the runtime
```

The first lovable proof is one promoted trader-system pod, not a static note.

## Primary User

The first user is a serious solo crypto operator who:

- trades real capital
- wants autonomous leverage from agent-built trader systems
- cannot manually supervise every candidate run
- needs evidence and promotion to be external and legible
- will accept live autonomy only through explicit limits and decisive intervention

## Core Job

Help a weak human supervisor create, evaluate, promote, and control one stronger trader-system
candidate without becoming the continuous runtime.

## Lovable Moment

The operator sees a candidate system move through a credible trust chain:

- a trader-system candidate is created by an external agent harness
- its `TradingSystemImage` and `CapabilityPackage` references are durable
- its agent runtime unit and communication boundaries are inspectable enough to know what is
  actually running
- it runs in a backtest binding without changing identity
- evidence is judged outside the pod
- promotion makes the live binding meaningful
- the live pod acts within an autokairos gateway, not with unrestricted exchange access
- wake/intervention preserves control

The operator should feel:

> this is not a disposable AI idea; this is a candidate trading system I can evaluate, promote, and
> control.

## Locked Product Decisions

| Decision area | Locked answer | Why it is locked |
| --- | --- | --- |
| Product category | automated weak-to-strong trader | Keeps the brand anchored in weak supervision and stronger systems |
| Product form | trader-system control plane | Prevents drift into dashboard, notebook, or generic agent shell |
| Candidate identity | `TraderSystemCandidate` | Candidate is the system under judgment, not a strategy note |
| Execution unit | `TradingSystemPod` | Same artifact runs under different bindings |
| First ICP | serious solo crypto operator | Strongest pain with lowest coordination overhead |
| First market | Binance BTC perpetual futures | Narrow, liquid, legible first live wedge |
| Candidate pool | small pool | Proves selection/evaluation without full portfolio scope |
| Capability model | versioned `CapabilityPackage` artifacts | Enables future sharing/marketplace without putting secrets in packages |
| Live authority | bounded agent through autokairos gateway | Agent can reason; gateway controls execution |
| Self-evolution | clone -> evaluate -> promote | Prevents silent live mutation |
| Human gate | per-candidate live deployment | One serious gate before bounded live autonomy |

## Core Objects

| Object | Meaning |
| --- | --- |
| `TraderSystemCandidate` | promotable candidate trading system |
| `TradingSystemImage` | versioned artifact for the system's brain/team contract and trading behavior |
| `CapabilityPackage` | packageable context/tool/skill/data-access artifact |
| `StageBinding` | backtest, paper, or live execution binding |
| `TradingSystemPod` | stage-bound execution instance of the candidate system |
| `AgentRuntimeUnit` | one brain/hands/session participant inside or beside a pod |
| `BrainSession` | provider or harness session for model reasoning and coordination |
| `HandsEnvironment` | tools, sandbox, data, gateway, and side-effect environment |
| `ToolProxy` | authority boundary between agent requests and real tools |
| `PodCommunicationPolicy` | one unified communication, sharing, routing, and isolation policy for all agent runtime units in a pod |
| `TeamTrace` | durable trace of multi-agent task, message, and artifact exchange |
| `EvidenceRecord` | externally judged evidence |
| `PromotionDecision` | governance decision that changes candidate standing |

## Hard Constraints From Sources

### AAR / Automated W2S

- evaluation is the bottleneck, not idea count
- weak human supervision must be compensated by external scoring and explicit progression
- agent self-report cannot define what counted

### automated-w2s-research

- local convenience and legitimate evaluation are different modes
- evaluator truth must sit outside the worker environment
- candidate systems should run in isolated environments when evidence is meant to count

### Claude Managed Agents

- split `brain`, `hands`, and `session`
- treat agent config as versioned
- treat environment as a template, not identity
- stream and preserve events outside the active model context
- inject files, memory, tools, and credentials through explicit resources
- use provider-native multiagent only as a managed-team reference, not as a hard MLP dependency

### Google A2A

- use A2A as the reference for communication between independent agent endpoints
- keep MCP/tool-proxy style access for tools, resources, data, and side effects
- keep provider selection on `AgentRuntimeUnit`, so one pod can mix Codex, Claude Code, Claude
  Managed Agents, OpenClaw/ACP, or future providers
- keep `PodCommunicationPolicy` provider-neutral and unified across the pod
- treat A2A tasks, messages, and artifacts as traceable communication, not counted evidence or
  promotion authority
- prevent multi-agent pods from becoming uncontrolled meshes by requiring explicit
  `PodCommunicationPolicy`

### Paperclip

- approval, wake, intervention, and audit are product value
- operator control must be visible, not hidden in backend operations

## Explicit Non-Goals

MLP-01 is not:

- a full marketplace
- a full Kubernetes clone
- a general agent platform
- a multi-venue product
- a direct-agent exchange access system
- a manual strategy authoring workflow
- an uncontrolled multi-agent mesh
- a hard dependency on A2A or Claude Managed Agents multiagent in the first cut
- a product that treats rubric outcomes or agent self-critique as trading evidence

## Success Criteria

MLP-01 succeeds if:

- one small candidate pool can produce one durable `TraderSystemCandidate`
- the candidate's image and capability package references are inspectable
- the same candidate can run through backtest/paper/live bindings without becoming a new object
- counted evidence is produced outside the pod
- one candidate reaches bounded live trading on Binance BTC perpetual futures
- the operator can inspect, pause, stop, or override without becoming the runtime loop

## Rejection Criteria

MLP-01 fails if:

- the product still reads as one idea moving through a workflow rather than a
  trader-system candidate being packaged, evaluated, promoted, and controlled
- capability/context/tool injection is buried inside candidate text
- live authority is direct and unbounded inside an agent harness
- evidence depends on agent self-report or hidden operator judgment
- self-evolution mutates the live system in place
- the first wedge expands into full marketplace, full platform, or full venue breadth before one pod
  proof lands

## What Downstream Docs May Not Change

Downstream docs may not silently change:

- `Candidate` meaning as `TraderSystemCandidate`
- `TradingSystemPod` as the execution unit
- `CapabilityPackage` as a versioned artifact boundary
- `AgentRuntimeUnit` as the agent participant boundary inside or beside a pod
- `PodCommunicationPolicy` as the explicit boundary for multi-agent communication
- backtest/paper/live as bindings for the same artifact
- external evaluator ownership of counted evidence
- bounded live authority through autokairos gateway
- clone/evaluate/promote as the self-evolution path
- first user and first market

## Read Next

1. [01-problem-jtbd-and-value.md](01-problem-jtbd-and-value.md)
2. [02-journey-map.md](02-journey-map.md)
3. [03-story-map-and-release-slices.md](03-story-map-and-release-slices.md)
4. [prds/README.md](prds/README.md)
