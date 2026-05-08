export type BillCategory = 'fixed' | 'variable' | 'savings'
export type BillFrequency = 'monthly' | 'quarterly' | 'annual'
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDayOfMonth: number | null  // null = every period
  frequency: BillFrequency       // only relevant when dueDayOfMonth != null
  dueMonths: number[]            // 1-12; empty = every month (monthly). Computed for quarterly/annual.
  category: BillCategory
  active: boolean
}

export interface PayPeriod {
  id: string
  startDate: string
  payAmount: number
  openingBalance: number | null
}

export interface PeriodItem {
  id: string
  periodId: string
  billId: string
  paid: boolean
  actualAmount: number | null
  dismissed: boolean  // hidden from this period only; won't be re-added
}

export interface QuickLink {
  id: string
  name: string
  url: string
}

export interface Extra {
  id: string
  periodId: string
  name: string
  amount: number
  paid: boolean
}

export interface ActualEntry {
  category: string
  billId: string | null
  billName: string
  budgeted: number
  actual: number
}

export interface PeriodActuals {
  periodId: string
  savedAt: string
  statementRange: string   // e.g. "Apr 30 – May 13"
  entries: ActualEntry[]
}

// ─── Credit Card Analysis ────────────────────────────────────────────────────

export type AmazonType = 'subscribe-save' | 'discretionary' | null
export type CCPerson = 'Bryan' | 'Rachel' | null

export interface MerchantMemoryEntry {
  category: string
  isRecurring: boolean
  person: CCPerson
  lastSeen: string  // YYYY-MM
}

// Keyed by normalized merchant description (uppercased, trimmed)
export type CCMerchantMemory = Record<string, MerchantMemoryEntry>

export interface CCTransaction {
  id: string
  date: string
  description: string
  amount: number             // always positive (charge to card)
  barclaysCategory: string   // raw category from Barclays CSV
  aiCategory: string         // what Claude picked
  category: string           // current value (user may override)
  aiIsRecurring: boolean
  isRecurring: boolean       // current value (user may override)
  isAmazon: boolean
  amazonType: AmazonType
  amazonItemDescription: string | null
  person: CCPerson           // user-assigned; null = unassigned
  flagged?: boolean          // user-marked for follow-up
  note?: string              // free-text note on a flagged transaction
  resolved?: boolean         // flagged transaction has been resolved
}

export interface CCReductionSuggestion {
  id: string
  description: string
  potentialSavings: number | null
  dismissed: boolean
}

export interface CCMonthlyAnalysis {
  id: string              // YYYY-MM
  month: string           // "April 2026"
  statementRange: string  // "Apr 1 – Apr 30"
  savedAt: string
  transactions: CCTransaction[]
  reductionSuggestions: CCReductionSuggestion[]
  notes: string
}

// ─── Wealth / Savings & Retirement ───────────────────────────────────────────

export type AccountType =
  | 'checking' | 'savings' | 'money_market' | 'cd'
  | 'roth_ira' | 'traditional_ira' | '401k' | '403b'
  | 'brokerage' | '529' | 'hsa' | 'other'

export type AccountCategory =
  | 'emergency' | 'retirement' | 'college' | 'investment' | 'spending' | 'kids' | 'other'

export interface WealthAccount {
  id: string
  institution: string
  name: string
  type: AccountType
  category: AccountCategory
  balance: number
  balanceDate: string
  notes: string
  includeInProjections: boolean
  collegeKidId: string | null   // when category=college / type=529, links to a kid
}

export type AccountAdjustmentType = 'actual' | 'forecast'

export interface AccountAdjustment {
  id: string
  accountId: string
  type: AccountAdjustmentType
  amount: number   // positive = addition, negative = subtraction
  label: string
  date: string
}

export interface ProjectionCalcAccount {
  id: string
  name: string
  linkedAccountId: string | null
  presentValue: number
  annualRate: number
  annualContribution: number
  periodsPerYear: number
}

export type SnapshotMilestoneLabel = 'Today' | '1yr' | '3yr' | '5yr' | '10yr' | '15yr' | '20yr'

export interface SnapshotMilestone {
  label: SnapshotMilestoneLabel
  targetDate: string
  projected: number
  actual: number | null
  actualDate: string | null
}

export interface ProjectionSnapshot {
  id: string
  name: string
  snapshotDate: string
  milestones: SnapshotMilestone[]
}

export interface RetirementExpense {
  id: string
  name: string
  monthlyAmount: number
}

export interface RetirementPlan {
  expenses: RetirementExpense[]
  socialSecurityAnnual: number
  portfolioReturnRate: number   // annual rate during drawdown, e.g. 0.05
  savingsSource: 'accounts' | 'snapshot'
  snapshotId: string | null
  snapshotMilestone: SnapshotMilestoneLabel | null
  useSnapshotActual: boolean
}

// ─── College ─────────────────────────────────────────────────────────────────

export interface CollegeKid {
  id: string
  name: string
  freshmanStartYear: number   // calendar year freshman year begins (e.g. 2027)
}
