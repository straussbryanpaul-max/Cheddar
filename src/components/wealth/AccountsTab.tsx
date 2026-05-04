import { useState } from 'react'
import { useStore } from '../../store'
import { formatCurrency } from '../../lib/periods'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/wealth'
import type { WealthAccount, AccountType, AccountCategory, AccountAdjustment, AccountAdjustmentType } from '../../types'

const inputCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400'
const selectCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400'

const today = () => new Date().toISOString().split('T')[0]

interface FormState {
  institution: string
  name: string
  type: AccountType
  category: AccountCategory
  balance: string
  balanceDate: string
  notes: string
  includeInProjections: boolean
}

function defaultForm(a?: WealthAccount): FormState {
  return {
    institution: a?.institution ?? '',
    name: a?.name ?? '',
    type: a?.type ?? 'savings',
    category: a?.category ?? 'other',
    balance: a ? String(a.balance) : '',
    balanceDate: a?.balanceDate ?? today(),
    notes: a?.notes ?? '',
    includeInProjections: a?.includeInProjections ?? false,
  }
}

function AccountForm({ initial, onSave, onCancel }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.institution.trim() && !form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="bg-slate-700/40 rounded-xl p-4 border border-slate-600 space-y-3 my-1">
      <div className="flex gap-2">
        <input
          autoFocus
          className={`${inputCls} flex-1`}
          placeholder="Institution"
          value={form.institution}
          onChange={e => set({ institution: e.target.value })}
        />
        <input
          className={`${inputCls} flex-1`}
          placeholder="Account name"
          value={form.name}
          onChange={e => set({ name: e.target.value })}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <select className={selectCls} value={form.type} onChange={e => set({ type: e.target.value as AccountType })}>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={selectCls} value={form.category} onChange={e => set({ category: e.target.value as AccountCategory })}>
          {Object.entries(ACCOUNT_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input
          className={`${inputCls} w-32 text-right`}
          placeholder="Balance"
          value={form.balance}
          onChange={e => set({ balance: e.target.value })}
        />
        <input
          type="date"
          className={inputCls}
          value={form.balanceDate}
          onChange={e => set({ balanceDate: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={e => set({ notes: e.target.value })}
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={form.includeInProjections}
            onChange={e => set({ includeInProjections: e.target.checked })}
            className="accent-blue-500"
          />
          Projections
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 px-3 py-1">Cancel</button>
        <button type="submit" className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1 font-medium">Save</button>
      </div>
    </form>
  )
}

function AdjustmentRow({ adj }: { adj: AccountAdjustment }) {
  const deleteAccountAdjustment = useStore(s => s.deleteAccountAdjustment)
  const isPositive = adj.amount >= 0
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded group hover:bg-slate-700/20 text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-12 text-center rounded px-1 py-0.5 font-medium ${adj.type === 'actual' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>
          {adj.type}
        </span>
        <span className="text-slate-300">{adj.label}</span>
        <span className="text-slate-500">{adj.date}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`tabular-nums font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{formatCurrency(adj.amount)}
        </span>
        <button onClick={() => deleteAccountAdjustment(adj.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function AddAdjustmentForm({ accountId, onDone }: { accountId: string; onDone: () => void }) {
  const addAccountAdjustment = useStore(s => s.addAccountAdjustment)
  const [type, setType] = useState<AccountAdjustmentType>('actual')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || !label.trim()) return
    addAccountAdjustment({ accountId, type, label: label.trim(), amount: amt, date })
    setLabel(''); setAmount('')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap px-2 py-2 bg-slate-700/20 rounded-lg mt-1">
      <select
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400"
        value={type}
        onChange={e => setType(e.target.value as AccountAdjustmentType)}
      >
        <option value="actual">Actual</option>
        <option value="forecast">Forecast</option>
      </select>
      <input
        autoFocus
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400 flex-1 min-w-24"
        placeholder="Label"
        value={label}
        onChange={e => setLabel(e.target.value)}
      />
      <input
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400 w-28 text-right"
        placeholder="+500 or -200"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <input
        type="date"
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400"
        value={date}
        onChange={e => setDate(e.target.value)}
      />
      <button type="button" onClick={onDone} className="text-xs text-slate-500 hover:text-slate-300 px-2">Cancel</button>
      <button type="submit" className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1 font-medium">Add</button>
    </form>
  )
}

function AccountRow({ account, onEdit, adjustments }: { account: WealthAccount; onEdit: () => void; adjustments: AccountAdjustment[] }) {
  const deleteWealthAccount = useStore(s => s.deleteWealthAccount)
  const updateWealthAccount = useStore(s => s.updateWealthAccount)
  const [expanded, setExpanded] = useState(false)
  const [addingAdj, setAddingAdj] = useState(false)

  const actualNet = adjustments.filter(a => a.type === 'actual').reduce((s, a) => s + a.amount, 0)
  const forecastNet = adjustments.filter(a => a.type === 'forecast').reduce((s, a) => s + a.amount, 0)
  const adjustedBalance = account.balance + actualNet
  const projectedBalance = adjustedBalance + forecastNet
  const hasAdjustments = adjustments.length > 0

  return (
    <div className="rounded-lg overflow-hidden">
      <div className="flex items-center justify-between py-2 px-3 group hover:bg-slate-700/30">
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="checkbox"
            checked={account.includeInProjections}
            onChange={e => updateWealthAccount(account.id, { includeInProjections: e.target.checked })}
            className="accent-blue-500 flex-shrink-0"
            title="Include in projections calculator"
          />
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 min-w-0 text-left">
            <svg className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-medium">{account.name || account.institution}</span>
                {account.name && account.institution && (
                  <span className="text-xs text-slate-500">{account.institution}</span>
                )}
                <span className="text-xs bg-slate-700 text-slate-400 rounded px-1.5 py-0.5 hidden sm:inline">
                  {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                </span>
              </div>
              {account.notes && <div className="text-xs text-slate-500 truncate max-w-xs">{account.notes}</div>}
            </div>
          </button>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-medium text-emerald-300 tabular-nums">{formatCurrency(account.balance)}</div>
            {hasAdjustments && (
              <div className="text-xs text-slate-400 tabular-nums">
                adj: {formatCurrency(adjustedBalance)}
                {forecastNet !== 0 && <span className="text-blue-400 ml-1">→ {formatCurrency(projectedBalance)}</span>}
              </div>
            )}
            <div className="text-xs text-slate-500">{account.balanceDate}</div>
          </div>
          <button onClick={onEdit} className="text-slate-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
            </svg>
          </button>
          <button onClick={() => deleteWealthAccount(account.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-2 space-y-0.5">
          {adjustments.map(adj => <AdjustmentRow key={adj.id} adj={adj} />)}
          {addingAdj
            ? <AddAdjustmentForm accountId={account.id} onDone={() => setAddingAdj(false)} />
            : (
              <button
                onClick={() => setAddingAdj(true)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors py-1 px-2"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add adjustment
              </button>
            )
          }
        </div>
      )}
    </div>
  )
}

export function AccountsTab() {
  const accounts = useStore(s => s.wealthAccounts)
  const allAdjustments = useStore(s => s.accountAdjustments)
  const addWealthAccount = useStore(s => s.addWealthAccount)
  const updateWealthAccount = useStore(s => s.updateWealthAccount)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  function handleSave(id: string | null, form: FormState) {
    const balance = parseFloat(form.balance)
    const patch = {
      institution: form.institution.trim(),
      name: form.name.trim(),
      type: form.type,
      category: form.category,
      balance: isNaN(balance) ? 0 : balance,
      balanceDate: form.balanceDate,
      notes: form.notes.trim(),
      includeInProjections: form.includeInProjections,
    }
    if (id) { updateWealthAccount(id, patch); setEditingId(null) }
    else { addWealthAccount(patch); setAdding(false) }
  }

  // Category summary
  const categoryTotals = CATEGORY_ORDER.map(cat => ({
    cat,
    label: ACCOUNT_CATEGORY_LABELS[cat],
    total: accounts.filter(a => a.category === cat).reduce((s, a) => s + a.balance, 0),
  })).filter(c => c.total > 0)

  const grandTotal = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">Accounts</h2>
          <p className="text-slate-400 text-sm mt-0.5">Total: {formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {/* Category summary pills */}
      {categoryTotals.length > 0 && (
        <div className="px-6 pt-4 pb-2 flex gap-2 flex-wrap">
          {categoryTotals.map(({ cat, label, total }) => (
            <div key={cat} className="bg-slate-700/50 rounded-lg px-3 py-1.5 text-center">
              <div className="text-xs text-slate-400">{label}</div>
              <div className="text-sm font-semibold text-emerald-300 tabular-nums">{formatCurrency(total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Accounts by category */}
      {CATEGORY_ORDER.map(cat => {
        const catAccounts = accounts.filter(a => a.category === cat)
        if (catAccounts.length === 0 && !adding) return null
        const catTotal = catAccounts.reduce((s, a) => s + a.balance, 0)
        return (
          <div key={cat} className="px-4 pt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <div className="text-xs text-slate-500 uppercase tracking-widest">{ACCOUNT_CATEGORY_LABELS[cat]}</div>
              {catTotal > 0 && <div className="text-xs text-slate-500 tabular-nums">{formatCurrency(catTotal)}</div>}
            </div>
            <div className="space-y-0.5">
              {catAccounts.map(a =>
                editingId === a.id ? (
                  <AccountForm
                    key={a.id}
                    initial={defaultForm(a)}
                    onSave={form => handleSave(a.id, form)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <AccountRow key={a.id} account={a} onEdit={() => setEditingId(a.id)} adjustments={allAdjustments.filter(adj => adj.accountId === a.id)} />
                )
              )}
            </div>
          </div>
        )
      })}

      <div className="px-4 py-4">
        {adding ? (
          <AccountForm
            initial={defaultForm()}
            onSave={form => handleSave(null, form)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-400 transition-colors py-2 px-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add account
          </button>
        )}
      </div>
    </div>
  )
}
