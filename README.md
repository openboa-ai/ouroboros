# Ouroboros

Ouroboros is undergoing a clean-slate reconstruction.

The previous implementation, schemas, interfaces, architecture, and compatibility surface were
intentionally retired. Their history remains available in Git, but none of them define the next
system.

No product runtime is currently shipped from this branch. Product direction will be established
from first principles before new implementation begins.

The [Agent Development Context](AGENTS.md) is the operational entry point for development agents.
It routes work through the [Core Doctrine](CORE_DOCTRINE.md), which defines the immutable purpose
and governing boundaries, and the [Whitepaper](WHITEPAPER.md), which explains the reasoning behind
those principles and the design space they establish. Architecture, product specifications, and
implementation must remain subordinate to both.
