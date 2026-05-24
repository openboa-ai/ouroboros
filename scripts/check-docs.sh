#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
node scripts/check-naming-surface.mjs
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
skill_name_re=re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
def has_unescaped_double_quote(value):
  escaped=False
  for char in value:
      if escaped:
          escaped=False; continue
      if char == "\\":
          escaped=True; continue
      if char == '"':
          return True
  return False
def has_unescaped_single_quote(value):
  i=0
  while i < len(value):
      if value[i] != "'":
          i += 1; continue
      if i + 1 < len(value) and value[i + 1] == "'":
          i += 2; continue
      return True
  return False
def closing_quote_index(value):
  quote=value[0]
  escaped=False; i=1
  while i < len(value):
      char=value[i]
      if quote == '"' and escaped:
          escaped=False; i += 1; continue
      if quote == '"' and char == "\\":
          escaped=True; i += 1; continue
      if quote == "'" and char == "'" and i + 1 < len(value) and value[i + 1] == "'":
          i += 2; continue
      if char == quote:
          return i
      i += 1
  return None
def strip_inline_comment(value):
  if value and value[0] in {"'", '"'}:
      end=closing_quote_index(value)
      if end is not None:
          suffix=value[end+1:].strip()
          if not suffix or suffix.startswith("#"):
              return value[:end+1]
      return value
  return re.sub(r"\s+#.*$", "", value).rstrip()
def frontmatter_scalars(fm, path):
  data={}; errors=[]
  for offset,line in enumerate(fm.splitlines(),2):
      if not line.strip(): continue
      if line.lstrip().startswith("#"): continue
      if line.startswith((" ", "\t")):
          errors.append(f"{path}:{offset}: frontmatter must use top-level scalar keys only"); continue
      if ":" not in line:
          errors.append(f"{path}:{offset}: invalid frontmatter line"); continue
      key, raw = line.split(":",1); value=raw.strip()
      if not re.match(r"^[A-Za-z0-9_-]+$", key):
          errors.append(f"{path}:{offset}: invalid frontmatter key {key!r}"); continue
      if not value:
          errors.append(f"{path}:{offset}: missing frontmatter value for {key}"); continue
      value=strip_inline_comment(value)
      if not value:
          errors.append(f"{path}:{offset}: missing frontmatter value for {key}"); continue
      quoted=len(value)>=2 and value[0] == value[-1] and value[0] in {"'", '"'}
      if not quoted and ": " in value:
          errors.append(f"{path}:{offset}: quote frontmatter values containing ': '"); continue
      if quoted and value[0] == '"':
          value=value[1:-1]
          if has_unescaped_double_quote(value):
              errors.append(f"{path}:{offset}: invalid unescaped double quote in frontmatter value"); continue
      elif quoted:
          value=value[1:-1]
          if has_unescaped_single_quote(value):
              errors.append(f"{path}:{offset}: invalid unescaped single quote in frontmatter value"); continue
          value=value.replace("''", "'")
      data[key]=value
  return data, errors
for path in skill_files:
  body=text(path)
  if not body.startswith("---\n"): skill_errors.append(f"{path}: missing YAML frontmatter"); continue
  _, fm, _ = body.split("---", 2)
  meta, fm_errors = frontmatter_scalars(fm, path)
  skill_errors.extend(fm_errors)
  name=meta.get("name", "")
  desc=meta.get("description", "")
  if name != path.parent.name: skill_errors.append(f"{path}: bad name")
  if not skill_name_re.fullmatch(name) or "--" in name:
      skill_errors.append(f"{path}: name must be lowercase hyphen-case, 1-64 chars, no edge hyphen or double hyphen")
  if len(desc) > 1024:
      skill_errors.append(f"{path}: description longer than 1024 characters")
  if not desc.startswith("Use when"): skill_errors.append(f"{path}: bad description")
  if len(body.splitlines()) > 500:
      skill_errors.append(f"{path}: SKILL.md longer than 500 lines")
  for heading in ["## Role", "## Workflow", "## Required Output", "## Handoff", "## Hard Boundaries"]:
      if heading not in body: skill_errors.append(f"{path}: missing heading {heading}")
