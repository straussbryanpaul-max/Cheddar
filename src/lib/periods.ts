import type { Bill, PayPeriod, PeriodItem, Extra, PayFrequency } from '../types'

export function prevPeriodStart(startDate: string, freq: PayFrequency = 'biweekly'): string {
  const d = new Date(startDate + 'T00:00:00')
  switch (freq) {
    case 'weekly':
      d.setDate(d.getDate() - 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() - 14)
      break
    case 'semimonthly':
      if (d.getDate() === 15) {
        d.setDate(1)
      } else {
        d.setDate(0) // last day of prev month
        d.setDate(15)
      }
      break
    case 'monthly':
      d.setMonth(d.getMonth() - 1)
      break
  }
  return d.toISOString().split('T')[0]
}

export function nextPeriodStart(startDate: string, freq: PayFrequency = 'biweekly'): string {
  const d = new Date(startDate + 'T00:00:00')
  switch (freq) {
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14)
      break
    case 'semimonthly':
      if (d.getDate() < 15) {
        d.setDate(15)
      } else {
        d.setMonth(d.getMonth() + 1)
        d.setDate(1)
      }
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
  }
  return d.toISOString().split('T')[0]
}

export function periodEndDate(startDate: string, freq: PayFrequency = 'biweekly'): string {
  const end = new Date(nextPeriodStart(startDate, freq) + 'T00:00:00')
  end.setDate(end.getDate() - 1)
  return end.toISOString().split('T')[0]
}

// Given a quarterly start month (1-3), returns the 4 months it falls in
export function quarterlyMonths(startMonth: number): number[] {
  return [startMonth, startMonth + 3, startMonth + 6, startMonth + 9]
}

export function billIncludedInPeriod(bill: Bill, periodStart: string, freq: PayFrequency = 'biweekly'): boolean {
  if (bill.dueDayOfMonth === null) return true

  const start = new Date(periodStart + 'T00:00:00')
  const end = new Date(periodEndDate(periodStart, freq) + 'T00:00:00')

  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cur <= endMonth) {
    const month = cur.getMonth() + 1

    if (bill.dueMonths.length > 0 && !bill.dueMonths.includes(month)) {
      cur.setMonth(cur.getMonth() + 1)
      continue
    }

    const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    const day = Math.min(bill.dueDayOfMonth, daysInMonth)
    const candidate = new Date(cur.getFullYear(), cur.getMonth(), day)
    if (candidate >= start && candidate <= end) return true
    cur.setMonth(cur.getMonth() + 1)
  }
  return false
}

// Opening balance already includes this period's paycheck.
// Forecast = what you'll have left after all unpaid bills clear.
export function calcForecast(
  period: PayPeriod,
  items: PeriodItem[],
  bills: Bill[],
  extras: Extra[]
): number | null {
  if (period.openingBalance === null) return null

  const billMap = new Map(bills.map(b => [b.id, b]))

  const itemTotal = items
    .filter(i => !i.paid)
    .reduce((sum, item) => {
      const bill = billMap.get(item.billId)
      return sum + (item.actualAmount ?? bill?.amount ?? 0)
    }, 0)

  const extraTotal = extras
    .filter(e => !e.paid)
    .reduce((sum, e) => sum + e.amount, 0)

  return period.openingBalance - itemTotal - extraTotal
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Walks all periods in order and computes the effective opening balance for each,
// chaining forecast → next opening when openingBalance is null in the store.
export function buildProjectedOpenings(
  periods: PayPeriod[],
  allItems: PeriodItem[],
  allExtras: Extra[],
  bills: Bill[],
): Map<string, number | null> {
  const billMap = new Map(bills.map(b => [b.id, b]))
  const result = new Map<string, number | null>()

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    if (period.openingBalance !== null) {
      result.set(period.id, period.openingBalance)
    } else if (i > 0) {
      const prev = periods[i - 1]
      const prevOpening = result.get(prev.id) ?? null
      if (prevOpening !== null) {
        const prevEffective = { ...prev, openingBalance: prevOpening }
        const prevItems = allItems.filter(
          pi => pi.periodId === prev.id && !pi.dismissed && billMap.get(pi.billId)?.active
        )
        const prevExtras = allExtras.filter(e => e.periodId === prev.id)
        const prevForecast = calcForecast(prevEffective, prevItems, bills, prevExtras)
        result.set(period.id, prevForecast !== null ? prevForecast + period.payAmount : null)
      } else {
        result.set(period.id, null)
      }
    } else {
      result.set(period.id, null)
    }
  }

  return result
}

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  semimonthly: 'Twice a Month (1st & 15th)',
  monthly: 'Monthly',
}
