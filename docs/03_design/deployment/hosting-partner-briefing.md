# Hosting Partner Briefing: Staging/Production Environment Separation

**Date:** 2026-01-27
**Status:** Pending infrastructure changes

## Summary

We're separating our deployment into two isolated environments:
- **Staging** - receives `main` branch deployments for testing
- **Production** - receives `production` branch deployments for live users

## Current State

- Single service: `opengov-monitor`
- Single image tag: `prod`
- Both branches deploy to the same container

## Requested Changes

### 1. Create Two Services

| Environment | Service Name | Image Tag | Data Volume |
|-------------|--------------|-----------|-------------|
| Staging | `opengov-monitor-staging` | `ghcr.io/opengov-watch/opengov-monitor:staging` | `/data-staging` |
| Production | `opengov-monitor-prod` | `ghcr.io/opengov-watch/opengov-monitor:prod` | `/data-prod` |

### 2. Service Configuration

Both services need identical configuration to the current `opengov-monitor`:
- Port 80 exposed
- `/data` volume mounted (but to separate host paths)
- Same environment variables
- Health check: `GET /api/health`

### 3. Deploy Scripts

The GitHub Actions workflow will call:
```bash
sudo /usr/local/bin/deploy-service opengov-monitor-staging  # for main branch
sudo /usr/local/bin/deploy-service opengov-monitor-prod     # for production branch
```

### 4. Domain Routing

| Domain | Routes to |
|--------|-----------|
| `polkadot-treasury-monitor.cypherpunk.agency` | `opengov-monitor-staging` |
| `monitor.opengov.watch` | `opengov-monitor-prod` |

## Data Migration

For initial setup:
1. Copy current `/data` to both `/data-staging` and `/data-prod`
2. Or start staging fresh and only migrate to production

## Rollback Plan

If issues arise, we can temporarily revert the GitHub workflow to deploy to a single `opengov-monitor` service.

## Timeline

We're ready to deploy once the infrastructure changes are in place. Please let us know:
1. When the new services are available
2. The exact service names if different from above
3. Any additional configuration needed

## Contact

Please reach out if you need any clarification on the application requirements.
