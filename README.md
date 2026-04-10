# autokairos
Installable local trading app with a built-in self-improving agent runtime.

## Why the name

AutoKairos combines `auto` with `Kairos`, the Greek idea of the critical or opportune moment.
That meaning maps directly to trading: not just seeing signals, but acting at the right time.
The name reflects a system designed to interpret market conditions, identify timing windows, and
turn those decisions into disciplined execution.

## Repository baseline

This repository includes a minimal, stack-agnostic baseline for hygiene and collaboration:

- `.editorconfig` for consistent formatting defaults
- `.gitattributes` for normalized line endings
- `.gitignore` for common local, Python, and Node artifacts
- GitHub Actions CI for repository hygiene and workflow linting

You can run the same repository check locally with:

```bash
bash scripts/check_repo.sh
```

## Desktop Scaffold

The current `v0` client scaffold uses:

- `Tauri 2`
- `React`
- `Vite`
- `Tailwind CSS`
- `shadcn/ui`-oriented component boundaries

The app shell and mock dashboard live in:

- [src/app.tsx](src/app.tsx)
- [src/components/](src/components/)
- [src/lib/service-contract.ts](src/lib/service-contract.ts)
- [src-tauri/](src-tauri/)

The current strategy-workspace template lives in:

- [templates/strategy-workspace/strategy.json](templates/strategy-workspace/strategy.json)
- [schemas/strategy.schema.json](schemas/strategy.schema.json)

To verify the frontend scaffold locally:

```bash
npm install
npm run build
```

## Documentation

This repository is being set up as an agent-legible markdown system.

- [AGENTS.md](AGENTS.md): short entry point for agents
- [ARCHITECTURE.md](ARCHITECTURE.md): top-level system shape
- [.agents/AGENTS.md](.agents/AGENTS.md): repo-local agent workflow rules
- [knowledge-index.md](knowledge-index.md): knowledge navigation layer
- [docs/index.md](docs/index.md): documentation map
- [docs/design-docs/index.md](docs/design-docs/index.md): stable design docs
- [docs/product-specs/index.md](docs/product-specs/index.md): product specs
- [docs/exec-plans/active/product-definition.md](docs/exec-plans/active/product-definition.md): active product-definition summary
- [docs/references/index.md](docs/references/index.md): reference notes
