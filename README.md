# Ouroboros

Ouroboros is an agent-native quantitative firm pursuing long-term growth in profits withdrawn by
its owner and net capital remaining in operation through authorized live trading. The owner
provides initial capital and decides whether, when, and how much to add. AI leads operation and
improvement within the human mandate; continued capital use must remain economically justified
after all costs and obligations, relative to realistic alternatives.

The owner currently also acts as the human sovereign. This describes economic ownership and final
control without assuming outside shareholders, equity issuance, or a particular legal form.
AI-led operation, economic results, AI contribution, earning ability, and justification for the
next allocation require distinct evidence.

Ouroboros is undergoing a clean-slate reconstruction.

The previous implementation, schemas, interfaces, architecture, and compatibility surface were
intentionally retired. Their history remains available in Git, but none of them define the next
system.

No product runtime is currently shipped from this branch. Product direction is established by the
Core Doctrine, Whitepaper, and Product Specification. The [Architecture](ARCHITECTURE.md) is a
provisional proposal for review; its presence does not establish adoption or authorize runtime
implementation.

Start with the [architecture reading map](ARCHITECTURE.md#3-detail-map-and-reading-order) for the
component designs, shared contracts, reference integration, and validation plan.
The worktree now contains a locally implemented Rust external environment and CLI under separate
bounded owner authorization. The [local implementation status](ARCHITECTURE.md#local-implementation-boundary)
separates tested behavior from remaining storage, recovery-authority and real-subscription gaps.
It is not a released or production-qualified runtime; architecture adoption remains separate.

Development checks use the same `scripts/check.py plan`, `run`, and `report` entry points locally
and in CI. The [executable validation map](docs/architecture/VALIDATION.md) connects responsibilities
to deterministic scenarios; the [integration guide](docs/architecture/INTEGRATION_AND_DEPLOYMENT.md)
describes explicit test-environment inputs and source-bound build/package commands. Default Cargo
tests cover fast invariants; required PostgreSQL and Linux scenarios must be selected and completed
separately. A missing environment or result cannot qualify a required check.

The intended implementation separates a public execution environment that enforces valid
delegation and provides evidence of actual effects from private AI operation that directs
research, trading, and resource allocation within it. Their methods should be loosely coupled;
the firm's accountability and feedback must remain connected. Separate repositories are an
intended implementation direction, not an existing split. Astra is the planned implementation
agent, not a selected internal operating model.

The architecture proposal separates common execution mechanics, mandatory investment enforcement,
and provider connectors inside the outer environment. It covers independently operated firms,
persistent private operation, company-wide observation and control, dependency isolation, and
continuity across replacement and exit. Reusable capabilities do not change the firm's purpose
or grant permission to use them.

The [Agent Development Context](AGENTS.md) is the operational entry point for development agents.
It routes work through the [Core Doctrine](CORE_DOCTRINE.md), which defines Ouroboros's
constitutionally governing purpose and boundaries; agents may not modify that authority, and the
human sovereign alone may amend the doctrine. The [Sovereign Designation](SOVEREIGN.md) resolves
that identity for repository governance. The [Whitepaper](WHITEPAPER.md) explains the reasoning
behind those principles and the design space they establish. The
[Product Specification](PRODUCT_SPECIFICATION.md) defines the required product identity, behavior,
and proof. Architecture and implementation must remain subordinate to them.
