#!/usr/bin/env python3
"""Exercise shell configuration with command stubs, without a daemon or downloads."""

import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest


SCRIPTS = Path(__file__).resolve().parent
IMAGE = "sha256:" + "a" * 64
PROXY_KEYS = ("http_proxy", "HTTP_PROXY", "https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY",
              "no_proxy", "NO_PROXY", "ftp_proxy", "FTP_PROXY")
STUB = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ["OURO_STUB_LOG"], "a") as log:
    log.write(json.dumps({"name": name, "args": args,
        "ambient_proxy_keys": sorted(key for key in os.environ
            if key.lower() in ("http_proxy", "https_proxy", "all_proxy", "no_proxy", "ftp_proxy")),
        "ambient_docker": {key: value for key, value in os.environ.items()
            if key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH")}}) + "\n")
if name == "uname":
    print("Linux" if args == ["-s"] else "aarch64")
elif name == "id":
    print("0")
elif name == "cargo":
    target = pathlib.Path(args[args.index("--target-dir") + 1])
    binary = target / "aarch64-unknown-linux-gnu/debug/ouroboros-cli"
    binary.parent.mkdir(parents=True, exist_ok=True)
    binary.write_text("fixture binary")
elif name == "readelf" and os.environ.get("OURO_STUB_READELF_FAIL"):
    raise SystemExit(1)
elif name == "rustc":
    pathlib.Path(args[args.index("-o") + 1]).write_text("fixture TCP probe")
elif name == "docker" and "--iidfile" in args:
    pathlib.Path(args[args.index("--iidfile") + 1]).write_text("sha256:" + "b" * 64 + "\n")
elif name == "sudo":
    raise SystemExit("test must not invoke sudo")
elif name == "curl":
    raise SystemExit(77)  # Stop before any archive, extraction, or installer exists.
'''


class BuildProfileTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="obp-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.commands = self.root / "commands"
        self.commands.mkdir()
        for name in ("uname", "id", "cargo", "rustc", "readelf", "docker", "sudo", "curl", "apt-get"):
            path = self.commands / name
            path.write_text(STUB)
            path.chmod(0o755)
        self.log = self.root / "commands.jsonl"
        self.env = os.environ.copy()
        for key in list(self.env):
            if key.startswith("OURO_") or key == "CARGO_TARGET_DIR":
                del self.env[key]
        self.env.update({
            "PATH": str(self.commands) + os.pathsep + self.env["PATH"],
            "OURO_STUB_LOG": str(self.log),
            "OURO_TEST_PROFILE": "linux-aarch64-reference",
            "DOCKER_HOST": "tcp://forbidden.invalid:2375",
            "DOCKER_CONTEXT": "forbidden-context",
            "DOCKER_TLS_VERIFY": "1",
            "DOCKER_CERT_PATH": "/forbidden-certificates",
        })
        self.env.update({key: "http://forbidden-proxy.invalid:9" for key in PROXY_KEYS})

    def configured_layout(self, suffix):
        layout = self.root / suffix
        layout.mkdir()
        stage = layout / "stage files"
        stage.mkdir()
        endpoint = layout / "engine.sock"
        sock = socket.socket(socket.AF_UNIX)
        sock.bind(str(endpoint))
        self.addCleanup(sock.close)
        env = self.env | {
            "OURO_TEST_STAGE_ROOT": str(stage),
            "CARGO_TARGET_DIR": str(layout / "build files"),
            "OURO_DOCKER_SOCKET": str(endpoint),
        }
        return env, stage, endpoint

    def run_build(self, env):
        return subprocess.run(
            ["bash", str(SCRIPTS / "prepare-connected-native.sh"), IMAGE],
            env=env, text=True, capture_output=True, check=False,
        )

    def calls(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def assert_no_effect_commands(self):
        self.assertFalse(any(call["name"] in ("cargo", "docker", "sudo", "curl") for call in self.calls()))

    def run_install(self, env):
        return subprocess.run(
            ["bash", str(SCRIPTS / "install-test-rust.sh")],
            env=env, text=True, capture_output=True, check=False,
        )

    def install_layout(self):
        stage = self.root / "installer stage"
        stage.mkdir()
        parent = self.root / "toolchains"
        parent.mkdir(mode=0o700)
        marker = parent / ".ouroboros-test-install-root"
        marker.write_text("ouroboros-disposable-toolchains\n")
        marker.chmod(0o600)
        prefix = parent / "rust reference"
        env = self.env | {"OURO_TEST_STAGE_ROOT": str(stage), "OURO_TEST_RUST_PREFIX": str(prefix)}
        return env, stage, prefix

    def test_missing_or_unsupported_profile_is_rejected_before_effects(self):
        for profile in ("", "linux-x86-unverified"):
            with self.subTest(profile=profile):
                result = self.run_build(self.env | {"OURO_TEST_PROFILE": profile})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("OURO_TEST_PROFILE", result.stderr)
        self.assert_no_effect_commands()

    def test_missing_or_relative_output_has_no_default(self):
        env, _, _ = self.configured_layout("invalid")
        for value in ("", "target", "/", str(self.root / ".." / "escape"), str(self.root / "bad\tpath")):
            with self.subTest(value=value):
                result = self.run_build(env | {"CARGO_TARGET_DIR": value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("CARGO_TARGET_DIR", result.stderr)
        self.assert_no_effect_commands()

    def test_missing_socket_does_not_use_ambient_docker_context(self):
        env, _, _ = self.configured_layout("socket")
        result = self.run_build(env | {"OURO_DOCKER_SOCKET": str(self.root / "absent.sock")})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("OURO_DOCKER_SOCKET", result.stderr)
        self.assert_no_effect_commands()

    def test_two_explicit_layouts_drive_build_and_endpoint(self):
        for suffix in ("layout one", "layout two"):
            with self.subTest(layout=suffix):
                env, stage, endpoint = self.configured_layout(suffix)
                before = len(self.calls())
                result = self.run_build(env)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), "sha256:" + "b" * 64)
                calls = self.calls()[before:]
                cargo = next(call for call in calls if call["name"] == "cargo")
                self.assertEqual(cargo["args"][cargo["args"].index("--target-dir") + 1], env["CARGO_TARGET_DIR"])
                rustc = next(call for call in calls if call["name"] == "rustc")
                self.assertIn("target-feature=+crt-static", rustc["args"])
                self.assertEqual(rustc["args"][rustc["args"].index("--target") + 1], "aarch64-unknown-linux-gnu")
                self.assertEqual(len([call for call in calls if call["name"] == "readelf"]), 2)
                docker = [call for call in calls if call["name"] == "docker"]
                self.assertEqual(len(docker), 2)
                for call in docker:
                    self.assertEqual(call["args"][:2], ["--host", "unix://" + str(endpoint)])
                    self.assertEqual(call["ambient_docker"], {})
                for call in calls:
                    self.assertEqual(call["ambient_proxy_keys"], [])
                self.assertEqual(list(stage.iterdir()), [], "only the invocation's staging directory is removed")

    def test_failed_binary_inspection_does_not_build_an_image(self):
        env, _, _ = self.configured_layout("invalid-binary")
        result = self.run_build(env | {"OURO_STUB_READELF_FAIL": "1"})
        self.assertNotEqual(result.returncode, 0)
        docker = [call for call in self.calls() if call["name"] == "docker"]
        self.assertEqual(len(docker), 1)
        self.assertIn("inspect", docker[0]["args"])

    def test_existing_system_directory_and_symlink_prefix_are_rejected(self):
        env, _, prefix = self.install_layout()
        prefix.symlink_to(self.root / "absent-target")
        for value in ("/usr", str(prefix.parent), str(prefix)):
            with self.subTest(prefix=value):
                result = self.run_install(env | {"OURO_TEST_RUST_PREFIX": value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("must not already exist", result.stderr)
        self.assertTrue(prefix.is_symlink())
        self.assert_no_effect_commands()

    def test_unmarked_or_unprotected_install_parent_is_rejected(self):
        env, _, prefix = self.install_layout()
        marker = prefix.parent / ".ouroboros-test-install-root"
        marker.unlink()
        self.assertNotEqual(self.run_install(env).returncode, 0)
        marker.write_text("ouroboros-disposable-toolchains\n")
        prefix.parent.chmod(0o777)
        self.assertNotEqual(self.run_install(env).returncode, 0)
        self.assertFalse(prefix.exists())
        self.assert_no_effect_commands()

    def test_fresh_prefix_claim_and_proxy_scrubbing_before_download(self):
        env, stage, prefix = self.install_layout()
        result = self.run_install(env)
        self.assertEqual(result.returncode, 77, result.stderr)
        self.assertTrue((prefix / ".ouroboros-test-toolchain").is_file())
        self.assertEqual(list(stage.iterdir()), [])
        downloads = [call for call in self.calls() if call["name"] == "curl"]
        self.assertEqual(len(downloads), 1)
        self.assertEqual(downloads[0]["ambient_proxy_keys"], [])
        self.assertIn("https://static.rust-lang.org/dist/", downloads[0]["args"][-1])
        self.assertFalse(any(call["name"] == "sudo" for call in self.calls()))
        retry = self.run_install(env)
        self.assertNotEqual(retry.returncode, 0)
        self.assertIn("must not already exist", retry.stderr)
        self.assertEqual(len([call for call in self.calls() if call["name"] == "curl"]), 1)

    def test_package_command_cannot_inherit_host_proxy_routing(self):
        result = subprocess.run(
            ["bash", "-c", '. "$1"; apt-get --help', "fixture", str(SCRIPTS / "test-profile.sh")],
            env=self.env, text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = [call for call in self.calls() if call["name"] == "apt-get"]
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["ambient_proxy_keys"], [])


if __name__ == "__main__":
    unittest.main()
