# Filtering Guide

Guide for using filtering systems: faceted filters, global search, and QueryBuilder advanced filters.

## Guides

### [Filtering Basics](./filters-basics.md)
Getting started with filtering. Covers:
- Faceted filters (multi-select dropdowns with counts)
- Global search (search across all columns)
- Combining faceted filters and global search
- Basic filter strategy
- Performance and troubleshooting

Start here if you're new to filtering.

### [Filtering Advanced](./filters-advanced.md)
Advanced QueryBuilder filters. Covers:
- Filter operators by column type
- Categorical column multiselect
- AND/OR logic and nested conditions
- Common patterns (date ranges, text patterns, NULL checks)
- Dashboard filter combinations
- Advanced troubleshooting

Use this guide for complex filtering needs in dashboards.

## Quick Reference

**Filter types:**
- **Faceted Filters**: Multi-select dropdowns on DataTable columns (< 100 distinct values)
- **Global Search**: Text search across all visible DataTable columns
- **Advanced Filters**: QueryBuilder with AND/OR logic for dashboards

**When to use:**
- Faceted: Quick filtering on categorical columns
- Global Search: Quick exploration, finding specific text
- Advanced: Complex logic, saved queries, numeric ranges

## See Also

- [Filters Specification](../spec/frontend/filters.md) - Technical details
- [DataTable How-To](./data-table.md) - DataTable filtering examples
- [QueryBuilder How-To](./query-builder.md) - Building complex queries
