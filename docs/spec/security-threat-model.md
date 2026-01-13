# Security Threat Model

This document outlines the security architecture, threat landscape, and mitigation strategies for the OpenGov Monitor application.

## System Overview

OpenGov Monitor is a governance transparency platform that:
- Fetches public blockchain governance data from Subsquare API
- Stores data in SQLite databases
- Provides a REST API for data access and query building
- Serves a React frontend for data visualization

**Deployment Model:** Single Docker container with nginx reverse proxy, Express API, and React SPA.

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     Untrusted Zone                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Internet   │  │ External APIs│  │  End Users   │     │
│  │   Actors     │  │ (Subsquare)  │  │ (Anonymous)  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Boundary Layer                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Nginx Reverse Proxy + Rate Limiting                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Express API     │◄────────│  Python Backend  │         │
│  │  (Semi-Trusted)  │         │  (Trusted)       │         │
│  └────────┬─────────┘         └──────────────────┘         │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  polkadot.db     │         │  sessions.db     │         │
│  │  (Public Data)   │         │  (Credentials)   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Trust Levels

1. **Untrusted Input:** All HTTP requests, external API responses
2. **Semi-Trusted:** Authenticated API requests (session-based auth)
3. **Trusted:** Internal Python backend processes, database operations

## Threat Actors

| Actor | Motivation | Capability | Target |
|-------|------------|------------|--------|
| **Opportunistic Attacker** | Financial gain, defacement | Low-Medium | SQL injection, XSS, CSRF |
| **Data Harvester** | Aggregate/resell governance data | Medium | API abuse, rate limit bypass |
| **Malicious Insider** | Manipulate displayed data | Medium-High | Database manipulation, auth bypass |
| **State-Level Actor** | Surveillance, censorship | High | DoS, data poisoning, infrastructure compromise |

## Attack Surface

### 1. API Endpoints

#### Unauthenticated Endpoints (High Risk)
- `GET /api/query/schema` - Exposes database schema
- `POST /api/query/execute` - **CRITICAL: SQL injection vector**
- `GET /api/referenda`, `/api/treasury`, etc. - Data exposure

#### Authenticated Endpoints (Medium Risk)
- `POST /api/dashboards` - Requires session
- `PUT /api/dashboards/components` - Requires session
- All mutating operations require authentication

### 2. Input Vectors

| Input | Endpoint | Validation | Risk |
|-------|----------|------------|------|
| `sourceTable` | `/api/query/execute` | Whitelist | LOW (mitigated) |
| `columns[].column` | `/api/query/execute` | Regex sanitization | LOW (mitigated) |
| `columns[].alias` | `/api/query/execute` | **Regex sanitization** | **CRITICAL (fixed)** |
| `expressionColumns[].expression` | `/api/query/execute` | Pattern blocking | LOW (mitigated) |
| `expressionColumns[].alias` | `/api/query/execute` | Regex sanitization | LOW (mitigated) |
| `filters[].value` | `/api/query/execute` | Parameterized queries | LOW (mitigated) |
| Session cookies | All auth endpoints | express-session | MEDIUM |

## Vulnerability Analysis

### CRITICAL: SQL Injection in Query Builder (CVE-YYYY-XXXX)

**Status:** ✅ FIXED (as of this commit)

**Affected Component:** `api/src/routes/query.ts:buildSelectClause()`

**Vulnerability Details:**
Prior to this fix, regular column aliases were directly interpolated into SQL queries without validation:

```typescript
// VULNERABLE CODE (before fix)
parts.push(col.alias ? `${colName} AS "${col.alias}"` : colName);
```

**Attack Vector:**
```json
POST /api/query/execute
{
  "sourceTable": "Referenda",
  "columns": [{ "column": "id", "alias": "foo\" FROM secret_data --" }]
}
```

This would generate malicious SQL:
```sql
SELECT "id" AS "foo" FROM secret_data --" FROM "Referenda" LIMIT 10000
```

**Impact:**
- Bypass `ALLOWED_SOURCES` whitelist
- Read sensitive data from any table (e.g., `Users`, internal tables)
- Unauthenticated exploitation
- **CVSS Score:** 8.6 (High) - AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N

**Mitigation:**
Applied `sanitizeAlias()` function to all column aliases (regular and aggregate):

```typescript
// SECURE CODE (after fix)
const safeAlias = col.alias ? sanitizeAlias(col.alias) : null;
parts.push(safeAlias ? `${colName} AS "${safeAlias}"` : colName);
```

**Prevention:**
- All aliases now validated with regex: `^[a-zA-Z_][a-zA-Z0-9_]*$`
- Consistent security pattern across expression and regular columns
- 15 new security tests added to prevent regression

### MEDIUM: PRAGMA Injection Risk (Defense-in-Depth)

**Affected Component:** `api/src/routes/query.ts:getTableColumns()`

**Current Code:**
```typescript
db.prepare(`PRAGMA table_info("${tableName}")`).all()
```

**Risk Assessment:**
- **Current Risk:** LOW - `tableName` is validated by whitelist before reaching this function
- **Defense-in-Depth Concern:** Direct string interpolation in SQL context

**Recommendation:**
While currently mitigated by upstream validation, consider using a safer pattern:
```typescript
// Validate tableName is in ALLOWED_SOURCES before this call
const allowedTableRegex = /^[a-zA-Z0-9_ ]+$/;
if (!allowedTableRegex.test(tableName)) {
  throw new Error("Invalid table name");
}
```

## Security Controls

### Input Validation

