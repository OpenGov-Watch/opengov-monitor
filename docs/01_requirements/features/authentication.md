# Authentication Specification

Requirements for login, session management, and auth state.

## Login Page (`/login`)

### Form Fields
- `username`: Required text input
- `password`: Required password input
- `remember me`: Optional checkbox

### Username Validation
- Length: 3-32 characters
- Characters: alphanumeric, underscore, hyphen
- Must start with letter or underscore

### States
- **Error**: Inline alert for invalid credentials
- **Loading**: Disabled inputs with "Signing in..." text
- **Success**: Redirect to originally requested page (or home)

---

## Session Management

### Duration
- Default: 24 hours
- Remember me: 30 days

### Storage
- SQLite session store (`sessions.db`)
- Cookie: HTTP-only, secure in production, SameSite=Lax

---

## Auth Context

### useAuth Hook
Returns: `{ isAuthenticated, user, isLoading, login(), logout() }`

### Behavior
- Checks `/api/auth/me` on mount to restore session
- User object: `{ id, username }`

---

## RequireAuth Wrapper

### Behavior
- Shows skeleton while checking auth
- Redirects to `/login` with return path if unauthenticated

### Protected Routes
- `/dashboards/:id/edit`

---

## Security

| Mechanism | Implementation |
|-----------|----------------|
| Password hashing | bcrypt (12 rounds) |
| Session regeneration | On login |
| CSRF protection | X-Requested-With header |
| Password comparison | Constant-time |

## See Also

- [Security Specification](../../02_specification/security/README.md)
- [Navigation](./navigation.md) - Auth-dependent navigation items
