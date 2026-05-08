import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useFormatCurrency } from '../lib/useFormatCurrency'
import { computeFV } from '../lib/wealth'
import type { CollegeKid, CollegeFVAccount, WealthAccount, CollegeForecastYear, CollegeExpenseLine, CollegeExpenseCategory } from '../types'

const inputCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400 w-full'
const CLASS_LABELS = ['Fr', 'So', 'Jr', 'Sr']

const EXPENSE_CATEGORIES: { value: CollegeExpenseCategory; label: string }[] = [
  { value: 'tuition',          label: 'Tuition' },
  { value: 'room_board',       label: 'Room & Board' },
  { value: 'meal_plan',        label: 'Meal Plan' },
  { value: 'books',            label: 'Books & Supplies' },
  { value: 'fees',             label: 'Fees' },
  { value: 'travel',           label: 'Travel' },
  { value: 'health_insurance', label: 'Health Insurance' },
  { value: 'personal',         label: 'Personal' },
  { value: 'other',            label: 'Other' },
  { value: 'custom',           label: 'Custom…' },
]

function yearLabel(start: number, i: number): string {
  const s = start + i
  const e = String((s + 1) % 100).padStart(2, '0')
  return `${s}–${e} (${CLASS_LABELS[i]})`
}

function computeYearForecast(begin: number, rate: number, contribution: number, expenses: number) {
  const netFlow = contribution - expenses
  const growth = begin * rate + netFlow * rate * 0.5
  const end = begin + growth + netFlow
  return { growth, end }
}

function yearsUntil(freshmanStartYear: number): number {
  return Math.max(0, freshmanStartYear - new Date().getFullYear())
}

function FVCard({ row, wealthAccounts, years }: {
  row: CollegeFVAccount
  wealthAccounts: WealthAccount[]
  years: number
}) {
  const fmt = useFormatCurrency()
  const updateCollegeFVAccount = useStore(s => s.updateCollegeFVAccount)
  const deleteCollegeFVAccount = useStore(s => s.deleteCollegeFVAccount)

  const linked = row.linkedAccountId ? wealthAccounts.find(a => a.id === row.linkedAccountId) : null
  const pv = linked?.balance ?? row.presentValue
  const fv = computeFV(pv, row.annualRate, row.annualContribution, row.periodsPerYear, years)

  return (
    <div className="bg-slate-700/30 rounded-lg border border-slate-700/50 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input
          className={`${inputCls} flex-1`}
          value={row.name}
          onChange={e => updateCollegeFVAccount(row.id, { name: e.target.value })}
          placeholder="Account name"
        />
        <button
          type="button"
          onClick={() => deleteCollegeFVAccount(row.id)}
          className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">PV</div>
          {linked ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/40 border border-slate-700">
              <span className="text-xs text-slate-300 tabular-nums truncate">{fmt(linked.balance)}</span>
              <button
                type="button"
                onClick={() => updateCollegeFVAccount(row.id, { linkedAccountId: null })}
                className="text-slate-600 hover:text-red-400 text-xs ml-auto"
                title="Unlink"
              >⊗</button>
            </div>
          ) : (
            <input
              className={inputCls}
              value={row.presentValue === 0 ? '' : row.presentValue}
              onChange={e => updateCollegeFVAccount(row.id, { presentValue: parseFloat(e.target.value) || 0 })}
              placeholder="$0"
            />
          )}
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Rate</div>
          <div className="relative">
            <input
              className={`${inputCls} pr-5`}
              value={row.annualRate === 0 ? '' : (row.annualRate * 100).toFixed(row.annualRate * 100 % 1 === 0 ? 0 : 1)}
              onChange={e => updateCollegeFVAccount(row.id, { annualRate: (parseFloat(e.target.value) || 0) / 100 })}
              placeholder="6"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">%</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Contrib/yr</div>
          <input
            className={inputCls}
            value={row.annualContribution === 0 ? '' : row.annualContribution}
            onChange={e => updateCollegeFVAccount(row.id, { annualContribution: parseFloat(e.target.value) || 0 })}
            placeholder="$0"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-700/60 pt-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          FV {years > 0 ? `(${years}yr)` : '(now)'}
        </span>
        <span className="text-sm font-bold text-emerald-300 tabular-nums">{fmt(fv)}</span>
      </div>
    </div>
  )
}

