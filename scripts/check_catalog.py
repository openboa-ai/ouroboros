"""Deterministic responsibility selection and result accounting for repository checks.

This module reads no host state and starts no process. A caller supplies the complete
flattened changed-path set (including old and new rename paths) and source identity.
Results attest only what the caller actually ran; a digest is identity, not trust.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from pathlib import PurePosixPath
import re

from native_scenarios import SCENARIOS


LANES = ("integrity", "fast", "postgres", "native", "recovery")


class CatalogError(ValueError):
    """The plan or evidence cannot safely be interpreted."""


_BASE = {
    "repository.integrity": ("integrity", ("repository",), "Required repository, paths and source integrity."),
    "rust.invariants": ("fast", ("rust",), "Deterministic Rust invariants and static checks."),
    "tooling.contracts": ("fast", ("tooling",), "Fixture binding, runner selection and bounded tool contracts."),
    "config.startup": ("fast", ("configuration",), "Invalid configuration fails before ambient credentials or effects."),
    "core.transactions": ("postgres", ("core",), "Current authority, shared limits, idempotency and unresolved state."),
    "core.mutations": ("postgres", ("core",), "The control oracle rejects isolated authority, capacity and idempotency regressions."),
    "resources.receipts": ("postgres", ("resources",), "Resource effects and protected receipts commit and recover together."),
    "ingress.api_cli": ("postgres", ("gateway", "cli"), "Actual mTLS API and CLI preserve caller authority and observable states."),
    "resources.api": ("postgres", ("resources", "gateway", "cli"), "Managed resource API preserves receipts, authority and bounded transfer behavior."),
    "conversations.api": ("postgres", ("conversations", "gateway", "cli"), "Human and agent conversation participation retains scoped access and delivery."),
    "wake.api": ("postgres", ("wake", "core", "gateway"), "Registered wake conditions preserve idempotency and current execution authority."),
    "recovery.crypto": ("recovery", ("recovery",), "Bounded sealed archive use does not publish unauthenticated plaintext."),
    "recovery.archive": ("recovery", ("recovery",), "Archive verification and isolated staging preserve exact data and limits."),
    "recovery.postgres": ("recovery", ("recovery",), "Restored PostgreSQL state and restricted inspection preserve obligations."),
}

_DOCUMENTS = frozenset({
    "README.md", "AGENTS.md", "ARCHITECTURE.md", "CORE_DOCTRINE.md", "SOVEREIGN.md",
    "WHITEPAPER.md", "PRODUCT_SPECIFICATION.md", "SECURITY.md", "CODEOWNERS", "LICENSE",
    ".github/pull_request_template.md",
})
_SHARED = frozenset({
    "Cargo.toml", "Cargo.lock", "rust-toolchain", "rust-toolchain.toml", ".gitignore",
    "scripts/check.py", "scripts/check_catalog.py", "scripts/test-check-catalog.py",
    "scripts/native_scenarios.py", "scripts/test-native-suite-contract.py",
    "scripts/run-native-scenario.py", "scripts/test-connected-native-guest.py",
    "scripts/fixture_config.py", "scripts/fixture_release.py", "scripts/test-profile.sh",
    "scripts/prepare-test-db.py", "scripts/prepare-resource-dbs.py",
    "scripts/provision-test-guest.sh", "scripts/install-test-rust.sh",
})
_SHARED_PREFIXES = (
    "crates/contracts/", "crates/transport/", ".github/workflows/", ".cargo/",
    "scripts/fixtures/", "scripts/ci/",
)
_FAST = frozenset({"rust.invariants", "tooling.contracts", "config.startup"})
_RECOVERY = frozenset({"recovery.crypto", "recovery.archive", "recovery.postgres"})

# Responsibility closure includes dependent connected behaviors, not a Rust import graph.
# A central authority/storage change has a deliberately wider impact than a single command.
_RESPONSIBILITY_CHECKS = {
    "core": {"core.transactions", "ingress.api_cli", "resources.api", "conversations.api", "wake.api"},
    "gateway": {"ingress.api_cli", "resources.api", "conversations.api", "wake.api"},
    "runtime": set(),
    "resources": {"resources.receipts", "ingress.api_cli", "resources.api"},
    "cli": {"ingress.api_cli", "resources.api", "conversations.api", "wake.api"},
    "conversations": {"core.transactions", "ingress.api_cli", "conversations.api"},
    "wake": {"core.transactions", "ingress.api_cli", "wake.api", "native.timer-successor"},
    "adapters": {"core.transactions", "ingress.api_cli", "resources.api"},
    "credentials": {"resources.receipts", "ingress.api_cli", "resources.api"},
    "deployment": {"ingress.api_cli"},
    "recovery": set(_RECOVERY),
}

_SCRIPT_RESPONSIBILITIES = {
    "scripts/test-api-cli.py": ("core", "gateway", "cli"),
    "scripts/prepare-api-fixture.py": ("core", "gateway", "cli"),
    "scripts/test-resource-api.py": ("core", "gateway", "resources", "cli"),
    "scripts/test-conversation-api.py": ("conversations",),
    "scripts/test-wake-api.py": ("wake",),
    "scripts/test-control-mutations.py": ("core",),
    "scripts/test-runtime-guest.py": ("runtime",),
    "scripts/test-connected-runtime-guest.py": ("runtime", "core", "gateway"),
    "scripts/test-connected-management-guest.py": ("core", "gateway", "runtime"),
    "scripts/test-connected-program-guest.py": ("runtime", "resources", "adapters"),
    "scripts/test-managed-guard-guest.py": ("runtime", "deployment"),
    "scripts/test-service-install.py": ("deployment",),
    "scripts/test-existing-storage-guest.py": ("deployment", "recovery", "resources"),
    "scripts/test-provider-process.py": ("credentials", "resources", "gateway"),
    "scripts/test-provider-https-fixture.py": ("credentials", "resources"),
    "scripts/test-backup-seal.py": ("recovery",),
    "scripts/test-recovery-archive.py": ("recovery",),
    "scripts/test-recovery-postgres.py": ("recovery",),
    "scripts/fixture_recovery_schema.py": ("recovery", "core", "resources"),
    "scripts/fixture_recovery_inspection.py": ("recovery", "core", "gateway"),
    "scripts/storage_fault_proxy.py": ("resources",),
}
_TOOLING_SCRIPTS = frozenset({
    "scripts/test-build-profile.py", "scripts/test-fixture-config.py",
    "scripts/test-fixture-release.py", "scripts/test-config-startup.py",
})


def catalog() -> dict[str, dict]:
    """Return the current authoritative scenario IDs; callers must not infer IDs."""
    result = {
        name: {"lane": lane, "responsibilities": list(responsibilities), "purpose": purpose}
        for name, (lane, responsibilities, purpose) in _BASE.items()
    }
    for name, scenario in SCENARIOS.items():
        if not name.startswith("native.") or name in result:
            raise CatalogError("invalid or duplicate native scenario ID")
        result[name] = {"lane": "native", "responsibilities": list(scenario.responsibilities),
                        "purpose": scenario.purpose}
    return result


def _digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=True).encode()).hexdigest()


def _source_digest(value: object) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise CatalogError("source_digest must be a lowercase SHA-256 digest")
    return value


def _revision(value: object, field: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 256 or any(ord(c) < 32 for c in value):
        raise CatalogError(field + " must be an explicit nonempty revision identity")
    return value


def _paths(changed_paths: Iterable[str]) -> list[str]:
    if isinstance(changed_paths, (str, bytes)) or not isinstance(changed_paths, Iterable):
        raise CatalogError("changed_paths must contain repository-relative paths")
    paths = set()
    for path in changed_paths:
        if (not isinstance(path, str) or not path or path.startswith("/") or "\\" in path
                or any(ord(c) < 32 for c in path) or any(p in ("", ".", "..") for p in path.split("/"))):
            raise CatalogError("invalid changed path")
        paths.add(path)
    return sorted(paths)


def _affected(path: str) -> tuple[str, ...] | None:
    """None is unknown/shared and requires every check; () is known documentation."""
    if path in _DOCUMENTS or (path.startswith("docs/") and PurePosixPath(path).suffix == ".md"):
        return ()
    if (path in _SHARED or path.startswith(_SHARED_PREFIXES)
            or path.startswith("scripts/native") or path.startswith("scripts/fixture_native")
            or path.startswith("scripts/prepare-connected") or path.startswith("scripts/prepare-codex")
            or path.startswith("scripts/prepare-checkpoint")):
        return None
    if path in _TOOLING_SCRIPTS:
        return ("tooling", "configuration")
    if path in _SCRIPT_RESPONSIBILITIES:
        return _SCRIPT_RESPONSIBILITIES[path]
    if path.startswith("deploy/"):
        return ("deployment", "runtime", "resources", "recovery")
    if path.startswith("crates/core/"):
        if "/migrations/" in path:
            return ("core", "resources", "recovery")
        if path == "crates/core/src/wakes.rs":
            return ("wake",)
        if path == "crates/core/src/conversations.rs":
            return ("conversations",)
        if path in {
            "crates/core/src/adapters.rs", "crates/core/src/adapter_activation.rs",
            "crates/core/src/connections.rs", "crates/core/src/connection_activation.rs",
            "crates/core/src/http/capabilities.rs",
        }:
            return ("adapters",)
        return ("core",)
    if path.startswith("crates/gateway/"):
        return ("gateway",)
    if path.startswith("crates/runtime/"):
        return ("runtime",)
    if path.startswith("crates/resources/"):
        return ("resources", "credentials", "recovery")
    if path.startswith("crates/cli/"):
        if path in {
            "crates/cli/src/backup_crypto.rs", "crates/cli/src/bin/ouroboros-backup-open.rs",
            "crates/cli/src/bin/ouroboros-backup-seal.rs",
            "crates/cli/src/bin/ouroboros-recovery-archive.rs",
        }:
            return ("recovery",)
        if path in {
            "crates/cli/src/service_install.rs", "crates/cli/src/service_manager.rs",
            "crates/cli/src/bin/ouroboros-service-unit.rs",
        }:
            return ("deployment",)
        # The central CLI command dispatcher reaches all the responsibility surfaces.
        return tuple(_RESPONSIBILITY_CHECKS)
    return None


def build_plan(changed_paths: Iterable[str], *, base: str, head: str,
               source_digest: str, mode: str = "affected") -> dict:
    """Select conservatively from paths, including paths no longer present on disk."""
    base, head = _revision(base, "base"), _revision(head, "head")
    source_digest = _source_digest(source_digest)
    if mode not in ("affected", "full"):
        raise CatalogError("mode must be affected or full")
    paths = _paths(changed_paths)
    checks = catalog()
    reasons: dict[str, set[str]] = {"repository.integrity": {"always required"}}

    def add(ids: Iterable[str], why: str):
        for check in ids:
            reasons.setdefault(check, set()).add(why)

    if mode == "full":
        add(checks, "explicit full validation")
    for path in paths:
        affected = _affected(path)
        if affected is None:
            add(checks, "shared or unclassified path: " + path)
            continue
        if not affected:
            add(("repository.integrity",), "documentation: " + path)
            continue
        add(_FAST, "implementation or test tooling: " + path)
        for responsibility in affected:
            add(_RESPONSIBILITY_CHECKS.get(responsibility, ()), responsibility + ": " + path)
            add((name for name, entry in checks.items()
                 if entry["lane"] == "native" and responsibility in entry["responsibilities"]),
                responsibility + ": " + path)
    if "core.transactions" in reasons:
        add(("core.mutations",), "control contract changes require oracle qualification")
    selected = sorted(reasons, key=lambda name: (LANES.index(checks[name]["lane"]), name))
    result = {"schema": 1, "base": base, "head": head, "source_digest": source_digest,
              "changed_paths": paths, "mode": mode, "catalog_digest": _digest(checks),
              "selected": selected,
              "reasons": {name: sorted(reasons[name]) for name in selected},
              "matrix": {"include": [
                  {"lane": lane, "scenarios": [name for name in selected if checks[name]["lane"] == lane]}
                  for lane in LANES if any(checks[name]["lane"] == lane for name in selected)
              ]}}
    result["plan_digest"] = _digest(result)
    return result


def validate_plan(plan: Mapping, *, source_digest: str) -> None:
    """Recompute the current selection; a rehashed, narrowed plan is still invalid."""
    _source_digest(source_digest)
    if not isinstance(plan, Mapping):
        raise CatalogError("plan must be an object")
    try:
        rebuilt = build_plan(plan["changed_paths"], base=plan["base"], head=plan["head"],
                             source_digest=plan["source_digest"], mode=plan["mode"])
    except (KeyError, TypeError) as error:
        raise CatalogError("incomplete plan") from error
    if dict(plan) != rebuilt:
        raise CatalogError("plan differs from current catalog selection or its identity")
    if plan["source_digest"] != source_digest:
        raise CatalogError("plan source differs from the source being checked")


def aggregate_results(plan: Mapping, results: Iterable[Mapping], *, source_digest: str) -> dict:
    """Require exactly one current-source PASS per selected ID; omissions cannot pass.

    Only structured status is aggregated. Optional local diagnostics are deliberately
    not copied into this publishable summary, since they may contain secret paths/data.
    """
    validate_plan(plan, source_digest=source_digest)
    if isinstance(results, (str, bytes, Mapping)) or not isinstance(results, Iterable):
        raise CatalogError("results must be a sequence of scenario result objects")
    required = set(plan["selected"])
    seen: dict[str, str] = {}
    for result in results:
        if not isinstance(result, Mapping):
            raise CatalogError("invalid scenario result")
        name, status = result.get("id"), result.get("status")
        if not isinstance(name, str) or name not in required:
            raise CatalogError("unexpected scenario result ID")
        if name in seen:
            raise CatalogError("duplicate scenario result ID")
        if (result.get("plan_digest") != plan["plan_digest"]
                or result.get("source_digest") != source_digest):
            raise CatalogError("scenario result plan/source mismatch")
        if status not in ("PASS", "FAIL", "NOT RUN", "CANCELLED", "ERROR", "TIMEOUT", "SKIPPED"):
            raise CatalogError("unknown scenario result status")
        seen[name] = status
    missing = [name for name in plan["selected"] if name not in seen]
    failed = [{"id": name, "status": seen[name]} for name in plan["selected"]
              if name in seen and seen[name] != "PASS"]
    return {"schema": 1, "status": "PASS" if not missing and not failed else "FAIL",
            "head": plan["head"], "source_digest": source_digest,
            "plan_digest": plan["plan_digest"], "required": len(required),
            "passed": sum(value == "PASS" for value in seen.values()),
            "missing": missing, "failed": failed}
