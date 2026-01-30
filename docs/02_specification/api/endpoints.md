# API Endpoints Specification

REST API endpoints for the manage section and data operations.

## Categories

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Create | POST | `/api/categories` | Add category/subcategory pair |
| Read | GET | `/api/categories` | List all categories grouped by parent |
| Update | PUT | `/api/categories/{id}` | Edit category/subcategory |
| Delete | DELETE | `/api/categories/{id}` | Remove with confirmation |

## Bounties

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Create | POST | `/api/bounties` | Add bounty record |
| Read | GET | `/api/bounties` | List all bounties |
| Update | PUT | `/api/bounties` | Edit bounty (ID immutable) |

## Subtreasury

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Create | POST | `/api/subtreasury` | Add entry |
| Read | GET | `/api/subtreasury` | List all entries |
| Update | PUT | `/api/subtreasury/{id}` | Edit entry |
| Delete | DELETE | `/api/subtreasury/{id}` | Remove with confirmation |

## Custom Spending

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Create | POST | `/api/custom-spending` | Add entry |
| Read | GET | `/api/custom-spending` | List all entries |
| Update | PUT | `/api/custom-spending/{id}` | Edit entry |
| Delete | DELETE | `/api/custom-spending/{id}` | Remove with confirmation |

## Custom Tables

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Create Table | POST | `/api/custom-tables` | Create with schema |
| Read Tables | GET | `/api/custom-tables` | List all custom tables |
| Read Data | GET | `/api/custom-tables/{id}/data` | Get table rows (paginated) |
| Update Row | PUT | `/api/custom-tables/{id}/data/{rowId}` | Edit single row |
| Delete Table | DELETE | `/api/custom-tables/{id}` | Remove entire table |
| Delete Row | DELETE | `/api/custom-tables/{id}/data/{rowId}` | Remove single row |
| Import | POST | `/api/custom-tables/{id}/import` | Bulk import CSV |
| Infer Schema | POST | `/api/custom-tables/infer-schema` | Detect column types |

## Sync/Import

| Source | Method | Endpoint | Behavior |
|--------|--------|----------|----------|
| Categories | POST | `api.categories.import()` | Merge |
| Referenda | POST | `api.referenda.import()` | Merge |
| Child Bounties | POST | `api.childBounties.import()` | Merge |
| Bounties | POST | `api.bounties.import()` | Merge |
| Treasury Netflows | POST | `api.treasuryNetflows.import()` | Replace |
| Cross Chain Flows | POST | `api.crossChainFlows.import()` | Replace |
| Local Flows | POST | `api.localFlows.import()` | Replace |
| Custom Spending | POST | `api.customSpending.import()` | Replace |
| Default Templates | GET | `/api/sync/default-*` | Server-side defaults |

## Database Backup

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Info | GET | `/api/backup/info` | File size |
| Download | POST | `/api/backup/download` | Returns blob |

## Query

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Execute | POST | `/api/query/execute` | Run query with filters |
| Facets | POST | `/api/query/facets` | Get distinct values with counts |
