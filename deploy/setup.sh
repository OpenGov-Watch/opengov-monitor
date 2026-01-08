#!/bin/bash
# OpenGov Monitor - GCP Deployment Setup Script
# Run this script on the VM after cloning the repository

set -e

echo "=========================================="
echo "OpenGov Monitor - Deployment Setup"
echo "=========================================="

# Check if running as opengov user
if [ "$USER" != "opengov" ]; then
    echo "Error: Please run this script as the 'opengov' user"
    echo "Usage: sudo su - opengov && ./deploy/setup.sh"
    exit 1
fi

INSTALL_DIR="/home/opengov"
DATA_DIR="$INSTALL_DIR/data"
LOG_DIR="$INSTALL_DIR/logs"

echo ""
echo "[1/7] Creating directories..."
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

echo ""
echo "[2/7] Setting up Python backend..."
cd "$INSTALL_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo ""
echo "[3/7] Setting up Node.js API..."
cd "$INSTALL_DIR/api"
pnpm install
pnpm build

echo ""
echo "[4/7] Building frontend..."
cd "$INSTALL_DIR/frontend"
pnpm install
pnpm build

echo ""
echo "[5/7] Configuring nginx..."
sudo cp "$INSTALL_DIR/deploy/nginx.conf" /etc/nginx/sites-available/opengov
sudo ln -sf /etc/nginx/sites-available/opengov /etc/nginx/sites-enabled/opengov
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "[6/7] Setting up cron job..."
sudo cp "$INSTALL_DIR/deploy/opengov-sync.cron" /etc/cron.d/opengov-sync
sudo chmod 644 /etc/cron.d/opengov-sync
sudo chown root:root /etc/cron.d/opengov-sync

echo ""
echo "[7/7] Starting API server with PM2..."
cd "$INSTALL_DIR/api"
DATABASE_PATH="$DATA_DIR/polkadot.db" pm2 start dist/index.js --name opengov-api
pm2 save

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run initial data sync:"
echo "   cd $INSTALL_DIR/backend && .venv/bin/python scripts/run_sqlite.py --db $DATA_DIR/polkadot.db"
echo ""
echo "2. Setup PM2 startup script (run as root):"
echo "   sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u opengov --hp /home/opengov"
echo ""
echo "3. (Optional) Setup HTTPS with Let's Encrypt:"
echo "   sudo certbot --nginx -d your-domain.com"
echo ""
