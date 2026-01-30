# Container Security

Non-root execution, file permissions, and logging.

## Non-root Execution

The container uses the `node` user (UID 1000) provided by the base image:

| Process | User | Notes |
|---------|------|-------|
| nginx | root | Required to bind port 80 |
| API (Node.js) | node | Via supervisord `user=` directive |
| Cron daemon | root | Required for cron functionality |
| Cron jobs | node | Specified in crontab |
| Python sync | node | Run by cron as node user |

## File Permissions

- `/app` owned by node (UID 1000)
- `/data` owned by node (UID 1000)
- Cron file permissions: 0644

## Log Rotation

Sync logs (`/data/opengov-sync.log`) are automatically truncated when exceeding 10MB to prevent disk fill.

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

## See Also

- [Transport Security](transport-security.md) - Headers, HTTPS
- [Authentication](authentication.md) - Sessions, users
- [README](README.md) - Security overview
