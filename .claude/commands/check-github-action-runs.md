# Check GitHub Action Runs

Check the latest CI/CD runs and report their status.

## Instructions

1. Run `gh run list --limit 5` to get recent workflow runs
2. Report the status of each run (success/failure/in_progress)
3. If any failed, run `gh run view <run-id> --log-failed` to get error details
4. Summarize what went wrong and suggest fixes

## Important

**Always use `gh` CLI** - WebFetch gives unreliable results for GitHub Actions pages.

## Commands

```bash
# List recent runs
gh run list --limit 5

# View failed run logs
gh run view <run-id> --log-failed

# Search for specific errors
gh run view <run-id> --log-failed 2>&1 | grep -i "error\|failed"

# Watch a run in progress
gh run watch <run-id>
```

## References

- [deploy/CLAUDE.md](../../deploy/CLAUDE.md) - Common build failures and deployment guidance
