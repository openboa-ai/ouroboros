#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="${ROOT_DIR}/templates/strategy-workspace"
WORKSPACE_DIR="${ROOT_DIR}/var/dev-workspace"

if [[ -f "${WORKSPACE_DIR}/strategy.json" ]]; then
  echo "Dev workspace already exists at ${WORKSPACE_DIR}"
  exit 0
fi

mkdir -p "${ROOT_DIR}/var"
cp -R "${TEMPLATE_DIR}" "${WORKSPACE_DIR}"
echo "Seeded dev workspace at ${WORKSPACE_DIR}"
