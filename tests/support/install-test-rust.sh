#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/test-profile.sh"
ouro_require_reference_profile
ouro_require_stage_root
ouro_prepare_rust_prefix
stage=$(mktemp -d "$OURO_TEST_STAGE_ROOT/ouro-rust.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT
cd "$stage"
archive=rust-1.94.1-aarch64-unknown-linux-gnu.tar.xz
curl --fail --silent --show-error --max-time 240 -O "https://static.rust-lang.org/dist/$archive"
curl --fail --silent --show-error --max-time 30 -O "https://static.rust-lang.org/dist/$archive.sha256"
sha256sum --check "$archive.sha256"
tar -xf "$archive"
./rust-1.94.1-aarch64-unknown-linux-gnu/install.sh --prefix="$OURO_TEST_RUST_PREFIX" --without=rust-docs --disable-ldconfig
"$OURO_TEST_RUST_PREFIX/bin/rustc" --version
