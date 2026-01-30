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

Sessions support "remember me" for extended duration.

**See Also:** [Security Specification](../../02_specification/security/authentication.md) for session configuration details

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

Authentication uses secure password hashing, session regeneration on login, CSRF protection, and constant-time password comparison.

**See Also:** [Security Specification](../../02_specification/security/authentication.md) for implementation details

## See Also

- [Security Specification](../../02_specification/security/README.md)
- [Navigation](./navigation.md) - Auth-dependent navigation items
