# Security Specification

This document describes the security architecture, controls, and configuration for OpenGov Monitor.

## Table of Contents

- [Authentication & Authorization](#authentication--authorization)
- [Transport Security](#transport-security)
- [API Security](#api-security)
- [Database Security](#database-security)
- [Frontend Security](#frontend-security)
- [Container Security](#container-security)
- [Environment Variables](#environment-variables)
- [Security Headers](#security-headers)
- [Logging & Monitoring](#logging--monitoring)

---

## Authentication & Authorization

### Session Management

- **Session Storage**: Sessions are stored in a separate SQLite database (`sessions.db`)
- **Password Hashing**: bcrypt with SALT_ROUNDS=12 (industry standard)
- **Session Cookies**: httpOnly, secure (in production), sameSite configurable
- **Session Regeneration**: Sessions are regenerated on login to prevent fixation

### User Management

Users are managed via the `pnpm users` CLI command. All authenticated users have equal access to protected endpoints.

### Username Validation

Usernames must match: `^[a-zA-Z_][a-zA-Z0-9_-]{2,31}$`

- 3-32 characters
- Start with letter or underscore
- Only alphanumeric, underscores, and hyphens

### Authentication Timing Safety

Authentication uses constant-time comparison to prevent user enumeration via timing attacks. A dummy bcrypt comparison runs even when the user doesn't exist.

### Protected Endpoints

| Endpoint | Auth Required |
|----------|---------------|
| `GET /api/backup/download` | Yes |
| `GET /api/backup/info` | Yes |
| `POST /api/categories/*` | Yes |
| `POST /api/bounties/*` | Yes |
| `POST /api/subtreasury/*` | Yes |
| `POST /api/dashboards/*` | Yes |
| `GET /api/query/*` | No |

### Rate Limiting

- **Login attempts**: Rate limited to prevent brute force
- **Write operations**: Rate limited to prevent abuse
- **External API calls**: No rate limiting (relies on upstream limits)

---

## Transport Security

### HTTPS Configuration

HTTPS is configured in nginx. To enable:

1. Obtain SSL certificates (Let's Encrypt recommended):
   ```bash
   certbot certonly --webroot -w /var/www/html -d yourdomain.com
   ```

2. Mount certificates in Docker or update nginx config

3. Uncomment HTTPS server block in `src/deploy/nginx-container.conf`

4. Enable HSTS header (uncomment in nginx config)

### TLS Settings (when enabled)

- **Protocols**: TLSv1.2, TLSv1.3 only
- **Ciphers**: ECDHE with AES-GCM (forward secrecy)
- **OCSP Stapling**: Enabled for certificate validation
- **HSTS**: 1 year with includeSubDomains

---

## API Security

### CORS Configuration

CORS is configurable via environment variable:

```bash
# Restrict to specific origins (production)
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Allow all origins (development - default if not set)
# CORS_ALLOWED_ORIGINS not set
```

When `CORS_ALLOWED_ORIGINS` is set, only listed origins can make cross-origin requests. Requests without an origin header (same-origin, curl, etc.) are always allowed.

A warning is logged at startup if `CORS_ALLOWED_ORIGINS` is not set in production.

### CSRF Protection

When `CROSS_ORIGIN_AUTH=true`, state-changing requests (POST, PUT, PATCH, DELETE) require the `X-Requested-With: XMLHttpRequest` header. This prevents CSRF attacks since browsers don't include custom headers in cross-origin requests triggered by forms.

The frontend API client automatically includes this header on all requests.

### Session Secret

The session secret is **auto-generated** on first run and persisted to the data directory:

- **Location:** `<data-dir>/.session-secret` (same directory as the database)
- **Permissions:** `0600` (owner read/write only)
- **Override:** Set `SESSION_SECRET` environment variable to use a custom secret

```bash
# Optional: Override with custom secret
SESSION_SECRET=your-32-character-minimum-secret-here
```

The auto-generated secret persists across container restarts (as long as the data volume is preserved).

### SQL Injection Protection

- **Query routes**: Column/table names validated against whitelist
- **PRAGMA queries**: Table names validated with `isValidTableName()` regex before interpolation
- **LIMIT clauses**: Parameterized with type validation
- **Expression columns**: Blocked patterns for dangerous SQL keywords (`UNION`, `SELECT`, `INSERT`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `EXEC`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, `REINDEX`, `load_extension`, `fts3_tokenizer`, `TRUNCATE`, `writefile`)
- **Custom tables**: Table names must match `^custom_[a-zA-Z0-9_]+$` before DROP; column names validated before CREATE
- **sqlite_sequence**: Parameterized queries (not string interpolation)

### Input Validation

- Request body size limited to 10MB
- Column names validated against schema
- Filter operators validated against whitelist
- Expression length limited to 500 characters
- **Custom table row data**: Validated against schema on insert/update/import (type checking, unknown field rejection)

---

## Database Security

### Access Control

- **Read-only connection**: Used for queries
- **Writable connection**: Used for mutations (separate instance)
- **WAL mode**: Enabled for concurrent access

### Backup Security

- Database backups require authentication
- Backups are checkpointed before download to ensure consistency

### Sensitive Data

- No PII stored in main database
- User passwords stored as bcrypt hashes only
- Session data in separate database file

---

## Frontend Security

### URL Validation

URLs in cell renderers are validated to prevent XSS:

```typescript
// Only allowed URL schemes
- http://
- https://
- / (relative paths)

// Blocked schemes
- javascript:
- data:
- vbscript:
- All others
```

### API URL Whitelist

The frontend only allows API connections to:

1. Relative URLs (`/api`)
2. Localhost URLs (`http://localhost:*`)
3. URLs defined in `config.json` presets

Arbitrary URLs passed via `?api=` parameter are rejected with a warning.

### localStorage Usage

localStorage stores **non-sensitive** data only:

- Table view preferences (filters, sorting, pagination)
- Dashboard layouts
- UI state (collapsed panels, etc.)

No authentication tokens, passwords, or PII are stored in localStorage.

### URL State Validation

View state embedded in URLs (`?view=...`) is validated against expected schema before deserialization:

- `sorting`: array of `{ id: string, desc: boolean }`
- `columnFilters`: array of `{ id: string, value: unknown }`
- `columnVisibility`: object with boolean values
- `pagination`: `{ pageIndex: number, pageSize: number }` with bounds checking
- `filterGroup`: validated operator and conditions structure

Invalid state is silently ignored to prevent XSS via malicious URL parameters.

### Open Redirect Prevention

Post-login redirects are validated:

- Only relative paths starting with `/` are allowed
- Protocol-relative URLs (`//evil.com`) are blocked
- Absolute URLs are rejected

---

## Container Security

### Non-root Execution

The container uses the `node` user (UID 1000) provided by the base image:

| Process | User | Notes |
|---------|------|-------|
| nginx | root | Required to bind port 80 |
| API (Node.js) | node | Via supervisord `user=` directive |
| Cron daemon | root | Required for cron functionality |
| Cron jobs | node | Specified in crontab |
| Python sync | node | Run by cron as node user |

### File Permissions

- `/app` owned by node (UID 1000)
- `/data` owned by node (UID 1000)
- Cron file permissions: 0644

### Log Rotation

Sync logs (`/data/opengov-sync.log`) are automatically truncated when exceeding 10MB to prevent disk fill.

---

## Environment Variables

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | (auto-generated) | Override for session encryption (auto-persists to `.session-secret`) |
| `CORS_ALLOWED_ORIGINS` | (allow all) | Comma-separated allowed origins |
| `NODE_ENV` | development | Set to `production` for secure defaults |
| `CROSS_ORIGIN_AUTH` | false | Enable cross-origin cookies + CSRF protection |

### Legacy (Flask endpoint)

| Variable | Description |
|----------|-------------|
| `OPENGOV_SYNC_API_KEY` | API key for legacy Google Sheets sync |

---

## Security Headers

The following headers are set by nginx:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | SAMEORIGIN | Prevent clickjacking |
| `X-Content-Type-Options` | nosniff | Prevent MIME sniffing |
| `X-XSS-Protection` | 1; mode=block | Legacy XSS filter |
| `Referrer-Policy` | strict-origin-when-cross-origin | Control referrer leakage |
| `Content-Security-Policy` | See below | Prevent XSS |
| `Permissions-Policy` | Restrict features | Disable sensitive APIs |

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';  # Required for shadcn/ui
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-ancestors 'self';
```

### HSTS (when HTTPS enabled)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Logging & Monitoring

### What is Logged

- API errors (full stack trace server-side only)
- Authentication failures (warnings)
- CORS violations (warnings)
- Sync job output

### What is NOT Logged

- Passwords or password hashes
- Session tokens
- Full request bodies (sanitized)
- Environment variable values (names only in dev mode)

### Error Handling

- **Production**: Generic "Internal server error" returned to clients
- **Development**: Full error messages for debugging

---

## Security Checklist for Deployment

Before deploying to production:

- [ ] Verify `SESSION_SECRET` auto-generated in data dir (or set custom via env var)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ALLOWED_ORIGINS` if cross-origin access needed
- [ ] Enable HTTPS in nginx configuration
- [ ] Uncomment HSTS header after HTTPS is working
- [ ] Verify security headers with browser DevTools
- [ ] Test that unauthenticated requests are rejected

---

## Known Limitations

1. **External API Response Validation**: Subsquare API responses are not schema-validated. Consider adding pydantic/jsonschema validation for defense-in-depth.

2. **Rate Limiting on External APIs**: No client-side rate limiting for Subsquare/CoinGecko calls. Relies on upstream rate limits.

3. **HTTPS in Container**: TLS termination must be configured manually or handled by a reverse proxy (e.g., Cloudflare, nginx on host).

4. **Session Database**: Sessions are in a separate SQLite file. Consider Redis for distributed deployments.

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public GitHub issue
2. Contact the maintainers directly
3. Allow reasonable time for a fix before disclosure
