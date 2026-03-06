#!/bin/sh
set -eu

DISPLAY_NUM="${DISPLAY_NUM:-:1}"
SCREEN_SIZE="${SCREEN_SIZE:-1366x768x24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

export DISPLAY="$DISPLAY_NUM"

display_id="$(printf "%s" "$DISPLAY_NUM" | sed 's/^://')"
rm -f "/tmp/.X${display_id}-lock" "/tmp/.X11-unix/X${display_id}" || true

DBUS_ADDR="$(dbus-daemon --session --fork --print-address 2>/tmp/dbus.log || true)"
if [ -n "$DBUS_ADDR" ]; then
  export DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDR"
fi

mkdir -p /run/dbus
dbus-daemon --system --fork --nopidfile >/tmp/dbus-system.log 2>&1 || true

Xvfb "$DISPLAY_NUM" -screen 0 "$SCREEN_SIZE" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!

sleep 1

fluxbox >/tmp/fluxbox.log 2>&1 &
FLUXBOX_PID=$!

x11vnc -display "$DISPLAY_NUM" -rfbport "$VNC_PORT" -forever -shared -nopw -listen 0.0.0.0 >/tmp/x11vnc.log 2>&1 &
X11VNC_PID=$!

if [ ! -f /usr/share/novnc/index.html ] && [ -f /usr/share/novnc/vnc.html ]; then
  ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html
fi

websockify --web=/usr/share/novnc/ "$NOVNC_PORT" "127.0.0.1:${VNC_PORT}" >/tmp/novnc.log 2>&1 &
WEBSOCKIFY_PID=$!

npm run start:docker &
APP_PID=$!

cleanup() {
  kill "$APP_PID" "$WEBSOCKIFY_PID" "$X11VNC_PID" "$FLUXBOX_PID" "$XVFB_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT
wait "$APP_PID"
