# Linear Source Map

Linear is the Ouroboros source of truth for product, planning, project state, Project Documents, comments, project updates, and durable operating history.

## Direction

- Repo-originated durable documentation changes go to Linear.
- Linear content is not synced back into repo documentation.
- The repo stays focused on implementation code, tests, validation, and minimal execution-facing instructions.
- Linear writeback is mandatory for durable outcomes. Linear-related work must select the `linear`
  skill first and execute Linear operations through the repo-local GraphQL path.
- Primary docs should keep agents focused on the CandidateArena loop: parallel or iterative
  TradingSystem candidate generation, external Evaluation, leaderboard, findings/lineage, next
  generation, and selected candidate paper evidence.

## Project

- Ouroboros Project: https://linear.app/openboa/project/ouroboros-113fef53f6d1

## Primary Read Path

- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/00-start-here-ouroboros-documentation-index-953f443725df
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/04-execution-ledger-active-frontier-and-handoff-9e036cf84011
- 05 Project Ledger - Frontier State and Run Packet: https://linear.app/openboa/document/05-project-ledger-frontier-state-and-run-packet-e3d192eb65b8
- 35 Source Synthesis - Runtime, Evaluation, Product Postures: https://linear.app/openboa/document/35-source-synthesis-runtime-evaluation-product-postures-fd857d802e22
- 38 Source Addendum - AlphaProof Nexus and Candidate Arena References: https://linear.app/openboa/document/38-source-addendum-alphaproof-nexus-and-candidate-arena-references-fa78e56e2ad2
- the active Linear issue, comments, blockers, and linked PRs

Use the taxonomy below only when a task needs deeper product, architecture, service, source, or
archive context.

## Document Taxonomy

- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/00-start-here-ouroboros-documentation-index-953f443725df
- 01 Product Strategy - Thesis, Market, Metrics: https://linear.app/openboa/document/01-product-strategy-thesis-market-metrics-0b56a519c964
- 02 MLP-01 Brief - Scope, JTBD, Cutline: https://linear.app/openboa/document/02-mlp-01-brief-scope-jtbd-cutline-b64af14949a6
- 03 MLP-01 Release Plan - Milestones and Slices: https://linear.app/openboa/document/03-mlp-01-release-plan-milestones-and-slices-d3d83c35f208
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/04-execution-ledger-active-frontier-and-handoff-9e036cf84011
- 05 Project Ledger - Frontier State and Run Packet: https://linear.app/openboa/document/05-project-ledger-frontier-state-and-run-packet-e3d192eb65b8
- 10 Product Archive - Strategy Through Implementation: https://linear.app/openboa/document/10-product-archive-strategy-through-implementation-70e5394b89d5
- 11 Product Archive - MLP-01 PRDs and Slice Details: https://linear.app/openboa/document/11-product-archive-mlp-01-prds-and-slice-details-3985937ee6fe
- 20 Architecture Baseline - System Map and Runtime Model: https://linear.app/openboa/document/20-architecture-baseline-system-map-and-runtime-model-ff4804a6d25c
- 21 Architecture Baseline - Agent, Control, Evaluation: https://linear.app/openboa/document/21-architecture-baseline-agent-control-evaluation-41c1aaff0f8f
- 22 Architecture Baseline - Foundation and Trading Substrate: https://linear.app/openboa/document/22-architecture-baseline-foundation-and-trading-substrate-31ac0895169f
- 23 Architecture Decisions - ADRs: https://linear.app/openboa/document/23-architecture-decisions-adrs-b516f7432828
- 24 Architecture Contracts - Core Through Evidence: https://linear.app/openboa/document/24-architecture-contracts-core-through-evidence-d18b7d17d45d
- 25 Architecture Contracts - Promotion Through Substrate: https://linear.app/openboa/document/25-architecture-contracts-promotion-through-substrate-e71a72691597
- 26 Architecture Contracts - Index and Remaining Specs: https://linear.app/openboa/document/26-architecture-contracts-index-and-remaining-specs-6136fc24c533
- 30 Source Library - Agent Runtime References A: https://linear.app/openboa/document/30-source-library-agent-runtime-references-a-ee27d978c9c0
- 31 Source Library - OpenAI and Repository References B: https://linear.app/openboa/document/31-source-library-openai-and-repository-references-b-cff64c66b612
- 32 Source Library - Repository and URL Notes C: https://linear.app/openboa/document/32-source-library-repository-and-url-notes-c-533606a3d39f
- 33 Source Library - OpenAI URL Notes D: https://linear.app/openboa/document/33-source-library-openai-url-notes-d-0592a84e24e6
- 34 Source Library - Google and Synthesis Inputs E: https://linear.app/openboa/document/34-source-library-google-and-synthesis-inputs-e-22de8a782cae
- 35 Source Synthesis - Runtime, Evaluation, Product Postures: https://linear.app/openboa/document/35-source-synthesis-runtime-evaluation-product-postures-fd857d802e22
- 37 Source Addendum - Trading Taxonomy References: https://linear.app/openboa/document/37-source-addendum-trading-taxonomy-references-33f2442f6588
- 38 Source Addendum - AlphaProof Nexus and Candidate Arena References: https://linear.app/openboa/document/38-source-addendum-alphaproof-nexus-and-candidate-arena-references-fa78e56e2ad2
- 40 Agent Operating Guide - Repo Harness and Skills: https://linear.app/openboa/document/40-agent-operating-guide-repo-harness-and-skills-7b1d4d884739
- 50 Service Docs - Runtime, Operator, Policies: https://linear.app/openboa/document/50-service-docs-runtime-operator-policies-578ec402e4d8
- 90-95 Architecture Archive documents: listed in the Documentation Index
- 99 Migration Source Map - Legacy Root Navigation: https://linear.app/openboa/document/99-migration-source-map-legacy-root-navigation-f5e8229e5e4d

## Update Rule

Update Linear first for durable product, architecture, source, service, or project-memory changes.
Update repo docs only when local developer or agent execution would be wrong without the change.
Every such repo-doc change must be paired with a Linear workpad, comment, project update, or
Project Document update.

Use the `linear` skill for Linear-related work. Execute the selected Linear operation through the
repo-local GraphQL path:

```bash
npm run linear:workpad -- --issue OURO-158 --body-file workpad.md
npm run linear:graphql -- --query-file query.graphql --variables-file variables.json
```

Both commands read `LINEAR_API_KEY` from the environment first, then local `.env`, and do not print
the token. Their implementation lives in [.agents/skills/linear-graphql](.agents/skills/linear-graphql/SKILL.md)
because this is agent operating support, not product runtime code. If GraphQL execution fails, leave
the work blocked with the failing evidence instead of marking the task complete.