function FVSection({ kid }: { kid: CollegeKid }) {
  const fmt = useFormatCurrency()
  const fvAccounts = useStore(s => s.collegeFVAccounts)
  const wealthAccounts = useStore(s => s.wealthAccounts)
  const addCollegeFVAccount = useStore(s => s.addCollegeFVAccount)

  const rows = fvAccounts.filter(c => c.kidId === kid.id)
  const years = yearsUntil(kid.freshmanStartYear)

  // 529 accounts tagged to this kid that aren't yet in the FV calc
  const linkedIds = new Set(rows.map(r => r.linkedAccountId).filter(Boolean))
  const available = wealthAccounts.filter(a =>
    a.collegeKidId === kid.id && !linkedIds.has(a.id)
  )

  const totalFV = rows.reduce((sum, r) => {
    const linked = r.linkedAccountId ? wealthAccounts.find(a => a.id === r.linkedAccountId) : null
    const pv = linked?.balance ?? r.presentValue
    return sum + computeFV(pv, r.annualRate, r.annualContribution, r.periodsPerYear, years)
  }, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-slate-500 uppercase tracking-widest">FV Calculator</div>
        <div className="text-xs text-slate-500">
          {years > 0
            ? <>at start of <span className="text-slate-300 tabular-nums">{kid.freshmanStartYear}</span> · <span className="text-slate-300">{years}yr</span></>
            : <span className="text-slate-400">in college now</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-slate-600 italic px-1 py-2">
          No accounts yet — tag a 529 to {kid.name} in the Savings tab, or add manually below.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(r => (
              <FVCard key={r.id} row={r} wealthAccounts={wealthAccounts} years={years} />
            ))}
          </div>
          {rows.length > 1 && (
            <div className="flex items-center justify-between border-t border-slate-700/60 pt-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Total FV</span>
              <span className="text-base font-bold text-emerald-300 tabular-nums">{fmt(totalFV)}</span>
            </div>
          )}
        </>
      )}

      {/* Add buttons */}
      <div className="space-y-1.5 pt-1">
        {available.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {available.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => addCollegeFVAccount({
                  kidId: kid.id,
                  name: `${a.institution} ${a.name}`.trim(),
                  linkedAccountId: a.id,
                  presentValue: a.balance,
                  annualRate: 0.06,
                  annualContribution: 0,
                  periodsPerYear: 1,
                })}
                className="flex items-center gap-1 text-xs bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded-lg px-2.5 py-1 transition-colors"
                title="Add to FV calc"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {a.institution} {a.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => addCollegeFVAccount({
            kidId: kid.id,
            name: '',
            linkedAccountId: null,
            presentValue: 0,
            annualRate: 0.06,
            annualContribution: 0,
            periodsPerYear: 1,
          })}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors py-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add manually
        </button>
      </div>
    </div>
  )
}

