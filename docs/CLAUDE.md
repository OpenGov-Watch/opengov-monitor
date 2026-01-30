# Documentation

## General Rules

- **Be terse**: Expert audience. Don't explain basics or what's in code. Show connections.
- **No "recent changes"**: Describe current state only.
- **No duplication**: Files play together. Keep each terse. >100 lines → split it.
- **Fix broken links** when discovered.

## Folder Roles

| Folder | Purpose | Example Content |
|--------|---------|-----------------|
| `01_requirements/` | What users need | User capabilities, validation messages, access rules |
| `02_specification/` | What the system does technically | Column lists, API endpoints, operators, pixel values |
| `03_design/` | How it's built | Architecture, ADRs, sequences. Link to code, don't show it. |
| `howtos/` | How to use features | Step-by-step guides with examples |

## Requirements vs Specifications

**Requirements** answer "what do users need?":
- "View referendum details with spending values"
- "Filter by status and track"
- "Edit categories (authenticated)"

**Specifications** answer "what exactly does the system do?":
- Column lists with types and editability
- API endpoints with methods and paths
- Breakpoints, page sizes, dimensions
- Operators by column type

**Rule**: If it has specific values (768px, 100 rows, `/api/categories`), it's specification.

## Cross-References

Always link between related files:
```markdown
## See Also
- [Data Views Specification](../02_specification/frontend/data-views.md) - Column details
```

## CLAUDE.md vs README.md

| File | Audience | Content |
|------|----------|---------|
| CLAUDE.md | Agents | Navigation context, rules, gotchas |
| README.md | Everyone | Structure, docs links, shell commands |

See [README.md](README.md) for documentation structure.
