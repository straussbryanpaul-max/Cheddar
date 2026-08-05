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
