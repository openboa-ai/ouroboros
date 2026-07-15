# Ouroboros Doctrine

Ouroboros is not a trading dashboard and not a one-shot AI trading bot generator. It connects
continuously improving external AI agents to a trading problem with externally recorded economic
outcomes, then forces their ideas through `CandidateArena` search, research-time preflight, and
selected continuous paper trading evaluation.

Trading must be made outcome-gradable under a precommitted evaluation protocol. Raw PnL remains
economic accounting, not self-sufficient proof of strategy quality.

```text
parallel TradingSystem candidates
-> pre-effect ResearchPreflightCommitment
-> bounded development replay/backtest feedback
-> frozen one-shot rotating sealed admission
-> external PaperTradingHandoffConformance
-> CandidateAdmissionDecision and materialization
-> leaderboard
-> findings and lineage
-> next generation
-> selected continuous paper trading evaluation
```

Name the boundary plainly: `ResearchPreflight` is replay, backtest, or simulation used while
creating candidates; `PaperTradingEvaluation` is selected-candidate paper trading over live public
market data, scored by accumulated `revenue - cost`. `PaperTradingHandoffConformance` sits between
them as external research-only proof that the exact submitted artifact satisfies the bounded target
paper event protocol before admission and generated-candidate paper start.

## Doctrine Tree

1. Core Bet
   - AI agents improve over time.
   - Codex, Claude Code, Gemini-powered agents, and future providers are external intelligence
     supply.
   - Ouroboros should get better as those agents get better without changing the core loop.

2. Problem Lens
   - Choose problems that are hard, dynamic, adversarial, and externally evaluable.
   - Trading fits because market behavior changes, but candidate output can still be scored by
     `revenue - cost`, `net_revenue_usdt`, return, costs, risk, and continuous paper evidence.
   - Trading outcomes are noisy, path-dependent, and non-stationary. A clear economic score only
     supports agent hill-climbing when the evidence purpose, candidate identity, comparison policy,
     and prospective window are committed before results are known.

3. Method
   - Generate many candidates, not one best bot.
   - Use replay, backtest, and simulation as research-time tools for candidate creation, sanity
     checks, and preflight rejection.
   - Commit allocation, source identity, development budget, and an evaluator-owned rotating sealed
     set before worker effects. Let development feedback guide artifact selection, then freeze one
     artifact before its only sealed admission submission.
   - Require exact external paper handoff conformance before a new candidate can claim runnable
     handoff; do not turn compatibility into economic or qualification evidence.
   - Rank by selected-candidate paper trading performance once a candidate enters the paper
     runtime. Preserve `Finding` records and lineage, then feed that memory into the next
     generation.
   - Losing candidates are still useful unless they crash, are malformed, fail risk validation,
     bypass provider boundaries, or attempt private/live behavior.

4. TradingSystem Shape
   - A TradingSystem is an executable candidate system, not just a code file.
   - TradingSystem may include an internal agent runtime, deterministic code, rules, model calls,
     tools, strategy logic, risk logic, and execution logic.
   - TradingSystem owns its own decision cadence. It may decide on timers, market events, tool
     results, internal agent loops, or explicit risk gates.
   - Whatever its internals, it must emit bounded, validated `OrderRequest`s and remain externally
     evaluated.

