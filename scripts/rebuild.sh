#!/bin/zsh
export DISPLAY=host.docker.internal:0
/opt/X11/bin/xhost + 127.0.0.1
docker compose down -v
docker compose -f docker-compose.yml up --build