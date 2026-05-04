import { useState } from 'react'
import type { Extra } from '../types'
import { formatCurrency } from '../lib/periods'
import { useStore } from '../store'

interface Props {
  extra: Extra
}

export function ExtraItem({ extra }: Props) {
  const toggleExtraPaid = useStore(s => s.toggleExtraPaid)
  const deleteExtra = useStore(s => s.deleteExtra)
  const updateExtra = useStore(s => s.updateExtra)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(extra.name)
  const [amountDraft, setAmountDraft] = useState(String(extra.amount))

  function commitEdit() {
    const val = parseFloat(amountDraft)
    if (!nameDraft.trim() || isNaN(val)) { setEditing(false); return }
    updateExtra(extra.id, { name: nameDraft.trim(), amount: val })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 px-3">
        <input
          autoFocus
          className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-0.5 border border-blue-500 outline-none"
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
        />
        <input
          className="w-24 text-right bg-slate-700 text-white text-sm rounded px-2 py-0.5 border border-blue-500 outline-none"
          value={amountDraft}
          onChange={e => setAmountDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
        />
        <button onClick={commitEdit} className="text-xs text-emerald-400 hover:text-emerald-300 px-1">Save</button>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${extra.paid ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => toggleExtraPaid(extra.id)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            extra.paid
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-400 hover:border-emerald-400'
          }`}
        >
          {extra.paid && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`text-sm truncate ${extra.paid ? 'line-through text-slate-400' : 'text-slate-200'}`}>
          {extra.name}
        </span>
        <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded flex-shrink-0">extra</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <button
          onClick={() => { setNameDraft(extra.name); setAmountDraft(String(extra.amount)); setEditing(true) }}
          className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors tabular-nums"
          title="Click to edit"
        >
          {formatCurrency(extra.amount)}
          <svg className="w-3 h-3 text-slate-600 hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
          </svg>
        </button>
        <button
          onClick={() => deleteExtra(extra.id)}
          title="Delete"
          className="text-slate-600 hover:text-red-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
