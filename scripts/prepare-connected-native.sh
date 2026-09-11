#!/usr/bin/env bash
# Dedicated Linux guest, not Mac. This build candidate is NOT qualified until the connected test passes.
# No model calls, account state, host mounts, or Docker access inside the resulting image.
set -euo pipefail
. "$(dirname "$0")/test-profile.sh"
ouro_require_reference_profile
ouro_require_stage_root
ouro_require_docker_socket
ouro_require_path CARGO_TARGET_DIR
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source_image=${1:?Pass the exact sha256 image ID returned by prepare-codex-fixture.sh}
[[ "$source_image" =~ ^sha256:[0-9a-f]{64}$ ]]
ouro_docker image inspect "$source_image" >/dev/null
# Build only the internal CLI with static C runtime; never place the host's TLS configuration in it.
# An explicit --target keeps crt-static flags off host proc-macro builds.
CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 RUSTFLAGS='-C target-feature=+crt-static'
export CARGO_INCREMENTAL CARGO_PROFILE_DEV_DEBUG RUSTFLAGS
cargo build --manifest-path "$repo_dir/Cargo.toml" --target-dir "$CARGO_TARGET_DIR" --locked --offline \
  --target aarch64-unknown-linux-gnu -p ouroboros-cli
cli_binary="$CARGO_TARGET_DIR/aarch64-unknown-linux-gnu/debug/ouroboros-cli"
program_headers=$(readelf -l "$cli_binary")
if [[ "$program_headers" == *INTERP* ]]; then
  echo 'CLI still requires a dynamic loader; candidate rejected' >&2
  exit 1
fi
stage=$(mktemp -d "$OURO_TEST_STAGE_ROOT/ouro-connected-image.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT
cp "$cli_binary" "$stage/ouroboros-cli"
rustc --edition=2024 --target aarch64-unknown-linux-gnu -C target-feature=+crt-static \
  -C opt-level=s -C panic=abort "$repo_dir/scripts/fixtures/native-network-probe.rs" \
  -o "$stage/ouroboros-fixture-net-probe"
probe_headers=$(readelf -l "$stage/ouroboros-fixture-net-probe")
if [[ "$probe_headers" == *INTERP* ]]; then
  echo 'Fixture probe still requires a dynamic loader; candidate rejected' >&2
  exit 1
fi
cat > "$stage/Dockerfile" <<'DOCKER'
ARG CODEX_IMAGE
FROM ${CODEX_IMAGE}
USER 0:0
COPY ouroboros-cli /usr/local/bin/ouroboros-cli
COPY ouroboros-fixture-net-probe /usr/local/bin/ouroboros-fixture-net-probe
USER 65532:65532
DOCKER
ouro_docker build --network=none --build-arg "CODEX_IMAGE=$source_image" \
  --iidfile "$stage/image.id" "$stage"
cat "$stage/image.id"
# Runtime will replace writable workspace/home with bounded tmpfs after admission.
# This command does not execute Codex or admit a workload.
