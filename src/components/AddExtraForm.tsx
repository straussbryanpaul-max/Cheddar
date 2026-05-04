import { useState } from 'react'
import { useStore } from '../store'

interface Props {
  periodId: string
}

export function AddExtraForm({ periodId }: Props) {
  const addExtra = useStore(s => s.addExtra)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!name.trim() || isNaN(val)) return
    addExtra({ periodId, name: name.trim(), amount: val, paid: false })
    setName('')
    setAmount('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-400 transition-colors py-2 px-3"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add extra
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-2 px-3">
      <input
        autoFocus
        placeholder="Description"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-amber-400"
      />
      <input
        placeholder="$0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="w-20 bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-amber-400 text-right"
      />
      <button type="submit" className="text-amber-400 hover:text-amber-300 text-sm font-medium">Add</button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm">Cancel</button>
    </form>
  )
}
