"""Explicit, disposable fixture bindings; never derive deployment paths from a checkout.

Paths are relative to the supplied JSON file, not the caller's working directory.
This helper is for test drivers, not product configuration or owner enrollment.
"""

import hashlib
import ctypes
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request


class FixtureError(ValueError):
    pass


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise FixtureError(f"duplicate configuration key: {key}")
        result[key] = value
    return result


def _keys(value, allowed, context):
    if not isinstance(value, dict):
        raise FixtureError(f"{context} must be an object")
    extra = value.keys() - allowed
    if extra:
        raise FixtureError(f"unknown {context} field: {sorted(extra)[0]}")


def clean_environment():
    """Do not inherit connection or proxy selection from the invoking shell."""
    prefixes = ("PG", "DOCKER_", "OURO_", "CARGO_TARGET_DIR")
    return {
        key: value for key, value in os.environ.items()
        if not key.startswith(prefixes) and key.lower() not in {
            "http_proxy", "https_proxy", "all_proxy", "no_proxy"
        }
    }


def local_url(value):
    try:
        parsed = urllib.parse.urlsplit(value)
        host = parsed.hostname
        port = parsed.port
    except ValueError as error:
        raise FixtureError("invalid disposable PostgreSQL URL") from error
    if (parsed.scheme not in {"postgres", "postgresql"}
            or host not in {"localhost", "127.0.0.1", "::1"}
            or port is None or not 1 <= port <= 65535
            or not parsed.username or not parsed.password
            or not re.fullmatch(r"/[A-Za-z_][A-Za-z0-9_]*", parsed.path)
            or parsed.fragment or parsed.query not in {"", "sslmode=disable"}):
        raise FixtureError("explicit local disposable PostgreSQL URL with port is required")
    return parsed


def postgres_environment(url):
    parsed = local_url(url)
    return {
        **clean_environment(),
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": urllib.parse.unquote(parsed.username),
        "PGPASSWORD": urllib.parse.unquote(parsed.password),
        "PGDATABASE": parsed.path.lstrip("/"),
        "PGSSLMODE": "disable",
        "PGCONNECT_TIMEOUT": "5",
    }


def guard_preexec(uid):
    """Match the qualified guard's dropped identity and no-new-privileges boundary."""
    libc = ctypes.CDLL(None, use_errno=True)
    prctl = libc.prctl

    def drop():
        os.setgroups([])
        os.setgid(uid)
        os.setuid(uid)
        if prctl(38, 1, 0, 0, 0) != 0:  # Linux PR_SET_NO_NEW_PRIVS.
            raise OSError(ctypes.get_errno(), "cannot prohibit guard privilege gain")
    return drop


def observe_guard(pid, uid, kill_fd, cgroup):
    """Observe actual Linux credentials and the only non-stdio inherited capability."""
    proc = Path("/proc") / str(pid)
    status = dict(line.split(":", 1) for line in (proc / "status").read_text().splitlines() if ":" in line)
    uids = [int(value) for value in status["Uid"].split()]
    gids = [int(value) for value in status["Gid"].split()]
    groups = [int(value) for value in status["Groups"].split()]
    if (uids != [uid] * 4 or gids != [uid] * 4 or groups
            or int(status["NoNewPrivs"].strip()) != 1 or int(status["CapEff"].strip(), 16) != 0):
        raise FixtureError("guard's actual credentials do not match its restricted binding")
    descriptors = {int(path.name) for path in (proc / "fd").iterdir()}
    if descriptors != {0, 1, 2, kill_fd}:
        raise FixtureError("guard inherited an unexpected descriptor")
    if os.readlink(proc / "fd" / str(kill_fd)) != str(cgroup / "cgroup.kill"):
        raise FixtureError("guard kill descriptor does not identify its fixed cgroup")
    info = dict(line.split(":", 1) for line in (proc / "fdinfo" / str(kill_fd)).read_text().splitlines() if ":" in line)
    if int(info["flags"].strip(), 8) & os.O_ACCMODE != os.O_WRONLY:
        raise FixtureError("guard kill descriptor is not write-only")
    return {"pid": pid, "uid": uid, "gid": uid, "supplementary_groups": groups,
            "no_new_privileges": True, "effective_capabilities": 0,
            "inherited_capability": "fixed write-only cgroup.kill FD"}


