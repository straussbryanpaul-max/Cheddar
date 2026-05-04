import { useState } from 'react'
import { useStore } from '../store'
import { formatCurrency, quarterlyMonths, MONTH_NAMES, PAY_FREQUENCY_LABELS } from '../lib/periods'
import type { Bill, BillCategory, BillFrequency, PayFrequency } from '../types'

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function frequencyLabel(bill: Bill): string {
  if (bill.dueDayOfMonth === null) return 'every period'
  if (bill.frequency === 'quarterly') {
    const months = bill.dueMonths.map(m => MONTH_NAMES[m - 1]).join('/')
    return `quarterly (${months})`
  }
  if (bill.frequency === 'annual') {
    const month = MONTH_NAMES[(bill.dueMonths[0] ?? 1) - 1]
    return `annually (${month})`
  }
  return `due ${ordinal(bill.dueDayOfMonth)}`
}

interface BillFormState {
  name: string
  amount: string
  dueDay: string
  frequency: BillFrequency
  quarterStart: string  // '1' | '2' | '3'
  annualMonth: string   // '1'..'12'
  category: BillCategory
}

function defaultForm(bill?: Bill): BillFormState {
  return {
    name: bill?.name ?? '',
    amount: bill ? String(bill.amount) : '',
    dueDay: bill?.dueDayOfMonth != null ? String(bill.dueDayOfMonth) : '',
    frequency: bill?.frequency ?? 'monthly',
    quarterStart: bill?.dueMonths.length ? String(bill.dueMonths[0]) : '1',
    annualMonth: bill?.dueMonths.length ? String(bill.dueMonths[0]) : '1',
    category: bill?.category ?? 'fixed',
  }
}

function computeDueMonths(form: BillFormState): number[] {
  if (!form.dueDay) return []
  if (form.frequency === 'quarterly') return quarterlyMonths(parseInt(form.quarterStart))
  if (form.frequency === 'annual') return [parseInt(form.annualMonth)]
  return []
}

const selectCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400'
const inputCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400'

