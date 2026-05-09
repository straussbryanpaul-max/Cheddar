import { create } from 'zustand'
import type { Bill, PayPeriod, PeriodItem, Extra, QuickLink, PayFrequency, PeriodActuals, ActualEntry, WealthAccount, AccountAdjustment, ProjectionCalcAccount, ProjectionSnapshot, SnapshotMilestone, RetirementExpense, RetirementPlan, CCMonthlyAnalysis, CCTransaction, CCMerchantMemory, MerchantMemoryEntry, CollegeKid, CollegeFVAccount, CollegeForecastYear, CollegeExpenseLine, CollegeExpenseCategory, CollegeContributionLine, UiPrefs } from '../types'
import { nextPeriodStart, prevPeriodStart, billIncludedInPeriod } from '../lib/periods'

interface State {
  bills: Bill[]
  periods: PayPeriod[]
  periodItems: PeriodItem[]
  extras: Extra[]
  defaultPayAmount: number
  payFrequency: PayFrequency
  payAnchorDate: string
  quickLinks: QuickLink[]
  periodsVisible: number
  periodsWindowDate: string | null   // startDate of first visible period; null = current
  quickLinksDocked: boolean          // true = collapsed to edge handle; false = pinned open
  periodActuals: PeriodActuals[]
  ghostMode: boolean

  setPaySettings: (s: { defaultPayAmount?: number; payFrequency?: PayFrequency; payAnchorDate?: string }) => void
  regeneratePeriods: () => void
  setGhostMode: (enabled: boolean) => void

  addQuickLink: (link: Omit<QuickLink, 'id'>) => void
  updateQuickLink: (id: string, updates: Partial<QuickLink>) => void
  deleteQuickLink: (id: string) => void
  setPeriodsVisible: (n: number) => void
  setPeriodsWindowDate: (date: string | null) => void
  setQuickLinksDocked: (docked: boolean) => void

  addBill: (bill: Omit<Bill, 'id'>) => void
  updateBill: (id: string, updates: Partial<Bill>) => void
  deleteBill: (id: string) => void

  ensureFuturePeriods: (count?: number) => void
  ensurePastPeriods: (count?: number) => void
  updatePeriod: (id: string, updates: Partial<PayPeriod>) => void

  ensurePeriodItems: (periodId: string) => void
  togglePaid: (itemId: string) => void
  setActualAmount: (itemId: string, amount: number | null) => void
  dismissPeriodItem: (itemId: string) => void

  addExtra: (extra: Omit<Extra, 'id'>) => void
  updateExtra: (id: string, updates: Partial<Extra>) => void
  deleteExtra: (id: string) => void
  toggleExtraPaid: (id: string) => void

  setPeriodActuals: (periodId: string, entries: ActualEntry[], statementRange: string) => void
  clearPeriodActuals: (periodId: string) => void

  // Credit card analysis
  ccAnalyses: CCMonthlyAnalysis[]
  ccMerchantMemory: CCMerchantMemory
  saveCCAnalysis: (analysis: CCMonthlyAnalysis) => void
  updateCCTransaction: (analysisId: string, txId: string, updates: Partial<CCTransaction>) => void
  dismissCCSuggestion: (analysisId: string, suggestionId: string) => void
  deleteCCAnalysis: (id: string) => void
  mergeCCMerchantMemory: (entries: CCMerchantMemory) => void

  resetStore: () => void
  resetPeriod: (periodId: string) => void

  // Sync-layer actions (called by src/lib/sync.ts)
  hydrate: (data: Partial<State>) => void
  hydrated: boolean
  setHydrated: (v: boolean) => void

  // Wealth module
  wealthAccounts: WealthAccount[]
  projectionCalcAccounts: ProjectionCalcAccount[]
  projectionSnapshots: ProjectionSnapshot[]
  retirementPlan: RetirementPlan

  addWealthAccount: (a: Omit<WealthAccount, 'id'>) => void
  updateWealthAccount: (id: string, updates: Partial<WealthAccount>) => void
  deleteWealthAccount: (id: string) => void

  accountAdjustments: AccountAdjustment[]
  addAccountAdjustment: (a: Omit<AccountAdjustment, 'id'>) => void
  updateAccountAdjustment: (id: string, updates: Partial<AccountAdjustment>) => void
  deleteAccountAdjustment: (id: string) => void

