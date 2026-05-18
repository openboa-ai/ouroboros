#!/usr/bin/env bash
set -euo pipefail

mode="${1:---tracked}"

case "$mode" in
  --staged)
    path_command=(git diff --cached --name-only --diff-filter=ACMR)
    label="staged"
    ;;
  --tracked)
    path_command=(git ls-files)
    label="tracked"
    ;;
  *)
    echo "Usage: bash scripts/check-env-files.sh [--staged|--tracked]" >&2
    exit 2
    ;;
esac

forbidden=()
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in
    .env.example|.env.*.example|*/.env.example|*/.env.*.example)
      ;;
    .env|.env.*|*/.env|*/.env.*|.envrc|*/.envrc)
      forbidden+=("$path")
      ;;
  esac
done < <("${path_command[@]}")

if ((${#forbidden[@]} > 0)); then
  echo "Refusing ${label} environment/secret files:" >&2
  printf '  %s\n' "${forbidden[@]}" >&2
  echo "Only .env.example and .env.*.example templates may be committed." >&2
  exit 1
fi

echo "Environment file guard passed (${label})."
