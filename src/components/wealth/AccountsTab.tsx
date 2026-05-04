import { useState } from 'react'
import { useStore } from '../../store'
import { formatCurrency } from '../../lib/periods'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/wealth'
import type { WealthAccount, AccountType, AccountCategory } from '../../types'

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

function AccountRow({ account, onEdit }: { account: WealthAccount; onEdit: () => void }) {
  const deleteWealthAccount = useStore(s => s.deleteWealthAccount)
  const updateWealthAccount = useStore(s => s.updateWealthAccount)
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg group hover:bg-slate-700/30">
      <div className="flex items-center gap-3 min-w-0">
        <input
          type="checkbox"
          checked={account.includeInProjections}
          onChange={e => updateWealthAccount(account.id, { includeInProjections: e.target.checked })}
          className="accent-blue-500 flex-shrink-0"
          title="Include in projections calculator"
        />
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
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <div className="text-sm font-medium text-emerald-300 tabular-nums">{formatCurrency(account.balance)}</div>
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
  )
}

export function AccountsTab() {
  const accounts = useStore(s => s.wealthAccounts)
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
                  <AccountRow key={a.id} account={a} onEdit={() => setEditingId(a.id)} />
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
