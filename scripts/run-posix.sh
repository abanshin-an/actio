#!/bin/zsh
defaults write org.xquartz.X11 nolisten_tcp -bool false
killall XQuartz 2>/dev/null || true
open -a XQuartz
sleep 2
DISPLAY=:0 /opt/X11/bin/xhost +localhost
DISPLAY=:0 /opt/X11/bin/xhost +127.0.0.1
lsof -nP -iTCP:6000 -sTCP:LISTEN
docker compose down
docker compose -f docker-compose.posix.yml up --build