#### 1. Whitelist-Based Validation
- **Tables/Views:** `ALLOWED_SOURCES` Set with 13 approved tables
- **Operators:** `ALLOWED_OPERATORS` Set with 10 approved SQL operators
- **Aggregates:** `ALLOWED_AGGREGATES` Set with 5 approved functions
- **Expression Functions:** `ALLOWED_EXPRESSION_FUNCTIONS` Set with 50+ safe functions

#### 2. Regex-Based Sanitization
- **Column Names:** `^[a-zA-Z0-9_.\s]+$` (alphanumeric, underscore, dot, space)
- **Aliases:** `^[a-zA-Z_][a-zA-Z0-9_]*$` (identifier pattern)

#### 3. Pattern Blocking (Expressions)
Blocked patterns include:
- Semicolons (`;`)
- SQL comments (`--`, `/*`)
- DML keywords (SELECT, INSERT, UPDATE, DELETE, DROP)
- DDL keywords (CREATE, ALTER)
- System keywords (PRAGMA, ATTACH, EXEC)

#### 4. Parameterized Queries
All filter values use prepared statement placeholders (`?`) to prevent injection in WHERE clauses.

### Authentication & Authorization

#### Session Management
- **Implementation:** `express-session` with SQLite store (`sessions.db`)
- **Cookie Security:** httpOnly, secure (production), sameSite
- **Session Lifetime:** Configurable (default: 24 hours)

#### Authorization Model
- **Public Read Access:** All GET endpoints for governance data are unauthenticated
- **Write Operations:** All POST/PUT/DELETE require authenticated session
- **Admin Operations:** User management via CLI only (no API exposure)

### Rate Limiting

**Status:** ⚠️ RECOMMENDED (not currently implemented)

**Recommendation:**
Implement rate limiting on `/api/query/execute` endpoint:
- **Anonymous:** 60 requests/minute per IP
- **Authenticated:** 300 requests/minute per user
- **Tools:** `express-rate-limit` or nginx `limit_req_zone`

### Data Exposure

#### Schema Endpoint (`GET /api/query/schema`)
- **Risk:** Exposes database structure to attackers
- **Mitigation:** Only whitelisted tables included
- **Recommendation:** Consider requiring authentication for schema access

#### SQL Disclosure in Responses
- **Current Behavior:** Generated SQL returned in response (`{ sql: "SELECT ..." }`)
- **Risk:** Information disclosure aids attackers
- **Recommendation:** Remove SQL from production responses or gate behind debug flag

## Deployment Security

### Docker Security
- **User Isolation:** Application runs as non-root user
- **Volume Mounts:** Minimal volume mounts (data directory only)
- **Network:** Only necessary ports exposed (80/443)

### Secrets Management
- **Session Secret:** Loaded from environment variable `SESSION_SECRET`
- **Database:** File-based SQLite (no network exposure)
- **Credentials:** User passwords bcrypt-hashed in `sessions.db`

### HTTPS/TLS
- **Production:** nginx configured for HTTPS with Let's Encrypt
- **Headers:** Security headers recommended (CSP, HSTS, X-Frame-Options)

## Monitoring & Incident Response

### Logging
- **Current:** Express access logs and error logs
- **Recommendation:** Add structured logging for security events:
  - Failed authentication attempts
  - SQL validation failures
  - Rate limit violations

### Alerting
**Recommended Alerts:**
- Spike in 400/500 errors on `/api/query/execute`
- Multiple failed login attempts from same IP
- Unusual query patterns (e.g., all aliases near max length)

## Security Testing

### Automated Testing
- **Unit Tests:** 15 new security tests in `api/src/routes/__tests__/query.test.ts`
- **Coverage:** SQL injection, alias validation, expression validation
- **CI/CD:** Tests run on every commit

### Manual Security Testing
**Recommended Practices:**
1. Regular security audits of query builder logic
2. Penetration testing of API endpoints
3. Dependency vulnerability scanning (`npm audit`, `pip-audit`)
4. SAST/DAST integration in CI/CD pipeline

## Compliance Considerations

### Data Privacy
- **Public Data Only:** All governance data is public blockchain data
- **Personal Data:** Identities fetched from Statescan (public on-chain identities)
- **User Data:** Session tokens and user credentials (internal only)

### Data Retention
- **Governance Data:** Indefinite retention (historical record)
- **Session Data:** Automatic expiration per session lifetime
- **Logs:** Recommended 90-day retention

## Security Roadmap

### Short-Term (0-3 months)
- [x] Fix SQL injection in column aliases (Issue #15)
- [ ] Add rate limiting to query endpoints
- [ ] Remove SQL from API responses (production)
- [ ] Add security headers to nginx config

### Medium-Term (3-6 months)
- [ ] Implement comprehensive audit logging
- [ ] Add SAST to CI/CD pipeline
- [ ] Conduct external security audit
- [ ] Implement API key authentication for programmatic access

### Long-Term (6-12 months)
- [ ] Move to PostgreSQL with RLS (row-level security)
- [ ] Implement OAuth2 for third-party integrations
- [ ] Add real-time security monitoring (e.g., Sentry, DataDog)
- [ ] Develop security incident response playbook

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- CWE-89: SQL Injection: https://cwe.mitre.org/data/definitions/89.html
- SQLite Security: https://www.sqlite.org/security.html

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-12 | Initial threat model created. Fixed SQL injection in column aliases (Issue #15). |

---

**Document Owner:** Security Team
**Last Reviewed:** 2026-01-12
**Next Review:** 2026-04-12 (Quarterly)