class FixtureConfig:
    def __init__(self, filename):
        supplied = Path(filename)
        if not supplied.is_absolute():
            raise FixtureError("--config must be an absolute path")
        self.filename = supplied.resolve(strict=True)
        self.data = json.loads(self.filename.read_text(), object_pairs_hook=_object)
        _keys(self.data, {"root", "bin_dir", "bind_host", "ports", "admin_url_file", "storage_root",
                          "disposable_database", "database", "runtime"}, "fixture")
        for key in ("root", "bin_dir", "bind_host", "ports"):
            if key not in self.data:
                raise FixtureError(f"missing fixture field: {key}")
        self.root = self.path(self.data["root"])
        self.binary = self.path(self.data["bin_dir"])
        if not self.binary.is_dir():
            raise FixtureError("bin_dir must identify an existing directory")
        try:
            host = ipaddress.ip_address(self.data["bind_host"])
        except ValueError as error:
            raise FixtureError("bind_host must be a literal loopback IP") from error
        if not host.is_loopback:
            raise FixtureError("fixtures may only listen on loopback")
        self.host = str(host)
        self.ports = self.data["ports"]
        _keys(self.ports, {"core", "gateway", "company", "catalog", "fixture", "bridge"}, "ports")
        if any(type(port) is not int or not 1024 <= port <= 65535 for port in self.ports.values()):
            raise FixtureError("fixture ports must be unprivileged explicit integers")
        if len(set(self.ports.values())) != len(self.ports):
            raise FixtureError("fixture listeners must use distinct ports")
        self.database = self.data.get("database", {})
        _keys(self.database, {"host", "port", "ssh_config", "ssh_alias", "metadata_file",
                              "server_socket_dir", "server_port"}, "database")
        self.runtime = self.data.get("runtime", {})
        _keys(self.runtime, {"docker_socket", "ipc_root", "image", "bridge_uid", "guard_uid"}, "runtime")
        if "disposable_database" in self.data and self.data["disposable_database"] is not True:
            raise FixtureError("disposable_database must be explicitly true")
        if "admin_url_file" in self.data and ({"ssh_config", "ssh_alias"} & self.database.keys()):
            raise FixtureError("choose one explicit database administration transport")
        # Validate every provided field, even when this particular driver does not use it.
        for key in ("admin_url_file", "storage_root"):
            if key in self.data:
                self.path(self.data[key])
        for section, keys in ((self.database, ("ssh_config", "metadata_file")),
                              (self.runtime, ("docker_socket", "ipc_root"))):
            for key in keys:
                if key in section:
                    self.path(section[key])
        if "host" in self.database or "port" in self.database:
            self.database_endpoint()
            if "admin_url_file" in self.data:
                admin = local_url(self.path(self.data["admin_url_file"]).read_text().strip())
                if self.database_endpoint() != (admin.hostname, admin.port):
                    raise FixtureError("database endpoint conflicts with selected administration URL")
        if "ssh_alias" in self.database and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", self.database["ssh_alias"]):
            raise FixtureError("invalid explicit SSH alias")
        if "server_socket_dir" in self.database and not re.fullmatch(r"/[A-Za-z0-9_/.-]+", self.database["server_socket_dir"]):
            raise FixtureError("server_socket_dir must be an explicit safe absolute guest path")
        if "server_port" in self.database and (type(self.database["server_port"]) is not int or not 1 <= self.database["server_port"] <= 65535):
            raise FixtureError("invalid explicit PostgreSQL server_port")
        for key in ("bridge_uid", "guard_uid"):
            if key in self.runtime and (type(self.runtime[key]) is not int or not 100000 <= self.runtime[key] < 2**32 - 1):
                raise FixtureError(f"{key} must be a dedicated numeric UID of at least 100000")
        if self.runtime.get("bridge_uid") == self.runtime.get("guard_uid") and "bridge_uid" in self.runtime:
            raise FixtureError("bridge and guard require distinct UIDs")
        if "ipc_root" in self.runtime:
            ipc = self.path(self.runtime["ipc_root"])
            if ipc == self.root or self.root in ipc.parents or ipc in self.root.parents:
                raise FixtureError("IPC and persistent evidence roots must be separate")
        self.identity = hashlib.sha256(json.dumps({"configuration": self.data,
            "configuration_directory": str(self.filename.parent), "root": str(self.root),
            "bin_dir": str(self.binary)}, sort_keys=True).encode()).hexdigest()

    def path(self, value):
        if not isinstance(value, str) or not value or "\x00" in value or "~" in value or "$" in value:
            raise FixtureError("paths must be explicit; shell or home expansion is unsupported")
        candidate = Path(value)
        if not candidate.is_absolute():
            candidate = self.filename.parent / candidate
        # Reject aliases through symlinks instead of silently accepting another binding.
        for part in (candidate, *candidate.parents):
            if part.is_symlink():
                raise FixtureError("fixture paths must not traverse symlinks")
        resolved = candidate.resolve()
        if resolved == Path(resolved.anchor):
            raise FixtureError("a filesystem root is not a fixture path")
        return resolved

    def require_ports(self, *names):
        for name in names:
            if name not in self.ports:
                raise FixtureError(f"missing fixture port: {name}")

    def endpoint(self, name):
        self.require_ports(name)
        host = f"[{self.host}]" if ":" in self.host else self.host
        return f"{host}:{self.ports[name]}"

    def url(self, name):
        return "https://" + self.endpoint(name)

    def cert_extensions(self):
        return ("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n"
                "extendedKeyUsage=serverAuth,clientAuth\nsubjectAltName=IP:" + self.host + "\n")

    def create_root(self, mode=0o700):
        if not self.root.parent.is_dir():
            raise FixtureError("fixture root parent must already exist")
        try:
            self.root.mkdir(mode=mode, exist_ok=False)
        except FileExistsError as error:
            raise FixtureError("fixture root already exists; choose a new disposable root") from error
        marker = self.root / ".ouroboros-disposable-fixture.json"
        with marker.open("x") as stream:
            json.dump({"kind": "disposable-fixture", "binding": self.identity}, stream)
        marker.chmod(0o600)
        return self.root

    def existing_storage_root(self):
        """An explicit empty fixture container; artifacts may live on a separate volume."""
        if "storage_root" not in self.data:
            return None
        path = self.path(self.data["storage_root"])
        if path == self.root or self.root in path.parents or path in self.root.parents:
            raise FixtureError("storage and persistent fixture evidence roots must be separate")
        info = path.stat()
        if (not path.is_dir() or info.st_uid != os.getuid()
                or info.st_mode & 0o777 != 0o700 or any(path.iterdir())):
            raise FixtureError("storage_root must be an existing empty caller-owned mode 0700 directory")
        return path

    def existing_root(self):
        marker = self.root / ".ouroboros-disposable-fixture.json"
        if marker.is_symlink() or not marker.is_file():
            raise FixtureError("existing fixture root has no regular disposable marker")
        if json.loads(marker.read_text()) != {"kind": "disposable-fixture", "binding": self.identity}:
            raise FixtureError("existing fixture root belongs to a different binding")
        return self.root

    def claim_test(self, name):
        """A prepared fixture can be consumed once without overwriting earlier test evidence."""
        if not re.fullmatch(r"[a-z][a-z0-9-]*", name):
            raise FixtureError("invalid fixture test identity")
        self.existing_root()
        try:
            with (self.root / (name + ".started.json")).open("x") as stream:
                json.dump({"fixture_binding": self.identity, "test": name}, stream)
        except FileExistsError as error:
            raise FixtureError("fixture test was already started; preserve it and prepare a new root") from error

    def require_database(self):
        if self.data.get("disposable_database") is not True:
            raise FixtureError("explicit disposable_database acknowledgement is required")

    def admin_url(self):
        self.require_database()
        if "admin_url_file" not in self.data:
            raise FixtureError("missing admin_url_file")
        url = self.path(self.data["admin_url_file"]).read_text().strip()
        local_url(url)
        return url

    def database_endpoint(self):
        host, port = self.database.get("host"), self.database.get("port")
        if host not in {"127.0.0.1", "localhost", "::1"} or type(port) is not int or not 1 <= port <= 65535:
            raise FixtureError("explicit local database host and port are required")
        return host, port

    def ssh(self):
        self.require_database()
        if not {"ssh_config", "ssh_alias"} <= self.database.keys():
            raise FixtureError("database SSH config and alias are required")
        config = self.path(self.database["ssh_config"])
        if not config.is_file():
            raise FixtureError("explicit SSH configuration is missing")
        return ["ssh", "-F", str(config), "-o", "BatchMode=yes", self.database["ssh_alias"]]

    def metadata(self):
        if "metadata_file" not in self.database:
            raise FixtureError("missing database metadata_file")
        data = json.loads(self.path(self.database["metadata_file"]).read_text(), object_pairs_hook=_object)
        if data.get("kind") != "ouroboros-disposable-database":
            raise FixtureError("database metadata is not a disposable fixture")
        for name in ("role", "database"):
            if not re.fullmatch(r"ouro_test_[a-f0-9]+", data.get(name, "")):
                raise FixtureError("invalid disposable database identity")
        if list(self.database_endpoint()) != [data.get("host"), data.get("port")]:
            raise FixtureError("database metadata endpoint conflicts with fixture binding")
        if data.get("administration_binding") != self.administration_binding():
            raise FixtureError("database metadata belongs to a different administration binding")
        return data

    def administration_binding(self):
        self.require_database()
        if "admin_url_file" in self.data:
            admin = local_url(self.admin_url())
            identity = ["local", admin.hostname, admin.port, admin.path, admin.username]
        else:
            command = self.ssh()
            if not {"server_socket_dir", "server_port"} <= self.database.keys():
                raise FixtureError("SSH fixtures require explicit PostgreSQL socket directory and server port")
            identity = ["ssh", command, self.database["server_socket_dir"], self.database["server_port"],
                        hashlib.sha256(self.path(self.database["ssh_config"]).read_bytes()).hexdigest()]
        return hashlib.sha256(json.dumps(identity).encode()).hexdigest()

    def sql(self, statement, database=None):
        """One explicitly chosen fixture admin endpoint; no inherited libpq defaults."""
        self.require_database()
        if database is not None and not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", database):
            raise FixtureError("invalid fixture database identifier")
        if "admin_url_file" in self.data:
            env = postgres_environment(self.admin_url())
            if database is not None:
                env["PGDATABASE"] = database
            command = ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1"]
        else:
            if not {"server_socket_dir", "server_port"} <= self.database.keys():
                raise FixtureError("SSH fixtures require explicit PostgreSQL socket directory and server port")
            command = self.ssh() + ["sudo", "-u", "postgres", "env", "-i", "PATH=/usr/bin:/bin",
                "psql", "-X", "-At", "-h", self.database["server_socket_dir"],
                "-p", str(self.database["server_port"]), "-d", database or "postgres",
                "-v", "ON_ERROR_STOP=1"]
            env = clean_environment()
        result = subprocess.run(command, input=statement.encode(), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, timeout=20)
        if result.returncode:
            raise FixtureError("disposable database operation failed; credentials are withheld")
        return result.stdout.decode().strip()

    def runtime_values(self):
        required = {"docker_socket", "ipc_root", "image", "bridge_uid", "guard_uid"}
        if not required <= self.runtime.keys():
            raise FixtureError("runtime requires docker_socket, ipc_root, image, bridge_uid and guard_uid")
        image = self.runtime["image"]
        if not isinstance(image, str) or not re.fullmatch(r"(?:[^\s]+@)?sha256:[a-f0-9]{64}", image):
            raise FixtureError("runtime image must be pinned by sha256")
        self.require_ports("bridge")
        if self.host != "127.0.0.1":
            raise FixtureError("the current isolated bridge profile requires IPv4 loopback")
        return {**self.runtime, "docker_socket": self.path(self.runtime["docker_socket"]),
                "ipc_root": self.path(self.runtime["ipc_root"])}

    def create_ipc_root(self):
        ipc = self.runtime_values()["ipc_root"]
        if len(os.fsencode(ipc / "gateway" / "instance.sock")) >= 100:
            raise FixtureError("configured IPC root exceeds supported Unix socket path length")
        if not ipc.parent.is_dir():
            raise FixtureError("IPC root parent must already exist")
        ipc.mkdir(mode=0o755, exist_ok=False)
        return ipc

    def docker(self, *args):
        return ["docker", "--host", "unix://" + str(self.runtime_values()["docker_socket"]), *args]

    @staticmethod
    def opener(context):
        return urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=context))


def load_config(parser):
    parser.add_argument("--config", required=True, help="absolute path to explicit disposable fixture JSON")
    args = parser.parse_args()
    try:
        config = FixtureConfig(args.config)
    except (OSError, ValueError, TypeError) as error:
        parser.error(str(error))
    return args, config
