#!/usr/bin/env bash
# Run only as root inside the dedicated, disposable Ubuntu test guest.
set -euo pipefail
. "$(dirname "$0")/test-profile.sh"
ouro_require_reference_profile
ouro_require_path OURO_DOCKER_SOCKET
[[ $(id -u) == 0 ]]
. /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]]
# The remaining package/key/service locations belong to this Ubuntu reference profile,
# rather than to a developer checkout or deployment's persistent firm-data directory.
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg docker.io build-essential pkg-config libssl-dev
install -d /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error --max-time 60 https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
printf '%s\n' 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main' > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y -qq postgresql-18
systemctl enable --now systemd-timesyncd docker postgresql
# Do not add the login user or a workload to the docker group.
# The operator must configure the guest daemon/socket unit for this exact endpoint.
# Package installation does not silently select a different socket for the fixture.
ouro_require_docker_socket
stat -c '%a %U %G' "$OURO_DOCKER_SOCKET"
/usr/lib/postgresql/18/bin/postgres --version
ouro_docker version