5. Evaluation Boundary
   - Researcher can generate candidates.
   - Researcher cannot grade.
   - Candidate cannot grade itself.
   - Replay/backtest is a research tool, not final evaluation authority.
   - ResearchWorker-visible notebooks and prompts may contain bounded aggregate development
     feedback, but not sealed seed, scenarios, outcomes, score deltas, raw events, or evaluator
     internals. Process loss closes that commitment rather than resampling it.
   - Replay success cannot self-certify the target paper runtime. Exact submitted-artifact
     conformance is externally evaluated and revalidated before generated paper effects.
   - Generated single-file Python SystemCode identity covers its frozen manifest and sole editable
     entrypoint. Undeclared files, directories, symlinks, or manifest drift cannot remain outside
     candidate freeze evidence.
   - Continuous paper trading is the evaluation authority for the product loop because living
     TradingSystems may use current market state, news, social data, tools, and internal agents that
     old static data cannot faithfully grade.
   - Binance public market data enters through the Gateway `MarketDataPort`, not through the
     TradingSystem. The latest market snapshot is evidence and an input source, not the clock that
     decides when a trade must happen.
   - Paper observations are checkpoint/readback events over a running TradingSystem. They refresh
     market evidence, consume newly emitted `OrderRequest`s, record Gateway validation and fake
     execution when orders exist, and otherwise record a valid no-order checkpoint.
   - A paper observation must not synthesize a decision merely because a snapshot was read.
   - Paper evaluation is sealed from candidate self-report, generated comments, provider optimism,
     and hidden authority.

6. Promotion Boundary
   - Gateway binding changes, TradingSystem identity does not.
   - Paper to live should change execution authority, account binding, and destination, not mutate
     the candidate that earned evidence.
   - Same candidate shape, different execution authority. Live remains disabled until a future repo
     issue explicitly enables it.

7. UX Boundary
   - Candidate, Paper Evidence, and Live are separate states.
   - Candidate means generated artifact or executable system with no execution authority.
   - `PaperEvidence` means selected-candidate proof through continuous fake account, fake executor,
     Gateway, and Ledger.
   - The selected paper evidence state is a visible readback of paper Ledger proof, not the whole
     evaluation loop and not live promotion.
   - Live means real authority and is outside the current product boundary.
   - `Start paper trading` is proof gathering, not live promotion.

8. Non-Negotiables
   - Do not collapse the arena into one-best-artifact editing.
   - Do not treat generated code, model output, or provider self-report as proof.
   - Do not treat replay/backtest results as final trading performance.
   - Do not imply paper success grants live authority.
   - Do not let architecture patterns obscure the simple loop: generate many, preflight quickly,
     paper trade selected candidates continuously, keep memory, repeat.

## Reference Lineage

| Reference | Doctrine contribution |
| --- | --- |
| Anthropic AAR | long-running parallel researchers, broad directions, external evaluation, shared findings and code lineage, plus explicit reward-hacking and holdout pressure |
| AlphaEvolve | code candidates plus evaluator plus evolutionary improvement |
| AlphaProof Nexus | unreliable generation made useful by verification and search |
| Weak-to-strong | stronger capability elicited through scalable evaluation |
| Agentic SDLC / factory model | tests, evals, context, harness, and human judgment as the production boundary around agent output |
| The New SDLC With Vibe Coding | shift from ad-hoc prompting to agentic engineering through context, skills, harnesses, evals, and human judgment |
| Codex, Claude Code, Gemini agents | external improving agent labor |
| Ouroboros | apply the pattern to trading, where continuous paper `revenue - cost` is the score |

These references are design pressure, not transferred proof. In particular, Anthropic AAR supports
the usefulness of parallel researchers, external evaluation, memory, and adversarial evaluator
thinking in its studied setting; it does not establish trading profitability, economic
generalization, evaluator security, or autonomous production readiness for Ouroboros. The repo must
prove those claims independently with prospective evidence and explicit controls.

## References

- [Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)
- [AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)
- [AlphaEvolve paper](https://arxiv.org/abs/2506.13131)
- [Advancing Mathematics Research with AI-Driven Formal Proof Search](https://arxiv.org/html/2605.22763v1)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [The New SDLC With Vibe Coding](https://drive.google.com/file/d/1IR7CddF_2FyQo_PdfBNTaEA50EGiVt2r/view)
- [Weak-to-strong generalization](https://openai.com/index/weak-to-strong-generalization/)
- [Introducing Codex](https://openai.com/index/introducing-codex/)