  addCalcAccount: (a: Omit<ProjectionCalcAccount, 'id'>) => void
  updateCalcAccount: (id: string, updates: Partial<ProjectionCalcAccount>) => void
  deleteCalcAccount: (id: string) => void

  addSnapshot: (s: Omit<ProjectionSnapshot, 'id'>) => void
  updateSnapshotMilestone: (snapshotId: string, milestoneLabel: string, updates: Pick<SnapshotMilestone, 'actual' | 'actualDate'>) => void
  deleteSnapshot: (id: string) => void

  updateRetirementPlan: (updates: Partial<RetirementPlan>) => void
  addRetirementExpense: (e: Omit<RetirementExpense, 'id'>) => void
  updateRetirementExpense: (id: string, updates: Partial<RetirementExpense>) => void
  deleteRetirementExpense: (id: string) => void

  // College module
  collegeKids: CollegeKid[]
  addCollegeKid: (kid: Omit<CollegeKid, 'id'>) => void
  updateCollegeKid: (id: string, updates: Partial<CollegeKid>) => void
  deleteCollegeKid: (id: string) => void

  collegeFVAccounts: CollegeFVAccount[]
  addCollegeFVAccount: (a: Omit<CollegeFVAccount, 'id'>) => void
  updateCollegeFVAccount: (id: string, updates: Partial<CollegeFVAccount>) => void
  deleteCollegeFVAccount: (id: string) => void

  collegeForecastYears: CollegeForecastYear[]
  ensureCollegeForecastYears: (fvAccountId: string) => void
  updateCollegeForecastYear: (id: string, updates: Partial<CollegeForecastYear>) => void
  addCollegeExpenseLine: (yearId: string, category: CollegeExpenseCategory) => void
  updateCollegeExpenseLine: (yearId: string, lineId: string, updates: Partial<CollegeExpenseLine>) => void
  deleteCollegeExpenseLine: (yearId: string, lineId: string) => void
  addCollegeContributionLine: (yearId: string) => void
  updateCollegeContributionLine: (yearId: string, lineId: string, updates: Partial<CollegeContributionLine>) => void
  deleteCollegeContributionLine: (yearId: string, lineId: string) => void
  copyForecastLinesDown: (yearId: string, kind: 'expense' | 'contribution') => void

