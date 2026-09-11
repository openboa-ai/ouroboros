#!/usr/bin/env bash
# Shared input validation for the explicitly selected Linux reference fixture.
# Source this file; it does not provision a host or infer an execution environment.

# This reference profile supports direct official-source access only. A host's proxy
# settings are not deployment inputs and must not redirect downloads or package traffic.
# Values may contain credentials, so never print them while rejecting inherited routing.
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY all_proxy ALL_PROXY \
  no_proxy NO_PROXY ftp_proxy FTP_PROXY

ouro_fail() {
  printf '%s\n' "$*" >&2
  return 1
}

ouro_require_reference_profile() {
  [[ ${OURO_TEST_PROFILE:-} == linux-aarch64-reference ]] || \
    ouro_fail 'Set OURO_TEST_PROFILE=linux-aarch64-reference; no other build profile is qualified here.' || return
  [[ $(uname -s) == Linux && $(uname -m) == aarch64 ]] || \
    ouro_fail 'The selected reference profile requires Linux aarch64.'
}

ouro_require_path() {
  local name=$1 value=${!1:-}
  [[ -n "$value" && "$value" == /* && "$value" != / && "$value" != */ && \
    "$value" != *[[:cntrl:]]* && "$value" != *'//'* ]] || \
    ouro_fail "$name must be an explicit absolute path without trailing slash or control characters." || return
  case "/${value#/}/" in
    */./*|*/../*) ouro_fail "$name must not contain dot path components."; return 1 ;;
  esac
}

ouro_require_stage_root() {
  ouro_require_path OURO_TEST_STAGE_ROOT || return
  [[ -d "$OURO_TEST_STAGE_ROOT" && -w "$OURO_TEST_STAGE_ROOT" ]] || \
    ouro_fail 'OURO_TEST_STAGE_ROOT must identify an existing writable directory.'
}

ouro_prepare_rust_prefix() {
  ouro_require_path OURO_TEST_RUST_PREFIX || return
  # A caller first prepares a dedicated, protected toolchain parent and marks it with
  # the exact text below. Never adopt an existing installation or invoke its installer
  # as root merely because an environment variable points at it.
  python3 - "$OURO_TEST_RUST_PREFIX" <<'PY'
import os
from pathlib import Path
import stat
import sys

prefix = Path(sys.argv[1])
parent = prefix.parent
uid = os.geteuid()
try:
    if os.path.lexists(prefix):
        raise ValueError("OURO_TEST_RUST_PREFIX must not already exist, including a symlink")
    if parent.resolve(strict=True) != parent:
        raise ValueError("toolchain parent must not contain symlink aliases")
    for ancestor in (parent, *parent.parents):
        meta = ancestor.stat()
        sticky_system_ancestor = ancestor != parent and meta.st_uid == 0 and meta.st_mode & stat.S_ISVTX
        if not stat.S_ISDIR(meta.st_mode) or meta.st_uid not in (0, uid) or (meta.st_mode & 0o022 and not sticky_system_ancestor):
            raise ValueError("toolchain parent ancestry must be protected")
    if parent.stat().st_uid != uid:
        raise ValueError("toolchain parent must belong to the invoking fixture user")
    marker = parent / ".ouroboros-test-install-root"
    meta = marker.lstat()
    if not stat.S_ISREG(meta.st_mode) or meta.st_uid != uid or meta.st_mode & 0o022:
        raise ValueError("toolchain parent marker must be a protected regular file")
    if marker.read_bytes() != b"ouroboros-disposable-toolchains\n":
        raise ValueError("toolchain parent is not explicitly marked for disposable installations")
    # mkdir is exclusive even if a concurrent invocation selects the same prefix.
    prefix.mkdir(mode=0o700)
    (prefix / ".ouroboros-test-toolchain").write_text("fresh reference fixture installation\n")
except (OSError, ValueError) as error:
    # Do not print unrelated environment variables or inherited credential-bearing URLs.
    print(f"Rust fixture prefix rejected: {error}", file=sys.stderr)
    sys.exit(1)
PY
}

ouro_require_docker_socket() {
  ouro_require_path OURO_DOCKER_SOCKET || return
  [[ -S "$OURO_DOCKER_SOCKET" && ! -L "$OURO_DOCKER_SOCKET" ]] || \
    ouro_fail 'OURO_DOCKER_SOCKET must identify an existing Unix socket, not a symlink.'
}

ouro_docker() {
  # Explicit endpoint selection must not inherit an ambient context, TLS mode, or provider.
  local command=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH
    -u http_proxy -u HTTP_PROXY -u https_proxy -u HTTPS_PROXY -u all_proxy -u ALL_PROXY
    -u no_proxy -u NO_PROXY -u ftp_proxy -u FTP_PROXY)
  if [[ $(id -u) != 0 ]]; then command=(sudo "${command[@]}"); fi
  "${command[@]}" docker --host "unix://$OURO_DOCKER_SOCKET" "$@"
}
