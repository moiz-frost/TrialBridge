# TrialBridge Deployment (DigitalOcean + Tasjeel Domain)

This guide assumes:
- Frontend domain: `trialbridge.ae` (and optional `www.trialbridge.ae`)
- API domain: `api.trialbridge.ae`
- Project path on droplet: `/opt/trialbridge`

## 5) Deploy App Services (Backend in Docker, Frontend as Node service)

### 5.1 Prepare app and env
```bash
sudo mkdir -p /opt/trialbridge
sudo chown -R $USER:$USER /opt/trialbridge
cd /opt/trialbridge
git clone <YOUR_REPO_URL> .
cp .env.prod.example .env.prod
nano .env.prod
```

Fill real values in `.env.prod`:
- `DJANGO_SECRET_KEY`
- `POSTGRES_PASSWORD`
- `GEMINI_API_KEY`
- `DJANGO_ALLOWED_HOSTS=api.trialbridge.ae`
- `CORS_ALLOWED_ORIGINS=https://trialbridge.ae,https://www.trialbridge.ae`
- Keep `SEED_DEMO=0`

### 5.2 Start backend stack
Use both compose files so production overrides apply:
```bash
cd /opt/trialbridge
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build postgres redis api worker beat nginx
```

Run one-time backend checks:
```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T api python manage.py migrate --noinput
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T api python manage.py collectstatic --noinput
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T api python manage.py check
```

Create coordinator login (if needed):
```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T api python manage.py createsuperuser
```

### 5.3 Build and run frontend (host process)
Install Node 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Build frontend:
```bash
cd /opt/trialbridge/frontend
cat > .env.production.local << 'EOF'
NEXT_PUBLIC_SITE_URL=https://trialbridge.ae
NEXT_PUBLIC_API_BASE_URL=https://api.trialbridge.ae/api/v1
NEXT_PUBLIC_DEV_TECH_MODE=0
NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=0
EOF

npm ci
npm run build
```

Create systemd service:
```bash
sudo tee /etc/systemd/system/trialbridge-frontend.service > /dev/null << 'EOF'
[Unit]
Description=TrialBridge Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/opt/trialbridge/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Replace `YOUR_LINUX_USER` with your Linux username in the service file, then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trialbridge-frontend
sudo systemctl status trialbridge-frontend --no-pager
```

## 6) Nginx Reverse Proxy (Host Nginx)

Create site config:
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

Enable and reload:
```bash
sudo ln -sf /etc/nginx/sites-available/trialbridge /etc/nginx/sites-enabled/trialbridge
sudo nginx -t
sudo systemctl reload nginx
```

## 7) TLS (Let's Encrypt)

Issue certs and enable redirects:
```bash
sudo certbot --nginx \
  -d trialbridge.ae \
  -d www.trialbridge.ae \
  -d api.trialbridge.ae \
  --redirect \
  -m <YOUR_EMAIL> \
  --agree-tos -n
```

Verify renewal timer:
```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

## 8) Verification Checklist

### 8.1 Service-level checks
```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 api
sudo systemctl status trialbridge-frontend --no-pager
sudo systemctl status nginx --no-pager
```

### 8.2 Endpoint checks
```bash
curl -I https://trialbridge.ae
curl -I https://www.trialbridge.ae
curl -sS https://api.trialbridge.ae/api/v1/health/
```

Expected:
- frontend returns `200`
- API health returns JSON like `{"status":"ok"}`

### 8.3 Functional checks in browser
1. Coordinator login works.
2. Patient login works.
3. Match detail loads.
4. PDF export works.
5. Patient history append updates matches.
6. Upload and extracted text display works.

## 9) Operations, Updates, Backups

### 9.1 Release/update
```bash
cd /opt/trialbridge
git pull

# Backend
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build api worker beat nginx
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T api python manage.py migrate --noinput

# Frontend
cd /opt/trialbridge/frontend
npm ci
npm run build
sudo systemctl restart trialbridge-frontend
```

### 9.2 Basic log commands
```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f worker
sudo journalctl -u trialbridge-frontend -f
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Postgres backup (daily)
Create backup folder:
```bash
mkdir -p /opt/trialbridge/backups
```

Backup command:
```bash
cd /opt/trialbridge
set -a; source .env.prod; set +a
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backups/trialbridge-$(date +%F-%H%M).sql.gz
```

Restore example:
```bash
cd /opt/trialbridge
set -a; source .env.prod; set +a
gunzip -c backups/<backup-file>.sql.gz | docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Tip: upload backup files to DigitalOcean Spaces/S3 for off-server safety.
