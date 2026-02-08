# TrialBridge Deployment (DigitalOcean + Tasjeel Domain)

This guide assumes:
- Frontend domain: `trialbridge.ae` (optional `www.trialbridge.ae`)
- API domain: `api.trialbridge.ae`
- Project path on droplet: `/opt/trialbridge`
- Full stack is Dockerized in production (`frontend` + backend services in compose)

## Script-first workflow

### Initial deploy
```bash
cd /opt/trialbridge
chmod +x ops/deploy_initial.sh ops/deploy_update.sh
./ops/deploy_initial.sh
```

### Subsequent deploys
```bash
cd /opt/trialbridge
./ops/deploy_update.sh
```

Optional env override:
```bash
ENV_FILE=.env ./ops/deploy_initial.sh
ENV_FILE=.env ./ops/deploy_update.sh
```

Scripts now auto-sync the Postgres role password from `.env.prod` before app services start, so password-only changes in env do not break API startup.

---

## 5) Deploy app services (all Docker)

### 5.1 Prepare app and env
```bash
sudo mkdir -p /opt/trialbridge
sudo chown -R $USER:$USER /opt/trialbridge
cd /opt/trialbridge
git clone <YOUR_REPO_URL> .
cp .env.prod.example .env.prod
nano .env.prod
```

Required values in `.env.prod`:
- `DJANGO_SECRET_KEY`
- `POSTGRES_PASSWORD`
- `GEMINI_API_KEY`
- `DJANGO_ALLOWED_HOSTS=api.trialbridge.ae`
- `CORS_ALLOWED_ORIGINS=https://trialbridge.ae,https://www.trialbridge.ae`
- `NEXT_PUBLIC_SITE_URL=https://trialbridge.ae`
- `NEXT_PUBLIC_API_BASE_URL=https://api.trialbridge.ae/api/v1`
- `SEED_DEMO=0`

### 5.2 Start full stack
```bash
cd /opt/trialbridge
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build postgres redis api worker beat nginx frontend
```

### 5.3 One-time backend init
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api python manage.py migrate --noinput
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api python manage.py collectstatic --noinput
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api python manage.py check
```

Create coordinator user if needed:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api python manage.py createsuperuser
```

---

## 6) Nginx reverse proxy on host

Your host Nginx terminates TLS and proxies:
- `trialbridge.ae` -> `127.0.0.1:3000` (frontend container)
- `api.trialbridge.ae` -> `127.0.0.1:8080` (backend nginx container)

Create config:
```bash
sudo tee /etc/nginx/sites-available/trialbridge > /dev/null << 'EOF'
server {
    listen 80;
    server_name trialbridge.ae www.trialbridge.ae;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api.trialbridge.ae;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Enable site:
```bash
sudo ln -sf /etc/nginx/sites-available/trialbridge /etc/nginx/sites-enabled/trialbridge
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7) TLS (Let's Encrypt)

```bash
sudo certbot --nginx \
  -d trialbridge.ae \
  -d www.trialbridge.ae \
  -d api.trialbridge.ae \
  --redirect \
  -m <YOUR_EMAIL> \
  --agree-tos -n
```

Verify auto-renew:
```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

---

## 8) Verification checklist

### 8.1 Service checks
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 api
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=50 frontend
sudo systemctl status nginx --no-pager
```

### 8.2 Endpoint checks
```bash
curl -I https://trialbridge.ae
curl -I https://www.trialbridge.ae
curl -sS https://api.trialbridge.ae/api/v1/health/
```

Expected:
- frontend: HTTP `200`
- API health: `{"status":"ok"}`

### 8.3 Browser checks
1. Coordinator login works.
2. Patient login works.
3. Match detail loads.
4. PDF export works.
5. Patient history append updates matches.
6. Upload + extracted text display works.

---

## 9) Operations, updates, backups

### 9.1 Regular release
```bash
cd /opt/trialbridge
./ops/deploy_update.sh
```

### 9.2 Useful logs
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f worker
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Postgres backup
Create backup folder:
```bash
mkdir -p /opt/trialbridge/backups
```

Backup command:
```bash
cd /opt/trialbridge
set -a; source .env.prod; set +a
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backups/trialbridge-$(date +%F-%H%M).sql.gz
```

Restore command:
```bash
cd /opt/trialbridge
set -a; source .env.prod; set +a
gunzip -c backups/<backup-file>.sql.gz | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Tip: push backups off-server (DigitalOcean Spaces/S3).

---

## Troubleshooting

### `password authentication failed for user "trialbridge"`

Most common cause: existing Postgres volume + changed `POSTGRES_PASSWORD` in `.env.prod`.

Use:
```bash
cd /opt/trialbridge
DO_PULL=0 ./ops/deploy_update.sh
```
This now re-syncs DB password and restarts app services.

### Still failing after script

If you changed `POSTGRES_USER` or `POSTGRES_DB` after first boot, role/database names may no longer match persisted volume state. Two options:

1. Revert `POSTGRES_USER`/`POSTGRES_DB` to original values.
2. If you are okay to reset DB data, recreate only the Postgres volume:
```bash
cd /opt/trialbridge
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker volume rm trialbridge_postgres_data
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build postgres redis api worker beat nginx frontend
```
