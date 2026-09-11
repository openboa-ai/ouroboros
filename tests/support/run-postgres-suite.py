#!/usr/bin/env python3
"""Run real PG18 contracts and API/CLI against a new, runner-owned local cluster.

Prebuild product binaries in --binary-dir. Cargo integration tests use a separate
test target, --locked, and the explicit postgres-tests feature. No existing server,
provider account, or research directory is used.
"""
from __future__ import annotations

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import sys
import tempfile
import time

from tests.support.postgres_suite_support import (Cancellation, Commands, PostgreSQL, SuiteFailure, cargo_result,
                                    free_ports, group_exists, private_write, report_write, safe_environment)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    if not __debug__:
        parser.error("optimized Python cannot execute assertion-based validation")
    for key in ("source-root", "binary-dir", "pg-bin", "scratch-root"):
        parser.add_argument("--" + key, type=Path, required=True)
    parser.add_argument("--suite", choices=("core-db", "control-mutations", "resources-db", "api-cli", "resource-api", "conversation-api", "wake-api", "all"), default="all")
    parser.add_argument("--cargo", default="cargo", help="Cargo executable; binaries must already be built")
    parser.add_argument("--test-target-dir", type=Path,
                        help="Separate cached Cargo test target; default: binary-dir parent/contract-tests")
    parser.add_argument("--offline", action="store_true", help="Forbid dependency downloads during Cargo tests")
    parser.add_argument("--timeout-seconds", type=int, default=1200, help="Per-suite deadline, 30..3600 seconds")
    parser.add_argument("--report-file", type=Path, help="Optional new JSON result file, safe for CI artifacts")
    args = parser.parse_args()
    if os.geteuid() == 0:
        parser.error("PostgreSQL suites must run as a nonroot user")
    if not 30 <= args.timeout_seconds <= 3600:
        parser.error("timeout-seconds must be between 30 and 3600")
    for key in ("source_root", "binary_dir", "pg_bin", "scratch_root"):
        value = getattr(args, key).resolve(strict=True)
        if not value.is_dir():
            parser.error(key.replace("_", "-") + " must be an existing directory")
        setattr(args, key, value)
    parent = args.scratch_root.stat()
    if parent.st_uid != os.getuid() or parent.st_mode & 0o777 != 0o700:
        parser.error("scratch-root must be caller-owned mode 0700")
    if shutil.disk_usage(args.scratch_root).free < 512 * 1024 * 1024:
        parser.error("scratch-root requires at least 512 MiB of free space")
    if args.binary_dir.name not in {"debug", "release"}:
        parser.error("binary-dir must be the debug or release directory within a Cargo target directory")
    target = args.test_target_dir or args.binary_dir.parent / "contract-tests"
    if (not target.is_absolute() or target.resolve() != target
            or target == args.binary_dir or target in args.binary_dir.parents
            or args.binary_dir in target.parents):
        parser.error("test-target-dir must be an exact absolute path separate from product binaries")
    if not target.exists():
        parent = target.parent.stat()
        if not target.parent.is_dir() or parent.st_uid != os.getuid() or parent.st_mode & 0o022:
            parser.error("new test-target-dir requires a protected caller-owned existing parent")
        target.mkdir(mode=0o700)
    info = target.stat()
    if not target.is_dir() or info.st_uid != os.getuid() or info.st_mode & 0o022:
        parser.error("test-target-dir must be a protected caller-owned directory")
    args.test_target_dir = target
    if not (args.source_root / "Cargo.toml").is_file():
        parser.error("source-root must contain the Ouroboros Cargo workspace")
    if args.report_file:
        args.report_file = args.report_file.absolute()
        if not args.report_file.parent.is_dir() or args.report_file.exists() or args.report_file.is_symlink():
            parser.error("report-file must be a new file within an existing directory")
    return args


def database_suite(args, root, commands, pg, suite):
    env = dict(commands.env)
    scratch = root / (suite + "-artifacts")
    scratch.mkdir(mode=0o700)
    if suite == "core-db":
        database = "ouro_test_" + secrets.token_hex(8)
        pg.sql("CREATE DATABASE " + database)
        url_file = root / "core-test.url"
        private_write(url_file, pg.url(database) + "\n")
        env["OURO_TEST_DATABASE_URL_FILE"] = str(url_file)
        package = "ouroboros-core"
    else:
        env["OURO_RESOURCE_TEST_ADMIN_URL_FILE"] = str(root / "admin.url")
        package = "ouroboros-resources"
    env.update(OURO_TEST_TEMP_DIR=str(scratch), OURO_TEST_BINARY_DIR=str(args.binary_dir))
    command = [args.cargo, "test", "--locked", "--manifest-path", str(args.source_root / "Cargo.toml"),
               "--target-dir", str(args.test_target_dir), "-p", package,
               "--features", "postgres-tests", "--test", "*"]
    if args.offline:
        command.append("--offline")
    if args.binary_dir.name == "release":
        command.append("--release")
    command.extend(["--", "--test-threads=2"])
    return cargo_result(commands.run(suite, command, env=env, cwd=args.source_root,
                                    timeout=args.timeout_seconds))


