# Authentication & Authorization

Session management, user handling, and endpoint protection.

## Session Management

- **Session Storage**: Separate SQLite database (`sessions.db`)
- **Password Hashing**: bcrypt with SALT_ROUNDS=12
- **Session Cookies**: httpOnly, secure (production), sameSite configurable
- **Session Regeneration**: On login to prevent fixation attacks

## User Management

Users are managed via `pnpm users` CLI:

```bash
pnpm --filter api run users --help
pnpm --filter api run users list
pnpm --filter api run users add <username>
pnpm --filter api run users set-password <username>
pnpm --filter api run users delete <username>
```

All authenticated users have equal access to protected endpoints.

### Username Validation

Pattern: `^[a-zA-Z_][a-zA-Z0-9_-]{2,31}$`

- 3-32 characters
- Start with letter or underscore
- Alphanumeric, underscores, hyphens only

## Authentication Timing Safety

Authentication uses constant-time comparison to prevent user enumeration. A dummy bcrypt comparison runs even when user doesn't exist.

## Protected Endpoints

| Endpoint | Auth Required |
|----------|---------------|
| `GET /api/backup/download` | Yes |
| `GET /api/backup/info` | Yes |
| `POST /api/categories/*` | Yes |
| `POST /api/bounties/*` | Yes |
| `POST /api/subtreasury/*` | Yes |
| `POST /api/dashboards/*` | Yes |
| `GET /api/query/*` | No |

## Rate Limiting

- **Login attempts**: Rate limited to prevent brute force
- **Write operations**: Rate limited to prevent abuse
- **External API calls**: No rate limiting (relies on upstream limits)

## Session Secret

Auto-generated on first run, persisted to data directory:

- **Location**: `<data-dir>/.session-secret`
- **Permissions**: `0600` (owner read/write only)
- **Override**: Set `SESSION_SECRET` environment variable

```bash
# Optional: Override with custom secret
SESSION_SECRET=your-32-character-minimum-secret-here
```

## See Also

- [API Security](api-security.md) - CORS, CSRF protection
- [README](README.md) - Security overview
