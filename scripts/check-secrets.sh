#!/usr/bin/env bash
set -euo pipefail

mode="${1:---git}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is required for secret scanning." >&2
  echo "Install gitleaks before committing or pushing." >&2
  exit 1
fi

case "$mode" in
  --staged)
    gitleaks protect --staged --no-banner --redact .
    ;;
  --git)
    gitleaks git --no-banner --redact .
    ;;
  *)
    echo "Usage: bash scripts/check-secrets.sh [--staged|--git]" >&2
    exit 2
    ;;
esac
