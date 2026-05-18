#!/usr/bin/env python3
import json
import subprocess
import sys


def main() -> int:
    if not in_git_worktree():
        return 0

    failures = []
    for mode in ("--staged", "--tracked"):
        result = subprocess.run(
            ["bash", "scripts/check-env-files.sh", mode],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            detail = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
            failures.append(f"{mode}: {detail}")

    if not failures:
        return 0

    print(
        json.dumps(
            {
                "decision": "block",
                "reason": "Repository environment-file guard failed after the tool call.",
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": "\n\n".join(failures),
                },
            },
            ensure_ascii=False,
        )
    )
    return 0


def in_git_worktree() -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        check=False,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


if __name__ == "__main__":
    raise SystemExit(main())
