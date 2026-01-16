# Local Docker Development

Guide for local development using the full production stack with Docker.

## Why Use Local Docker?

**Use Docker locally when:**
- Testing deployment changes
- Verifying production behavior
- Testing nginx configuration
- Testing supervisor setup
- Debugging container issues
- Before deploying to production

**Use `pnpm run dev` when:**
- Rapid frontend iteration
- Hot module replacement needed
- Quick backend changes

**Key difference:** Docker matches production environment exactly. Dev server does not.

---

## Basic Commands

### Start Container

```bash
docker compose up -d --build
```

**Flags:**
- `-d`: Detached mode (background)
- `--build`: Rebuild image (use when Dockerfile or dependencies change)

**When to use:**
- Testing production setup locally
- Verifying container builds correctly
- Pre-deployment testing

---

### Check Health

```bash
# Wait for startup
sleep 10

# Test health endpoint
curl http://localhost/api/health

# Should return: {"status":"ok"}
```

**Use after:** Starting container, to verify everything is running

---

### View Logs

```bash
# Follow logs (real-time)
docker compose logs -f opengov-monitor

# Last 50 lines
docker compose logs --tail=50 opengov-monitor

# Specific service logs (inside container)
docker compose exec opengov-monitor cat /var/log/supervisor/api-error.log
```

**Use when:** Debugging issues, checking startup, verifying sync runs

---

### Check Supervisor Status

```bash
docker compose exec opengov-monitor supervisorctl status
```

**Expected output:**
```
api     RUNNING   pid X, uptime X:XX:XX
cron    RUNNING   pid X, uptime X:XX:XX
nginx   RUNNING   pid X, uptime X:XX:XX
```

**Use when:** Verifying all services started correctly

---

### Stop Container

```bash
# Stop and remove container
docker compose down

# Stop, remove, and delete volumes
docker compose down -v
```

**Use `-v` when:** Want to start fresh with clean database

---

## Running Python Sync Manually

Useful for testing data sync without waiting for cron.

```bash
docker compose exec opengov-monitor \
  /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py \
  --db /data/polkadot.db
```

**What it does:**
- Runs Python data sync script
- Fetches data from Polkadot APIs
- Updates local SQLite database

**Use when:**
- Testing sync logic changes
- Populating fresh database
- Debugging data issues

**Expected output:**
- Progress messages for each data source
- Success/failure status
- Final count of records synced

---

## Interactive Shell

### Get Shell Inside Container

```bash
docker compose exec opengov-monitor /bin/bash
```

**Once inside:**
```bash
# Navigate to app
cd /app

# Check file structure
ls -la

# View logs
cat /var/log/supervisor/api-error.log

# Test API directly
curl http://localhost:3001/api/health

# Check database
ls -la /data/
sqlite3 /data/polkadot.db ".tables"

# Control supervisor
supervisorctl status
supervisorctl restart api
supervisorctl tail api
```

**Use when:** Need to inspect files, test commands, or debug issues

---

## Testing Changes

### Testing Dockerfile Changes

```bash
# Rebuild and start
docker compose up -d --build

# Check logs for build errors
docker compose logs opengov-monitor

# Verify supervisor status
docker compose exec opengov-monitor supervisorctl status

# Test health
curl http://localhost/api/health
```

---

### Testing nginx Configuration

```bash
# After modifying nginx-container.conf
docker compose up -d --build

# Test new routes
curl http://localhost/api/your-new-endpoint

# Check nginx logs for errors
docker compose exec opengov-monitor cat /var/log/supervisor/nginx-error.log
```

---

### Testing supervisor Configuration

```bash
# After modifying supervisord.conf
docker compose up -d --build

# Verify all processes started
docker compose exec opengov-monitor supervisorctl status

# Check for any FATAL processes
docker compose logs opengov-monitor | grep FATAL
```

---

## Common Development Workflows

### Fresh Start

```bash
# Stop and remove everything
docker compose down -v

# Rebuild and start fresh
docker compose up -d --build

# Wait for startup
sleep 10

# Run sync to populate data
docker compose exec opengov-monitor \
  /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py \
  --db /data/polkadot.db

# Verify health
curl http://localhost/api/health
```

---

### Quick Rebuild After Code Changes

```bash
# Rebuild and restart
docker compose up -d --build

# Check logs for errors
docker compose logs --tail=50 opengov-monitor

# Test changes
curl http://localhost/api/your-endpoint
```

---

### Debugging Startup Issues

```bash
# Start with logs visible
docker compose up --build

# (In another terminal) Check supervisor
docker compose exec opengov-monitor supervisorctl status

# (In another terminal) Check specific log
docker compose exec opengov-monitor cat /var/log/supervisor/api-error.log
```

---

## Data Management

### Backup Local Database

```bash
docker compose exec opengov-monitor cp /data/polkadot.db /data/polkadot.db.backup
```

---

### Restore Database

```bash
docker compose exec opengov-monitor cp /data/polkadot.db.backup /data/polkadot.db

# Restart API to pick up changes
docker compose exec opengov-monitor supervisorctl restart api
```

---

### Access Database Directly

```bash
docker compose exec opengov-monitor sqlite3 /data/polkadot.db

# In SQLite shell:
.tables
.schema Referenda
SELECT COUNT(*) FROM Referenda;
.quit
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check build output for errors
docker compose up --build

# Check if port 80 is in use
netstat -an | grep :80
```

---

### Health Check Fails

```bash
# Check supervisor status
docker compose exec opengov-monitor supervisorctl status

# Test health from inside container
docker compose exec opengov-monitor curl -f http://localhost/api/health

# Check API logs
docker compose exec opengov-monitor cat /var/log/supervisor/api-error.log
```

---

### API Not Responding

```bash
# Check if API is listening
docker compose exec opengov-monitor netstat -tlnp | grep 3001

# Check API logs
docker compose exec opengov-monitor cat /var/log/supervisor/api-error.log

# Restart API
docker compose exec opengov-monitor supervisorctl restart api
```

---

## See Also

- [Pre-Deployment Checklist](./pre-deployment-checklist.md) - What to test before deploy
- [Debugging](./debugging.md) - Production debugging commands
- [Common Issues](./common-issues.md) - Frequent problems and solutions
