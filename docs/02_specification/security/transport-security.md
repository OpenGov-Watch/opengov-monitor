# Transport Security

HTTPS configuration, TLS settings, and security headers.

## HTTPS Configuration

HTTPS is configured in nginx. To enable:

1. Obtain SSL certificates (Let's Encrypt recommended):
   ```bash
   certbot certonly --webroot -w /var/www/html -d yourdomain.com
   ```

2. Mount certificates in Docker or update nginx config

3. Uncomment HTTPS server block in `src/deploy/nginx-container.conf`

4. Enable HSTS header (uncomment in nginx config)

## TLS Settings (when enabled)

- **Protocols**: TLSv1.2, TLSv1.3 only
- **Ciphers**: ECDHE with AES-GCM (forward secrecy)
- **OCSP Stapling**: Enabled for certificate validation
- **HSTS**: 1 year with includeSubDomains

## Security Headers

Set by nginx:

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

## Frontend Security

### URL Validation

URLs in cell renderers are validated to prevent XSS:

```typescript
// Allowed URL schemes
- http://
- https://
- / (relative paths)

// Blocked schemes
- javascript:
- data:
- vbscript:
```

### API URL Whitelist

Frontend only allows API connections to:
1. Relative URLs (`/api`)
2. Localhost URLs (`http://localhost:*`)
3. URLs defined in `config.json` presets

### localStorage Usage

Stores **non-sensitive** data only:
- Table view preferences
- Dashboard layouts
- UI state

No authentication tokens, passwords, or PII in localStorage.

### URL State Validation

View state in URLs (`?view=...`) is validated against expected schema before deserialization. Invalid state is silently ignored to prevent XSS.

### Open Redirect Prevention

Post-login redirects validated:
- Only relative paths starting with `/` allowed
- Protocol-relative URLs (`//evil.com`) blocked
- Absolute URLs rejected

## See Also

- [Container Security](container-security.md) - Process permissions
- [API Security](api-security.md) - CORS, CSRF
- [README](README.md) - Security overview
