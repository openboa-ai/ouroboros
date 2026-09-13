#!/usr/bin/env bash
# Dedicated guest only. Public official binary; no account state is imported.
set -euo pipefail
. "$(dirname "$0")/test-profile.sh"
ouro_require_reference_profile
ouro_require_stage_root
ouro_require_docker_socket
stage=$(mktemp -d "$OURO_TEST_STAGE_ROOT/ouro-codex.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT
cd "$stage"
curl --fail --silent --show-error --max-time 180 -L https://github.com/openai/codex/releases/download/rust-v0.153.4/codex-aarch64-unknown-linux-musl.tar.gz -o codex.tar.gz
printf '%s\n' '5cda6182bd94c3a30f2eb63a495489ebf7f691fddb14d70f48c6c1a5071b6cde  codex.tar.gz' | sha256sum -c -
tar -xzf codex.tar.gz
curl --fail --silent --show-error --max-time 60 -L https://github.com/openai/codex/releases/download/rust-v0.153.4/bwrap-aarch64-unknown-linux-musl.tar.gz -o bwrap.tar.gz
printf '%s\n' '2c6ea97dfb0a936b695ece6df058b89d4dfd53774a9ad852b3e4c98e6bbdfd20  bwrap.tar.gz' | sha256sum -c -
tar -xzf bwrap.tar.gz
curl --fail --silent --show-error --max-time 60 -L https://github.com/openai/codex/releases/download/rust-v0.153.4/codex-code-mode-host-aarch64-unknown-linux-musl.tar.gz -o code-mode-host.tar.gz
printf '%s\n' 'd8047b8d33370d6090e729d27eb76de60a2686baa1c143c138c9b05dc70d813b  code-mode-host.tar.gz' | sha256sum -c -
tar -xzf code-mode-host.tar.gz
cat > Dockerfile <<'DOCKER'
FROM busybox@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0
RUN adduser -D -u 20000 agent && mkdir /workspace && chown agent /workspace
COPY codex-aarch64-unknown-linux-musl /usr/local/bin/codex
COPY codex-code-mode-host-aarch64-unknown-linux-musl /usr/local/bin/codex-code-mode-host
COPY bwrap-aarch64-unknown-linux-musl /usr/local/bin/codex-resources/bwrap
ENV HOME=/home/agent
USER 20000:20000
WORKDIR /workspace
ENTRYPOINT ["/bin/sleep"]
CMD ["120"]
DOCKER
ouro_docker build --network=none --iidfile "$stage/image.id" .
cat "$stage/image.id"
