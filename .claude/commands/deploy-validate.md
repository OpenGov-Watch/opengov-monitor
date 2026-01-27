# Deploy Validate

Full deployment validation: build → test → push → check CI → verify container → test browser

## Environments

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Staging | `https://polkadot-treasury-monitor.cypherpunk.agency` |
| `production` | Production | `https://monitor.opengov.watch` |

## Steps

1. `pnpm run build` - Report pass/fail
2. `pnpm test` - Report pass/fail
3. If the change contains migrations, run migration tests via `/db-test-local-migration`, then `/db-test-production-migration`
4. `git push origin $(git branch --show-current)` - Report branch pushed
5. Use `/check-github-action-runs` skill - Watch CI completion
6. Check container health and migration version based on current branch:
   - If on `main` branch: Fetch `https://polkadot-treasury-monitor.cypherpunk.agency/api/health`
   - If on `production` branch: Fetch `https://monitor.opengov.watch/api/health`
   - Report status, database version, and applied timestamp
   - If migration expected, verify version matches expected migration number
7. If applies: Check the change with Chrome Devtools

If any step fails, fix the issue and restart from step 1.
