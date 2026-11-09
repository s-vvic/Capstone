#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

sudo setpriv \
  --reuid="$(id -u)" \
  --regid="$(id -g)" \
  --init-groups \
  --inh-caps=-all,+net_admin,+dac_override \
  --ambient-caps=-all,+net_admin,+dac_override \
  "$(command -v node)" --env-file=.env src/server.js