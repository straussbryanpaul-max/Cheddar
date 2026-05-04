import type { SnapshotMilestoneLabel } from '../types'

export function computeFV(
  presentValue: number,
  annualRate: number,
  annualContribution: number,
  periodsPerYear: number,
  years: number,
): number {
  if (years === 0) return presentValue
  if (annualRate === 0) return presentValue + annualContribution * years
  const rn = annualRate / periodsPerYear
  const factor = Math.pow(1 + rn, periodsPerYear * years)
  return presentValue * factor + (annualContribution / periodsPerYear) * (factor - 1) / rn
}

export const MILESTONE_YEARS: Record<SnapshotMilestoneLabel, number> = {
  Today: 0,
  '1yr': 1,
  '3yr': 3,
  '5yr': 5,
  '10yr': 10,
  '15yr': 15,
  '20yr': 20,
}

export const MILESTONE_LABELS: SnapshotMilestoneLabel[] = ['Today', '1yr', '3yr', '5yr', '10yr', '15yr', '20yr']

export function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().split('T')[0]
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  money_market: 'Money Market',
  cd: 'CD',
  roth_ira: 'Roth IRA',
  traditional_ira: 'Traditional IRA',
  '401k': '401(k)',
  '403b': '403(b)',
  brokerage: 'Brokerage',
  '529': '529',
  hsa: 'HSA',
  other: 'Other',
}

export const ACCOUNT_CATEGORY_LABELS: Record<string, string> = {
  emergency: 'Emergency',
  retirement: 'Retirement',
  college: 'College',
  investment: 'Investment',
  spending: 'Spending',
  kids: 'Kids',
  other: 'Other',
}

export const CATEGORY_ORDER = ['emergency', 'retirement', 'college', 'investment', 'spending', 'kids', 'other'] as const
