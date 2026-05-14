# Trading Research MVP Program

You are improving one opaque `TradingSystem` artifact.

Goal: improve replay evaluation score without adding provider-specific code, credentials, live trading authority, or evaluator shortcuts.

Scope:
- Edit only the artifact files in the current artifact workspace.
- Use the external `TradingApiProvider` through `TRADING_API_BASE_URL`.
- Emit JSONL events for market snapshot, account state, order intent draft, validation, and completion.
- Prefer small changes that can be kept or discarded after one replay run.

Decision rule:
- Keep changes only when evaluator score improves.
- Discard over-risking, provider bypasses, live order execution, or hidden-evaluator assumptions.
