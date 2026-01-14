# Deploy Validate

Full deployment validation: build → test → push → check CI → verify container → test browser

## Steps

1. `pnpm run build` - Report pass/fail
2. `pnpm test` - Report pass/fail
3. `git push origin $(git branch --show-current)` - Report branch pushed
4. Use `/check-github-action-runs` skill - Watch CI completion
5. If the change is with db migration: Check db version + container health via `/container`
6. If applies: Check the change with Chrome Devtools

If any step fails, fix the issue and restart from step 1.