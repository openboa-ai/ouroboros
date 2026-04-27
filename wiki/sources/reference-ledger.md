# Reference Ledger

This page is the tracking ledger for externally supplied references.

Rules:

- Preserve every supplied URL exactly enough that it can be audited later.
- Deduplicate only by marking an alias; do not silently drop duplicate or localized URLs.
- A URL is not considered ingested until it points to a maintained source note and at least one
  synthesis page.
- `blocked` means the original URL could not be fetched, but the row must still remain visible.

Status values:

- `existing`: already covered by a maintained source note and synthesis.
- `needs-update`: partially covered, but the supplied URL changes or deepens the source.
- `new`: newly added in this ingestion pass.
- `duplicate-alias`: duplicate or localized alias of another row.
- `blocked`: original URL could not be fetched; a fallback source may be listed.

## Ledger

| # | Supplied URL | Status | Source note | Synthesis |
| --- | --- | --- | --- | --- |
| 1 | https://alignment.anthropic.com/2026/automated-w2s-researcher/ | existing | [001-anthropic-automated-w2s-researcher.md](library/url-notes/001-anthropic-automated-w2s-researcher.md) | [evaluation-governance-and-promotion.md](synthesis/evaluation-governance-and-promotion.md) |
| 2 | https://platform.claude.com/docs/en/managed-agents/overview | needs-update | [002-claude-managed-agents-overview.md](library/url-notes/002-claude-managed-agents-overview.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 3 | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | existing | [003-anthropic-effective-harnesses-long-running-agents.md](library/url-notes/003-anthropic-effective-harnesses-long-running-agents.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 4 | https://www.anthropic.com/engineering/harness-design-long-running-apps | new | [004-anthropic-harness-design-long-running-apps.md](library/url-notes/004-anthropic-harness-design-long-running-apps.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 5 | https://www.anthropic.com/product/claude-cowork | new | [005-anthropic-claude-cowork.md](library/url-notes/005-anthropic-claude-cowork.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 6 | https://arxiv.org/pdf/2410.12361 | new | [006-proactive-agent-paper.md](library/url-notes/006-proactive-agent-paper.md) | [proactive-operations-and-runtime-control.md](synthesis/proactive-operations-and-runtime-control.md) |
| 7 | https://arxiv.org/pdf/2304.03442 | new | [007-generative-agents-paper.md](library/url-notes/007-generative-agents-paper.md) | [proactive-operations-and-runtime-control.md](synthesis/proactive-operations-and-runtime-control.md) |
| 8 | https://arxiv.org/pdf/2602.04482 | new | [008-proagentbench-paper.md](library/url-notes/008-proagentbench-paper.md) | [proactive-operations-and-runtime-control.md](synthesis/proactive-operations-and-runtime-control.md) |
| 9 | https://openai.com/ko-KR/index/introducing-workspace-agents-in-chatgpt/ | duplicate-alias | [009-openai-workspace-agents-ko-alias.md](library/url-notes/009-openai-workspace-agents-ko-alias.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 10 | https://claude.com/blog/claude-managed-agents | new | [010-claude-managed-agents-blog.md](library/url-notes/010-claude-managed-agents-blog.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 11 | https://clawhub.ai/halthelobster/proactive-agent | new | [011-clawhub-proactive-agent.md](library/url-notes/011-clawhub-proactive-agent.md) | [proactive-operations-and-runtime-control.md](synthesis/proactive-operations-and-runtime-control.md) |
| 12 | https://platform.claude.com/docs/en/managed-agents/memory | needs-update | [012-claude-managed-agents-memory.md](library/url-notes/012-claude-managed-agents-memory.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 13 | https://www.anthropic.com/engineering/claude-code-auto-mode | new | [013-claude-code-auto-mode.md](library/url-notes/013-claude-code-auto-mode.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 14 | https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills | new | [014-anthropic-agent-skills.md](library/url-notes/014-anthropic-agent-skills.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 15 | https://www.anthropic.com/news/measuring-agent-autonomy | new | [015-anthropic-measuring-agent-autonomy.md](library/url-notes/015-anthropic-measuring-agent-autonomy.md) | [evaluation-governance-and-promotion.md](synthesis/evaluation-governance-and-promotion.md) |
| 16 | https://openai.com/index/introducing-workspace-agents-in-chatgpt/ | new | [016-openai-workspace-agents.md](library/url-notes/016-openai-workspace-agents.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 17 | https://openai.com/academy/workspace-agents/ | new | [017-openai-workspace-agents-academy.md](library/url-notes/017-openai-workspace-agents-academy.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 18 | https://openai.com/index/introducing-the-codex-app/ | needs-update | [018-openai-codex-app.md](library/url-notes/018-openai-codex-app.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 19 | https://openai.com/codex/ | needs-update | [019-openai-codex-product.md](library/url-notes/019-openai-codex-product.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 20 | https://openai.com/index/codex-for-almost-everything/ | new | [020-openai-codex-for-almost-everything.md](library/url-notes/020-openai-codex-for-almost-everything.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 21 | https://openai.com/index/codex-security-now-in-research-preview/ | new | [021-openai-codex-security-preview.md](library/url-notes/021-openai-codex-security-preview.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 22 | https://openai.com/index/new-tools-for-building-agents/ | new | [022-openai-new-tools-building-agents.md](library/url-notes/022-openai-new-tools-building-agents.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 23 | https://openai.com/index/introducing-agentkit/ | new | [023-openai-agentkit.md](library/url-notes/023-openai-agentkit.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 24 | https://developers.openai.com/api/docs/guides/agents/sandboxes | new | [024-openai-agents-sandbox-agents.md](library/url-notes/024-openai-agents-sandbox-agents.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 25 | https://developers.openai.com/api/docs/guides/agents/running-agents | new | [025-openai-agents-running-agents.md](library/url-notes/025-openai-agents-running-agents.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 26 | https://developers.openai.com/api/docs/guides/agents/orchestration | new | [026-openai-agents-orchestration.md](library/url-notes/026-openai-agents-orchestration.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 27 | https://developers.openai.com/api/docs/guides/agents/guardrails-approvals | new | [027-openai-agents-guardrails-approvals.md](library/url-notes/027-openai-agents-guardrails-approvals.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 28 | https://developers.openai.com/api/docs/guides/agents/integrations-observability | new | [028-openai-agents-integrations-observability.md](library/url-notes/028-openai-agents-integrations-observability.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 29 | https://developers.openai.com/api/docs/guides/agent-evals | new | [029-openai-agent-evals.md](library/url-notes/029-openai-agent-evals.md) | [evaluation-governance-and-promotion.md](synthesis/evaluation-governance-and-promotion.md) |
| 30 | https://developers.openai.com/api/docs/guides/tools-connectors-mcp | new | [030-openai-mcp-connectors.md](library/url-notes/030-openai-mcp-connectors.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 31 | https://developers.openai.com/api/docs/guides/tools-skills | new | [031-openai-tools-skills.md](library/url-notes/031-openai-tools-skills.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 32 | https://developers.openai.com/api/docs/guides/latest-model | new | [032-openai-latest-model-gpt-5-5.md](library/url-notes/032-openai-latest-model-gpt-5-5.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 33 | https://developers.openai.com/api/docs/guides/tools | new | [033-openai-tools-overview.md](library/url-notes/033-openai-tools-overview.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 34 | https://developers.openai.com/api/docs/guides/tools-shell | new | [034-openai-tools-shell.md](library/url-notes/034-openai-tools-shell.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 35 | https://developers.openai.com/api/docs/guides/tools-computer-use | new | [035-openai-tools-computer-use.md](library/url-notes/035-openai-tools-computer-use.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 36 | https://developers.openai.com/api/docs/guides/compaction | new | [036-openai-compaction.md](library/url-notes/036-openai-compaction.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 37 | https://developers.openai.com/api/docs/guides/token-counting | new | [037-openai-token-counting.md](library/url-notes/037-openai-token-counting.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 38 | https://developers.openai.com/api/docs/guides/reasoning | new | [038-openai-reasoning-models.md](library/url-notes/038-openai-reasoning-models.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 39 | https://cloud.google.com/blog/topics/google-cloud-next/welcome-to-google-cloud-next26?hl=en | new | [039-google-cloud-next26-welcome.md](library/url-notes/039-google-cloud-next26-welcome.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 40 | https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform?hl=en | new | [040-google-gemini-enterprise-agent-platform.md](library/url-notes/040-google-gemini-enterprise-agent-platform.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 41 | https://cloud.google.com/blog/products/ai-machine-learning/whats-new-in-gemini-enterprise?hl=en | new | [041-google-whats-new-gemini-enterprise.md](library/url-notes/041-google-whats-new-gemini-enterprise.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 42 | https://cloud.google.com/blog/topics/google-cloud-next/next26-day-1-recap?hl=en | new | [042-google-next26-day-1-recap.md](library/url-notes/042-google-next26-day-1-recap.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 43 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime | new | [043-google-agent-runtime.md](library/url-notes/043-google-agent-runtime.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 44 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank | new | [044-google-memory-bank.md](library/url-notes/044-google-memory-bank.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 45 | https://adk.dev/ | needs-update | [045-google-adk.md](library/url-notes/045-google-adk.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 46 | https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/ | new | [046-google-agent-protocols-guide.md](library/url-notes/046-google-agent-protocols-guide.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 47 | https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/ | duplicate-alias | [047-google-agent-protocols-guide-duplicate.md](library/url-notes/047-google-agent-protocols-guide-duplicate.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 48 | https://a2a-protocol.org/latest/ | needs-update | [048-a2a-protocol-latest.md](library/url-notes/048-a2a-protocol-latest.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 49 | https://developers.googleblog.com/jules-gemini-3/ | new | [049-google-jules-gemini-3.md](library/url-notes/049-google-jules-gemini-3.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 50 | https://cloud.google.com/blog/products/application-development/gemini-cloud-assist-at-next26?hl=en | new | [050-google-gemini-cloud-assist-next26.md](library/url-notes/050-google-gemini-cloud-assist-next26.md) | [reference-systems-and-product-postures.md](synthesis/reference-systems-and-product-postures.md) |
| 51 | https://www.anthropic.com/features/project-deal | new | [051-anthropic-project-deal.md](library/url-notes/051-anthropic-project-deal.md) | [evaluation-governance-and-promotion.md](synthesis/evaluation-governance-and-promotion.md) |
| 52 | https://agents.md/ | new | [agents-md-and-agent-skills.md](library/agents-md-and-agent-skills.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 53 | https://agentskills.io/home | new | [agents-md-and-agent-skills.md](library/agents-md-and-agent-skills.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |
| 54 | https://github.com/obra/superpowers | new | [superpowers-agentic-skill-methodology.md](library/superpowers-agentic-skill-methodology.md) | [agent-runtime-and-harness-principles.md](synthesis/agent-runtime-and-harness-principles.md) |

## Blocked / Fallback Notes

- No supplied URL is currently excluded from the ledger. If a URL later becomes inaccessible, keep
  the row and mark it `blocked` instead of removing it.
