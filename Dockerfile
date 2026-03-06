FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  dbus \
  fluxbox \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnss3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  novnc \
  websockify \
  x11vnc \
  xauth \
  xvfb \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Electron sandbox helper must be owned by root and be setuid (4755).
RUN chown root:root /app/node_modules/electron/dist/chrome-sandbox \
  && chmod 4755 /app/node_modules/electron/dist/chrome-sandbox

RUN chmod +x /app/scripts/start-novnc.sh

USER node

CMD ["/app/scripts/start-novnc.sh"]
