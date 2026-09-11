"""Bounded subprocess and disposable PostgreSQL support for contract tests.

This module never accepts an existing database endpoint. The only database it can
administer is a directly owned child initialized in a fresh private directory.
"""
from __future__ import annotations


import json
import os
from pathlib import Path
import re
import selectors
import signal
import socket
import subprocess
import time

from tests.support.fixture_config import postgres_environment


class SuiteFailure(RuntimeError):
    """A deliberately secret-free failure suitable for a public test report."""


class Cancellation:
    """Convert cancellation to unwinding once; preserve the cleanup interval."""

    def __init__(self):
        self.interrupted = False
        self.previous = {}

    def install(self):
        self.previous = {sig: signal.signal(sig, self.interrupt) for sig in (signal.SIGTERM, signal.SIGINT)}

    def interrupt(self, _signal, _frame):
        self.interrupted = True
        self.begin_cleanup()
        raise KeyboardInterrupt()

    def begin_cleanup(self):
        for sig in self.previous:
            signal.signal(sig, signal.SIG_IGN)

    def restore(self):
        for sig, handler in self.previous.items():
            signal.signal(sig, handler)


def private_write(path: Path, value: str) -> None:
    with path.open("x") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(value)


def free_ports(count: int) -> list[int]:
    """Choose distinct loopback ports; actual bind failure remains a hard failure."""
    sockets = []
    try:
        for _ in range(count):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(sock)
            sock.bind(("127.0.0.1", 0))
        return [sock.getsockname()[1] for sock in sockets]
    finally:
        for sock in sockets:
            sock.close()


def safe_environment(pg_bin: Path) -> dict[str, str]:
    # A caller may choose tool/cache paths and finite build profiles. Interpreter
    # hooks, optimization, test filters, database/proxy/account selection and Rust
    # code injection flags must not reach the assertion-based child fixtures.
    allowed = {"PATH", "HOME", "TMPDIR", "TEMP", "TMP", "CARGO_HOME", "RUSTUP_HOME",
               "RUSTUP_TOOLCHAIN", "LANG", "LC_ALL", "SYSTEMROOT", "SDKROOT", "DEVELOPER_DIR",
               "CARGO_INCREMENTAL", "CARGO_PROFILE_DEV_DEBUG", "CARGO_PROFILE_TEST_DEBUG",
               "CARGO_BUILD_JOBS"}
    env = {key: value for key, value in os.environ.items() if key in allowed}
    env.update(PATH=str(pg_bin) + os.pathsep + env.get("PATH", os.defpath), LC_ALL="C")
    return env


def redact(output: bytes, secrets: list[str]) -> bytes:
    for secret in sorted(secrets, key=len, reverse=True):
        if secret:
            output = output.replace(secret.encode(), b"[REDACTED]")
    # Fixture children create additional passwords. Do not persist PostgreSQL URLs
    # or SQL password literals from an assertion/driver diagnostic either.
    output = re.sub(rb"postgres(?:ql)?://[^\s\"'<>]+", b"[REDACTED_DATABASE_URL]", output)
    return re.sub(rb"(?i)(password\s*(?:=|:)\s*|password\s+)[\"']?[^\s,;\"']+", rb"\1[REDACTED]", output)


