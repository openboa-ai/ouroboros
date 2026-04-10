# Architecture

AutoKairos is an installable trading app with a built-in self-improving agent runtime.

The product should feel like one local application, not a loose bundle of scripts.
The runtime should feel alive by default, but the live-trading path must remain narrow and auditable.

## Top-Level Shape

- `app shell`
  The installable UI surface users launch.
- `client service layer`
  The boundary the official client uses instead of mutating workspace state directly.
- `workspace asset`
  The local strategy workspace the service layer owns, seeds, checkpoints, exports, and stages sanitized imports into.
- `resident supervisor`
  The always-on orchestration layer that owns threads, turns, logs, and background work.
- `research runtime`
  The broad self-improvement layer that observes, hypothesizes, edits, and evaluates candidates.
- `execution core`
  The narrow live-trading path that enforces invariants and places orders.
- `docs tree`
  The durable markdown operating memory for the system.

## Design Direction

- The product goal is money-making automated trading.
- The initial live venue is Binance `USDⓈ-M` Futures.
- The initial symbols are `BTCUSDT` and `ETHUSDT`.
- The desktop client stack should use `Tauri 2 + React + Vite + Tailwind CSS`.
- The target is practical low-latency automated trading, not true HFT.
- The product is local-first but should remain portable to server or VPS deployment.

## Runtime Separation

Research and live execution should not be the same surface.

- research can modify strategy logic, prompts, evaluation methods, and feature generation
- live execution must remain deterministic and harder to change
- candidate changes must be evaluated before promotion
- live trading should never depend on an unreviewed experimental workspace
- the current v0 scaffold seeds a mutable workspace from `templates/strategy-workspace/` into `var/dev-workspace/`

## Current Live-Path Invariants

- every live position must have an exchange-native protective stop
- critical execution failures are owned by the execution core, not delegated to the agent
- model issues may block new entries, but execution invariants may trigger stronger intervention
- users always keep ultimate control over trading state and emergency actions

## Documentation Map

- [docs/design-docs/index.md](docs/design-docs/index.md)
  Durable design beliefs and technical model
- [docs/design-docs/client-architecture.md](docs/design-docs/client-architecture.md)
  Desktop client and service-boundary model
- [docs/product-specs/index.md](docs/product-specs/index.md)
  Product behavior and trading-spec documents
- [docs/exec-plans/active/product-definition.md](docs/exec-plans/active/product-definition.md)
  Current active product-definition summary
- [docs/references/index.md](docs/references/index.md)
  Source-backed analysis and external reference notes
