#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_PATH="$ROOT_DIR/ops/nginx/trialbridge.host.conf.template"
DOMAIN="${DOMAIN:-evercool.ae}"
API_DOMAIN="${API_DOMAIN:-api.$DOMAIN}"
TARGET_PATH="/etc/nginx/sites-available/trialbridge"
ENABLED_PATH="/etc/nginx/sites-enabled/trialbridge"
DEFAULT_ENABLED="/etc/nginx/sites-enabled/default"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Template not found: $TEMPLATE_PATH"
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

sed \
  -e "s|__DOMAIN__|$DOMAIN|g" \
  -e "s|__API_DOMAIN__|$API_DOMAIN|g" \
  "$TEMPLATE_PATH" > "$TMP_FILE"

echo "Installing host nginx config for:"
echo "  domain: $DOMAIN"
echo "  api:    $API_DOMAIN"

$SUDO cp "$TMP_FILE" "$TARGET_PATH"
$SUDO ln -sf "$TARGET_PATH" "$ENABLED_PATH"

if [[ -L "$DEFAULT_ENABLED" || -f "$DEFAULT_ENABLED" ]]; then
  $SUDO rm -f "$DEFAULT_ENABLED"
fi

$SUDO nginx -t
if ! $SUDO systemctl is-active --quiet nginx; then
  echo "nginx.service is not active. Starting and enabling nginx..."
  $SUDO systemctl enable --now nginx
else
  $SUDO systemctl reload nginx || $SUDO systemctl restart nginx
fi

if ! $SUDO systemctl is-active --quiet nginx; then
  echo "Host nginx failed to start/reload. Port owners on 80/443:"
  $SUDO ss -ltnp | grep -E ":(80|443) " || true
  echo "If docker is occupying 80/443, stop the conflicting containers and rerun this script."
  exit 1
fi

echo "Nginx host proxy configured successfully."
echo "Next: run certbot for TLS:"
echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d $API_DOMAIN --redirect -m <YOUR_EMAIL> --agree-tos -n"
