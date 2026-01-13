// TypeScript types matching backend/data_sinks/sqlite/schema.py

export interface Referendum {
  id: number;
  url: string;
  title: string;
  status: string;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  track: string;
  "tally.ayes": number | null;
  "tally.nays": number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  category_id: number | null;
  // Denormalized fields (populated via JOIN with Categories)
  category?: string | null;
  subcategory?: string | null;
  notes: string | null;
  hide_in_spends: number | null;
}

export interface TreasurySpend {
  id: number;
  url: string;
  referendumIndex: number | null;
  status: string;
  description: string | null;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  validFrom: string | null;
  expireAt: string | null;
}

export interface ChildBounty {
  identifier: string;
  url: string;
  index: number;
  parentBountyId: number;
  status: string;
  description: string | null;
  DOT: number | null;
  USD_proposal_time: number | null;
  beneficiary: string | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  USD_latest: number | null;
  category_id: number | null;
  // Denormalized fields (populated via JOIN with Categories)
  category?: string | null;
  subcategory?: string | null;
  // Denormalized from Bounties table
  parentBountyName?: string | null;
  notes: string | null;
  hide_in_spends: number | null;
}

export interface Fellowship {
  id: number;
  url: string;
  status: string;
  description: string | null;
  DOT: number | null;
  USD_proposal_time: number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  USD_latest: number | null;
}

export interface FellowshipSalaryCycle {
  cycle: number;
  url: string;
  budget_dot: number | null;
  registeredCount: number | null;
  registeredPaidCount: number | null;
  registered_paid_amount_dot: number | null;
  total_registrations_dot: number | null;
  unregistered_paid_dot: number | null;
  registration_period: number | null;
  payout_period: number | null;
  start_block: number | null;
  end_block: number | null;
  start_time: string | null;
  end_time: string | null;
}

export interface FellowshipSalaryClaimant {
  address: string;
  display_name: string | null;
  name: string | null;
  short_address: string | null;
  status_type: string | null;
  registered_amount_dot: number | null;
  attempt_amount_dot: number | null;
  attempt_id: number | null;
  last_active_time: string | null;
  rank: number | null;
}

export interface FellowshipSalaryPayment {
  payment_id: number;
  cycle: number;
  who: string;
  who_name: string | null;
  beneficiary: string;
  beneficiary_name: string | null;
  amount_dot: number | null;
  salary_dot: number | null;
  rank: number | null;
  is_active: number | null;
  block_height: number | null;
  block_time: string | null;
  url: string;
}

// Manual Tables (managed via frontend UI)

export interface Category {
  id: number;
  category: string;
  subcategory: string;
}

export interface Bounty {
  id: number;
  name: string | null;
  category_id: number | null;
  // Denormalized fields (populated via JOIN with Categories)
  category?: string | null;
  subcategory?: string | null;
  remaining_dot: number | null;
  url: string | null;
}

export interface Subtreasury {
  id: number;
  title: string | null;
  description: string | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  category_id: number | null;
  // Denormalized fields (populated via JOIN with Categories)
  category?: string | null;
  subcategory?: string | null;
  latest_status_change: string | null;
  url: string | null;
}

export interface FellowshipSubtreasury {
  id: number;
  url: string | null;
  title: string | null;
  status: string;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  validFrom: string | null;
  expireAt: string | null;
}

// Database Views

export interface OutstandingClaim {
  id: number;
  url: string;
  referendumIndex: number | null;
  status: string;
  description: string | null;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  validFrom: string | null;
  expireAt: string | null;
  claim_type: "active" | "upcoming";
  days_until_expiry: number | null;
  days_until_valid: number | null;
}

// Log entries from logs/app.db
export interface LogEntry {
  id: number;
  timestamp: string;
  source: string;
  log_level: string;
  content: string;
  extra: string | null;
}

export interface ExpiredClaim {
  id: number;
  url: string;
  referendumIndex: number | null;
  status: string;
  description: string | null;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  validFrom: string | null;
  expireAt: string | null;
  days_since_expiry: number | null;
}

export type SpendingType =
  | "Direct Spend"
  | "Claim"
  | "Bounty"
  | "Subtreasury"
  | "Fellowship Salary"
  | "Fellowship Grants";