def management_fixture(args, root, commands, pg, suite):
    binaries = ("ouroboros-migrate", "ouroboros-core", "ouroboros-gateway", "ouroboros-cli")
    for name in binaries:
        binary = args.binary_dir / name
        if not binary.is_file() or not os.access(binary, os.X_OK):
            raise SuiteFailure("API fixture requires prebuilt executable " + name)
    common = {"bin_dir": str(args.binary_dir), "bind_host": "127.0.0.1",
              "disposable_database": True, "admin_url_file": str(root / "admin.url"),
              "database": {"host": "127.0.0.1", "port": pg.port}}
    db_config = root / (suite + "-database.json")
    database_root = root / (suite + "-database")
    private_write(db_config, json.dumps({**common, "root": str(database_root), "ports": {}}))
    commands.run(suite + "-database-prepare", [sys.executable, str(args.source_root / "tests/support/prepare-test-db.py"), "--config", str(db_config)])
    commands.secrets.append((database_root / "test-database.url").read_text().strip())
    commands.run(suite + "-migrate", [str(args.binary_dir / "ouroboros-migrate"), "--database-url-file", str(database_root / "test-database.url")])
    core_port, gateway_port = free_ports(2)
    fixture_root = root / (suite + "-fixture")
    config = root / (suite + "-fixture.json")
    private_write(config, json.dumps({**common, "root": str(fixture_root),
        "ports": {"core": core_port, "gateway": gateway_port},
        "database": {**common["database"], "metadata_file": str(database_root / "test-database.json")}}))
    commands.run(suite + "-fixture-prepare", [sys.executable, str(args.source_root / "tests/support/prepare-api-fixture.py"), "--config", str(config)])
    commands.secrets.append((fixture_root / "core-database.url").read_text().strip())
    return config, fixture_root


def api_suite(args, root, commands, pg, suite):
    config, fixture_root = management_fixture(args, root, commands, pg, suite)
    commands.run(suite, [sys.executable, str(args.source_root / "tests/contracts" / ("test-" + suite + ".py")), "--config", str(config)],
                 timeout=args.timeout_seconds)
    result_file = "api-test-result.json" if suite == "api-cli" else "result.json"
    evidence = json.loads((fixture_root / result_file).read_text())
    if evidence.get("result") != "PASS" or not evidence.get("checks"):
        raise SuiteFailure("API fixture did not produce successful behavioral evidence")
    return {"status": "PASS", "checks": evidence["checks"], "private_execution": "NOT RUN",
            "subscription": "NOT RUN"}


def resource_api_suite(args, root, commands, pg):
    for name in ("ouroboros-migrate", "ouroboros-resource-migrate", "ouroboros-core",
                 "ouroboros-gateway", "ouroboros-resources", "ouroboros-storage", "ouroboros-cli"):
        binary = args.binary_dir / name
        if not binary.is_file() or not os.access(binary, os.X_OK):
            raise SuiteFailure("resource API fixture requires prebuilt executable " + name)
    config = root / "resource-api-fixture.json"
    fixture_root = root / "resource-api-fixture"
    ports = dict(zip(("core", "gateway", "company", "catalog", "fixture"), free_ports(5)))
    private_write(config, json.dumps({"root": str(fixture_root), "bin_dir": str(args.binary_dir),
        "bind_host": "127.0.0.1", "ports": ports, "disposable_database": True,
        "admin_url_file": str(root / "admin.url"), "database": {"host": "127.0.0.1", "port": pg.port}}))
    # One named complete resource scenario selects the existing finite cases. No
    # PostgreSQL restart handoff or external owner/controller is required.
    commands.run("resource-api", [sys.executable, str(args.source_root / "tests/contracts/test-resource-api.py"),
        "--config", str(config), "--storage-failure-checks", "--binary-checks", "--workspace-checks",
        "--retirement-checks", "--collection-checks"], timeout=args.timeout_seconds)
    evidence = json.loads((fixture_root / "result.json").read_text())
    cases = ("storage_failure", "binary", "workspace", "retirement", "collection")
    if (evidence.get("result") != "PASS" or not evidence.get("checks")
            or any(evidence.get(case, {}).get("result") != "PASS" for case in cases)):
        raise SuiteFailure("resource API fixture lacks a required successful behavioral case")
    return {"status": "PASS", "checks": evidence["checks"],
            "subcases": {case: evidence[case] for case in cases},
            "native_codex": "NOT RUN", "linux_isolation": "NOT RUN", "subscription": "NOT RUN"}


