#!/usr/bin/env bash
# Explicit disposable Linux candidate only; no account, provider or workload execution.
set -euo pipefail
. "$(dirname "$0")/test-profile.sh"
ouro_require_reference_profile
ouro_require_stage_root
ouro_require_docker_socket
ouro_require_path CARGO_TARGET_DIR
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source_image=${1:?Pass an already present exact sha256 base image ID}
source_digest=$(python3 "$repo_dir/scripts/native_image_identity.py" --source-root "$repo_dir")
[[ "$source_image" =~ ^sha256:[0-9a-f]{64}$ ]]
ouro_docker image inspect "$source_image" >/dev/null
# The supplied image must already contain /usr/bin/env, /bin/sh and ordinary shell utilities.
# Both product binaries use a static C runtime. No host configuration or private payload is copied.
export CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 RUSTFLAGS='-C target-feature=+crt-static'
cargo build --manifest-path "$repo_dir/Cargo.toml" --target-dir "$CARGO_TARGET_DIR" --locked --offline \
  --target aarch64-unknown-linux-gnu -p ouroboros-cli -p ouroboros-runtime \
  --bin ouroboros-cli --bin ouroboros-materialize
stage=$(mktemp -d "$OURO_TEST_STAGE_ROOT/ouro-program-image.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT
for name in ouroboros-cli ouroboros-materialize; do
  candidate="$CARGO_TARGET_DIR/aarch64-unknown-linux-gnu/debug/$name"
  program_headers=$(readelf -l "$candidate")
  if [[ "$program_headers" == *INTERP* ]]; then
    printf '%s requires a dynamic loader; candidate rejected\n' "$name" >&2
    exit 1
  fi
  cp "$candidate" "$stage/$name"
done
# The final image owns every current-source test/product binary. Do not inherit a
# stale network probe from a caller-selected base and relabel it as current source.
rustc --edition=2024 --target aarch64-unknown-linux-gnu -C target-feature=+crt-static \
  -C opt-level=s -C panic=abort "$repo_dir/scripts/fixtures/native-network-probe.rs" \
  -o "$stage/ouroboros-fixture-net-probe"
probe_headers=$(readelf -l "$stage/ouroboros-fixture-net-probe")
if [[ "$probe_headers" == *INTERP* ]]; then
  ouro_fail 'Fixture probe requires a dynamic loader; candidate rejected.'
fi
cat > "$stage/Dockerfile" <<'DOCKER'
ARG PROGRAM_IMAGE
FROM ${PROGRAM_IMAGE}
ARG SOURCE_SHA256
ARG CLI_SHA256
ARG MATERIALIZER_SHA256
ARG PROBE_SHA256
LABEL io.ouroboros.fixture.source-sha256=${SOURCE_SHA256} \
      io.ouroboros.fixture.cli-sha256=${CLI_SHA256} \
      io.ouroboros.fixture.materializer-sha256=${MATERIALIZER_SHA256} \
      io.ouroboros.fixture.probe-sha256=${PROBE_SHA256}
USER 0:0
COPY ouroboros-cli /usr/local/bin/ouroboros-cli
COPY ouroboros-materialize /usr/local/bin/ouroboros-materialize
COPY ouroboros-fixture-net-probe /usr/local/bin/ouroboros-fixture-net-probe
USER 65532:65532
DOCKER
[[ $(python3 "$repo_dir/scripts/native_image_identity.py" --source-root "$repo_dir") == "$source_digest" ]] || \
  ouro_fail 'Native image sources changed during the build; candidate rejected.'
cli_digest=$(sha256sum "$stage/ouroboros-cli" | cut -d' ' -f1)
materializer_digest=$(sha256sum "$stage/ouroboros-materialize" | cut -d' ' -f1)
probe_digest=$(sha256sum "$stage/ouroboros-fixture-net-probe" | cut -d' ' -f1)
build_base=$(ouro_local_build_base "$source_image")
ouro_docker build --pull=false --network=none --build-arg "PROGRAM_IMAGE=$build_base" \
  --build-arg "SOURCE_SHA256=$source_digest" --build-arg "CLI_SHA256=$cli_digest" \
  --build-arg "MATERIALIZER_SHA256=$materializer_digest" --build-arg "PROBE_SHA256=$probe_digest" \
  --iidfile "$stage/image.id" "$stage"
cat "$stage/image.id"
# The COPY-only image is a candidate; the connected program fixture qualifies the actual path.
