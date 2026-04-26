#!/usr/bin/env bash
set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is not installed; skipping local secret scan." >&2
  echo "Install gitleaks to run the same secret scan locally before push." >&2
  exit 0
fi

gitleaks git --no-banner --redact .
