# Ouroboros Doctrine

Ouroboros is not a trading dashboard and not a one-shot AI trading bot generator. It connects
continuously improving external AI agents to an outcome-gradable trading problem, then forces their
ideas through `CandidateArena` search, external Evaluation, and selected paper evidence.

```text
parallel TradingSystem candidates
-> external Evaluation
-> leaderboard
-> findings and lineage
-> next generation
-> selected paper evidence
```

## Doctrine Tree

1. Core Bet
   - AI agents improve over time.
   - Codex, Claude Code, Gemini-powered agents, and future providers are external intelligence
     supply.
   - Ouroboros should get better as those agents get better without changing the core loop.

2. Problem Lens
   - Choose problems that are hard, dynamic, adversarial, and objectively gradable.
   - Trading fits because market behavior changes, but candidate output can still be scored by
     `revenue - cost`, `net_revenue_usdt`, return, costs, risk, and paper evidence.
   - A hard problem with a clear score is where agent hill-climbing can compound.

3. Method
   - Generate many candidates, not one best bot.
   - Evaluate externally, rank on a leaderboard, preserve `Finding` records and lineage, then feed that
     memory into the next generation.
   - Losing candidates are still useful unless they crash, are malformed, fail risk validation,
     bypass provider boundaries, or attempt private/live behavior.

4. TradingSystem Shape
   - A TradingSystem is an executable candidate system, not just a code file.
   - TradingSystem may include an internal agent runtime, deterministic code, rules, model calls,
     tools, strategy logic, risk logic, and execution logic.
   - Whatever its internals, it must emit bounded, validated `OrderRequest`s and remain externally
     evaluated.

5. Evaluation Boundary
   - Researcher can generate candidates.
   - Researcher cannot grade.
   - Candidate cannot grade itself.
   - External Evaluation is sealed from candidate self-report, generated comments, and provider
     optimism.

6. Promotion Boundary
   - Gateway binding changes, TradingSystem identity does not.
   - Paper to live should change execution authority, account binding, and destination, not mutate
     the candidate that earned evidence.
   - Same candidate shape, different execution authority. Live remains disabled until a future repo
     issue explicitly enables it.

7. UX Boundary
   - Candidate, Paper Evidence, and Live are separate states.
   - Candidate means evaluated artifact with no execution authority.
   - `PaperEvidence` means selected-candidate proof through fake account, fake executor, Gateway, and
     Ledger.
   - Live means real authority and is outside the current product boundary.
   - `Run paper evidence` is proof gathering, not live promotion.

8. Non-Negotiables
   - Do not collapse the arena into one-best-artifact editing.
   - Do not treat generated code, model output, or provider self-report as proof.
   - Do not hide Evaluation behind UI optimism.
   - Do not imply paper success grants live authority.
   - Do not let architecture patterns obscure the simple loop: generate many, evaluate externally,
     keep memory, repeat.

## Reference Lineage

| Reference | Doctrine contribution |
| --- | --- |
| Anthropic AAR | parallel researchers plus sealed, outcome-gradable evaluation |
| AlphaEvolve | code candidates plus evaluator plus evolutionary improvement |
| AlphaProof Nexus | unreliable generation made useful by verification and search |
| Weak-to-strong | stronger capability elicited through scalable evaluation |
| Codex, Claude Code, Gemini agents | external improving agent labor |
| Ouroboros | apply the pattern to trading, where `revenue - cost` is the score |

## References

- [Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)
- [AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)
- [AlphaEvolve paper](https://arxiv.org/abs/2506.13131)
- [Advancing Mathematics Research with AI-Driven Formal Proof Search](https://arxiv.org/html/2605.22763v1)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Weak-to-strong generalization](https://openai.com/index/weak-to-strong-generalization/)
- [Introducing Codex](https://openai.com/index/introducing-codex/)
