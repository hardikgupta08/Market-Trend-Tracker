#!/usr/bin/env bash
# One-shot setup / update for an Ubuntu VM (Oracle Cloud Always Free, ARM or x86).
# Installs Docker, opens ports 80/443, clones (or updates) the repo and starts the app behind HTTPS.
#
#   curl -fsSL https://raw.githubusercontent.com/hardikgupta08/industry-index-tracker/main/deploy/oracle-setup.sh | bash
#
# Optional: DOMAIN=markets.example.com (default: <public-ip>.sslip.io, which needs no DNS setup).
# Safe to rerun; rerunning pulls the latest code and rebuilds.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/hardikgupta08/industry-index-tracker.git}"
APP_DIR="${APP_DIR:-$HOME/industry-index-tracker}"

if ! command -v docker >/dev/null; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH.
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then
  sudo netfilter-persistent save >/dev/null
fi

echo "==> Fetching code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  if [ -n "${DOMAIN:-}" ]; then
    addr="$DOMAIN"
  else
    ip="$(curl -fsS https://ifconfig.me)"
    addr="${ip//./-}.sslip.io"
  fi
  echo "SITE_ADDRESS=$addr" > .env
fi
addr="$(sed -n 's/^SITE_ADDRESS=//p' .env)"

echo "==> Building and starting (first build takes a few minutes)"
sudo docker compose up -d --build
sudo docker image prune -f >/dev/null

echo
echo "Done. Open https://$addr (the HTTPS certificate is issued on first start, allow ~30 s)."
echo "Logs: cd $APP_DIR && sudo docker compose logs -f app"
