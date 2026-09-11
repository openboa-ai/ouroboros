"""One disposable Linux integration run; no model, Codex or subscription calls.

Product Core/Gateway/Runtime/CLI and PostgreSQL are real. The trusted fixture driver uses
Docker exec as an observer to run commands as the existing private UID in two Runtime-created
containers. It does not authenticate a workload by supplying an identity header. Runtime remains
the only product service holding the Docker endpoint. Fixture setup/inspection is separately
privileged and is not an agent-visible API or a production authority-enrollment procedure.

The pinned gateway-probe image must contain /bin/sh, /bin/sleep, wget,
/usr/local/bin/ouroboros-cli and /usr/local/bin/ouroboros-fixture-net-probe. The COPY layer in
prepare-connected-native.sh can prepare those fixture binaries from a pinned base without running
Codex. This driver neither pulls nor builds an image. Its small /dev/shm marker tests existing
container-private scratch, not the unimplemented general workspace provisioning lifecycle.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import uuid

from fixture_config import clean_environment, load_config, local_url


def interrupted(signum, frame):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise KeyboardInterrupt('management fixture cancelled')

signal.signal(signal.SIGTERM, interrupted)
parser = argparse.ArgumentParser()
if not __debug__:
    parser.error('optimized Python disables behavioral assertions and is not a test profile')
parser.add_argument("--lifetime-seconds", type=int, default=90)
args, fixture = load_config(parser)
if os.geteuid() != 0 or not 45 <= args.lifetime_seconds <= 110:
    parser.error("dedicated root-operated Linux fixture and a 45..110 second lifetime required")
fixture.require_ports("core", "gateway", "bridge")
if fixture.ports["bridge"] != 18080:
    parser.error("the current instance CLI requires explicit bridge port 18080")
admin = local_url(fixture.admin_url())
runtime_values = fixture.runtime_values()
binary = fixture.binary
for name in ["core", "gateway", "cli", "runtime", "bridge", "guard", "migrate"]:
    if not (binary / f"ouroboros-{name}").is_file():
        parser.error("required product binary is absent from the explicit bin_dir")
root = fixture.create_root(mode=0o755)
root.chmod(0o755)
ipc = fixture.create_ipc_root()
ipc.chmod(0o755)
(ipc / "gateway").mkdir(mode=0o711)
(ipc / "gateway").chmod(0o711)
os.chown(ipc / "gateway", 70002, 70002)
environment = clean_environment()
processes = []
runtimes = {}
containers = {}
instances = {}
runtime_configs = {}
checks = []
roles = []
databases = []
database = None
result = None
redactions = []
diagnostic_count = 0
cutoff_observations = {}
owned_guards = {}
confirmed_runtime_startups = set()


def diagnostic(argv, stderr, category):
    global diagnostic_count
    if diagnostic_count >= 16:
        return
    diagnostic_count += 1
    detail = stderr[:8192].decode("utf-8", errors="replace")
    for value in redactions:
        detail = detail.replace(value, "[withheld]")
    detail = re.sub(r"(?i)postgres(?:ql)?://[^\s]+", "[database URL withheld]", detail)
    # Do not persist protocol response bodies, authorization fields or PEM material.
    lines = []
    pem = False
    for line in detail.splitlines():
        if "-----BEGIN " in line:
            pem = True
        if pem:
            if "-----END " in line:
                pem = False
            continue
        if line.lstrip().startswith(("{", "[")) or any(word in line.lower() for word in ["authorization:", "access_token", "refresh_token", "password"]):
            lines.append("[sensitive diagnostic line withheld]")
        else:
            lines.append(line)
    path = root / "command-failures.jsonl"
    with path.open("a") as output:
        path.chmod(0o600)
        output.write(json.dumps({"executable": Path(argv[0]).name, "category": category,
                                 "stderr": "\n".join(lines), "truncated": len(stderr) > 8192}) + "\n")


def command(argv, *, data=None, uid=None, timeout=15):
    if argv[0] == "docker":
        argv = fixture.docker(*argv[1:])
    return subprocess.run(
        argv, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env=environment, timeout=timeout, preexec_fn=drop(uid) if uid is not None else None,
    )


def run(argv, **kwargs):
    observed = command(argv, **kwargs)
    if observed.returncode:
        diagnostic(argv, observed.stderr, "command_failed")
        raise RuntimeError("fixture command failed; inspect protected local evidence")
    return observed.stdout


def drop(uid):
    def apply():
        os.setgroups([])
        os.setgid(uid)
        os.setuid(uid)
        if ctypes.CDLL(None, use_errno=True).prctl(38, 1, 0, 0, 0) != 0:
            raise OSError("fixture could not apply no-new-privileges")
    return apply


def write(path, value, uid=0, mode=0o600):
    path.write_text(value)
    path.chmod(mode)
    os.chown(path, uid, uid)


def sql(statement, db=None):
    return fixture.sql(statement, db)


def db_url(user, password, db):
    host = f"[{admin.hostname}]" if ":" in admin.hostname else admin.hostname
    return f"postgresql://{user}:{password}@{host}:{admin.port}/{db}?sslmode=disable\n"


def tls(service, name, uid):
    folder = root / service
    for source, destination in [(f"{name}.key", f"{name}.key"),
                                (f"{name}.pem", f"{name}.pem"), ("ca.pem", "ca.pem")]:
        write(folder / destination, (root / "ca" / source).read_text(), uid)
    return {"certificate": str(folder / f"{name}.pem"),
            "private_key": str(folder / f"{name}.key"), "ca": str(folder / "ca.pem")}


def context(folder, name):
    ctx = ssl.create_default_context(cafile=str(root / folder / "ca.pem"))
    ctx.load_cert_chain(root / folder / f"{name}.pem", root / folder / f"{name}.key")
    return ctx


def api(path, *, ctx=None, service="gateway", data=None, headers=None):
    request = urllib.request.Request(
        fixture.url(service) + path,
        data=None if data is None else json.dumps(data).encode(),
        headers=headers or {},
    )
    if data is not None:
        request.add_header("content-type", "application/json")
    try:
        with fixture.opener(ctx or human_context).open(request, timeout=3) as response:
            return response.status, json.loads(response.read(262145))
    except urllib.error.HTTPError as error:
        return error.code, None


def private_command(name, arguments, body=None):
    prefix = ["docker", "exec", "--user", "65532:65532", "-i", containers[name]]
    program = ["/usr/local/bin/ouroboros-cli", "--instance", *arguments]
    if body is None:
        return prefix + program, None
    # The private process creates its own bounded input file. Reopening /dev/stdin after a UID
    # change can fail on root-owned pipes; neither a host mount nor Docker cp is needed here.
    private_input = "/dev/shm/ouro-management-input-" + uuid.uuid4().hex
    wrapper = ('set -eu; umask 077; input=$1; shift; '
               'trap \'rm -f -- "$input"\' EXIT; cat > "$input"; "$@" --input "$input"')
    return prefix + ["/bin/sh", "-c", wrapper, "fixture-input", private_input, *program], json.dumps(body).encode()


def cli(name, *arguments, body=None, expected=200):
    if name == "human":
        request_file = None
        if body is not None:
            request_file = root / "cli" / ("request-" + uuid.uuid4().hex + ".json")
            write(request_file, json.dumps(body), 70003)
            arguments = (*arguments, "--input", str(request_file))
        try:
            argv = [str(binary / "ouroboros-cli"), "--config", str(root / "cli/config.json"), *arguments]
            observed = command(argv, uid=70003)
        finally:
            if request_file is not None:
                request_file.unlink()
    else:
        argv, data = private_command(name, arguments, body)
        observed = command(argv, data=data)
    statuses = re.findall(rb"HTTP ([0-9]{3})", observed.stderr)
    if not statuses:
        diagnostic(argv, observed.stderr, "cli_missing_http_result")
        raise RuntimeError("CLI did not report an HTTP result; process failure is not policy denial")
    status = int(statuses[-1])
    if status != expected or (observed.returncode == 0) != (200 <= expected < 300):
        diagnostic(argv, observed.stderr, "cli_unexpected_result")
        raise RuntimeError(f"unexpected CLI outcome: expected {expected}, observed {status}")
    return json.loads(observed.stdout) if expected < 300 else None


def observed_events(name, cursor):
    # The fixed timeout bounds a read-only stream; emitted events, not timeout, prove success.
    arguments = ["events", "--cursor", cursor]
    if name == "human":
        observed = command(["timeout", "3", str(binary / "ouroboros-cli"), "--config",
                            str(root / "cli/config.json"), *arguments], uid=70003, timeout=6)
    else:
        observed = command(["docker", "exec", "--user", "65532:65532", containers[name],
                            "timeout", "3", "/usr/local/bin/ouroboros-cli", "--instance", *arguments], timeout=6)
    assert observed.returncode in {0, 124, 143} and b"HTTP 200" in observed.stderr
    return [json.loads(line[5:].strip()) for line in observed.stdout.splitlines() if line.startswith(b"data:")]


def spawn_service(name, uid, config):
    log = root / name / "process.log"
    with log.open("xb") as stream:
        log.chmod(0o600)
        process = subprocess.Popen(
            [str(binary / f"ouroboros-{name}"), "--config", str(config)],
            stdout=stream, stderr=stream, env=environment, preexec_fn=drop(uid),
        )
    processes.append(process)


def process_identity(pid):
    try:
        raw = (Path("/proc") / str(pid) / "stat").read_text()
    except FileNotFoundError:
        return None
    fields = raw.rpartition(")")[2].split()
    return {"start_ticks": int(fields[19]), "state": fields[0]}


def capture_guards(process):
    tasks = Path("/proc") / str(process.pid) / "task"
    pids = set()
    for children in tasks.glob("*/children"):
        try:
            pids.update(int(value) for value in children.read_text().split())
        except FileNotFoundError:
            continue
    for pid in sorted(pids):
        proc = Path("/proc") / str(pid)
        try:
            if os.readlink(proc / "exe") != str(binary / "ouroboros-guard"):
                continue
            arguments = (proc / "cmdline").read_bytes().split(b"\0")
            identity = process_identity(pid)
            if identity is None or len(arguments) != 4 or arguments[-1] != b"":
                continue
            deadline = int(arguments[2])
            kill_fd = int(arguments[1])
            if not os.readlink(proc / "fd" / str(kill_fd)).endswith("/cgroup.kill"):
                raise RuntimeError("owned guard has an unexpected kill capability")
            owned_guards[(pid, identity["start_ticks"])] = {
                "pid": pid, "start_ticks": identity["start_ticks"],
                "deadline_boottime_ns": deadline, "observed_parent_runtime_pid": process.pid,
            }
        except FileNotFoundError:
            continue


def start_runtime(name, accepted):
    folder = root / f"runtime-{name}"
    log = folder / "process.log"
    with log.open("xb") as stream:
        log.chmod(0o600)
        process = subprocess.Popen(
            [str(binary / "ouroboros-runtime"), "--config", str(runtime_configs[name])],
            stdout=stream, stderr=stream, env=environment,
        )
    runtimes[name] = process
    end = time.monotonic() + 10
    while time.monotonic() < end:
        # Capture while the supervisor is still the parent; after early exit an unobserved
        # guard may be reparented and cannot be recovered by a fixture-wide PID search.
        capture_guards(process)
        state = cli("human", "get", "executions", accepted["resource_id"])
        if state.get("instance_id"):
            instance = state["instance_id"]
            evidence = folder / instance
            bound = evidence / "binding.json"
            probe = evidence / "probe.jsonl"
            if bound.is_file() and probe.is_file() and agent in probe.read_text():
                binding = json.loads(bound.read_text())
                containers[name] = binding["container_id"]
                instances[name] = {"instance_id": instance, "execution_id": accepted["resource_id"],
                                   "binding": binding, "evidence": evidence}
                observed = cli(name, "conditions")
                assert observed["principal_id"] == agent
                capture_guards(process)
                assert any(guard["observed_parent_runtime_pid"] == process.pid and
                           guard["deadline_boottime_ns"] == binding["deadline_boottime_ns"]
                           for guard in owned_guards.values()), "actual fixed-deadline guard was not observed"
                confirmed_runtime_startups.add(name)
                return observed
        if process.poll() is not None:
            raise RuntimeError("Runtime ended before its bound instance became usable")
        time.sleep(0.1)
    raise RuntimeError("bounded instance startup did not complete")


def execution_body(work, grant, child, units):
    return {"work_id": work, "delegation_id": grant, "agent_delegation_id": child,
            "profile_id": "gateway-probe", "units": units,
            "lifetime_seconds": args.lifetime_seconds, "predecessor_execution_id": None}


def revision():
    return str(cli("human", "conditions")["revision"])


def process_state(process):
    for line in (Path("/proc") / str(process.pid) / "status").read_text().splitlines():
        if line.startswith("State:"):
            return line.split()[1]
    raise RuntimeError("supervisor state observation missing")


def paused_positive_control(name):
    process = runtimes[name]
    os.kill(process.pid, signal.SIGSTOP)
    until = time.monotonic() + 2
    while process_state(process) != "T":
        if time.monotonic() >= until:
            raise RuntimeError("Runtime SIGSTOP was not observed")
        time.sleep(0.02)
    now = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    deadline = instances[name]["binding"]["deadline_boottime_ns"]
    assert deadline - now >= 15_000_000_000, "insufficient unchanged deadline margin for restriction test"
    assert json.loads(run(["docker", "inspect", containers[name]]))[0]["State"]["Running"]
    cli(name, "conditions")
    cutoff_observations[name] = {"supervisor_state": "T", "paused_at_boottime_ns": now,
                                 "deadline_boottime_ns": deadline,
                                 "remaining_at_pause_ns": deadline - now, "paused_positive_http": 200}


def paused_denial_control(name):
    assert process_state(runtimes[name]) == "T"
    assert json.loads(run(["docker", "inspect", containers[name]]))[0]["State"]["Running"]
    cli(name, "conditions", expected=403)
    now = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    assert now < cutoff_observations[name]["deadline_boottime_ns"]
    cutoff_observations[name].update({"restricted_http": 403, "still_running_when_denied": True,
                                      "denial_observed_boottime_ns": now})


def verify_terminated(name):
    process = runtimes[name]
    process.wait(timeout=8)
    state = cli("human", "get", "executions", instances[name]["execution_id"])
    assert state["terminated"]
    detail = json.loads(run(["docker", "inspect", containers[name]]))[0]
    assert not detail["State"]["Running"]
    now = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    assert now < cutoff_observations[name]["deadline_boottime_ns"], "deadline expiry cannot substitute for applied restriction"
    cutoff_observations[name].update({"termination_observed_boottime_ns": now,
                                      "core_terminated": True, "backend_running": False,
                                      "terminated_before_original_deadline": True})


try:
    for name, uid in [("core", 70001), ("gateway", 70002), ("cli", 70003),
                      ("runtime-a", 0), ("runtime-b", 0), ("ca", 0)]:
        (root / name).mkdir(mode=0o700)
        os.chown(root / name, uid, uid)
    run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(root / "ca/ca.key")])
    run(["openssl", "req", "-x509", "-new", "-key", str(root / "ca/ca.key"), "-subj",
         "/CN=Ouroboros disposable management fixture", "-days", "1", "-addext",
         "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign",
         "-out", str(root / "ca/ca.pem")])
    write(root / "ca/cert.ext", fixture.cert_extensions())
    fingerprints = {}
    for name in ["core", "gateway", "gateway-service", "runtime", "human"]:
        key, csr, cert = [root / "ca" / f"{name}.{suffix}" for suffix in ["key", "csr", "pem"]]
        run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(key)])
        run(["openssl", "req", "-new", "-key", str(key), "-subj", f"/CN={name}", "-out", str(csr)])
        run(["openssl", "x509", "-req", "-in", str(csr), "-CA", str(root / "ca/ca.pem"),
             "-CAkey", str(root / "ca/ca.key"), "-CAcreateserial", "-days", "1", "-extfile",
             str(root / "ca/cert.ext"), "-out", str(cert)])
        fingerprints[name] = hashlib.sha256(run(["openssl", "x509", "-in", str(cert), "-outform", "DER"])).hexdigest()

    database = "ouro_test_" + secrets.token_hex(6)
    password = secrets.token_hex(24)
    redactions.append(password)
    sql(f"CREATE ROLE {database} LOGIN PASSWORD '{password}';")
    roles.append(database)
    sql(f"CREATE DATABASE {database} OWNER {database};")
    databases.append(database)
    write(root / "runtime-a/migrate.url", db_url(database, password, database))
    run([str(binary / "ouroboros-migrate"), "--database-url-file", str(root / "runtime-a/migrate.url")])
    firm, human, agent, grant, grant_a, grant_b, inherited = [str(uuid.uuid4()) for _ in range(7)]
    service_role = "ouro_service_" + secrets.token_hex(6)
    service_password = secrets.token_hex(24)
    redactions.append(service_password)
    sql(f"CREATE ROLE {service_role} LOGIN PASSWORD '{service_password}';")
    roles.append(service_role)
    sql(f"""GRANT CONNECT ON DATABASE {database} TO {service_role};
