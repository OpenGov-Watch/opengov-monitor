// TypeScript types matching backend/data_sinks/sqlite/schema.py

export interface Referendum {
  id: number;
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
  budget_usdc: number | null;
  registeredCount: number | null;
  registeredPaidCount: number | null;
  registered_paid_amount_usdc: number | null;
  total_registrations_usdc: number | null;
  unregistered_paid_usdc: number | null;
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
}

export interface TreasuryNetflow {
  month: string;                    // YYYY-MM format
  asset_name: string;
  flow_type: string;
  amount_usd: number;
  amount_dot_equivalent: number;
}

export interface FellowshipSubtreasury {
  id: number;
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

export interface ExpiredClaim {
  id: number;
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
  // Computed date grouping columns
  year: string | null;
  year_month: string | null;
  year_quarter: string | null;
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

export interface JoinCondition {
  left: string;           // Left side column (e.g., "Referenda.category_id")
  right: string;          // Right side column (e.g., "c.id")
}

export interface JoinConfig {
  type: 'LEFT' | 'INNER' | 'RIGHT';
  table: string;          // Table name to join (e.g., "Categories")
  alias?: string;         // Optional alias (e.g., "c")
  on: JoinCondition;      // Join condition
}

export interface QueryConfig {
  sourceTable: string;
  columns: ColumnSelection[];
  expressionColumns?: ExpressionColumn[];
  joins?: JoinConfig[];     // Array of joins
  filters: FilterCondition[];
  groupBy?: string[];
  orderBy?: OrderByConfig[];
  limit?: number;
  offset?: number;         // Optional: enables server-side pagination
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
    | "IS NOT NULL";
  value: string | number | string[] | null;
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
  treasuryNetflows: "Treasury Netflows",
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
