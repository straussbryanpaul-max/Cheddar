import { useState } from 'react'
import type { PeriodItem, Bill } from '../types'
import { formatCurrency } from '../lib/periods'
import { useStore } from '../store'

interface Props {
  item: PeriodItem
  bill: Bill
  onDismiss?: () => void
}

export function LineItem({ item, bill, onDismiss }: Props) {
  const togglePaid = useStore(s => s.togglePaid)
  const setActualAmount = useStore(s => s.setActualAmount)
  const [editingAmount, setEditingAmount] = useState(false)
  const [draft, setDraft] = useState('')

  const amount = item.actualAmount ?? bill.amount

  function startEdit() {
    setDraft(String(amount))
    setEditingAmount(true)
  }

  function commitEdit() {
    const val = parseFloat(draft)
    setActualAmount(item.id, isNaN(val) ? null : val)
    setEditingAmount(false)
  }

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${item.paid ? 'opacity-50' : ''}`}>
      {/* Left: paid toggle + name + due date */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => togglePaid(item.id)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            item.paid
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-400 hover:border-emerald-400'
          }`}
        >
          {item.paid && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`text-sm truncate ${item.paid ? 'line-through text-slate-400' : 'text-slate-200'}`}>
          {bill.name}
        </span>
        {bill.dueDayOfMonth !== null && (
          <span className="text-xs text-slate-600 flex-shrink-0">due {bill.dueDayOfMonth}</span>
        )}
      </div>

      {/* Right: amount (editable) + dismiss */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {editingAmount ? (
          <input
            autoFocus
            className="w-24 text-right bg-slate-700 text-white text-sm rounded px-2 py-0.5 border border-blue-500 outline-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingAmount(false) }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors tabular-nums"
            title="Click to edit amount"
          >
            {formatCurrency(amount)}
            {item.actualAmount !== null && <span className="text-xs text-blue-400">*</span>}
            <svg className="w-3 h-3 text-slate-600 hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
            </svg>
          </button>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Remove from this period only"
            className="text-slate-600 hover:text-red-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
