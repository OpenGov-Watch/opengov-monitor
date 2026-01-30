# Security Specification

Security architecture, controls, and configuration for OpenGov Monitor.

## Overview

The application uses a defense-in-depth approach with security controls at multiple layers:

- **Authentication**: Session-based with bcrypt password hashing
- **API Security**: CORS, CSRF protection, SQL injection prevention
- **Transport**: HTTPS with TLS 1.2+ (when configured)
- **Container**: Non-root processes, minimal permissions

## Documentation

| Document | Topics |
|----------|--------|
| [Authentication](authentication.md) | Sessions, users, protected endpoints, rate limiting |
| [API Security](api-security.md) | CORS, CSRF, SQL injection, input validation |
| [Transport Security](transport-security.md) | HTTPS, TLS, security headers |
| [Container Security](container-security.md) | Non-root execution, permissions, logging |

## Quick Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | (auto-generated) | Session encryption (persists to `.session-secret`) |
| `CORS_ALLOWED_ORIGINS` | (allow all) | Comma-separated allowed origins |
| `NODE_ENV` | development | Set to `production` for secure defaults |
| `CROSS_ORIGIN_AUTH` | false | Enable cross-origin cookies + CSRF |

### Security Checklist

Before deploying to production:

- [ ] Verify `SESSION_SECRET` auto-generated or set custom
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ALLOWED_ORIGINS` if cross-origin needed
- [ ] Enable HTTPS in nginx configuration
- [ ] Uncomment HSTS header after HTTPS working
- [ ] Test unauthenticated requests are rejected

## Known Limitations

1. **External API Responses**: Subsquare API responses not schema-validated
2. **Rate Limiting**: No client-side rate limiting for external APIs
3. **HTTPS**: TLS termination must be manually configured
4. **Sessions**: SQLite-based; consider Redis for distributed deployments

## Reporting Security Issues

Report vulnerabilities responsibly:
1. Do not open a public GitHub issue
2. Contact the maintainers directly
3. Allow reasonable time for a fix before disclosure
