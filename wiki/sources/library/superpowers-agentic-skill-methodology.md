# Superpowers Agentic Skill Methodology

## Source

- [obra/superpowers](https://github.com/obra/superpowers)
- [Superpowers skills directory](https://github.com/obra/superpowers/tree/main/skills)

## What This Source Is

Superpowers is an agentic software-development methodology packaged as composable workflow skills.
Its public README describes a process where an agent checks for relevant skills, shapes ideas before
implementation, writes detailed plans, executes with verification and review, and finishes branches
through an explicit merge/PR/keep/discard decision.

## Core Thesis

Agent autonomy improves when process skills are mandatory gates rather than optional suggestions.
The useful pattern is not the exact Superpowers file layout; it is the sequence:

```text
skill selection -> design/brainstorming -> implementation plan -> isolated execution -> review ->
verification -> finish branch
```

## Key Mechanisms / Architecture

- Skills are small workflow modules with strong trigger descriptions.
- The entry skill forces the agent to check whether a more specific skill applies before acting.
- Brainstorming prevents implementation before intent and design are clear.
- Writing plans turns approved designs into concrete, verifiable implementation steps.
- Execution skills follow the plan rather than improvising.
- Debugging and verification skills prevent random patching and unverified success claims.
- Branch finishing is a separate workflow with explicit merge/PR/keep/discard choices.

## Important Passages Or Facts

- The repo describes Superpowers as a skills framework and software development methodology for
  coding agents.
- Its basic workflow includes brainstorming, worktree setup, writing plans, executing plans or
  subagent-driven development, test-driven development, code review, and branch finishing.
- It emphasizes process over guessing and evidence over claims.

## Vocabulary And Mental Models

- skill-first gate: check relevant workflow skills before acting.
- design before implementation: clarify intent and tradeoffs before changing files.
- plan execution: follow a written plan with verification steps.
- verification before completion: no success claim without fresh evidence.
- branch finishing: choose merge, PR, keep, or discard after verification.

## Transferable Lessons

- Check for relevant skills before routing or acting.
- Shape intent and design before implementation when requirements are unclear.
- Execute from a written plan when one exists.
- Treat failed checks as debugging/root-cause work, not random patching.
- Verify freshly before claiming completion, committing, or marking work ready.
- Use review before merge when the frontier is meaningful.
- Finish branches with a structured decision: merge, PR, keep, or discard.

## Non-transferable Baggage

- Do not vendor Superpowers skills into `.agents/skills` by default.
- Do not copy its default `docs/superpowers/**` output paths when this repo already has `wiki/**`,
  `knowledge-log.md`, and project frontier ledgers.
- Do not let external skill state become project truth. Maintained repo docs, git state, checks, and
  `llm-wiki` writeback remain authoritative.

## Open Questions / Tensions

- How strongly should repo-local CI enforce external skill availability when environments differ?
- Which external workflow skills should be treated as mandatory versus optional accelerators?
- How much implementation-plan detail should live in repo docs versus task-local plans?

## Autokairos Harness Impact

- `auto-project` should act as the repo-local conductor that can invoke or mirror Superpowers-style
  gates when they are available.
- `.agents/skills/AGENTS.md` should document how external workflow skills map onto repo-local owners.
- `llm-wiki` remains the durable writeback owner for decisions produced by any external workflow
  skill.