  // UI preferences (persistent across sessions, synced via Supabase)
  uiPrefs: UiPrefs
  setUiPrefs: (updates: Partial<UiPrefs>) => void
  setCollegeYearUi: (yearId: string, updates: Partial<UiPrefs['collegeYearUi'][string]>) => void
  setWealthAccountExpanded: (accountId: string, expanded: boolean) => void
  setPeriodExpanded: (periodId: string, expanded: boolean) => void
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const SEED_QUICK_LINKS: QuickLink[] = [
  { id: 'ql1', name: 'Bank of America',  url: 'https://www.bankofamerica.com' },
  { id: 'ql2', name: 'Barclays Card',    url: '' },
  { id: 'ql3', name: 'Spectrum FCU',     url: '' },
  { id: 'ql4', name: 'Y-12 FCU',         url: '' },
  { id: 'ql5', name: 'Schwab',           url: 'https://client.schwab.com' },
  { id: 'ql6', name: 'Texas 529',        url: '' },
  { id: 'ql7', name: 'Wells Fargo',      url: 'https://www.wellsfargo.com' },
]

const SEED_BILLS: Bill[] = [
  { id: 'b1', name: 'Mortgage',           amount: 2919, dueDayOfMonth: 6,  frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b2', name: 'Credit Card',        amount: 4500, dueDayOfMonth: 14, frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b3', name: 'Auto Loan',          amount: 526,  dueDayOfMonth: 4,  frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b4', name: 'Gas Bill',           amount: 200,  dueDayOfMonth: 6,  frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b5', name: 'Life Insurance - B', amount: 136,  dueDayOfMonth: 14, frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b6', name: 'Life Insurance - R', amount: 20,   dueDayOfMonth: 20, frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b7', name: 'YMCA',               amount: 51,   dueDayOfMonth: 2,  frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b8', name: 'Planet Fit',         amount: 46,   dueDayOfMonth: 17, frequency: 'monthly', dueMonths: [], category: 'fixed',   active: true },
  { id: 'b9',  name: 'Kids Savings',          amount: 200, dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'savings',  active: true },
  { id: 'b10', name: 'Individual Allowance',  amount: 100, dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'variable', active: true },
  { id: 'b11', name: 'Groceries',             amount: 400, dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'variable', active: true },
  { id: 'b12', name: 'Gas',                   amount: 50,  dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'variable', active: true },
  { id: 'b13', name: 'Meals Out',             amount: 100, dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'variable', active: true },
  { id: 'b14', name: 'Misc',                  amount: 100, dueDayOfMonth: null, frequency: 'monthly', dueMonths: [], category: 'variable', active: true },
]

const SEED_WEALTH_ACCOUNTS: WealthAccount[] = [
  { id: 'wa1',  institution: 'Spec', name: 'Safety Net',         type: 'money_market',    category: 'emergency',  balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa2',  institution: 'Spec', name: 'Travel',             type: 'money_market',    category: 'spending',   balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa3',  institution: 'Spec', name: 'Emergency Repair',   type: 'money_market',    category: 'emergency',  balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa4',  institution: 'Spec', name: 'Planned Updates',    type: 'money_market',    category: 'emergency',  balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa5',  institution: 'Spec', name: 'Miscellaneous',      type: 'money_market',    category: 'spending',   balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa6',  institution: 'Spec', name: 'Available to Invest',type: 'money_market',    category: 'investment', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa7',  institution: 'Spec', name: 'CD',                 type: 'cd',              category: 'spending',   balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa8',  institution: 'Spec', name: 'Kids',               type: 'savings',         category: 'kids',       balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa9',  institution: 'Wells',name: 'Savings',            type: 'savings',         category: 'emergency',  balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa10', institution: 'Chuck',name: 'Rachel Roth',        type: 'roth_ira',        category: 'retirement', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: true, collegeKidId: null },
  { id: 'wa11', institution: 'Chuck',name: 'Bryan Roth',         type: 'roth_ira',        category: 'retirement', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: true, collegeKidId: null },
  { id: 'wa12', institution: 'Chuck',name: 'IRA',                type: 'traditional_ira', category: 'retirement', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: true, collegeKidId: null },
  { id: 'wa13', institution: 'Chuck',name: 'Brokerage',          type: 'brokerage',       category: 'retirement', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: true, collegeKidId: null },
  { id: 'wa14', institution: 'Company', name: 'Trust & Thrift',  type: '401k',            category: 'retirement', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: true, collegeKidId: null },
  { id: 'wa15', institution: 'Public',  name: 'E-Account',       type: 'brokerage',       category: 'investment', balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
  { id: 'wa16', institution: 'Texas College Savings', name: '529', type: '529',           category: 'college',    balance: 1, balanceDate: '2026-05-01', notes: '', includeInProjections: false, collegeKidId: null },
]

const SEED_COLLEGE_KIDS: CollegeKid[] = [
  { id: 'ck1', name: 'Kid 1', freshmanStartYear: 2026 },
  { id: 'ck2', name: 'Kid 2', freshmanStartYear: 2030 },
  { id: 'ck3', name: 'Kid 3', freshmanStartYear: 2034 },
]

const DEFAULT_PAY_AMOUNT = 6400
const DEFAULT_PAY_ANCHOR = '2026-04-30'
const DEFAULT_PAY_FREQ: PayFrequency = 'biweekly'
const PAST_PERIODS_SEED = 8

function seedStartDate(anchorDate: string, freq: PayFrequency): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let d = anchorDate
  while (true) {
    const next = nextPeriodStart(d, freq)
    if (new Date(next + 'T00:00:00') > today) break
    d = next
  }
  return d
}

function buildSeedPeriods(
  payAmount: number,
  anchorDate: string,
  freq: PayFrequency,
): PayPeriod[] {
  const currentStart = seedStartDate(anchorDate, freq)

  // Walk back PAST_PERIODS_SEED periods
  let start = currentStart
  for (let i = 0; i < PAST_PERIODS_SEED; i++) {
    start = prevPeriodStart(start, freq)
  }

  const periods: PayPeriod[] = []
  for (let i = 0; i < PAST_PERIODS_SEED + 8; i++) {
    periods.push({
      id: start,
      startDate: start,
      payAmount,
      openingBalance: start === currentStart ? 3932 + payAmount : null,
    })
    start = nextPeriodStart(start, freq)
  }
  return periods
}

export const useStore = create<State>()(
  (set, get) => ({
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      hydrate: (data) => set(data as State),
      bills: SEED_BILLS,
      periods: buildSeedPeriods(DEFAULT_PAY_AMOUNT, DEFAULT_PAY_ANCHOR, DEFAULT_PAY_FREQ),
      periodItems: [],
      extras: [],
      defaultPayAmount: DEFAULT_PAY_AMOUNT,
      payFrequency: DEFAULT_PAY_FREQ,
      payAnchorDate: DEFAULT_PAY_ANCHOR,
      quickLinks: SEED_QUICK_LINKS,
      periodsVisible: 2,
      periodsWindowDate: null,
      quickLinksDocked: true,
      periodActuals: [],
      ccAnalyses: [],
      ccMerchantMemory: {},
      ghostMode: false,
      wealthAccounts: SEED_WEALTH_ACCOUNTS,
      accountAdjustments: [],
      projectionCalcAccounts: [],
      projectionSnapshots: [],
      retirementPlan: { expenses: [], socialSecurityAnnual: 0, portfolioReturnRate: 0.05, savingsSource: 'accounts', snapshotId: null, snapshotMilestone: null, useSnapshotActual: false },
      collegeKids: SEED_COLLEGE_KIDS,
      collegeFVAccounts: [],
      collegeForecastYears: [],

      uiPrefs: {
        currentModule: 'budget',
        ccSelectedId: null,
        ccRecurringOpen: true,
        ccOneOffOpen: true,
        ccAllTxOpen: false,
        ccExpandedCats: [],
        collegeYearUi: {},
        wealthAccountExpanded: {},
        wealthExpandLevel: 2,
        periodExpanded: {},
      },
      setUiPrefs: (updates) =>
        set(s => ({ uiPrefs: { ...s.uiPrefs, ...updates } })),
      setCollegeYearUi: (yearId, updates) =>
        set(s => {
          const existing = s.uiPrefs.collegeYearUi[yearId] ?? { collapsed: false, contribsOpen: true, expensesOpen: true }
          return {
            uiPrefs: {
              ...s.uiPrefs,
              collegeYearUi: {
                ...s.uiPrefs.collegeYearUi,
                [yearId]: { ...existing, ...updates },
              },
            },
          }
        }),
      setWealthAccountExpanded: (accountId, expanded) =>
        set(s => ({
          uiPrefs: {
            ...s.uiPrefs,
            wealthAccountExpanded: { ...s.uiPrefs.wealthAccountExpanded, [accountId]: expanded },
          },
        })),
      setPeriodExpanded: (periodId, expanded) =>
        set(s => ({
          uiPrefs: {
            ...s.uiPrefs,
            periodExpanded: { ...s.uiPrefs.periodExpanded, [periodId]: expanded },
          },
        })),

      setPaySettings: (s) => {
        set(state => ({
          defaultPayAmount: s.defaultPayAmount ?? state.defaultPayAmount,
          payFrequency: s.payFrequency ?? state.payFrequency,
          payAnchorDate: s.payAnchorDate ?? state.payAnchorDate,
        }))
      },

      regeneratePeriods: () => {
        const { defaultPayAmount, payAnchorDate, payFrequency } = get()
        const periods = buildSeedPeriods(defaultPayAmount, payAnchorDate, payFrequency)
        set({ periods, periodItems: [], extras: [], periodActuals: [], periodsWindowDate: null })
      },

      setGhostMode: (enabled) => set({ ghostMode: enabled }),

      addBill: (bill) =>
        set(s => ({ bills: [...s.bills, { ...bill, id: uid() }] })),

      updateBill: (id, updates) =>
        set(s => ({ bills: s.bills.map(b => b.id === id ? { ...b, ...updates } : b) })),

      deleteBill: (id) =>
        set(s => ({
          bills: s.bills.filter(b => b.id !== id),
          periodItems: s.periodItems.filter(i => i.billId !== id),
        })),

      ensureFuturePeriods: (count = 6) => {
        const { periods, defaultPayAmount, payFrequency } = get()
        const today = new Date().toISOString().split('T')[0]
        const futureCount = periods.filter(p => p.startDate >= today).length
        if (futureCount >= count) return
        const last = periods[periods.length - 1]
        const toAdd: PayPeriod[] = []
        let startDate = nextPeriodStart(last.startDate, payFrequency)
        while (futureCount + toAdd.length < count) {
          toAdd.push({ id: startDate, startDate, payAmount: defaultPayAmount, openingBalance: null })
          startDate = nextPeriodStart(startDate, payFrequency)
        }
        set(s => ({ periods: [...s.periods, ...toAdd] }))
      },

      ensurePastPeriods: (count = PAST_PERIODS_SEED) => {
        const { periods, defaultPayAmount, payFrequency } = get()
        const today = new Date().toISOString().split('T')[0]
        const pastCount = periods.filter(p => p.startDate < today).length
        if (pastCount >= count) return
        const oldest = periods[0]
        const toAdd: PayPeriod[] = []
        let startDate = prevPeriodStart(oldest.startDate, payFrequency)
        while (pastCount + toAdd.length < count) {
          toAdd.unshift({ id: startDate, startDate, payAmount: defaultPayAmount, openingBalance: null })
          startDate = prevPeriodStart(startDate, payFrequency)
        }
        if (toAdd.length > 0) {
          set(s => ({ periods: [...toAdd, ...s.periods] }))
        }
      },

      updatePeriod: (id, updates) =>
        set(s => ({ periods: s.periods.map(p => p.id === id ? { ...p, ...updates } : p) })),

      ensurePeriodItems: (periodId) => {
        const { bills, periods, periodItems, payFrequency } = get()
        const period = periods.find(p => p.id === periodId)
        if (!period) return

        const existingBillIds = new Set(
          periodItems.filter(i => i.periodId === periodId).map(i => i.billId)
        )

        const toAdd: PeriodItem[] = []
        for (const bill of bills) {
          if (!bill.active || existingBillIds.has(bill.id)) continue
          if (billIncludedInPeriod(bill, period.startDate, payFrequency)) {
            toAdd.push({
              id: `${periodId}-${bill.id}`,
              periodId,
              billId: bill.id,
              paid: false,
              actualAmount: null,
              dismissed: false,
            })
          }
        }

        if (toAdd.length > 0) {
          set(s => ({ periodItems: [...s.periodItems, ...toAdd] }))
        }
      },

      togglePaid: (itemId) =>
        set(s => ({
          periodItems: s.periodItems.map(i =>
            i.id === itemId ? { ...i, paid: !i.paid } : i
          ),
        })),

      setActualAmount: (itemId, amount) =>
        set(s => ({
          periodItems: s.periodItems.map(i =>
            i.id === itemId ? { ...i, actualAmount: amount } : i
          ),
        })),

      dismissPeriodItem: (itemId) =>
        set(s => ({
          periodItems: s.periodItems.map(i =>
            i.id === itemId ? { ...i, dismissed: true } : i
          ),
        })),

      addExtra: (extra) =>
        set(s => ({ extras: [...s.extras, { ...extra, id: uid() }] })),

      updateExtra: (id, updates) =>
        set(s => ({ extras: s.extras.map(e => e.id === id ? { ...e, ...updates } : e) })),

      deleteExtra: (id) =>
        set(s => ({ extras: s.extras.filter(e => e.id !== id) })),

      toggleExtraPaid: (id) =>
        set(s => ({
          extras: s.extras.map(e => e.id === id ? { ...e, paid: !e.paid } : e),
        })),

      addQuickLink: (link) =>
        set(s => ({ quickLinks: [...s.quickLinks, { ...link, id: uid() }] })),

      updateQuickLink: (id, updates) =>
        set(s => ({ quickLinks: s.quickLinks.map(l => l.id === id ? { ...l, ...updates } : l) })),

      deleteQuickLink: (id) =>
        set(s => ({ quickLinks: s.quickLinks.filter(l => l.id !== id) })),

      setPeriodsVisible: (n) => set({ periodsVisible: n }),
      setPeriodsWindowDate: (date) => set({ periodsWindowDate: date }),
      setQuickLinksDocked: (docked) => set({ quickLinksDocked: docked }),

      setPeriodActuals: (periodId, entries, statementRange) =>
        set(s => ({
          periodActuals: [
            ...s.periodActuals.filter(a => a.periodId !== periodId),
            { periodId, savedAt: new Date().toISOString().split('T')[0], statementRange, entries },
          ],
        })),

      clearPeriodActuals: (periodId) =>
        set(s => ({ periodActuals: s.periodActuals.filter(a => a.periodId !== periodId) })),

      saveCCAnalysis: (analysis) =>
        set(s => {
          const incoming: CCMerchantMemory = {}
          for (const tx of analysis.transactions) {
            const key = tx.description.toUpperCase().trim()
            incoming[key] = {
              category: tx.category,
              isRecurring: tx.isRecurring,
              person: tx.person,
              lastSeen: analysis.id,
            }
          }
          return {
            ccAnalyses: [...s.ccAnalyses.filter(a => a.id !== analysis.id), analysis],
            // Merge: new entries win so fresh analysis data is authoritative
            ccMerchantMemory: { ...s.ccMerchantMemory, ...incoming },
          }
        }),

      mergeCCMerchantMemory: (entries) =>
        set(s => ({ ccMerchantMemory: { ...s.ccMerchantMemory, ...entries } })),

      updateCCTransaction: (analysisId, txId, updates) =>
        set(s => {
          const analysis = s.ccAnalyses.find(a => a.id === analysisId)
          const tx = analysis?.transactions.find(t => t.id === txId)
          const memoryUpdates: CCMerchantMemory = {}
          if (tx && (updates.category !== undefined || updates.isRecurring !== undefined || updates.person !== undefined)) {
            const key = tx.description.toUpperCase().trim()
            const existing = s.ccMerchantMemory[key]
            const entry: MerchantMemoryEntry = {
              category: updates.category ?? existing?.category ?? tx.category,
              isRecurring: updates.isRecurring ?? existing?.isRecurring ?? tx.isRecurring,
              person: (updates.person ?? existing?.person ?? tx.person) as MerchantMemoryEntry['person'],
              lastSeen: analysisId,
            }
            memoryUpdates[key] = entry
          }
          return {
            ccAnalyses: s.ccAnalyses.map(a =>
              a.id !== analysisId ? a : {
                ...a,
                transactions: a.transactions.map(t => t.id !== txId ? t : { ...t, ...updates }),
              }
            ),
            ccMerchantMemory: { ...s.ccMerchantMemory, ...memoryUpdates },
          }
        }),

      dismissCCSuggestion: (analysisId, suggestionId) =>
        set(s => ({
          ccAnalyses: s.ccAnalyses.map(a =>
            a.id !== analysisId ? a : {
              ...a,
              reductionSuggestions: a.reductionSuggestions.map(sg =>
                sg.id !== suggestionId ? sg : { ...sg, dismissed: true }
              ),
            }
          ),
        })),

      deleteCCAnalysis: (id) =>
        set(s => ({ ccAnalyses: s.ccAnalyses.filter(a => a.id !== id) })),

      resetStore: () =>
        set({
          bills: SEED_BILLS,
          periods: buildSeedPeriods(DEFAULT_PAY_AMOUNT, DEFAULT_PAY_ANCHOR, DEFAULT_PAY_FREQ),
          periodItems: [],
          extras: [],
          defaultPayAmount: DEFAULT_PAY_AMOUNT,
          payFrequency: DEFAULT_PAY_FREQ,
          payAnchorDate: DEFAULT_PAY_ANCHOR,
          periodsVisible: 2,
          periodsWindowDate: null,
          periodActuals: [],
          wealthAccounts: [],
          projectionCalcAccounts: [],
          projectionSnapshots: [],
          retirementPlan: { expenses: [], socialSecurityAnnual: 0, portfolioReturnRate: 0.05, savingsSource: 'accounts', snapshotId: null, snapshotMilestone: null, useSnapshotActual: false },
          collegeKids: SEED_COLLEGE_KIDS,
          collegeFVAccounts: [],
          collegeForecastYears: [],
        }),

      resetPeriod: (periodId) =>
        set(s => ({
          periodItems: s.periodItems.map(i =>
            i.periodId === periodId ? { ...i, paid: false, actualAmount: null, dismissed: false } : i
          ),
          extras: s.extras.filter(e => e.periodId !== periodId),
          periodActuals: s.periodActuals.filter(a => a.periodId !== periodId),
          periods: s.periods.map(p =>
            p.id === periodId ? { ...p, openingBalance: null, payAmount: s.defaultPayAmount } : p
          ),
        })),

      addWealthAccount: (a) =>
        set(s => ({ wealthAccounts: [...s.wealthAccounts, { ...a, id: uid() }] })),
      updateWealthAccount: (id, updates) =>
        set(s => ({ wealthAccounts: s.wealthAccounts.map(a => a.id === id ? { ...a, ...updates } : a) })),
      deleteWealthAccount: (id) =>
        set(s => ({
          wealthAccounts: s.wealthAccounts.filter(a => a.id !== id),
          accountAdjustments: s.accountAdjustments.filter(a => a.accountId !== id),
          projectionCalcAccounts: s.projectionCalcAccounts.map(c =>
            c.linkedAccountId === id ? { ...c, linkedAccountId: null } : c
          ),
          collegeFVAccounts: s.collegeFVAccounts.map(c =>
            c.linkedAccountId === id ? { ...c, linkedAccountId: null } : c
          ),
        })),

      addAccountAdjustment: (a) =>
        set(s => ({ accountAdjustments: [...s.accountAdjustments, { ...a, id: uid() }] })),
      updateAccountAdjustment: (id, updates) =>
        set(s => ({ accountAdjustments: s.accountAdjustments.map(a => a.id === id ? { ...a, ...updates } : a) })),
      deleteAccountAdjustment: (id) =>
        set(s => ({ accountAdjustments: s.accountAdjustments.filter(a => a.id !== id) })),

      addCalcAccount: (a) =>
        set(s => ({ projectionCalcAccounts: [...s.projectionCalcAccounts, { ...a, id: uid() }] })),
      updateCalcAccount: (id, updates) =>
        set(s => ({ projectionCalcAccounts: s.projectionCalcAccounts.map(c => c.id === id ? { ...c, ...updates } : c) })),
      deleteCalcAccount: (id) =>
        set(s => ({ projectionCalcAccounts: s.projectionCalcAccounts.filter(c => c.id !== id) })),

      addSnapshot: (snap) =>
        set(s => ({ projectionSnapshots: [...s.projectionSnapshots, { ...snap, id: uid() }] })),
      updateSnapshotMilestone: (snapshotId, milestoneLabel, updates) =>
        set(s => ({
          projectionSnapshots: s.projectionSnapshots.map(sn =>
            sn.id !== snapshotId ? sn : {
              ...sn,
              milestones: sn.milestones.map(m => m.label === milestoneLabel ? { ...m, ...updates } : m),
            }
          ),
        })),
      deleteSnapshot: (id) =>
        set(s => ({ projectionSnapshots: s.projectionSnapshots.filter(sn => sn.id !== id) })),

      updateRetirementPlan: (updates) =>
        set(s => ({ retirementPlan: { ...s.retirementPlan, ...updates } })),
      addRetirementExpense: (e) =>
        set(s => ({ retirementPlan: { ...s.retirementPlan, expenses: [...s.retirementPlan.expenses, { ...e, id: uid() }] } })),
      updateRetirementExpense: (id, updates) =>
        set(s => ({ retirementPlan: { ...s.retirementPlan, expenses: s.retirementPlan.expenses.map(e => e.id === id ? { ...e, ...updates } : e) } })),
      deleteRetirementExpense: (id) =>
        set(s => ({ retirementPlan: { ...s.retirementPlan, expenses: s.retirementPlan.expenses.filter(e => e.id !== id) } })),

      addCollegeKid: (kid) =>
        set(s => ({ collegeKids: [...s.collegeKids, { ...kid, id: uid() }] })),
      updateCollegeKid: (id, updates) =>
        set(s => ({ collegeKids: s.collegeKids.map(k => k.id === id ? { ...k, ...updates } : k) })),
      deleteCollegeKid: (id) =>
        set(s => {
          const removedFVIds = new Set(s.collegeFVAccounts.filter(c => c.kidId === id).map(c => c.id))
          return {
            collegeKids: s.collegeKids.filter(k => k.id !== id),
            wealthAccounts: s.wealthAccounts.map(a =>
              a.collegeKidId === id ? { ...a, collegeKidId: null } : a
            ),
            collegeFVAccounts: s.collegeFVAccounts.filter(c => c.kidId !== id),
            collegeForecastYears: s.collegeForecastYears.filter(y => !removedFVIds.has(y.fvAccountId)),
          }
        }),

      addCollegeFVAccount: (a) =>
        set(s => ({ collegeFVAccounts: [...s.collegeFVAccounts, { ...a, id: uid() }] })),
      updateCollegeFVAccount: (id, updates) =>
        set(s => ({ collegeFVAccounts: s.collegeFVAccounts.map(c => c.id === id ? { ...c, ...updates } : c) })),
      deleteCollegeFVAccount: (id) =>
        set(s => ({
          collegeFVAccounts: s.collegeFVAccounts.filter(c => c.id !== id),
          collegeForecastYears: s.collegeForecastYears.filter(y => y.fvAccountId !== id),
        })),

      ensureCollegeForecastYears: (fvAccountId) => {
        const existing = get().collegeForecastYears.filter(y => y.fvAccountId === fvAccountId)
        const existingIdx = new Set(existing.map(y => y.yearIndex))
        const toAdd: CollegeForecastYear[] = []
        for (const i of [0, 1, 2, 3] as const) {
          if (!existingIdx.has(i)) {
            toAdd.push({
              id: `${fvAccountId}:${i}`,
              fvAccountId,
              yearIndex: i,
              contributionLines: [],
              expenseLines: [],
              actualEndBalance: null,
              closedOut: false,
            })
          }
        }
        if (toAdd.length > 0) {
          set(s => ({ collegeForecastYears: [...s.collegeForecastYears, ...toAdd] }))
        }
      },

      updateCollegeForecastYear: (id, updates) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id === id ? { ...y, ...updates } : y
          ),
        })),

      addCollegeExpenseLine: (yearId, category) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              expenseLines: [
                ...y.expenseLines,
                { id: uid(), category, customLabel: '', amount: 0, startMonth: 8, months: 1 },
              ],
            }
          ),
        })),

      updateCollegeExpenseLine: (yearId, lineId, updates) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              expenseLines: y.expenseLines.map(l =>
                l.id === lineId ? { ...l, ...updates } : l
              ),
            }
          ),
        })),

      deleteCollegeExpenseLine: (yearId, lineId) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              expenseLines: y.expenseLines.filter(l => l.id !== lineId),
            }
          ),
        })),

      addCollegeContributionLine: (yearId) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              contributionLines: [
                ...y.contributionLines,
                { id: uid(), label: '', amount: 0, startMonth: 7, months: 12 },
              ],
            }
          ),
        })),

      updateCollegeContributionLine: (yearId, lineId, updates) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              contributionLines: y.contributionLines.map(l =>
                l.id === lineId ? { ...l, ...updates } : l
              ),
            }
          ),
        })),

      deleteCollegeContributionLine: (yearId, lineId) =>
        set(s => ({
          collegeForecastYears: s.collegeForecastYears.map(y =>
            y.id !== yearId ? y : {
              ...y,
              contributionLines: y.contributionLines.filter(l => l.id !== lineId),
            }
          ),
        })),

      copyForecastLinesDown: (yearId, kind) =>
        set(s => {
          const source = s.collegeForecastYears.find(y => y.id === yearId)
          if (!source) return {}
          const targets = new Set(
            s.collegeForecastYears
              .filter(y => y.fvAccountId === source.fvAccountId && y.yearIndex > source.yearIndex && !y.closedOut)
              .map(t => t.id)
          )
          if (targets.size === 0) return {}
          return {
            collegeForecastYears: s.collegeForecastYears.map(y => {
              if (!targets.has(y.id)) return y
              if (kind === 'expense') {
                return { ...y, expenseLines: [...y.expenseLines, ...source.expenseLines.map(l => ({ ...l, id: uid() }))] }
              }
              return { ...y, contributionLines: [...y.contributionLines, ...source.contributionLines.map(l => ({ ...l, id: uid() }))] }
            }),
          }
        }),
    })
)