def group_exists(pid: int) -> bool:
    """True means present or not yet observable; only ESRCH proves absence.

    Darwin can briefly return EPERM while a signalled process is leaving its
    group but waitpid has not made it reapable. Never treat that as absence, or
    abandon the bounded recheck before the direct child can be reaped.
    """
    try:
        os.killpg(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def terminate_group(child: subprocess.Popen, first_signal: int = signal.SIGTERM) -> bool:
    """Terminate only a new session created by this driver; return clean shutdown."""
    if not group_exists(child.pid):
        child.wait(timeout=1)
        return True
    try:
        os.killpg(child.pid, first_signal)
    except ProcessLookupError:
        child.wait(timeout=1)
        return True
    except PermissionError:
        # An exit race may also affect delivery. Observe actual disappearance
        # within the same bound; a persistently unobservable group cannot pass.
        pass
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        child.poll()  # Reap the direct child before checking its process group.
        if not group_exists(child.pid):
            child.wait(timeout=1)
            return True
        time.sleep(0.025)
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except PermissionError:
        # Best effort reap of the directly owned child cannot prove its group
        # disappeared. The overall result remains unclean below.
        if child.poll() is None:
            child.kill()
    child.wait(timeout=5)
    return False


class Commands:
    """Run finite child groups; capture bounded output and persist redacted logs."""

    def __init__(self, root: Path, env: dict[str, str], secrets: list[str]):
        self.root, self.env, self.secrets = root, env, secrets
        self.cleanup_ok = True

    def run(self, label: str, argv: list[str], *, timeout: int = 60,
            env: dict[str, str] | None = None, cwd: Path | None = None,
            input_text: str | None = None, log: bool = True) -> bytes:
        if not re.fullmatch(r"[a-z0-9-]+", label):
            raise SuiteFailure("invalid command label")
        output = bytearray()
        maximum = 16 * 1024 * 1024
        child = subprocess.Popen(argv, stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 env=env or self.env, cwd=cwd, start_new_session=True)
        deadline = time.monotonic() + timeout
        selector = selectors.DefaultSelector()
        selector.register(child.stdout, selectors.EVENT_READ, "output")
        pending = memoryview(input_text.encode()) if input_text is not None else None
        if pending is not None:
            os.set_blocking(child.stdin.fileno(), False)
            selector.register(child.stdin, selectors.EVENT_WRITE, "input")
        failed = None
        try:
            while selector.get_map():
                if time.monotonic() >= deadline:
                    raise SuiteFailure(label + " exceeded its deadline")
                for selected, _ in selector.select(min(0.1, max(0, deadline - time.monotonic()))):
                    if selected.data == "input":
                        try:
                            written = os.write(selected.fd, pending[:65536])
                            pending = pending[written:]
                        except BrokenPipeError:
                            pending = None
                        if not pending:
                            selector.unregister(selected.fileobj)
                            selected.fileobj.close()
                    else:
                        chunk = os.read(selected.fd, 65536)
                        if not chunk:
                            selector.unregister(selected.fileobj)
                            selected.fileobj.close()
                        else:
                            output.extend(chunk)
                            if len(output) > maximum:
                                raise SuiteFailure(label + " exceeded its output bound")
            code = child.wait(timeout=max(0.1, deadline - time.monotonic()))
            if code:
                raise SuiteFailure(label + " failed (exit " + str(code) + ")")
            if group_exists(child.pid):
                raise SuiteFailure(label + " left a running descendant")
        except BaseException as error:
            failed = error
            prior_cleanup = self.cleanup_ok
            self.cleanup_ok = False
            try:
                self.cleanup_ok = terminate_group(child) and prior_cleanup
            except OSError:
                # A host that denies group inspection cannot prove descendant
                # cleanup. Still reap our direct child, and never report PASS.
                self.cleanup_ok = False
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait(timeout=5)
        finally:
            selector.close()
            for stream in (child.stdin, child.stdout):
                if stream is not None and not stream.closed:
                    stream.close()
            if log:
                private_write(self.root / (label + ".log"), redact(bytes(output[:maximum]), self.secrets).decode(errors="replace"))
        if failed is not None:
            raise failed
        return bytes(output)


def cargo_result(output: bytes) -> dict:
    """Zero tests, ignored tests, and incomplete test output cannot report success."""
    summaries = re.findall(rb"test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out", output)
    if not summaries or any(int(value) for row in summaries for value in row[1:]):
        raise SuiteFailure("database test output is incomplete, ignored, or filtered")
    passed = sum(int(row[0]) for row in summaries)
    if not passed:
        raise SuiteFailure("database suite ran no tests")
    return {"status": "PASS", "tests_passed": passed, "ignored": 0, "filtered": 0}


class PostgreSQL:
    def __init__(self, root: Path, pg_bin: Path, commands: Commands, username: str, password: str):
        self.root, self.pg, self.commands = root, pg_bin, commands
        self.username, self.password = username, password
        self.cluster = root / "cluster"
        self.port = free_ports(1)[0]
        self.child = None
        self.shutdown_verified = False
        self.version = None

    def url(self, database: str = "postgres") -> str:
        if not re.fullmatch(r"[a-z_][a-z0-9_]*", database):
            raise SuiteFailure("invalid test database identity")
        return f"postgresql://{self.username}:{self.password}@127.0.0.1:{self.port}/{database}?sslmode=disable"

    def start(self) -> None:
        version = self.commands.run("postgres-version", [str(self.pg / "postgres"), "--version"])
        if not re.fullmatch(rb"postgres \(PostgreSQL\) 18\.\d+[^\n]*\n?", version):
            raise SuiteFailure("PostgreSQL 18 release binaries are required")
        self.version = version.decode().strip()
        password_file = self.root / "initial-password"
        private_write(password_file, self.password + "\n")
        try:
            self.commands.run("initdb", [str(self.pg / "initdb"), "-D", str(self.cluster),
                "--username", self.username, "--pwfile", str(password_file),
                "--auth-local=scram-sha-256", "--auth-host=scram-sha-256", "--no-locale", "--encoding=UTF8"])
        finally:
            password_file.unlink(missing_ok=True)
        # No SQL statements or passwords enter a PostgreSQL log. The foreground
        # server has no daemon/pidfile discovery path and no shared Unix socket.
        self.child = subprocess.Popen([str(self.pg / "postgres"), "-D", str(self.cluster),
            "-p", str(self.port), "-c", "listen_addresses=127.0.0.1", "-c", "unix_socket_directories=",
            "-c", "shared_buffers=32MB", "-c", "max_connections=80", "-c", "max_wal_size=128MB",
            "-c", "min_wal_size=32MB", "-c", "temp_file_limit=131072", "-c", "statement_timeout=30000",
            "-c", "log_statement=none", "-c", "log_min_error_statement=panic", "-c", "log_min_messages=panic"],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=self.commands.env, start_new_session=True)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.child.poll() is not None:
                raise SuiteFailure("owned PostgreSQL exited before readiness")
            try:
                data = self.sql("SELECT current_setting('data_directory')", label="readiness", log=False)
                if data.strip().decode() != str(self.cluster):
                    raise SuiteFailure("PostgreSQL readiness returned a different data directory")
                return
            except SuiteFailure:
                if self.child.poll() is not None:
                    raise SuiteFailure("owned PostgreSQL failed to bind its private endpoint") from None
                time.sleep(0.05)
        raise SuiteFailure("owned PostgreSQL did not become ready")

    def sql(self, text: str, database: str = "postgres", *, label: str = "sql", log: bool = False) -> bytes:
        if self.child is None or self.child.poll() is not None:
            raise SuiteFailure("owned PostgreSQL is not live")
        connection = postgres_environment(self.url(database))
        env = {**self.commands.env, **{key: value for key, value in connection.items() if key.startswith("PG")}}
        env["PGCONNECT_TIMEOUT"] = "2"
        return self.commands.run(label, [str(self.pg / "psql"), "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
                                 env=env, input_text=text, timeout=35, log=log)

    def stop(self) -> None:
        if self.child is None:
            return
        clean = terminate_group(self.child, signal.SIGINT)
        if not clean or self.child.returncode != 0 or (self.cluster / "postmaster.pid").exists():
            raise SuiteFailure("owned PostgreSQL did not stop cleanly")
        control = self.commands.run("postgres-shutdown", [str(self.pg / "pg_controldata"), str(self.cluster)])
        if not re.search(rb"Database cluster state:\s+shut down\s*\n", control):
            raise SuiteFailure("owned PostgreSQL shutdown state was not verified")
        self.shutdown_verified = True


def report_write(path: Path, report: dict) -> None:
    private_write(path, json.dumps(report, indent=2, sort_keys=True) + "\n")
