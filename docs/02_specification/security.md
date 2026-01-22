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

### User Roles

Users are managed via the `pnpm users` CLI command. Admin privileges are controlled via environment variable:

```bash
# Set admin users (comma-separated usernames)
ADMIN_USERNAMES=alice,bob
```

If `ADMIN_USERNAMES` is not set, all authenticated users have full access (backwards compatibility).

### Protected Endpoints

| Endpoint | Auth Required | Admin Required |
|----------|---------------|----------------|
| `GET /api/backup/download` | Yes | Yes |
| `GET /api/backup/info` | Yes | No |
| `POST /api/categories/*` | Yes | No |
| `POST /api/bounties/*` | Yes | No |
| `POST /api/subtreasury/*` | Yes | No |
| `POST /api/dashboards/*` | Yes | No |
| `GET /api/query/*` | No | No |

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

### Session Secret

The session secret **must** be set in production:

```bash
# Required in production (NODE_ENV=production)
SESSION_SECRET=your-32-character-minimum-secret-here
```

The server will refuse to start in production mode without this variable.

### SQL Injection Protection

- **Query routes**: Column/table names validated against whitelist
- **PRAGMA queries**: Table names quoted, validated against allowed sources
- **LIMIT clauses**: Parameterized with type validation
- **Expression columns**: Blocked patterns for dangerous SQL keywords

### Input Validation

- Request body size limited to 10MB
- Column names validated against schema
- Filter operators validated against whitelist
- Expression length limited to 500 characters

---

## Database Security

### Access Control

- **Read-only connection**: Used for queries
- **Writable connection**: Used for mutations (separate instance)
- **WAL mode**: Enabled for concurrent access

### Backup Security

- Database backups require authentication
- Admin privileges required for download (when `ADMIN_USERNAMES` is set)
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

### Open Redirect Prevention

Post-login redirects are validated:

- Only relative paths starting with `/` are allowed
- Protocol-relative URLs (`//evil.com`) are blocked
- Absolute URLs are rejected

---

## Container Security

### Non-root Execution

The container creates a dedicated user (`appuser`, UID 1000):

| Process | User | Notes |
|---------|------|-------|
| nginx | root | Required to bind port 80 |
| API (Node.js) | appuser | Via supervisord `user=` directive |
| Cron daemon | root | Required for cron functionality |
| Cron jobs | appuser | Specified in crontab |
| Python sync | appuser | Run by cron as appuser |

### File Permissions

- `/app` owned by appuser
- `/data` owned by appuser
- Cron file permissions: 0644

### Log Rotation

Sync logs are automatically truncated when exceeding 10MB to prevent disk fill.

---

## Environment Variables

### Required in Production

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | 32+ character session encryption key |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | (allow all) | Comma-separated allowed origins |
| `ADMIN_USERNAMES` | (all users) | Comma-separated admin usernames |
| `NODE_ENV` | development | Set to `production` for secure defaults |

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

- [ ] Set `SESSION_SECRET` environment variable (32+ characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ALLOWED_ORIGINS` if cross-origin access needed
- [ ] Configure `ADMIN_USERNAMES` if role-based access needed
- [ ] Enable HTTPS in nginx configuration
- [ ] Uncomment HSTS header after HTTPS is working
- [ ] Verify security headers with browser DevTools
- [ ] Test that unauthenticated requests are rejected
- [ ] Test that admin endpoints require admin privileges

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
