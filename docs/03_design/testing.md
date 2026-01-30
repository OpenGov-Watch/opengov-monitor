# Testing

Testing architecture, patterns, and CI integration for OpenGov Monitor.

## Overview

| Package | Framework | Environment | Test Files |
|---------|-----------|-------------|------------|
| API | Vitest | Node.js | `src/**/__tests__/*.test.ts` |
| Frontend | Vitest | happy-dom | `src/**/__tests__/*.test.{ts,tsx}` |
| Backend | pytest | Python | `tests/*.py` |

## Commands

```bash
# All tests
pnpm test            # Watch mode (all packages)
pnpm test:run        # Single run (all packages)

# Package-specific
pnpm --filter api run test:run
pnpm --filter opengov-monitor-frontend run test:run

# Backend (Python)
cd src/backend
pytest
```

## Test File Conventions

Tests are colocated with source code in `__tests__/` folders:

```
src/
├── routes/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.test.ts
├── components/
│   ├── data-table/
│   │   ├── data-table.tsx
│   │   └── __tests__/
│   │       └── data-table.test.tsx
```

Naming: `<source-file>.test.{ts,tsx}`

## API Testing Patterns

### Setup

Tests use an in-memory SQLite database:

```typescript
// src/api/src/test/setup.ts
import { createTestDb } from "./helpers";

beforeAll(() => {
  testDb = createTestDb();
});

afterAll(() => {
  testDb.close();
});
```

### Route Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("GET /api/categories", () => {
  it("returns all categories", async () => {
    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});
```

### Database Test Isolation

Each test file gets a fresh database state:

```typescript
beforeEach(() => {
  testDb.exec("DELETE FROM categories");
});
```

## Frontend Testing Patterns

### Setup

```typescript
// src/frontend/src/__tests__/setup.ts
import "@testing-library/jest-dom/vitest";

// Mock browser APIs
Object.defineProperty(window, "matchMedia", { ... });
Object.defineProperty(window, "ResizeObserver", { ... });
```

### Component Tests

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DataTable } from "@/components/data-table";

describe("DataTable", () => {
  it("renders loading state", () => {
    render(<DataTable loading={true} data={[]} columns={[]} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
```

### User Interactions

```typescript
import userEvent from "@testing-library/user-event";

it("filters on search input", async () => {
  const user = userEvent.setup();
  render(<DataTable {...props} />);

  await user.type(screen.getByRole("searchbox"), "test");
  expect(screen.getByText("Filtered: test")).toBeInTheDocument();
});
```

## CI Integration

Tests run on every PR and push to `main`/`production`:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run build
      - run: pnpm --filter api run test:run
      - run: pnpm --filter opengov-monitor-frontend run test:run
```

Order: lint → build → test

## Coverage

### API

- Provider: V8
- Includes: `src/db/**`, `src/routes/**`
- Command: `pnpm --filter api run test:run --coverage`

### Frontend

- Provider: V8
- Includes: `src/components/data-table/**`
- Thresholds: 40% statements, 35% branches, 40% functions
- Command: `pnpm --filter opengov-monitor-frontend run test:run --coverage`

## Known Issues

### Frontend Memory

React Testing Library can accumulate memory during large test runs. The tests pass but may exit with code 1 due to OOM during teardown. Mitigations:

- `pool: "forks"` in vitest config
- `fileParallelism: false` for sequential execution
- Coverage disabled in CI to reduce memory

## Writing Tests

### What to Test

| Type | Coverage |
|------|----------|
| API routes | Input validation, auth, response format |
| Query builders | SQL generation, edge cases |
| React components | Render states, user interactions |
| Utility functions | Pure function logic |

### What NOT to Test

- Third-party libraries (assume they work)
- Simple pass-through functions
- Implementation details (test behavior, not internals)

## See Also

- [Architecture](architecture.md) - System overview
- [CI/CD Workflows](../../.github/workflows/ci.yml) - Pipeline configuration