if skill_errors: fail("Skill check failed:\n"+"\n".join(skill_errors[:200]))
codex_agent_files=sorted(Path(".codex/agents").glob("*.toml")); agent_errors=[]
toml_name_re=re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$")
def toml_string(body, key):
  triple=re.search(rf'(?ms)^\s*{re.escape(key)}\s*=\s*"""(.*?)"""', body)
  if triple: return triple.group(1)
  double=re.search(rf'(?m)^\s*{re.escape(key)}\s*=\s*"((?:[^"\\]|\\.)*)"', body)
  if double: return double.group(1)
  single=re.search(rf"(?m)^\s*{re.escape(key)}\s*=\s*'([^']*)'", body)
  if single: return single.group(1)
  return None
def toml_scalar(body, key):
  value=toml_string(body, key)
  return value.strip() if isinstance(value, str) else None
secret_patterns=[
  r"sk-[A-Za-z0-9_-]{12,}",
  r"BEGIN [A-Z ]*PRIVATE KEY",
  r"(?i)api[_-]?key\s*=",
  r"(?i)api[_-]?secret\s*=",
  r"(?i)secret[_-]?key\s*="
]
if not codex_agent_files:
  agent_errors.append(".codex/agents: missing project-scoped custom agents")
for path in codex_agent_files:
  body=text(path)
  name=toml_scalar(body, "name")
  desc=toml_scalar(body, "description")
  instructions=toml_scalar(body, "developer_instructions")
  sandbox_mode=toml_scalar(body, "sandbox_mode")
  if name != path.stem:
      agent_errors.append(f"{path}: name must match file stem")
  if not name or not toml_name_re.fullmatch(name):
      agent_errors.append(f"{path}: missing or invalid name")
  if not desc:
      agent_errors.append(f"{path}: missing description")
  if not instructions:
      agent_errors.append(f"{path}: missing developer_instructions")
  if sandbox_mode != "read-only":
      agent_errors.append(f"{path}: sandbox_mode must be read-only")
  if instructions and "Do not edit files" not in instructions:
      agent_errors.append(f"{path}: developer_instructions must prohibit file edits")
  if instructions and "Never output raw secret values" not in instructions:
      agent_errors.append(f"{path}: developer_instructions must prohibit raw secret output")
  if instructions and "live Binance" not in instructions:
      agent_errors.append(f"{path}: developer_instructions must preserve live Binance authority boundary")
  for pattern in secret_patterns:
      if re.search(pattern, body):
          agent_errors.append(f"{path}: contains secret-looking assignment or key material")
if agent_errors: fail("Codex custom agent check failed:\n"+"\n".join(agent_errors[:200]))
corpus="\n".join(text(p) for p in [Path("AGENTS.md"), Path(".agents/AGENTS.md"), Path(".agents/skills/AGENTS.md")] if p.exists())
for term in ["llm-wiki", "writeback_needed", "project-context", ".agents/skills/AGENTS.md", "superpowers:using-superpowers", "Skill-First Gate"]:
  if term not in corpus: fail("Skill routing terms missing: "+term)
retired_project_suffix="kai"+"ros"
retired_project_terms=["auto"+retired_project_suffix, "Auto"+retired_project_suffix.capitalize()]
retired_runtime_terms=["Trader"+"System", "Runtime"+"Control", "Runtime"+"Placement"]
banned=retired_project_terms+["ouroboros", "Ouroboros", *retired_runtime_terms, "gateway", "Bootstrap", "weak-to-strong"]
pattern=re.compile("|".join(re.escape(x) for x in banned)); bad=[]
for path in sorted(Path(".agents").rglob("*.md")):
  for i,line in enumerate(text(path).splitlines(),1):
      if pattern.search(line): bad.append(f"{path}:{i}: {line.strip()}")
if bad: fail(".agents harness must stay generic; project-specific terms found:\n"+"\n".join(bad[:200]))
print("Local markdown links OK:", checked, "checked")
print("Docs design baseline checks passed")
PY
