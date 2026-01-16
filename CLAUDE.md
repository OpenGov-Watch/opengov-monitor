# CLAUDE.md

Agent-specific instructions for working on this codebase. For project overview, architecture, commands, and general documentation, see [README.md](README.md).

## Rules
- Never create, read, update, or delete in the DB without consulting with the user first
- Never apply DB migrations without explicit user consent
- Never modify DB migration versions after they have been applied to the production DB

## When planning changes
- Planning Phase
  - Review the specification. If it is not mentioned in the spec, discuss updating the spec with the user
  - Database schema changes must consider `docs/spec/backend/migrations.md`
- Specification
  - Update Spec
  - Prospectively update unit tests to match spec
- Coding
  - prefer removing code over marking it as deprecated
- Update documentation where relevant. See the Documentation section in [README.md](README.md) for where to document different topics
- Testing
  - Update unit tests, then run full test suite
  - Use Chrome DevTools to verify frontend changes

## When Debugging
- The server has hot reloading. Don't claim a restart will fix it. Find the real issue.

## Tool usage
- Use `pnpm`, not `npm`
- Use Chrome DevTools to verify frontend changes yourself first
- Use the `gh` CLI for interacting with Github
- Bash: Don't chain commands with `&&`. Run them sequentially instead.

## Before Committing
Always run these commands and ensure they pass before committing:
- Build: `pnpm run build`
- Test: `pnpm test`

If either fails, fix the issues before committing.

## Before Deploying
If your changes affect Docker, supervisord, or startup scripts:
- Test: `docker compose up --build`
- Verify: `curl http://localhost/api/health`
- Check: `docker compose exec opengov-monitor supervisorctl status`

See [deploy/CLAUDE.md](deploy/CLAUDE.md) for full pre-deployment checklist.
