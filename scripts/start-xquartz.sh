#!/bin/sh
set -eu

if [ -z "${DISPLAY:-}" ]; then
  export DISPLAY="host.docker.internal:0"
fi

DBUS_ADDR="$(dbus-daemon --session --fork --print-address 2>/tmp/dbus-session.log || true)"
if [ -n "$DBUS_ADDR" ]; then
  export DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDR"
fi

mkdir -p /run/dbus
dbus-daemon --system --fork --nopidfile >/tmp/dbus-system.log 2>&1 || true

exec npm run start:docker