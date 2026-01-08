# Container Management

Service name: `opengov-monitor`

## Check Health Status
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status opengov-monitor"
```

## View Logs
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs opengov-monitor 100"
```

## Debug Unhealthy Container

If container is unhealthy, check supervisor logs inside the container:

```bash
# Check API error log (most common issue)
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /var/log/supervisor/api-error.log"

# List all supervisor logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor ls -la /var/log/supervisor/"

# Check supervisord status
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor supervisorctl status"
```

## Shell Access
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell opengov-monitor"
```

## Trigger Redeploy
Push to `production` branch to trigger CI/CD rebuild and deploy.

## Common Issues

### "Cannot find package 'express'" or missing node_modules
- Dockerfile needs to copy `api/node_modules` (pnpm symlinks)
- Fix: `COPY --from=api-build /app/api/node_modules ./api/node_modules`

### "Cannot find module" ESM resolution errors
- TypeScript `moduleResolution: bundler` doesn't add `.js` extensions
- Node ESM requires explicit extensions
- Fix: Use `tsup` bundler instead of plain `tsc`

## Key Files
- `Dockerfile` - Container build
- `deploy/supervisord.conf` - Process management (nginx, api, cron)
- `deploy/nginx-container.conf` - Nginx config
- `.github/workflows/deploy.yml` - CI/CD pipeline