function ExpenseLineRow({ yearId, line }: { yearId: string; line: CollegeExpenseLine }) {
  const updateCollegeExpenseLine = useStore(s => s.updateCollegeExpenseLine)
  const deleteCollegeExpenseLine = useStore(s => s.deleteCollegeExpenseLine)

  return (
    <div className="flex items-center gap-1.5">
      <select
        className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600 outline-none focus:border-blue-400 flex-1 min-w-0"
        value={line.category}
        onChange={e => updateCollegeExpenseLine(yearId, line.id, { category: e.target.value as CollegeExpenseCategory })}
      >
        {EXPENSE_CATEGORIES.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      {line.category === 'custom' && (
        <input
          className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600 outline-none focus:border-blue-400 flex-1 min-w-0"
          value={line.customLabel}
          onChange={e => updateCollegeExpenseLine(yearId, line.id, { customLabel: e.target.value })}
          placeholder="Label"
        />
      )}
      <input
        className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600 outline-none focus:border-blue-400 w-20 tabular-nums text-right"
        value={line.amount === 0 ? '' : line.amount}
        onChange={e => updateCollegeExpenseLine(yearId, line.id, { amount: parseFloat(e.target.value) || 0 })}
        placeholder="$0"
      />
      <button
        type="button"
        onClick={() => deleteCollegeExpenseLine(yearId, line.id)}
        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
        title="Remove"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function YearCard({
  year, beginBalance, rate, freshmanStartYear,
}: {
  year: CollegeForecastYear
  beginBalance: number
  rate: number
  freshmanStartYear: number
}) {
  const fmt = useFormatCurrency()
  const updateCollegeForecastYear = useStore(s => s.updateCollegeForecastYear)
  const addCollegeExpenseLine = useStore(s => s.addCollegeExpenseLine)

  const totalExpenses = year.expenseLines.reduce((sum, l) => sum + l.amount, 0)
  const { growth, end: forecastEnd } = computeYearForecast(beginBalance, rate, year.contribution, totalExpenses)
  const variance = year.actualEndBalance !== null ? year.actualEndBalance - forecastEnd : null

  return (
    <div className="bg-slate-700/30 rounded-lg border border-slate-700/50 p-2.5 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-300 tabular-nums">
          {yearLabel(freshmanStartYear, year.yearIndex)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">Begin</span>
        <span className="text-slate-300 tabular-nums text-right">{fmt(beginBalance)}</span>

        <span className="text-slate-500">Contribution</span>
        <input
          className="bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none focus:border-blue-400 tabular-nums text-right w-full"
          value={year.contribution === 0 ? '' : year.contribution}
          onChange={e => updateCollegeForecastYear(year.id, { contribution: parseFloat(e.target.value) || 0 })}
          placeholder="$0"
        />

        <span className="text-slate-500">Growth</span>
        <span className="text-slate-300 tabular-nums text-right">{fmt(growth)}</span>
      </div>

      <div className="space-y-1 pt-1 border-t border-slate-700/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Expenses</span>
          <span className="text-xs text-slate-400 tabular-nums">{fmt(totalExpenses)}</span>
        </div>
        {year.expenseLines.map(line => (
          <ExpenseLineRow key={line.id} yearId={year.id} line={line} />
        ))}
        <button
          type="button"
          onClick={() => addCollegeExpenseLine(year.id, 'tuition')}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-400 transition-colors py-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add expense
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1 border-t border-slate-700/60">
        <span className="text-slate-400 font-medium">Forecast end</span>
        <span className="text-emerald-300 tabular-nums text-right font-semibold">{fmt(forecastEnd)}</span>

        <span className="text-slate-500">Actual end</span>
        <input
          className="bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none focus:border-blue-400 tabular-nums text-right w-full"
          value={year.actualEndBalance === null ? '' : year.actualEndBalance}
          onChange={e => {
            const v = e.target.value
            updateCollegeForecastYear(year.id, { actualEndBalance: v === '' ? null : (parseFloat(v) || 0) })
          }}
          placeholder="—"
        />

        <span className="text-slate-500">Variance</span>
        <span className={`tabular-nums text-right ${
          variance === null ? 'text-slate-600'
            : variance >= 0 ? 'text-emerald-300' : 'text-red-300'
        }`}>
          {variance === null ? '—' : `${variance >= 0 ? '+' : ''}${fmt(variance)}`}
        </span>
      </div>
    </div>
  )
}

function AccountForecast({ account, kid }: { account: CollegeFVAccount; kid: CollegeKid }) {
  const wealthAccounts = useStore(s => s.wealthAccounts)
  const forecastYears = useStore(s => s.collegeForecastYears)
  const ensureCollegeForecastYears = useStore(s => s.ensureCollegeForecastYears)

  useEffect(() => {
    ensureCollegeForecastYears(account.id)
  }, [account.id, ensureCollegeForecastYears])

  const linked = account.linkedAccountId ? wealthAccounts.find(a => a.id === account.linkedAccountId) : null
  const pv = linked?.balance ?? account.presentValue
  const yearsUntilFreshman = Math.max(0, kid.freshmanStartYear - new Date().getFullYear())
  const startBalance = computeFV(pv, account.annualRate, account.annualContribution, account.periodsPerYear, yearsUntilFreshman)

  const years = [0, 1, 2, 3]
    .map(i => forecastYears.find(y => y.fvAccountId === account.id && y.yearIndex === i))
    .filter((y): y is CollegeForecastYear => Boolean(y))

  if (years.length < 4) return null  // ensure hasn't completed yet

  // Walk forward year by year so each year's begin = previous end
  const computed: { year: CollegeForecastYear; begin: number }[] = []
  let begin = startBalance
  for (const y of years) {
    computed.push({ year: y, begin })
    const totalExpenses = y.expenseLines.reduce((s, l) => s + l.amount, 0)
    const { end } = computeYearForecast(begin, account.annualRate, y.contribution, totalExpenses)
    begin = end
  }

  const accountLabel = account.name.trim() || (linked ? `${linked.institution} ${linked.name}` : 'Untitled account')

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-300 truncate">{accountLabel}</span>
        <span className="text-[10px] text-slate-500 tabular-nums">
          {(account.annualRate * 100).toFixed(account.annualRate * 100 % 1 === 0 ? 0 : 1)}%
        </span>
      </div>
      <div className="space-y-2">
        {computed.map(({ year, begin }) => (
          <YearCard
            key={year.id}
            year={year}
            beginBalance={begin}
            rate={account.annualRate}
            freshmanStartYear={kid.freshmanStartYear}
          />
        ))}
      </div>
    </div>
  )
}

function ForecastSection({ kid }: { kid: CollegeKid }) {
  const fvAccounts = useStore(s => s.collegeFVAccounts)
  const accounts = fvAccounts.filter(a => a.kidId === kid.id)

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 uppercase tracking-widest">Forecast vs Actual</div>
      {accounts.length === 0 ? (
        <div className="text-xs text-slate-600 italic px-1 py-2">
          Add an FV account above to see the 4-year forecast.
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map(a => <AccountForecast key={a.id} account={a} kid={kid} />)}
        </div>
      )}
    </div>
  )
}

function KidColumn({ kid }: { kid: CollegeKid }) {
  const updateCollegeKid = useStore(s => s.updateCollegeKid)
  const deleteCollegeKid = useStore(s => s.deleteCollegeKid)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(kid.name)
  const [editingYear, setEditingYear] = useState(false)
  const [yearDraft, setYearDraft] = useState(String(kid.freshmanStartYear))

  function commitName() {
    const n = nameDraft.trim()
    if (n) updateCollegeKid(kid.id, { name: n })
    setEditingName(false)
  }
  function commitYear() {
    const y = parseInt(yearDraft)
    if (!isNaN(y) && y > 1900 && y < 2200) updateCollegeKid(kid.id, { freshmanStartYear: y })
    setEditingYear(false)
  }

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-slate-700/50 px-5 py-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              className="bg-slate-700 text-white text-base font-semibold rounded px-2 py-1 border border-blue-500 outline-none w-full"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setNameDraft(kid.name); setEditingName(true) }}
              className="text-white font-semibold text-base hover:text-blue-300 transition-colors w-full text-left truncate"
              title="Rename"
            >
              {kid.name}
            </button>
          )}
          <div className="text-xs text-slate-400 mt-1">
            <span className="text-slate-500">Freshman year:</span>{' '}
            {editingYear ? (
              <input
                autoFocus
                className="bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 border border-blue-500 outline-none w-20 tabular-nums"
                value={yearDraft}
                onChange={e => setYearDraft(e.target.value)}
                onBlur={commitYear}
                onKeyDown={e => { if (e.key === 'Enter') commitYear(); if (e.key === 'Escape') setEditingYear(false) }}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setYearDraft(String(kid.freshmanStartYear)); setEditingYear(true) }}
                className="text-blue-300 hover:text-blue-200 transition-colors tabular-nums"
                title="Edit start year"
              >
                {kid.freshmanStartYear}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => deleteCollegeKid(kid.id)}
          className="text-slate-500 hover:text-red-400 transition-colors p-1 flex-shrink-0"
          title="Remove kid"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        <FVSection kid={kid} />
        <ForecastSection kid={kid} />
      </div>
    </div>
  )
}

export function CollegeModule() {
  const kids = useStore(s => s.collegeKids)
  const addCollegeKid = useStore(s => s.addCollegeKid)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg">College</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan each kid's 4-year college funding</p>
        </div>
        <button
          type="button"
          onClick={() => addCollegeKid({ name: `Kid ${kids.length + 1}`, freshmanStartYear: new Date().getFullYear() })}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 font-medium transition-colors"
        >
          + Add kid
        </button>
      </div>

      {kids.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm bg-slate-800/40 rounded-2xl">
          No kids yet — add one to start planning.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kids.map(k => <KidColumn key={k.id} kid={k} />)}
        </div>
      )}
    </div>
  )
}
