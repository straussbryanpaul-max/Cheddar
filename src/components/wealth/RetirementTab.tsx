import { useState } from 'react'
import { useStore } from '../../store'
import { formatCurrency } from '../../lib/periods'
import type { RetirementExpense } from '../../types'

const inputCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400'

function ExpenseForm({ initial, onSave, onCancel }: {
  initial: { name: string; monthlyAmount: string }
  onSave: (name: string, amount: number) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [amount, setAmount] = useState(initial.monthlyAmount)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!name.trim() || isNaN(amt)) return
    onSave(name.trim(), amt)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input
        autoFocus
        className={`${inputCls} flex-1`}
        placeholder="Expense name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className={`${inputCls} w-28 text-right`}
        placeholder="Monthly $"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 px-2 py-1">Cancel</button>
      <button type="submit" className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1 font-medium">Save</button>
    </form>
  )
}

function ExpenseRow({ expense, onEdit }: { expense: RetirementExpense; onEdit: () => void }) {
  const deleteRetirementExpense = useStore(s => s.deleteRetirementExpense)
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg group hover:bg-slate-700/30">
      <span className="text-sm text-slate-200">{expense.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-slate-300">{formatCurrency(expense.monthlyAmount)}<span className="text-slate-500 text-xs">/mo</span></span>
        <button onClick={onEdit} className="text-slate-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
          </svg>
        </button>
        <button onClick={() => deleteRetirementExpense(expense.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function RetirementTab() {
  const plan = useStore(s => s.retirementPlan)
  const wealthAccounts = useStore(s => s.wealthAccounts)
  const addRetirementExpense = useStore(s => s.addRetirementExpense)
  const updateRetirementExpense = useStore(s => s.updateRetirementExpense)
  const updateRetirementPlan = useStore(s => s.updateRetirementPlan)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingSS, setEditingSS] = useState(false)
  const [ssDraft, setSsDraft] = useState('')

  const monthlyTotal = plan.expenses.reduce((s, e) => s + e.monthlyAmount, 0)
  const annualExpenses = monthlyTotal * 12
  const annualNetDraw = Math.max(0, annualExpenses - plan.socialSecurityAnnual)
  const totalRetirementSavings = wealthAccounts
    .filter(a => a.category === 'retirement')
    .reduce((s, a) => s + a.balance, 0)
  const fundedYears = annualNetDraw > 0 ? totalRetirementSavings / annualNetDraw : null

  const fundedColor =
    fundedYears === null ? 'text-slate-400' :
    fundedYears > 25 ? 'text-emerald-400' :
    fundedYears > 15 ? 'text-yellow-400' :
    'text-red-400'

  function commitSS() {
    const val = parseFloat(ssDraft)
    if (!isNaN(val)) updateRetirementPlan({ socialSecurityAnnual: val })
    setEditingSS(false)
  }

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-slate-700/50 px-6 py-4">
        <h2 className="text-white font-semibold text-lg">Retirement Planning</h2>
        <p className="text-slate-400 text-sm mt-0.5">Monthly expenses + income at retirement</p>
      </div>

      {/* Monthly Expenses */}
      <div className="px-4 pt-4">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Monthly Expenses</div>
        <div className="space-y-0.5">
          {plan.expenses.map(e =>
            editingId === e.id ? (
              <div key={e.id} className="px-3">
                <ExpenseForm
                  initial={{ name: e.name, monthlyAmount: String(e.monthlyAmount) }}
                  onSave={(name, amount) => { updateRetirementExpense(e.id, { name, monthlyAmount: amount }); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <ExpenseRow key={e.id} expense={e} onEdit={() => setEditingId(e.id)} />
            )
          )}
        </div>
        <div className="px-3 py-2">
          {adding ? (
            <ExpenseForm
              initial={{ name: '', monthlyAmount: '' }}
              onSave={(name, amount) => { addRetirementExpense({ name, monthlyAmount: amount }); setAdding(false) }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-400 transition-colors py-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add expense
            </button>
          )}
        </div>
      </div>

      {/* Income */}
      <div className="px-4 pt-2">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-2">Annual Income</div>
        <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700/30">
          <span className="text-sm text-slate-200">Social Security</span>
          {editingSS ? (
            <input
              autoFocus
              className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-blue-500 outline-none w-32 text-right"
              value={ssDraft}
              onChange={e => setSsDraft(e.target.value)}
              onBlur={commitSS}
              onKeyDown={e => { if (e.key === 'Enter') commitSS(); if (e.key === 'Escape') setEditingSS(false) }}
            />
          ) : (
            <button
              onClick={() => { setSsDraft(String(plan.socialSecurityAnnual)); setEditingSS(true) }}
              className="text-sm text-slate-300 hover:text-blue-300 tabular-nums transition-colors"
            >
              {plan.socialSecurityAnnual > 0 ? formatCurrency(plan.socialSecurityAnnual) : <span className="text-slate-500">Set amount</span>}
              <span className="text-slate-500 text-xs ml-1">/yr</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 pt-4 pb-6">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-3">Summary</div>
        <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Monthly Expenses</div>
              <div className="text-lg font-semibold text-slate-200 tabular-nums">{formatCurrency(monthlyTotal)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Annual Expenses</div>
              <div className="text-lg font-semibold text-slate-200 tabular-nums">{formatCurrency(annualExpenses)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">SS Income</div>
              <div className="text-lg font-semibold text-emerald-300 tabular-nums">{formatCurrency(plan.socialSecurityAnnual)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Annual Net Draw</div>
              <div className="text-lg font-semibold text-slate-200 tabular-nums">{formatCurrency(annualNetDraw)}</div>
            </div>
          </div>

          <div className="border-t border-slate-600/50 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Total Retirement Savings</div>
                <div className="text-sm text-slate-400">From accounts tagged "Retirement"</div>
              </div>
              <div className="text-xl font-bold text-slate-200 tabular-nums">{formatCurrency(totalRetirementSavings)}</div>
            </div>
          </div>

          <div className="border-t border-slate-600/50 pt-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Funded Years of Retirement</div>
              <div className="text-xs text-slate-500">At current draw rate</div>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${fundedColor}`}>
              {fundedYears === null ? '∞' : `${fundedYears.toFixed(1)}`}
              {fundedYears !== null && <span className="text-lg font-normal ml-1">yrs</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
