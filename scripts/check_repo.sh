#!/usr/bin/env bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

required_files=(
  "AGENTS.md"
  "ARCHITECTURE.md"
  "README.md"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "vite.config.ts"
  "tailwind.config.ts"
  ".gitignore"
  ".editorconfig"
  ".gitattributes"
  ".github/workflows/ci.yml"
  ".agents/AGENTS.md"
  ".agents/skills/autokairos-wiki/SKILL.md"
  "docs/index.md"
  "docs/AGENTS.md"
  "docs/design-docs/index.md"
  "docs/design-docs/client-architecture.md"
  "docs/design-docs/workspace-asset-model.md"
  "docs/product-specs/index.md"
  "docs/product-specs/client-rules.md"
  "docs/exec-plans/active/product-definition.md"
  "docs/references/index.md"
  "docs/RELIABILITY.md"
  "docs/SECURITY.md"
  "schemas/strategy.schema.json"
  "src/app.tsx"
  "src/lib/service-contract.ts"
  "src/lib/service-gateway.ts"
  "src/lib/tauri-service.ts"
  "src/lib/workspace-contract.ts"
  "src-tauri/tauri.conf.json"
  "src-tauri/src/lib.rs"
  "src-tauri/src/commands.rs"
  "src-tauri/src/models.rs"
  "src-tauri/src/state.rs"
  "templates/strategy-workspace/strategy.json"
  "templates/strategy-workspace/imports/index.json"
  "templates/strategy-workspace/operations/index.json"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "Missing required file: ${file}" >&2
    exit 1
  fi
done

if git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- .; then
  echo "Found unresolved merge conflict markers." >&2
  exit 1
fi

if git grep -nI -E '[[:blank:]]$' -- '*.md' '*.yml' '*.yaml' '*.sh' '.gitignore' '.editorconfig' '.gitattributes'; then
  echo "Found trailing whitespace in tracked text files." >&2
  exit 1
fi

echo "Repository hygiene checks passed."
