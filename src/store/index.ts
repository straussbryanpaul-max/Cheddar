import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bill, PayPeriod, PeriodItem, Extra, QuickLink, PayFrequency, PeriodActuals, ActualEntry } from '../types'
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
  periodActuals: PeriodActuals[]
  anthropicApiKey: string

  setPaySettings: (s: { defaultPayAmount?: number; payFrequency?: PayFrequency; payAnchorDate?: string }) => void
  regeneratePeriods: () => void
  setAnthropicApiKey: (key: string) => void

  addQuickLink: (link: Omit<QuickLink, 'id'>) => void
  updateQuickLink: (id: string, updates: Partial<QuickLink>) => void
  deleteQuickLink: (id: string) => void
  setPeriodsVisible: (n: number) => void
  setPeriodsWindowDate: (date: string | null) => void

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

  resetStore: () => void
  resetPeriod: (periodId: string) => void
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
  persist(
    (set, get) => ({
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
      periodActuals: [],
      anthropicApiKey: '',

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

      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),

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

      setPeriodActuals: (periodId, entries, statementRange) =>
        set(s => ({
          periodActuals: [
            ...s.periodActuals.filter(a => a.periodId !== periodId),
            { periodId, savedAt: new Date().toISOString().split('T')[0], statementRange, entries },
          ],
        })),

      clearPeriodActuals: (periodId) =>
        set(s => ({ periodActuals: s.periodActuals.filter(a => a.periodId !== periodId) })),

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
    }),
    {
      name: 'cheddar-store-v4',
      merge: (persisted, current) => {
        const p = persisted as Partial<State>
        const c = current as State
        // Inject any seed bills missing from persisted data (e.g. added after first load)
        const persistedBills = p.bills ?? []
        const persistedIds = new Set(persistedBills.map(b => b.id))
        const missingSeeds = SEED_BILLS.filter(b => !persistedIds.has(b.id))
        return {
          ...c,
          ...p,
          bills: [...persistedBills, ...missingSeeds],
          quickLinks: p.quickLinks ?? c.quickLinks,
          periodsVisible: p.periodsVisible ?? c.periodsVisible,
          anthropicApiKey: p.anthropicApiKey ?? c.anthropicApiKey,
          payFrequency: p.payFrequency ?? c.payFrequency,
          payAnchorDate: p.payAnchorDate ?? c.payAnchorDate,
          periodsWindowDate: p.periodsWindowDate ?? null,
          periodActuals: p.periodActuals ?? [],
        }
      },
    }
  )
)