function BillForm({ initial, onSave, onCancel }: {
  initial: BillFormState
  onSave: (form: BillFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<BillFormState>) => setForm(f => ({ ...f, ...patch }))
  const isEveryPeriod = !form.dueDay

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!form.name.trim() || isNaN(amt)) return
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="bg-slate-700/40 rounded-xl p-4 border border-slate-600 space-y-3">
      <div className="flex gap-2">
        <input
          autoFocus
          className={`${inputCls} flex-1`}
          placeholder="Bill name"
          value={form.name}
          onChange={e => set({ name: e.target.value })}
        />
        <input
          className={`${inputCls} w-28 text-right`}
          placeholder="Amount"
          value={form.amount}
          onChange={e => set({ amount: e.target.value })}
        />
        <select
          className={selectCls}
          value={form.category}
          onChange={e => set({ category: e.target.value as BillCategory })}
        >
          <option value="fixed">Fixed</option>
          <option value="variable">Variable</option>
          <option value="savings">Savings</option>
        </select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          className={`${inputCls} w-20 text-center`}
          placeholder="Due day"
          title="Day of month — leave blank for every period"
          value={form.dueDay}
          onChange={e => set({ dueDay: e.target.value })}
        />

        {!isEveryPeriod && (
          <select
            className={selectCls}
            value={form.frequency}
            onChange={e => set({ frequency: e.target.value as BillFrequency })}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        )}

        {!isEveryPeriod && form.frequency === 'quarterly' && (
          <select
            className={selectCls}
            value={form.quarterStart}
            onChange={e => set({ quarterStart: e.target.value })}
            title="First month of the quarter"
          >
            <option value="1">Jan / Apr / Jul / Oct</option>
            <option value="2">Feb / May / Aug / Nov</option>
            <option value="3">Mar / Jun / Sep / Dec</option>
          </select>
        )}

        {!isEveryPeriod && form.frequency === 'annual' && (
          <select
            className={selectCls}
            value={form.annualMonth}
            onChange={e => set({ annualMonth: e.target.value })}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        {isEveryPeriod && (
          <span className="text-xs text-slate-500 italic">every period (no due day)</span>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 px-3 py-1">Cancel</button>
        <button type="submit" className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1 font-medium">Save</button>
      </div>
    </form>
  )
}

function BillRow({ bill, onEdit }: { bill: Bill; onEdit: () => void }) {
  const deleteBill = useStore(s => s.deleteBill)
  const updateBill = useStore(s => s.updateBill)

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg group hover:bg-slate-700/30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => updateBill(bill.id, { active: !bill.active })}
          className={`w-4 h-4 rounded border flex-shrink-0 transition-colors ${
            bill.active ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'
          }`}
        />
        <span className={`text-sm ${bill.active ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
          {bill.name}
        </span>
        <span className="text-xs text-slate-500">{frequencyLabel(bill)}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 tabular-nums">{formatCurrency(bill.amount)}</span>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
          </svg>
        </button>
        <button
          onClick={() => deleteBill(bill.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function PaySettings() {
  const defaultPayAmount = useStore(s => s.defaultPayAmount)
  const payFrequency = useStore(s => s.payFrequency)
  const payAnchorDate = useStore(s => s.payAnchorDate)
  const setPaySettings = useStore(s => s.setPaySettings)
  const regeneratePeriods = useStore(s => s.regeneratePeriods)

  const [amountDraft, setAmountDraft] = useState(String(defaultPayAmount))
  const [freqDraft, setFreqDraft] = useState<PayFrequency>(payFrequency)
  const [anchorDraft, setAnchorDraft] = useState(payAnchorDate)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const hasChanges =
    parseFloat(amountDraft) !== defaultPayAmount ||
    freqDraft !== payFrequency ||
    anchorDraft !== payAnchorDate

  function save() {
    const amt = parseFloat(amountDraft)
    const scheduleChanged = freqDraft !== payFrequency || anchorDraft !== payAnchorDate
    setPaySettings({
      defaultPayAmount: !isNaN(amt) ? amt : defaultPayAmount,
      payFrequency: freqDraft,
      payAnchorDate: anchorDraft,
    })
    if (scheduleChanged) setConfirmRegen(true)
  }

  function doRegen() {
    regeneratePeriods()
    setConfirmRegen(false)
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-3">Pay Settings</div>
      <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-28 flex-shrink-0">Default Paycheck</label>
          <input
            className={`${inputCls} w-32 text-right`}
            value={amountDraft}
            onChange={e => setAmountDraft(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-28 flex-shrink-0">Frequency</label>
          <select
            className={selectCls}
            value={freqDraft}
            onChange={e => setFreqDraft(e.target.value as PayFrequency)}
          >
            {(Object.entries(PAY_FREQUENCY_LABELS) as [PayFrequency, string][]).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-28 flex-shrink-0">Known Pay Date</label>
          <input
            type="date"
            className={`${inputCls}`}
            value={anchorDraft}
            onChange={e => setAnchorDraft(e.target.value)}
          />
        </div>
        {hasChanges && (
          <div className="flex justify-end pt-1">
            <button
              onClick={save}
              className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-4 py-1.5 font-medium transition-colors"
            >
              Save
            </button>
          </div>
        )}
        {confirmRegen && (
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3 text-sm">
            <p className="text-amber-300 mb-2">
              Changing the schedule will regenerate all periods and clear period-specific data (paid items, extras). Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmRegen(false)} className="text-slate-400 hover:text-slate-200 px-3 py-1 text-xs">Cancel</button>
              <button onClick={doRegen} className="bg-amber-600 hover:bg-amber-500 text-white rounded px-3 py-1 text-xs font-medium">Regenerate</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function BillsManager() {
  const bills = useStore(s => s.bills)
  const addBill = useStore(s => s.addBill)
  const updateBill = useStore(s => s.updateBill)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fixed = bills.filter(b => b.category === 'fixed')
  const variable = bills.filter(b => b.category === 'variable')
  const savings = bills.filter(b => b.category === 'savings')

  function handleSave(id: string | null, form: BillFormState) {
    const amt = parseFloat(form.amount)
    const day = form.dueDay ? parseInt(form.dueDay) : null
    const dueMonths = computeDueMonths(form)
    const patch = {
      name: form.name.trim(),
      amount: amt,
      dueDayOfMonth: day && day >= 1 && day <= 31 ? day : null,
      frequency: form.frequency,
      dueMonths,
      category: form.category,
      active: true,
    }
    if (id) {
      updateBill(id, patch)
      setEditingId(null)
    } else {
      addBill(patch)
      setAdding(false)
    }
  }

  function Section({ title, items }: { title: string; items: Bill[] }) {
    return (
      <div className="px-4 pt-4">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">{title}</div>
        <div className="space-y-0.5">
          {items.map(b =>
            editingId === b.id ? (
              <BillForm
                key={b.id}
                initial={defaultForm(b)}
                onSave={form => handleSave(b.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <BillRow key={b.id} bill={b} onEdit={() => setEditingId(b.id)} />
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-slate-700/50 px-6 py-4">
        <h2 className="text-white font-semibold text-lg">Bills & Recurring Items</h2>
        <p className="text-slate-400 text-sm mt-0.5">Changes propagate to all periods automatically.</p>
      </div>

      <Section title="Fixed Bills" items={fixed} />
      <Section title="Every Period" items={variable} />
      {savings.length > 0 && <Section title="Savings" items={savings} />}

      <div className="px-4 py-4">
        {adding ? (
          <BillForm
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
            Add bill or recurring item
          </button>
        )}
      </div>

      <div className="border-t border-slate-700/40 mt-2">
        <PaySettings />
      </div>
    </div>
  )
}
