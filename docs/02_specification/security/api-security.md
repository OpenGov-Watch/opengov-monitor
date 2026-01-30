# API Security

CORS, CSRF protection, SQL injection prevention, and input validation.

## CORS Configuration

Configurable via environment variable:

```bash
# Restrict to specific origins (production)
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Allow all origins (development - default if not set)
# CORS_ALLOWED_ORIGINS not set
```

When `CORS_ALLOWED_ORIGINS` is set, only listed origins can make cross-origin requests. Requests without origin header (same-origin, curl) are always allowed.

A warning is logged at startup if not set in production.

## CSRF Protection

When `CROSS_ORIGIN_AUTH=true`, state-changing requests (POST, PUT, PATCH, DELETE) require `X-Requested-With: XMLHttpRequest` header.

This prevents CSRF since browsers don't include custom headers in cross-origin form requests.

The frontend API client automatically includes this header.

## SQL Injection Protection

Multiple layers of protection:

| Context | Protection |
|---------|------------|
| Query routes | Column/table names validated against whitelist |
| PRAGMA queries | Table names validated with `isValidTableName()` regex |
| LIMIT clauses | Parameterized with type validation |
| Expression columns | Blocked patterns for dangerous SQL keywords |
| Custom tables | Table names must match `^custom_[a-zA-Z0-9_]+$` |
| sqlite_sequence | Parameterized queries only |

### Blocked SQL Keywords

`UNION`, `SELECT`, `INSERT`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `EXEC`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, `REINDEX`, `load_extension`, `fts3_tokenizer`, `TRUNCATE`, `writefile`

## Input Validation

- **Request body size**: Limited to 10MB
- **Column names**: Validated against schema
- **Filter operators**: Validated against whitelist
- **Expression length**: Limited to 500 characters
- **Custom table data**: Validated against schema (type checking, unknown field rejection)

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

## See Also

- [Authentication](authentication.md) - Session management
- [Transport Security](transport-security.md) - HTTPS, headers
- [README](README.md) - Security overview