export interface AllSpending {
  type: SpendingType;
  id: string;
  latest_status_change: string | null;
  DOT_latest: number | null;
  USD_latest: number | null;
  category: string | null;
  subcategory: string | null;
  title: string | null;
  DOT_component: number | null;
  USDC_component: number | null;
  USDT_component: number | null;
  url: string | null;
}

// Dashboard Types

export interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type DashboardComponentType =
  | "table"
  | "pie"
  | "bar_stacked"
  | "bar_grouped"
  | "line"
  | "text";

export interface DashboardComponent {
  id: number;
  dashboard_id: number;
  name: string;
  type: DashboardComponentType;
  query_config: string; // JSON string of QueryConfig
  grid_config: string; // JSON string of GridConfig
  chart_config: string | null; // JSON string of ChartConfig
  created_at: string | null;
  updated_at: string | null;
}

export interface GridConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExpressionColumn {
  expression: string; // SQL expression, e.g., "DOT_latest * 10"
  alias: string; // Required display name for the result column
}

export interface QueryConfig {
  sourceTable: string;
  columns: ColumnSelection[];
  expressionColumns?: ExpressionColumn[];
  filters: FilterCondition[];
  groupBy?: string[];
  orderBy?: OrderByConfig[];
  limit?: number;
}

export interface ColumnSelection {
  column: string;
  alias?: string;
  aggregateFunction?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
}

export interface FilterCondition {
  column: string;
  operator:
    | "="
    | "!="
    | ">"
    | "<"
    | ">="
    | "<="
    | "LIKE"
    | "IN"
    | "IS NULL"
    | "IS NOT NULL"
    | "NOT IN"
    | "NOT LIKE"
    | "BETWEEN";
  value: string | number | string[] | null;
}

// Advanced Filter Types for Notion-like filtering
export type FilterOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN";

export type FilterCombinator = "AND" | "OR";

export interface AdvancedFilterCondition {
  column: string;
  operator: FilterOperator;
  value: string | number | string[] | [number, number] | [string, string] | null;
}

export interface AdvancedFilterGroup {
  combinator: FilterCombinator;
  conditions: (AdvancedFilterCondition | AdvancedFilterGroup)[];
}

// Sort configuration for multi-column sorting
export interface SortCondition {
  column: string;
  direction: "ASC" | "DESC";
}

// Grouping configuration
export interface GroupConfig {
  column: string;
  aggregations?: {
    column: string;
    function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
    alias?: string;
  }[];
}

// Table view state for save/load
export interface TableViewState {
  name: string;
  filters?: AdvancedFilterGroup;
  sorts?: SortCondition[];
  grouping?: GroupConfig;
  columnVisibility?: Record<string, boolean>;
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
}

// API request parameters for enhanced table features
export interface TableQueryParams {
  filters?: string; // JSON-encoded AdvancedFilterGroup
  sorts?: string; // JSON-encoded SortCondition[]
  groupBy?: string; // Column name to group by
  limit?: number;
  offset?: number;
}

export interface OrderByConfig {
  column: string;
  direction: "ASC" | "DESC";
}

export interface ChartConfig {
  colors?: string[];
  labelColumn?: string;
  valueColumn?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  content?: string; // Markdown content for text components
}

export interface QueryCache {
  id: number;
  cache_key: string;
  result_json: string;
  cached_at: string | null;
  expires_at: string;
}

// Table names matching SQLite (with spaces)
export const TABLE_NAMES = {
  referenda: "Referenda",
  treasury: "Treasury",
  childBounties: "Child Bounties",
  fellowship: "Fellowship",
  fellowshipSalaryCycles: "Fellowship Salary Cycles",
  fellowshipSalaryClaimants: "Fellowship Salary Claimants",
  fellowshipSalaryPayments: "Fellowship Salary Payments",
  // Manual tables
  categories: "Categories",
  bounties: "Bounties",
  subtreasury: "Subtreasury",
  fellowshipSubtreasury: "Fellowship Subtreasury",
  // Dashboard tables
  dashboards: "Dashboards",
  dashboardComponents: "Dashboard Components",
  queryCache: "Query Cache",
} as const;

// View names (lowercase, no spaces)
export const VIEW_NAMES = {
  outstandingClaims: "outstanding_claims",
  expiredClaims: "expired_claims",
  allSpending: "all_spending",
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
export type ViewName = (typeof VIEW_NAMES)[keyof typeof VIEW_NAMES];
