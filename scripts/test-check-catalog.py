#!/usr/bin/env python3
"""Check coverage selection and evidence identity, without executing product scenarios."""
import copy
import hashlib
import json
import unittest
from unittest.mock import patch

import check_catalog as checks
from native_scenarios import SCENARIOS


SOURCE = "a" * 64
OTHER_SOURCE = "b" * 64


class CoverageSelection(unittest.TestCase):
    def plan(self, paths=(), **kw):
        return checks.build_plan(paths, base="1" * 40, head="2" * 40,
                                 source_digest=SOURCE, **kw)

    def results(self, plan):
        return [{"id": name, "status": "PASS", "plan_digest": plan["plan_digest"],
                 "source_digest": SOURCE} for name in plan["selected"]]

    def test_known_documentation_requires_integrity_only(self):
        plan = self.plan(["README.md", "docs/architecture/CONTROL_CORE.md"])
        self.assertEqual(plan["selected"], ["repository.integrity"])
        self.assertEqual(plan["matrix"], {"include": [
            {"lane": "integrity", "scenarios": ["repository.integrity"]}]})
        self.assertEqual(self.plan()["selected"], ["repository.integrity"])

    def test_core_and_runtime_select_each_declared_connected_dependency(self):
        for path, responsibility in [("crates/core/src/http/context.rs", "core"),
                                     ("crates/runtime/src/guard_process.rs", "runtime")]:
            with self.subTest(path=path):
                plan = self.plan([path])
                required = {name for name, scenario in SCENARIOS.items()
                            if responsibility in scenario.responsibilities}
                self.assertTrue(required <= set(plan["selected"]))
                self.assertTrue({"rust.invariants", "config.startup"} <= set(plan["selected"]))
        self.assertIn("native.management-isolation", self.plan(["crates/runtime/src/lib.rs"])["selected"])
        self.assertIn("native.install-faults", self.plan(["crates/cli/src/service_install.rs"])["selected"])
        self.assertIn("core.transactions", self.plan(["crates/core/src/actors.rs"])["selected"])
        self.assertIn("ingress.api_cli", self.plan(["crates/gateway/src/resources.rs"])["selected"])

    def test_narrow_conversation_and_backup_changes_do_not_run_all_native_cases(self):
        conversation = set(self.plan(["crates/core/src/conversations.rs"])["selected"])
        self.assertIn("native.conversation-reply", conversation)
        self.assertNotIn("native.encrypted-provider", conversation)
        backup = self.plan(["crates/cli/src/backup_crypto.rs"])
        self.assertTrue({"recovery.crypto", "recovery.archive", "recovery.postgres"} <= set(backup["selected"]))
        self.assertNotIn("native.adapter-stop-running", backup["selected"])

    def test_public_resource_conversation_and_wake_surfaces_remain_selected(self):
        for path in ["crates/core/src/lib.rs", "crates/gateway/src/main.rs"]:
            self.assertTrue({"resources.api", "conversations.api", "wake.api"} <=
                            set(self.plan([path])["selected"]))
        self.assertIn("resources.api", self.plan(["crates/resources/src/lib.rs"])["selected"])
        chat = self.plan(["crates/core/src/conversations.rs"])["selected"]
        self.assertIn("conversations.api", chat)
        wake = self.plan(["crates/core/src/wakes.rs"])["selected"]
        self.assertTrue({"wake.api", "native.timer-successor"} <= set(wake))

    def test_unknown_shared_selector_and_native_fixture_select_full(self):
        for path in ["future/server.go", "Cargo.lock", "crates/contracts/src/program.rs",
                     "crates/transport/src/recovery.rs", ".github/workflows/ci.yml",
                     "scripts/check_catalog.py", "scripts/check.py", "scripts/native_scenarios.py",
                     "scripts/test-connected-native-guest.py", "scripts/fixture_native_recovery.py"]:
            with self.subTest(path=path):
                plan = self.plan([path])
                self.assertEqual(set(plan["selected"]), set(checks.catalog()))
                self.assertTrue(all(plan["reasons"].values()))

    def test_deleted_and_both_renamed_paths_remain_selected_without_filesystem_lookup(self):
        # The caller flattens git name-status: deleting a path must not remove its responsibility.
        removed = self.plan(["crates/runtime/src/no-longer-present.rs"])
        self.assertIn("native.runtime-loss", removed["selected"])
        renamed = self.plan(["crates/core/src/conversations.rs", "crates/runtime/src/renamed.rs"])
        self.assertIn("native.conversation-reply", renamed["selected"])
        self.assertIn("native.runtime-loss", renamed["selected"])
        # Moving previously unknown input into docs must not hide the old path's effect.
        self.assertEqual(set(self.plan(["unclassified.dat", "docs/archive.md"])["selected"]),
                         set(checks.catalog()))

    def test_control_contract_cannot_omit_mutation_oracle_qualification(self):
        for path in ["crates/core/src/lib.rs", "crates/core/src/conversations.rs",
                     "crates/core/src/adapters.rs", "crates/core/src/wakes.rs",
                     "scripts/test-control-mutations.py", "Cargo.lock"]:
            with self.subTest(path=path):
                selected = set(self.plan([path])["selected"])
                self.assertTrue({"core.transactions", "core.mutations"} <= selected)
        self.assertEqual(checks.catalog()["core.mutations"]["lane"], "postgres")

    def test_migrations_require_receipts_and_recovery(self):
        selected = self.plan(["crates/core/migrations/0031_environment_admission.sql"])["selected"]
        self.assertTrue({"core.transactions", "resources.receipts", "recovery.postgres"} <= set(selected))

    def test_path_order_duplicates_and_full_selection_are_deterministic(self):
        paths = ["crates/runtime/src/lib.rs", "README.md"]
        self.assertEqual(self.plan(paths), self.plan([*reversed(paths), paths[0]]))
        full = self.plan(["README.md"], mode="full")
        self.assertEqual(set(full["selected"]), set(checks.catalog()))
        flattened = [name for entry in full["matrix"]["include"] for name in entry["scenarios"]]
        self.assertEqual(flattened, full["selected"])
        self.assertEqual([entry["lane"] for entry in full["matrix"]["include"]], list(checks.LANES))

    def test_invalid_bindings_do_not_default_to_documentation(self):
        for paths in ["README.md", ["../README.md"], ["/README.md"], ["docs//safe.md"], [""], [None]]:
            with self.subTest(paths=paths), self.assertRaises(checks.CatalogError):
                self.plan(paths)
        with self.assertRaises(checks.CatalogError):
            self.plan([], mode="unknown")
        with self.assertRaises(checks.CatalogError):
            checks.build_plan([], base="", head="head", source_digest=SOURCE)
        with self.assertRaises(checks.CatalogError):
            checks.build_plan([], base="base", head="head", source_digest="not-a-digest")

    def test_exact_pass_and_nonpublishing_of_optional_diagnostics(self):
        plan = self.plan(["crates/core/src/conversations.rs"])
        results = self.results(plan)
        results[0]["detail"] = {"local_path": "secret-canary", "output": "credential-canary"}
        summary = checks.aggregate_results(plan, results, source_digest=SOURCE)
        self.assertEqual(summary["status"], "PASS")
        self.assertEqual(summary["passed"], len(plan["selected"]))
        self.assertNotIn("canary", json.dumps(summary))

    def test_omissions_and_all_nonpass_terminal_states_cannot_pass(self):
        plan = self.plan(["README.md"])
        missing = checks.aggregate_results(plan, [], source_digest=SOURCE)
        self.assertEqual(missing["status"], "FAIL")
        self.assertEqual(missing["missing"], plan["selected"])
        for status in ["FAIL", "NOT RUN", "CANCELLED", "ERROR", "TIMEOUT", "SKIPPED"]:
            results = self.results(plan)
            results[0]["status"] = status
            with self.subTest(status=status):
                self.assertEqual(checks.aggregate_results(plan, results, source_digest=SOURCE)["status"], "FAIL")

    def test_duplicate_unexpected_or_nonterminal_evidence_is_rejected(self):
        plan = self.plan(["README.md"])
        results = self.results(plan)
        for invalid in [results + results, results + [{**results[0], "id": "native.workflow"}],
                        [{**results[0], "status": "RUNNING"}], [True]]:
            with self.subTest(invalid=invalid), self.assertRaises(checks.CatalogError):
                checks.aggregate_results(plan, invalid, source_digest=SOURCE)

    def test_result_from_another_plan_or_source_is_rejected(self):
        plan = self.plan(["README.md"])
        for field, value in [("source_digest", OTHER_SOURCE), ("plan_digest", "0" * 64)]:
            results = self.results(plan)
            results[0][field] = value
            with self.subTest(field=field), self.assertRaises(checks.CatalogError):
                checks.aggregate_results(plan, results, source_digest=SOURCE)
        with self.assertRaises(checks.CatalogError):
            checks.aggregate_results(plan, self.results(plan), source_digest=OTHER_SOURCE)

    def test_rehashed_omission_or_stale_catalog_plan_is_rejected(self):
        plan = self.plan(["crates/runtime/src/lib.rs"])
        altered = copy.deepcopy(plan)
        missing = altered["selected"].pop()
        del altered["reasons"][missing]
        for entry in altered["matrix"]["include"]:
            if missing in entry["scenarios"]:
                entry["scenarios"].remove(missing)
        del altered["plan_digest"]
        altered["plan_digest"] = hashlib.sha256(json.dumps(
            altered, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()
        with self.assertRaises(checks.CatalogError):
            checks.aggregate_results(altered, self.results(altered), source_digest=SOURCE)
        current = checks.catalog()
        current["new.required"] = {"lane": "fast", "responsibilities": ["rust"], "purpose": "new contract"}
        with patch.object(checks, "catalog", return_value=current), self.assertRaises(checks.CatalogError):
            checks.aggregate_results(plan, self.results(plan), source_digest=SOURCE)


if __name__ == "__main__":
    unittest.main()
