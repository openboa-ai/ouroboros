#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
python3 - <<'PY'
from pathlib import Path
import re, subprocess, sys
def fail(msg): print(msg, file=sys.stderr); sys.exit(1)
tracked = [Path(x) for x in subprocess.check_output(["git", "ls-files"], text=True).splitlines() if x]
active = [Path(p) for p in ["AGENTS.md", "README.md", "ARCHITECTURE.md", "LINEAR.md", ".agents/AGENTS.md", ".agents/skills/AGENTS.md"]]
active += sorted(Path(".agents/skills").glob("*/SKILL.md"))
active += sorted((Path(".agents/skills") / ("llm-"+"wiki") / "references").glob("*.md"))
def text(path): return path.read_text(encoding="utf-8", errors="ignore")
problems=[]
for path in tracked:
  if path.suffix not in {".md", ".yml", ".yaml", ".sh"}: continue
  if not path.exists(): continue
  raw=path.read_bytes()
  if raw and not raw.endswith(b"\n"): problems.append(f"{path}: missing final newline")
  for i,line in enumerate(raw.splitlines(),1):
      if line.rstrip(b" \t") != line: problems.append(f"{path}:{i}: trailing whitespace")
if problems: fail("Whitespace check failed:\n"+"\n".join(problems[:200]))
missing=[str(p) for p in active[:6] if not p.exists()]
if missing: fail("Required minimal repo docs missing: "+", ".join(missing))
removed=[Path("wiki"), Path("docs"), Path("knowledge"+"-index.md"), Path("knowledge"+"-log.md")]
present=[str(p) for p in removed if p.exists()]
if present: fail("Migrated long-form docs should not remain in repo: "+", ".join(present))
forbidden=["wiki"+"/", "docs"+"/", "knowledge"+"-index", "knowledge"+"-log", "Mir"+"ror", "linear"+" -> "+"repo", "Linear"+" -> "+"repo"]
hits=[]
for path in active:
  if not path.exists(): continue
  body=text(path)
  for term in forbidden:
      if term in body: hits.append(f"{path}: {term}")
if hits: fail("Active documents/scripts still reference migrated local documents or old flow:\n"+"\n".join(hits[:200]))
body=text(Path("LINEAR.md"))
required=["00 Start Here - Ouroboros Documentation Index", "01 Product Strategy - Thesis, Market, Metrics", "02 MLP-01 Brief - Scope, JTBD, Cutline", "03 MLP-01 Release Plan - Milestones and Slices", "04 Execution Ledger - Active Frontier and Handoff", "05 Project Ledger - Frontier State and Run Packet", "20 Architecture Baseline", "24 Architecture Contracts", "30 Source Library", "35 Source Synthesis", "40 Agent Operating Guide", "50 Service Docs", "linear.app/openboa/project/ouroboros"]
miss=[x for x in required if x not in body]
if miss: fail("Linear source map missing terms: "+", ".join(miss))
link_re=re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
broken=[]; checked=0
for path in active:
  if not path.exists(): continue
  for m in link_re.finditer(text(path)):
      raw=m.group(1).strip(); target=raw.strip("<>")
      if " " in target and not raw.startswith("<"): target=target.split(" ",1)[0]
      if target.startswith(("#","http://","https://","mailto:","app://","plugin://","file://")): continue
      target_path=target.split("#",1)[0]
      if not target_path: continue
      candidate=Path(target_path)
      if not candidate.is_absolute(): candidate=path.parent/candidate
      checked += 1
      if not candidate.exists(): broken.append(f"{path}: {target}")
if broken: fail(f"Broken local markdown links ({len(broken)}):\n"+"\n".join(broken[:200]))
skill_files=sorted(Path(".agents/skills").glob("*/SKILL.md")); skill_errors=[]
for path in skill_files:
  body=text(path)
  if not body.startswith("---\n"): skill_errors.append(f"{path}: missing YAML frontmatter"); continue
  _, fm, _ = body.split("---", 2)
  name=re.search(r"^name:\s*(\S+)", fm, re.M)
  desc=re.search(r"^description:\s*(.+)", fm, re.M)
  if not name or name.group(1) != path.parent.name: skill_errors.append(f"{path}: bad name")
  if not desc or not desc.group(1).startswith("Use when"): skill_errors.append(f"{path}: bad description")
  for heading in ["## Role", "## Workflow", "## Required Output", "## Handoff", "## Hard Boundaries"]:
      if heading not in body: skill_errors.append(f"{path}: missing heading {heading}")
if skill_errors: fail("Skill check failed:\n"+"\n".join(skill_errors[:200]))
corpus="\n".join(text(p) for p in [Path("AGENTS.md"), Path(".agents/AGENTS.md"), Path(".agents/skills/AGENTS.md")] if p.exists())
for term in ["llm-wiki", "writeback_needed", "project-context", ".agents/skills/AGENTS.md", "superpowers:using-superpowers", "Skill-First Gate"]:
  if term not in corpus: fail("Skill routing terms missing: "+term)
legacy_project_suffix="kai"+"ros"
legacy_project_terms=["auto"+legacy_project_suffix, "Auto"+legacy_project_suffix.capitalize()]
banned=legacy_project_terms+["ouroboros", "Ouroboros", "TraderSystem", "RuntimeControl", "RuntimePlacement", "gateway", "Bootstrap", "weak-to-strong"]
pattern=re.compile("|".join(re.escape(x) for x in banned)); bad=[]
for path in sorted(Path(".agents").rglob("*.md")):
  for i,line in enumerate(text(path).splitlines(),1):
      if pattern.search(line): bad.append(f"{path}:{i}: {line.strip()}")
if bad: fail(".agents harness must stay generic; project-specific terms found:\n"+"\n".join(bad[:200]))
print("Local markdown links OK:", checked, "checked")
print("Docs design baseline checks passed")
PY
