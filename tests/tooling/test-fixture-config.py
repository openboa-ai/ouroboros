"""Deterministic binding checks; no database, VM, daemon or model is started."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tests.support.fixture_config import FixtureConfig, FixtureError, clean_environment, local_url, postgres_environment


class FixtureBindings(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ouro-fixture-config-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.binary = self.base / "bins"
        self.binary.mkdir()

    def write(self, name="binding.json", **changes):
        data = {"root": "evidence", "bin_dir": "bins", "bind_host": "127.0.0.1",
                "ports": {"core": 29444, "gateway": 29443}}
        data.update(changes)
        target = self.base / name
        target.write_text(json.dumps(data))
        return target

    def test_two_bindings_are_independent_of_cwd_and_ambient_selection(self):
        one = self.write()
        two = self.write("second.json", root="other-evidence", bind_host="127.0.0.2",
                         ports={"core": 30444, "gateway": 30443})
        elsewhere = self.base / "unrelated-cwd"
        elsewhere.mkdir()
        original = Path.cwd()
        self.addCleanup(os.chdir, original)
        os.chdir(elsewhere)
        with patch.dict(os.environ, {"OURO_ROOT": "/unexpected", "PGHOST": "not-local",
                                     "HTTPS_PROXY": "http://not-local", "DOCKER_HOST": "tcp://not-local",
                                     "CARGO_TARGET_DIR": "/unexpected-build"}):
            a, b = FixtureConfig(one), FixtureConfig(two)
            self.assertEqual(a.root, self.base / "evidence")
            self.assertEqual(a.binary, b.binary)
            self.assertNotEqual(a.endpoint("gateway"), b.endpoint("gateway"))
            self.assertIn("IP:127.0.0.2", b.cert_extensions())
            self.assertNotIn("localhost", b.cert_extensions())
            self.assertEqual(a.url("core"), "https://127.0.0.1:29444")
            a.create_root()
            b.create_root()
            self.assertEqual(a.existing_root(), a.root)
            environment = clean_environment()
            self.assertFalse({"OURO_ROOT", "PGHOST", "HTTPS_PROXY", "DOCKER_HOST", "CARGO_TARGET_DIR"} & environment.keys())

    def test_missing_unknown_duplicate_and_conflicting_bindings_rejected(self):
        for key in ("root", "bin_dir", "bind_host", "ports"):
            target = self.write()
            data = json.loads(target.read_text())
            del data[key]
            target.write_text(json.dumps(data))
            with self.subTest(missing=key), self.assertRaises(FixtureError):
                FixtureConfig(target)
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(unrecognized="value"))
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(ports={"core": 29000, "gateway": 29000}))
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(ports={"core": True}))
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(runtime={"unknown": "value"}))
        target = self.write()
        target.write_text(target.read_text().replace('"ports": {', '"root":"other","ports": {'))
        with self.assertRaises(FixtureError):
            FixtureConfig(target)
        self.assertFalse((self.base / "evidence").exists())

    def test_no_existing_directory_adoption_or_configuration_reinterpretation(self):
        config = FixtureConfig(self.write())
        config.create_root()
        (config.root / "sentinel").write_text("preserve")
        with self.assertRaises(FixtureError):
            config.create_root()
        changed = FixtureConfig(self.write(ports={"core": 31000}))
        with self.assertRaises(FixtureError):
            changed.existing_root()
        self.assertEqual((config.root / "sentinel").read_text(), "preserve")
        config.claim_test("api-cli")
        with self.assertRaises(FixtureError):
            config.claim_test("api-cli")

    def test_relative_config_and_symlink_paths_are_not_implicit_bindings(self):
        with self.assertRaises(FixtureError):
            FixtureConfig("relative-config.json")
        link = self.base / "alias"
        link.symlink_to(self.binary)
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(bin_dir="alias"))
        for value in ("$HOME/artifacts", "~/artifacts", "/"):
            with self.subTest(value=value), self.assertRaises(FixtureError):
                FixtureConfig(self.write(root=value))

    def test_database_selection_cannot_inherit_libpq_or_use_remote_target(self):
        url = "postgresql://fixture:password@127.0.0.1:32432/postgres?sslmode=disable"
        with patch.dict(os.environ, {"PGSERVICE": "production", "PGHOSTADDR": "192.0.2.1", "PGOPTIONS": "-c search_path=other"}):
            env = postgres_environment(url)
            self.assertEqual(env["PGPORT"], "32432")
            self.assertFalse({"PGSERVICE", "PGHOSTADDR", "PGOPTIONS"} & env.keys())
        for bad in (url.replace("127.0.0.1", "192.0.2.1"),
                    url.replace(":32432", ""), url + "&options=-csearch_path=other"):
            with self.subTest(bad=bad), self.assertRaises(FixtureError):
                local_url(bad)
        admin = self.base / "admin.url"
        admin.write_text(url)
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(admin_url_file="admin.url")).admin_url()
        config = FixtureConfig(self.write(admin_url_file="admin.url", disposable_database=True))
        self.assertEqual(config.admin_url(), url)
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(admin_url_file="admin.url", disposable_database=True,
                                     database={"host": "127.0.0.1", "port": 11111}))
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(admin_url_file="admin.url", disposable_database=True,
                                     database={"ssh_alias": "guest"}))

    def test_ipc_and_evidence_have_separate_roots_and_byte_bounded_socket_names(self):
        runtime = {"docker_socket": "docker.sock", "ipc_root": "ipc", "image": "sha256:" + "a" * 64,
                   "bridge_uid": 100010, "guard_uid": 200001}
        ports = {"bridge": 28080}
        config = FixtureConfig(self.write(runtime=runtime, ports=ports))
        self.assertEqual(config.docker("info"), ["docker", "--host", "unix://" + str(self.base / "docker.sock"), "info"])
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(runtime={**runtime, "ipc_root": "evidence/ipc"}, ports=ports))
        too_long = FixtureConfig(self.write(runtime={**runtime, "ipc_root": "x" * 100}, ports=ports))
        with self.assertRaises(FixtureError):
            too_long.create_ipc_root()
        self.assertFalse((self.base / ("x" * 100)).exists())

    def test_same_relative_json_at_another_base_is_a_distinct_effective_binding(self):
        first = FixtureConfig(self.write())
        other = self.base / "another-environment"
        other.mkdir()
        (other / "bins").mkdir()
        (other / "binding.json").write_text(first.filename.read_text())
        second = FixtureConfig(other / "binding.json")
        self.assertNotEqual(first.identity, second.identity)
        self.assertNotEqual(first.root, second.root)

    def test_ipv6_listener_url_and_certificate_use_same_binding(self):
        config = FixtureConfig(self.write(bind_host="::1"))
        self.assertEqual(config.url("gateway"), "https://[::1]:29443")
        self.assertIn("subjectAltName=IP:::1", config.cert_extensions())
        with self.assertRaises(FixtureError):
            FixtureConfig(self.write(bind_host="0.0.0.0"))


if __name__ == "__main__":
    unittest.main()
