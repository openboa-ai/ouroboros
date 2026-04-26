#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

python3 - <<'PY'
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path.cwd()


def git_files() -> list[Path]:
    output = subprocess.check_output(["git", "ls-files"], text=True)
    return [Path(line) for line in output.splitlines() if line]


tracked_files = git_files()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


def check_whitespace() -> None:
    checked_suffixes = {".md", ".yml", ".yaml", ".sh"}
    problems: list[str] = []
    for path in tracked_files:
        if path.suffix not in checked_suffixes:
            continue
        full = ROOT / path
        if not full.exists():
            continue
        raw = full.read_bytes()
        if raw and not raw.endswith(b"\n"):
            problems.append(f"{path}: missing final newline")
        for index, line in enumerate(raw.splitlines(), start=1):
            if line.rstrip(b" \t") != line:
                problems.append(f"{path}:{index}: trailing whitespace")
    if problems:
        fail("Whitespace check failed:\n" + "\n".join(problems[:200]))


def active_markdown_files() -> list[Path]:
    roots = [
        Path("AGENTS.md"),
        Path("README.md"),
        Path("ARCHITECTURE.md"),
        Path("knowledge-index.md"),
        Path("knowledge-log.md"),
        Path(".agents/AGENTS.md"),
        Path(".agents/skills/AGENTS.md"),
        Path("wiki"),
    ]
    files: list[Path] = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            for path in root.rglob("*.md"):
                if "wiki/architecture/historical/" in path.as_posix():
                    continue
                files.append(path)
    files.extend(sorted(Path(".agents/skills").glob("*/SKILL.md")))
    return sorted(files)


def check_links() -> None:
    link_re = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
    broken: list[str] = []
    checked = 0
    for path in active_markdown_files():
        text = read_text(path)
        for match in link_re.finditer(text):
            raw = match.group(1).strip()
            if not raw:
                continue
            target = raw.strip("<>")
            if " " in target and not raw.startswith("<"):
                target = target.split(" ", 1)[0]
            if target.startswith(
                (
                    "#",
                    "http://",
                    "https://",
                    "mailto:",
                    "app://",
                    "plugin://",
                    "file://",
                )
            ):
                continue
            target_path = target.split("#", 1)[0]
            if not target_path:
                continue
            candidate = Path(target_path)
            if not candidate.is_absolute():
                candidate = path.parent / candidate
            checked += 1
            if not candidate.exists():
                broken.append(f"{path}: {target}")
    if broken:
        fail(f"Broken local markdown links ({len(broken)}):\n" + "\n".join(broken[:200]))
    print(f"Local markdown links OK: {checked} checked")


def stale_check_files() -> list[Path]:
    roots = [
        Path("AGENTS.md"),
        Path("README.md"),
        Path("ARCHITECTURE.md"),
        Path("knowledge-index.md"),
        Path(".agents/AGENTS.md"),
        Path(".agents/skills/AGENTS.md"),
        Path("wiki/architecture"),
        Path("wiki/product"),
        Path("wiki/sources/synthesis"),
    ]
    files: list[Path] = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            for path in root.rglob("*.md"):
                posix = path.as_posix()
                if "/historical/" in posix or "/adrs/" in posix:
                    continue
                files.append(path)
    return sorted(files)


def check_stale_terms() -> None:
    terms = [
        r"wake\(",
        r"AttentionRequest",
        r"NextAttentionPlan",
        r"WakePolicy",
        r"WakeTriggerRecord",
        r"AgentLoopPolicy",
        r"TraderSystemPod",
        r"runtime bridge",
        r"event enum dispatch",
        r"market_signal",
        r"fill_update",
        r"risk_change",
    ]
    pattern = re.compile("|".join(f"(?:{term})" for term in terms))
    hits: list[str] = []
    for path in stale_check_files():
        for index, line in enumerate(read_text(path).splitlines(), start=1):
            if pattern.search(line):
                hits.append(f"{path}:{index}: {line.strip()}")
    if hits:
        fail("Stale active design terms found:\n" + "\n".join(hits[:200]))
    print("Stale active design term check OK")


