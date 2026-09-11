#!/usr/bin/env python3
"""Prove the Core behavior oracle kills three bounded, deliberately broken controls.

Copies only Cargo manifests/lock and Rust source/test/migration inputs to private scratch.
The working source is never edited. Each mutant must compile and reach its precise expected
contract assertion; compiler errors, no tests, unrelated failures and timeouts are failures.
This is a synthetic local PostgreSQL check, not production authority or provider use.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys

from postgres_suite_support import Cancellation, Commands, SuiteFailure, private_write
from fixture_config import clean_environment, local_url

TEST = "bounded_operation_sequences_preserve_authority_identity_and_capacity"
CORE_FILE = Path("crates/core/src/lib.rs")
MUTANTS = (
    ("authority", "fresh execution ignores a denied current grant",
     '        self.actor_permission(tx, ctx, r.delegation_id, r.work_id, "execution.start")\n            .await?;',
     '        let _ = self.actor_permission(tx, ctx, r.delegation_id, r.work_id, "execution.start").await;',
     ("seed 1 step 12: Submit(1, 1)", "left: New", "right: Denied")),
    ("capacity", "accepted execution does not charge shared capacity",
     '"UPDATE limits SET committed=committed+$2 WHERE firm_id=$1 AND id=\'compute\'"',
     '"UPDATE limits SET committed=committed+($2::bigint*0) WHERE firm_id=$1 AND id=\'compute\'"',
     ("seed 1 step 0: capacity changed without settlement", "left: 0", "right: 70")),
    ("replay", "a stable key accepts changed original input",
     '            if r.get::<Value, _>("input") != *input {\n                return Err(Error::Conflict);\n            }',
     '            if false && r.get::<Value, _>("input") != *input {\n                return Err(Error::Conflict);\n            }',
     ("seed 1 step 2: Submit(0, 71)", "left: Replay", "right: Conflict")),
)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source-root", "target-dir", "scratch-root", "database-url-file"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--cargo", required=True)
    parser.add_argument("--offline", action="store_true", help="Accepted explicitly; all mutation builds are always offline")
    parser.add_argument("--timeout-seconds", type=int, default=600)
    args = parser.parse_args()
    if not 30 <= args.timeout_seconds <= 1800:
        parser.error("timeout-seconds must be between 30 and 1800")
    for name in ("source_root", "target_dir", "scratch_root", "database_url_file"):
        path = getattr(args, name)
        if not path.is_absolute() or path.resolve(strict=True) != path:
            parser.error(name + " must be an existing canonical absolute path")
    for directory in (args.source_root, args.target_dir, args.scratch_root):
        if not directory.is_dir():
            parser.error("source, target and scratch must be existing directories")
    meta = args.scratch_root.stat()
    if meta.st_uid != os.getuid() or meta.st_mode & 0o777 != 0o700:
        parser.error("scratch-root must be caller-owned mode 0700")
    if any(args.scratch_root.iterdir()):
        parser.error("scratch-root must be empty and dedicated to this proof")
    if any(args.target_dir.iterdir()) or args.target_dir.is_relative_to(args.source_root):
        parser.error("target-dir must be fresh, empty and outside the working source")
    if args.target_dir == args.scratch_root or args.target_dir.is_relative_to(args.scratch_root):
        parser.error("target-dir must be separate from the source-copy scratch directory")
    secret_meta = args.database_url_file.stat()
    if not args.database_url_file.is_file() or secret_meta.st_uid != os.getuid() or secret_meta.st_mode & 0o077:
        parser.error("database URL must be a caller-owned protected regular file")
    args.cargo = shutil.which(args.cargo)
    if not args.cargo:
        parser.error("explicit Cargo executable was not found")
    # Preserve argv[0]: rustup dispatches its cargo symlink by executable name.
    args.cargo = os.path.abspath(args.cargo)
    return args


def source_inputs(source):
    paths = [Path("Cargo.toml"), Path("Cargo.lock")]
    for crate in sorted((source / "crates").iterdir()):
        if crate.is_symlink() or not crate.is_dir():
            raise SuiteFailure("unexpected Cargo crate source entry")
        paths.append(crate.relative_to(source) / "Cargo.toml")
        for name in ("src", "tests", "migrations"):
            directory = crate / name
            if not directory.exists():
                continue
            for path in sorted(directory.rglob("*")):
                if path.is_symlink():
                    raise SuiteFailure("source copy rejects symbolic links")
                if path.is_file() and path.suffix in {".rs", ".sql"}:
                    paths.append(path.relative_to(source))
    if len(paths) > 512:
        raise SuiteFailure("source copy exceeds its finite file count")
    contents = {}
    total = 0
    for path in paths:
        entry = source / path
        if entry.is_symlink() or not entry.is_file():
            raise SuiteFailure("required source input is not a regular file")
        total += entry.stat().st_size
        if total > 32 * 1024 * 1024:
            raise SuiteFailure("source copy exceeds its finite byte bound")
        contents[path] = entry.read_bytes()
    return contents


def manifest(contents):
    return {str(path): hashlib.sha256(data).hexdigest() for path, data in sorted(contents.items())}


def executable_from(output, target):
    choices = []
    for line in output.splitlines():
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if (item.get("reason") == "compiler-artifact" and item.get("target", {}).get("name") == "control"
                and "test" in item.get("target", {}).get("kind", []) and item.get("executable")):
            path = Path(item["executable"]).resolve(strict=True)
            if not path.is_relative_to(target) or not os.access(path, os.X_OK):
                raise SuiteFailure("compiled test executable escaped the injected target directory")
            choices.append(path)
    if len(choices) != 1:
        raise SuiteFailure("compile did not identify exactly one Core control test executable")
    return choices[0]


def main():
    args = arguments()
    cancellation = Cancellation()
    cancellation.install()
    contents = None
    commands = None
    copy = args.scratch_root / "source"
    result = {"status": "FAIL", "cases": [], "source_unchanged": False, "cleanup_ok": False}
    try:
        # Validate without persisting or displaying the input URL; the caller owns this DB.
        database_url = args.database_url_file.read_text().strip()
        local_url(database_url)
        contents = source_inputs(args.source_root)
        source_manifest = manifest(contents)
        result["source_manifest_sha256"] = hashlib.sha256(json.dumps(source_manifest, sort_keys=True).encode()).hexdigest()
        private_write(args.scratch_root / "source-manifest.json", json.dumps(source_manifest, sort_keys=True))
        if shutil.disk_usage(args.scratch_root).free < 64 * 1024 * 1024:
            raise SuiteFailure("insufficient bounded source-copy headroom")
        original = contents[CORE_FILE].decode()
        # A refactor that moves these controls requires explicit re-selection; never skip a mutant.
        for _, _, before, _, _ in MUTANTS:
            if original.count(before) != 1:
                raise SuiteFailure("control mutation anchor no longer uniquely identifies its source")
        copy.mkdir(mode=0o700)
        for relative, data in contents.items():
            destination = copy / relative
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with destination.open("xb") as stream:
                os.fchmod(stream.fileno(), 0o600)
                stream.write(data)
        env = clean_environment()
        for key in list(env):
            if key.startswith("RUST_TEST_") or key in {"DATABASE_URL", "SQLX_OFFLINE", "OURO_TEST_DATABASE_URL_FILE"}:
                del env[key]
        env.update(OURO_TEST_DATABASE_URL_FILE=str(args.database_url_file), LC_ALL="C")
        commands = Commands(args.scratch_root, env, [database_url])
        for identity, description, before, after, expected in (("baseline", "unchanged Core", None, None, ()), *MUTANTS):
            candidate = original if before is None else original.replace(before, after, 1)
            (copy / CORE_FILE).write_text(candidate)
            build = [args.cargo, "test", "--locked", "--offline", "--manifest-path", str(copy / "Cargo.toml"),
                     "--target-dir", str(args.target_dir), "-p", "ouroboros-core", "--features", "postgres-tests",
                     "--test", "control", "--no-run", "--message-format=json"]
            compiled = commands.run(identity + "-compile", build, cwd=copy, timeout=args.timeout_seconds)
            executable = executable_from(compiled, args.target_dir)
            label = identity + "-test"
            invocation = [str(executable), TEST, "--exact", "--nocapture", "--test-threads=1"]
            failure = None
            try:
                output = commands.run(label, invocation, cwd=copy, timeout=min(args.timeout_seconds, 120))
            except SuiteFailure as error:
                failure = str(error)
                output = (args.scratch_root / (label + ".log")).read_bytes()
            if identity == "baseline":
                if failure or not re.search(rb"test result: ok\. 1 passed; 0 failed; 0 ignored;", output):
                    raise SuiteFailure("unchanged control behavior did not pass before mutation")
                result["cases"].append({"id": identity, "status": "PASS", "compiled": True, "test_executed": True})
            else:
                if (failure != label + " failed (exit 101)"
                        or not re.search(rb"test result: FAILED\. 0 passed; 1 failed; 0 ignored;", output)
                        or any(text.encode() not in output for text in expected)):
                    raise SuiteFailure(identity + " mutation did not fail its exact expected contract assertion")
                result["cases"].append({"id": identity, "status": "KILLED", "compiled": True,
                    "test_executed": True, "expected_assertion": True, "violation": description,
                    "mutated_core_sha256": hashlib.sha256(candidate.encode()).hexdigest()})
        result["status"] = "PASS"
    except BaseException as error:
        result["status"] = "FAIL"
        result["error"] = str(error) if isinstance(error, SuiteFailure) else type(error).__name__
    finally:
        cancellation.begin_cleanup()
        if contents is not None:
            if (copy / CORE_FILE).exists():
                (copy / CORE_FILE).write_bytes(contents[CORE_FILE])
            try:
                result["source_unchanged"] = manifest(source_inputs(args.source_root)) == manifest(contents)
            except (OSError, SuiteFailure):
                result["source_unchanged"] = False
        result["cleanup_ok"] = commands is not None and commands.cleanup_ok
        if not result["source_unchanged"] or not result["cleanup_ok"]:
            result["status"] = "FAIL"
        private_write(args.scratch_root / "result.json", json.dumps(result, indent=2) + "\n")
        cancellation.restore()
    print(json.dumps(result))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
