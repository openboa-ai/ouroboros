#!/usr/bin/env python3
import json
import os
import re
import sys


PATCH_TARGET_RE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$", re.MULTILINE)
SHELL_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_.-])"
    r"((?:[A-Za-z0-9_./-]*/)?(?:\.env(?:\.[A-Za-z0-9_.-]+)?|\.envrc|[A-Za-z0-9_./-]+\.(?:pem|p12|pfx|key)))"
    r"(?![A-Za-z0-9_.-])"
)
PRIVATE_KEY_RE = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
OPENAI_KEY_RE = re.compile(r"\bsk-(?:proj|live|test)?-[A-Za-z0-9_-]{16,}")


def main() -> int:
    payload = read_payload()
    tool_name = str(payload.get("tool_name", ""))
    tool_input = payload.get("tool_input", {})
    command = tool_command(tool_input)

    if PRIVATE_KEY_RE.search(command):
        return block("Refusing to write or run tool input that contains private key material.")
    if OPENAI_KEY_RE.search(command):
        return block("Refusing to write or run tool input that looks like an OpenAI API key.")

    if tool_name == "apply_patch":
        forbidden = forbidden_patch_targets(command)
        if forbidden:
            paths = ", ".join(forbidden)
            return block(
                f"Refusing to edit real environment or key files through apply_patch: {paths}. "
                "Commit only .env.example or .env.*.example templates."
            )
        return 0

    if tool_name == "Bash":
        target = forbidden_shell_write_target(command)
        if target:
            return block(
                f"Refusing shell command that writes or stages a real environment/key file: {target}. "
                "Use ignored local files for real credentials and commit only example templates."
            )

    return 0


def read_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def tool_command(tool_input) -> str:
    if isinstance(tool_input, dict):
        command = tool_input.get("command")
        if isinstance(command, str):
            return command
    try:
        return json.dumps(tool_input, ensure_ascii=False, sort_keys=True)
    except TypeError:
        return str(tool_input)


def forbidden_patch_targets(command: str):
    targets = []
    for match in PATCH_TARGET_RE.finditer(command):
        path = (match.group(1) or match.group(2) or "").strip()
        if is_forbidden_secret_path(path):
            targets.append(path)
    return targets


def forbidden_shell_write_target(command: str):
    for path in forbidden_shell_paths(command):
        if writes_or_stages_path(command, path):
            return path
    return None


def forbidden_shell_paths(command: str):
    paths = []
    for match in SHELL_PATH_RE.finditer(command):
        path = match.group(1)
        if is_forbidden_secret_path(path):
            paths.append(path)
    return paths


def is_forbidden_secret_path(path: str) -> bool:
    clean = path.strip().strip("\"'")
    name = os.path.basename(clean)
    if name == ".env.example" or (name.startswith(".env.") and name.endswith(".example")):
        return False
    if name == ".env" or name.startswith(".env.") or name == ".envrc":
        return True
    return name.endswith((".pem", ".p12", ".pfx", ".key"))


def writes_or_stages_path(command: str, path: str) -> bool:
    escaped = re.escape(path)
    redirection = re.compile(r"(?:^|[\s])(?:>|>>)\s*['\"]?" + escaped + r"(?:['\"]?)(?:$|[\s;|&])")
    staged_or_write_verb = re.compile(
        r"(?:^|[;&|]\s*)"
        r"(?:git\s+add(?:\s+-[A-Za-z]+)*|touch|cp|mv|install|tee|chmod|chown)\b"
        r"[^\n;&|]*['\"]?"
        + escaped
        + r"(?:['\"]?)(?:$|[\s;|&])"
    )
    return bool(redirection.search(command) or staged_or_write_verb.search(command))


def block(reason: str) -> int:
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
