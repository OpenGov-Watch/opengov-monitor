# Dashboard Guide

Guide for creating custom dashboards with tables, charts, and visual QueryBuilder.

## Guides

### [Dashboard Basics](./dashboard-basics.md)
Getting started with dashboards. Covers:
- Creating a dashboard
- Layout and positioning (12-column grid system)
- Adding data table components
- Adding pie charts
- Tips and best practices

Start here if you're new to dashboards.

### [Dashboard Advanced](./dashboard-advanced.md)
Advanced features and patterns. Covers:
- Advanced chart types (bar charts, line charts)
- Building queries with JOINs
- Adding filters (simple and complex)
- Complete real-world example (Governance Overview)
- Performance optimization

Use this guide for complex dashboards.

## Quick Reference

**Component types:**
- **Table**: Display query results in a simple HTML table
- **Pie Chart**: Show categorical data distribution
- **Bar Chart**: Compare values across categories (grouped or stacked)
- **Line Chart**: Show trends over time

**Grid layout:**
- 12-column grid system
- Position: `{ x, y, w, h }` (column, row, width, height)
- Row height: 80px
- Drag and resize in edit mode

**Common grid patterns:**
- Full-width: `{ x: 0, y: 0, w: 12, h: 4 }`
- Two-column: `{ x: 0, y: 0, w: 6, h: 4 }` + `{ x: 6, y: 0, w: 6, h: 4 }`

## See Also

- [Dashboard Specification](../spec/frontend/dashboard.md) - Architecture details
- [QueryBuilder How-To](./query-builder.md) - Query building guide
- [Table Systems Reference](../reference/frontend/table-systems.md) - Table architecture