GRANT USAGE ON SCHEMA public TO {service_role};
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {service_role};
INSERT INTO firms(id) VALUES('{firm}');
INSERT INTO principals VALUES('{firm}','{human}','human',true),('{firm}','{agent}','agent',true);
INSERT INTO credentials VALUES('{fingerprints['human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES
('{firm}','{grant}','{human}',ARRAY['inspect','work.create','execution.start','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','compute',120,0);
INSERT INTO profiles VALUES('{firm}','gateway-probe',true,100,{args.lifetime_seconds});
""", database)
    write(root / "core/db.url", db_url(service_role, service_password, database), 70001)
    gateway_socket = ipc / "gateway/instance.sock"
    write(root / "core/config.json", json.dumps({
        "listen": fixture.endpoint("core"), "tls": tls("core", "core", 70001),
        "database_url_file": str(root / "core/db.url"), "firm_id": firm,
        "gateway_fingerprint": fingerprints["gateway-service"], "runtime_fingerprint": fingerprints["runtime"],
    }), 70001)
    write(root / "gateway/config.json", json.dumps({
        "listen": fixture.endpoint("gateway"), "tls": tls("gateway", "gateway", 70002),
        "core_url": fixture.url("core"), "core_client": tls("gateway", "gateway-service", 70002),
        "instance_socket": str(gateway_socket),
    }), 70002)
    write(root / "cli/config.json", json.dumps({
        "gateway_url": fixture.url("gateway"), "tls": tls("cli", "human", 70003),
    }), 70003)
    for name in ["a", "b"]:
        folder = f"runtime-{name}"
        runtime_configs[name] = root / folder / "config.json"
        write(runtime_configs[name], json.dumps({
            "core_url": fixture.url("core"), "tls": tls(folder, "runtime", 0),
            "profile_id": "gateway-probe", "profile": {
                "image": runtime_values["image"], "docker_socket": str(runtime_values["docker_socket"]),
                "memory_bytes": 134217728, "nano_cpus": 500000000, "pids_limit": 48,
                "lifetime_seconds": args.lifetime_seconds,
            }, "gateway_socket": str(gateway_socket), "binary_dir": str(binary),
            "evidence_dir": str(root / folder), "bridge_uid": runtime_values["bridge_uid"],
            "guard_uid": runtime_values["guard_uid"], "gateway_uid": 70002, "ipc_root": str(ipc),
        }))
    human_context = context("cli", "human")
    runtime_context = context("runtime-a", "runtime")
    for name, uid in [("core", 70001), ("gateway", 70002)]:
        spawn_service(name, uid, root / name / "config.json")
    for _ in range(50):
        try:
            if api("/conditions")[0] == 200:
                break
        except OSError:
            pass
        time.sleep(0.1)
    else:
        raise RuntimeError("control services did not become ready")
    assert api("/runtime/pending?profile=gateway-probe", service="core")[0] == 403
    assert api("/conditions", headers={"x-ouro-bridge-peer": "{}"})[1]["principal_id"] == human
    roots = {}
    for name in ["a", "b"]:
        roots[name] = cli("human", "work", "--key", f"root-{name}", body={
            "delegation_id": grant, "purpose": f"Management fixture root {name}",
        })["resource_id"]
    # All test grants are prepared before private execution; later tests never mint authority.
    for child, work in [(grant_a, roots["a"]), (grant_b, roots["b"])]:
        sql(f"""INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id)
VALUES('{firm}','{child}','{agent}','{grant}',ARRAY['inspect','work.create','execution.start','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour','{work}');""", database)
    sql(f"""INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at)
VALUES('{firm}','{inherited}','{agent}','{grant_a}',ARRAY['inspect','work.create','execution.start','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour');""", database)
    initial = {}
    for name, child in [("a", grant_a), ("b", grant_b)]:
        initial[name] = cli("human", "start", "--key", f"start-{name}", expected=202,
                            body=execution_body(roots[name], grant, child, 5))
        actual = start_runtime(name, initial[name])
        assert actual["work_id"] == roots[name] and actual["delegations"] == [child]
    assert instances["a"]["instance_id"] != instances["b"]["instance_id"]
    assert instances["a"]["binding"]["peer"] != instances["b"]["binding"]["peer"]
    checks.append("two real Runtime-bound instances share one logical principal but retain distinct work, grant and kernel peer")

    cursor_a = cli("a", "conditions")["cursor"]
    parent_cursor = cli("human", "conditions")["cursor"]
    child_work = cli("a", "work", "--key", "private-child", body={
        "delegation_id": grant_a, "purpose": "Private-generated child declaration",
    })
    replay = cli("a", "work", "--key", "private-child", body={
        "delegation_id": grant_a, "purpose": "Private-generated child declaration",
    })
    assert replay["replayed"] and replay["intent_id"] == child_work["intent_id"]
    detail = cli("human", "get", "work", child_work["resource_id"])
    assert detail["parent_id"] == roots["a"] and detail["principal_id"] == agent
    assert "input" not in cli("a", "get", "intents", child_work["intent_id"])
    for name, own, other in [("a", roots["a"], roots["b"]), ("b", roots["b"], roots["a"])]:
        listing = cli(name, "list-work")
        ids = {item["id"] for item in listing["items"]}
        assert own in ids and other not in ids
    assert child_work["resource_id"] in {item["id"] for item in cli("human", "list-work")["items"]}
    cli("b", "get", "work", child_work["resource_id"], expected=404)
    cli("b", "get", "intents", child_work["intent_id"], expected=404)
    cli("b", "work", "--key", "private-child", expected=403, body={
        "delegation_id": grant_b, "purpose": "Private-generated child declaration",
    })
    cli("b", "list-work", "--cursor", cursor_a, expected=409)
    cli("b", "events", "--cursor", cursor_a, expected=409)
    cli("a", "work", "--key", "borrow-grant", expected=403, body={
        "delegation_id": grant_b, "purpose": "Cannot borrow sibling grant",
    })
    for observer, cursor in [("a", cursor_a), ("human", parent_cursor)]:
        events = observed_events(observer, cursor)
        assert any(event["resource_id"] == child_work["resource_id"] for event in events)
        if observer == "a":
            assert all(event["data"].get("work_id") != roots["b"] for event in events)
    checks.append("private CLI creates/lists/reads work; parent human sees it; same-agent cross-root, replay and cursor access are denied")

    for name in ["a", "b"]:
        cid = containers[name]
        private = ["docker", "exec", "--user", "65532:65532", cid]
        forged = run([*private, "wget", "-T", "2", "-qO-", "--header", "x-ouro-client-fingerprint:" + fingerprints["human"],
                      "--header", "x-ouro-bridge-peer:" + json.dumps(instances["b" if name == "a" else "a"]["binding"]["peer"]),
                      "http://127.0.0.1:18080/conditions"])
        assert json.loads(forged)["work_id"] == roots[name]
        network = run([*private, "/usr/local/bin/ouroboros-fixture-net-probe", "18080", str(admin.port)])
        assert b"OUROBOROS_DIRECT_ACCESS_DENIED" in network
        probe = run([*private, "/bin/sh", "-c", "set -eu; test \"$(id -u)\" = 65532; test \"$(ls /sys/class/net)\" = lo; test ! -e /var/run/docker.sock; test ! -e /run/docker.sock; test ! -e \"$1\"; printf containment-ok", "probe", str(root)])
        assert probe == b"containment-ok"
        inspected = json.loads(run(["docker", "inspect", cid]))[0]
        assert inspected["HostConfig"]["NetworkMode"] == "none"
        assert inspected["HostConfig"]["ReadonlyRootfs"] and inspected["HostConfig"]["CapDrop"] == ["ALL"]
        assert not inspected.get("Mounts") and inspected["Config"]["User"] == "65532:65532"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(2)
        connection.connect(str(gateway_socket))
        forged_peer = json.dumps(instances["a"]["binding"]["peer"])
        connection.sendall(f"GET /conditions HTTP/1.1\r\nHost: local\r\nx-ouro-bridge-peer: {forged_peer}\r\nConnection: close\r\n\r\n".encode())
        assert b"403" in connection.recv(4096).split(b"\r\n", 1)[0]
    marker = secrets.token_hex(16)
    run(["docker", "exec", "--user", "65532:65532", "-i", containers["a"], "/bin/sh", "-c",
         "umask 077; cat > /dev/shm/ouroboros-management-marker"], data=marker.encode())
    assert run(["docker", "exec", "--user", "65532:65532", containers["a"], "cat", "/dev/shm/ouroboros-management-marker"]).decode() == marker
    run(["docker", "exec", "--user", "65532:65532", containers["b"], "/bin/sh", "-c",
         "test ! -e /dev/shm/ouroboros-management-marker"])
    checks.append("actual private kernel paths reject forged identity, direct DB/network and host sockets; per-container probe scratch is separate")

    stopped = cli("a", "start", "--key", "scoped-stop-job", expected=202,
                  body=execution_body(child_work["resource_id"], grant_a, grant_a, 5))
    cli("b", "stop", stopped["resource_id"], "--revision", revision(), "--key", "sibling-stop", expected=403)
    cli("a", "stop", stopped["resource_id"], "--revision", revision(), "--key", "scoped-stop", expected=202)
    assert cli("human", "get", "executions", stopped["resource_id"])["stopped"]
    assert cli("a", "conditions")["delegations"] == [grant_a]
    pending = cli("a", "start", "--key", "origin-pending", expected=202,
                  body=execution_body(child_work["resource_id"], grant_a, grant_a, 5))
    assert sql(f"SELECT committed FROM limits WHERE firm_id='{firm}' AND id='compute'", database) == "20"
    with ThreadPoolExecutor(max_workers=2) as pool:
        def race(name, child):
            argv, data = private_command(name, ["start", "--key", f"race-{name}"], execution_body(roots[name], child, child, 70))
            observed = command(argv, data=data)
            match = re.findall(rb"HTTP ([0-9]{3})", observed.stderr)
            if not match:
                raise RuntimeError("concurrent admission produced no HTTP observation")
            return int(match[-1]), observed.returncode
        observations = list(pool.map(lambda item: race(*item), [("a", grant_a), ("b", grant_b)]))
    assert sorted(status for status, _ in observations) == [202, 429]
    assert all((status == 202) == (code == 0) for status, code in observations)
    assert sql(f"SELECT committed FROM limits WHERE firm_id='{firm}' AND id='compute'", database) == "90"
    checks.append("two initial 5-unit instances plus two 5-unit jobs leave 100 of 120; simultaneous 70/70 admits exactly one")

    cli("a", "revoke", grant_b, "--revision", revision(), "--key", "sibling-revoke", expected=403)
    cli("a", "revoke", inherited, "--revision", revision(), "--key", "inherited-revoke", expected=202)
    assert cli("a", "conditions")["delegations"] == [grant_a]
    assert cli("b", "conditions")["delegations"] == [grant_b]
    paused_positive_control("a")
    cli("human", "stop", instances["a"]["execution_id"], "--revision", revision(), "--key", "stop-origin", expected=202)
    paused_denial_control("a")
    status, _ = api(f"/runtime/claims/{pending['intent_id']}", ctx=runtime_context, service="core", data={})
    assert status == 403
    assert sql(f"SELECT count(*) FROM attempts WHERE firm_id='{firm}' AND intent_id='{pending['intent_id']}'", database) == "0"
    assert sql(f"SELECT units::text||':'||settled::text FROM reservations WHERE firm_id='{firm}' AND intent_id='{pending['intent_id']}'", database) == "5:false"
    os.kill(runtimes["a"].pid, signal.SIGCONT)
    verify_terminated("a")
    paused_positive_control("b")
    cli("b", "revoke", grant_b, "--revision", revision(), "--key", "self-revoke", expected=202)
    paused_denial_control("b")
    os.kill(runtimes["b"].pid, signal.SIGCONT)
    verify_terminated("b")
    assert sql(f"SELECT committed FROM limits WHERE firm_id='{firm}' AND id='compute'", database) == "80"
    checks.append("scope-limited stop and inherited/self revocation apply at live Gateway; stopped-origin dispatch is denied and only confirmed original runtime compute returns; pending reservations survive")
    result = {"result": "PASS", "fixture_id": fixture.identity, "checks": checks,
              "bound_instances": {name: {key: value for key, value in instance.items() if key in {"instance_id", "execution_id"}} for name, instance in instances.items()},
              "concurrent_admission_statuses": sorted(status for status, _ in observations),
              "compute_capacity": 120, "retained_compute_commitment": 80,
              "restriction_application": cutoff_observations,
              "native_codex": "NOT RUN", "model_subscription": "NOT RUN",
              "general_workspace_lifecycle": "NOT RUN; only container-private /dev/shm marker tested",
              "successful_successor_recovery": "NOT RUN", "production_qualification": "NOT RUN"}
except BaseException as error:
    result = {"result": "FAIL", "fixture_id": fixture.identity,
              "error_type": type(error).__name__, "completed_checks": checks,
              "restriction_application": cutoff_observations}
    raise
finally:
    cleanup_errors = []
    runtime_guard_observations = []
    for name, process in runtimes.items():
        try:
            capture_guards(process)
        except (OSError, ValueError, RuntimeError):
            cleanup_errors.append("owned guard identity requires inspection")
        guard_observed = any(guard["observed_parent_runtime_pid"] == process.pid
                             for guard in owned_guards.values())
        startup_confirmed = name in confirmed_runtime_startups
        runtime_guard_observations.append({"runtime": name, "runtime_pid": process.pid,
                                           "initial_execution_confirmed": startup_confirmed,
                                           "owned_guard_observed": guard_observed})
        if not guard_observed and not startup_confirmed:
            cleanup_errors.append(f"runtime {name} guard cleanup unknown/pending; initial execution and owned guard were not observed")
        if process.poll() is None:
            try:
                os.kill(process.pid, signal.SIGCONT)
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
            except (OSError, subprocess.TimeoutExpired):
                cleanup_errors.append("runtime containment requires inspection")
    # Collect only identities journaled beneath this one-use fixture root; never sweep Docker.
    owned = set(containers.values())
    for name in ["a", "b"]:
        folder = root / f"runtime-{name}"
        if folder.is_dir():
            for record in folder.glob("*/container.json"):
                try:
                    candidate = json.loads(record.read_text())["container_id"]
                    if re.fullmatch(r"[a-f0-9]{64}", candidate):
                        owned.add(candidate)
                except (OSError, ValueError, KeyError):
                    cleanup_errors.append("container journal requires inspection")
    for cid in owned:
        try:
            if command(["docker", "rm", "-f", cid], timeout=10).returncode:
                cleanup_errors.append("fixture container removal failed")
        except (OSError, subprocess.TimeoutExpired):
            cleanup_errors.append("fixture container removal uncertain")
    for process in reversed(processes):
        try:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=3)
        except (OSError, subprocess.TimeoutExpired):
            cleanup_errors.append("service shutdown requires inspection")
    for db in reversed(databases):
        try:
            sql(f"DROP DATABASE {db} WITH (FORCE);")
        except Exception:
            cleanup_errors.append("disposable database cleanup failed")
    for role in reversed(roles):
        try:
            sql(f"DROP ROLE {role};")
        except Exception:
            cleanup_errors.append("disposable role cleanup failed")
    # Guards intentionally survive the supervisor. Observe only previously identified PID/start
    # pairs until their original deadline; no process-name sweep or lifetime change is permitted.
    guard_cleanup = []
    for guard in owned_guards.values():
        observation = dict(guard)
        bound = time.monotonic() + max(0, (guard["deadline_boottime_ns"] - time.clock_gettime_ns(time.CLOCK_BOOTTIME)) / 1e9) + 3
        while True:
            current = process_identity(guard["pid"])
            if current is None or current["start_ticks"] != guard["start_ticks"]:
                observation["original_process_gone"] = True
                observation["observed_at_boottime_ns"] = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
                break
            if time.monotonic() >= bound:
                observation["original_process_gone"] = False
                observation["remaining_state"] = current["state"]
                cleanup_errors.append("owned deadline guard cleanup remains pending")
                break
            time.sleep(0.2)
        guard_cleanup.append(observation)
    if result is None:
        result = {"result": "FAIL", "fixture_id": fixture.identity, "completed_checks": checks}
    result["cleanup"] = "complete" if not cleanup_errors else cleanup_errors
    result["runtime_guard_observations"] = runtime_guard_observations
    result["guard_cleanup"] = guard_cleanup
    if cleanup_errors:
        result["result"] = "FAIL"
    write(root / "result.json", json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    if cleanup_errors:
        raise RuntimeError("fixture cleanup incomplete; inspect protected result")