def mutation_suite(args, root, commands, pg):
    database = "ouro_test_" + secrets.token_hex(8)
    pg.sql("CREATE DATABASE " + database)
    url_file = root / "control-mutant.url"
    private_write(url_file, pg.url(database) + "\n")
    scratch = root / "control-mutation-artifacts"
    scratch.mkdir(mode=0o700)
    target = root / "control-mutation-target"
    if target.is_relative_to(args.source_root):
        raise SuiteFailure("control mutation scratch must be outside the working source")
    target.mkdir(mode=0o700)
    commands.run("control-mutations", [sys.executable, str(args.source_root / "tests/contracts/test-control-mutations.py"),
        "--source-root", str(args.source_root), "--cargo", args.cargo,
        "--target-dir", str(target), "--scratch-root", str(scratch),
        "--database-url-file", str(url_file), "--timeout-seconds", str(min(args.timeout_seconds, 1800)),
        "--offline"], timeout=args.timeout_seconds)
    evidence = json.loads((scratch / "result.json").read_text())
    cases = evidence.get("cases", [])
    if (evidence.get("status") != "PASS" or evidence.get("source_unchanged") is not True
            or evidence.get("cleanup_ok") is not True or len(cases) != 4
            or {case.get("id") for case in cases} != {"baseline", "authority", "capacity", "replay"}):
        raise SuiteFailure("control mutation proof is missing or incomplete")
    for case in cases:
        if case["id"] == "baseline":
            valid = case.get("status") == "PASS" and case.get("test_executed") is True
        else:
            valid = (case.get("status") == "KILLED" and case.get("compiled") is True
                     and case.get("expected_assertion") is True)
        if not valid:
            raise SuiteFailure("control mutation proof did not reject an expected violation")
    return {"status": "PASS", "cases": cases, "source_unchanged": True, "cleanup_ok": True}


def main() -> int:
    args = arguments()
    root = Path(tempfile.mkdtemp(prefix="pg-suite-", dir=args.scratch_root)).resolve()
    secrets_list = [secrets.token_hex(32)]
    commands = Commands(root, safe_environment(args.pg_bin), secrets_list)
    pg = PostgreSQL(root, args.pg_bin, commands, "ouro_test_" + secrets.token_hex(8), secrets_list[0])
    started = time.monotonic()
    report = {"runner": "postgres-suite", "status": "FAIL", "suites": {},
              "subscription": "NOT RUN", "existing_database_accessed": False}
    cancellation = Cancellation()
    cancellation.install()
    try:
        pg.start()
        report["postgres_version"] = pg.version
        private_write(root / "admin.url", pg.url() + "\n")
        suites = ("core-db", "control-mutations", "resources-db", "api-cli", "resource-api", "conversation-api", "wake-api") if args.suite == "all" else (args.suite,)
        for suite in suites:
            before = time.monotonic()
            if suite in {"core-db", "resources-db"}:
                result = database_suite(args, root, commands, pg, suite)
            elif suite == "control-mutations":
                result = mutation_suite(args, root, commands, pg)
            elif suite == "resource-api":
                result = resource_api_suite(args, root, commands, pg)
            else:
                result = api_suite(args, root, commands, pg, suite)
            result["duration_seconds"] = round(time.monotonic() - before, 3)
            report["suites"][suite] = result
        report["status"] = "PASS"
    except SuiteFailure as error:
        report["failure"] = str(error)
    except BaseException:
        # Third-party diagnostic strings may contain random fixture credentials.
        report["failure"] = "interrupted" if cancellation.interrupted else "fixture preparation or execution failed"
    finally:
        cancellation.begin_cleanup()
        try:
            pg.stop()
        except BaseException:
            report["cleanup_failure"] = "owned PostgreSQL shutdown could not be verified"
            report["status"] = "FAIL"
        report["cleanup"] = {"postgres_clean_shutdown": pg.shutdown_verified,
                             "child_groups_cleaned": commands.cleanup_ok}
        if not commands.cleanup_ok:
            report["status"] = "FAIL"
        report["duration_seconds"] = round(time.monotonic() - started, 3)
        # Publish only redacted command output and summary; database bytes, synthetic
        # credentials, certificates and service logs never become CI artifacts.
        for child in list(root.iterdir()):
            try:
                if child.is_file() and child.suffix == ".log":
                    continue
                if child.is_dir() and not child.is_symlink():
                    if child == pg.cluster and pg.child is not None and group_exists(pg.child.pid):
                        report["cleanup_failure"] = "live owned database retained for explicit recovery"
                        report["status"] = "FAIL"
                        continue
                    shutil.rmtree(child)
                else:
                    child.unlink(missing_ok=True)
            except OSError:
                report["cleanup_failure"] = "private fixture material could not be completely removed"
                report["status"] = "FAIL"
        report_write(root / "report.json", report)
        if args.report_file:
            report_write(args.report_file, report)
        cancellation.restore()
    print(json.dumps({**report, "evidence_directory": str(root)}, sort_keys=True))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
