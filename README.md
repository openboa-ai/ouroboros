# Ouroboros

Ouroboros is undergoing a clean-slate reconstruction.

The previous implementation, schemas, interfaces, architecture, and compatibility surface were
intentionally retired. Their history remains available in Git, but none of them define the next
system.

No product runtime is currently shipped from this branch. Product direction is established by the
Core Doctrine and Whitepaper; the next authority document is the Product Specification.

The [Agent Development Context](AGENTS.md) is the operational entry point for development agents.
It routes work through the [Core Doctrine](CORE_DOCTRINE.md), which defines Ouroboros's
constitutionally governing purpose and boundaries; agents may not modify that authority, and the
human sovereign alone may amend the doctrine. The [Sovereign Designation](SOVEREIGN.md) resolves
that identity for repository governance. The [Whitepaper](WHITEPAPER.md) explains the reasoning
behind those principles and the design space they establish. Architecture, product specifications,
and implementation must remain subordinate to them.
