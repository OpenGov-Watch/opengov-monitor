# Deploy Validate

Full deployment validation: build → test → push → check CI → verify container → test browser

## Steps

1. `pnpm run build` - Report pass/fail
2. `pnpm test` - Report pass/fail
3. If the change contains migrations, run migration tests via `/db-test-local-migration`, then `/db-test-production-migration`
4. `git push origin $(git branch --show-current)` - Report branch pushed
5. Use `/check-github-action-runs` skill - Watch CI completion
6. Check container health and migration version:
   - Fetch `https://opengov.win/api/health` and report status, database version, and applied timestamp
   - If migration expected, verify version matches expected migration number
7. If applies: Check the change with Chrome Devtools

If any step fails, fix the issue and restart from step 1.