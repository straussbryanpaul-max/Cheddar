import type { AccountType, TaxTreatment } from '../types'

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

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  tax_free: 'Tax-Free',
  tax_deferred: 'Tax-Deferred',
  taxable: 'Taxable',
}

// Roth/HSA withdrawals are tax-free (already-taxed or qualified-medical); traditional
// retirement accounts are taxed as ordinary income on withdrawal; brokerage gains are
// taxed at capital-gains rates. Cash accounts are treated as already-taxed.
export function defaultTaxTreatment(accountType: AccountType): TaxTreatment {
  switch (accountType) {
    case 'roth_ira':
    case 'hsa':
      return 'tax_free'
    case 'traditional_ira':
    case '401k':
    case '403b':
      return 'tax_deferred'
    case 'brokerage':
      return 'taxable'
    default:
      return 'tax_free'
  }
}