def check_active_spec_count() -> None:
    specs = sorted(Path("wiki/architecture/specs").glob("*.md"))
    expected = 22
    if len(specs) != expected:
        rendered = "\n".join(str(path) for path in specs)
        fail(f"Expected {expected} active spec markdown files, found {len(specs)}:\n{rendered}")
    print(f"Active spec count OK: {expected}")


def check_required_terms() -> None:
    corpus_paths = [
        Path("wiki/architecture/08-runtime-authority-model.md"),
        Path("wiki/architecture/09-trader-system-runtime-operating-model.md"),
        Path("wiki/architecture/specs/02-core-primitives.md"),
        Path("wiki/architecture/specs/07-runtime-connector-contract.md"),
        Path("wiki/architecture/specs/15-runtime-operating-policy-contract.md"),
    ]
    corpus = "\n".join(read_text(path) for path in corpus_paths)
    required = [
        "TraderSystemRuntime",
        "RuntimePlacement",
        "RuntimeControl",
        "RuntimeOperatingPolicy",
        "RuntimeProviderAdapter",
        "OrderIntent",
        "GatewayDecision",
        "EvidenceRecord",
        "CapabilityManifest",
    ]
    missing = [term for term in required if term not in corpus]
    if missing:
        fail("Required active design terms missing: " + ", ".join(missing))
    print("Required active design term check OK")


def check_skill_frontmatter() -> None:
    skill_files = sorted(Path(".agents/skills").glob("*/SKILL.md"))
    problems: list[str] = []
    for path in skill_files:
        text = read_text(path)
        if not text.startswith("---\n"):
            problems.append(f"{path}: missing YAML frontmatter")
            continue
        try:
            _, frontmatter, _ = text.split("---", 2)
        except ValueError:
            problems.append(f"{path}: malformed YAML frontmatter")
            continue
        if not re.search(r"^name:\s*\S+", frontmatter, re.MULTILINE):
            problems.append(f"{path}: missing name")
        else:
            name_match = re.search(r"^name:\s*(\S+)", frontmatter, re.MULTILINE)
            if name_match and name_match.group(1) != path.parent.name:
                problems.append(
                    f"{path}: name {name_match.group(1)!r} does not match directory {path.parent.name!r}"
                )
        if not re.search(r"^description:\s*\S+", frontmatter, re.MULTILINE):
            problems.append(f"{path}: missing description")
    if problems:
        fail("Skill frontmatter check failed:\n" + "\n".join(problems))
    print(f"Skill frontmatter OK: {len(skill_files)} skills")


def check_skill_routing_rules() -> None:
    paths = [
        Path("AGENTS.md"),
        Path(".agents/AGENTS.md"),
        Path(".agents/skills/AGENTS.md"),
    ]
    corpus = "\n".join(read_text(path) for path in paths if path.exists())
    if "auto-wiki" in corpus:
        fail("Deprecated auto-wiki routing found; use llm-wiki")
    if "brain-autokairos" in corpus:
        fail("Deprecated project-specific brain-autokairos skill found; use project-context")
    required = [
        "llm-wiki",
        "writeback_needed",
        "project-context",
        ".agents/skills/AGENTS.md",
    ]
    missing = [term for term in required if term not in corpus]
    if missing:
        fail("Skill routing terms missing: " + ", ".join(missing))
    print("Skill routing rule check OK")


def check_generic_agents_harness() -> None:
    banned = [
        "autokairos",
        "AutoKairos",
        "TraderSystem",
        "RuntimeControl",
        "RuntimePlacement",
        "gateway",
        "Bootstrap",
        "weak-to-strong",
    ]
    pattern = re.compile("|".join(re.escape(term) for term in banned))
    hits: list[str] = []
    for path in sorted(Path(".agents").rglob("*.md")):
        for index, line in enumerate(read_text(path).splitlines(), start=1):
            if pattern.search(line):
                hits.append(f"{path}:{index}: {line.strip()}")
    if hits:
        fail(
            ".agents harness must stay generic; project-specific terms found:\n"
            + "\n".join(hits[:200])
        )
    print("Generic .agents harness check OK")


check_whitespace()
check_links()
check_stale_terms()
check_active_spec_count()
check_required_terms()
check_skill_frontmatter()
check_skill_routing_rules()
check_generic_agents_harness()
print("Docs design baseline checks passed")
PY
