import { useState } from 'react'
import { useStore } from '../store'
import type { CollegeKid } from '../types'

const CLASS_LABELS = ['Fr', 'So', 'Jr', 'Sr']

function yearLabel(start: number, i: number): string {
  const s = start + i
  const e = String((s + 1) % 100).padStart(2, '0')
  return `${s}–${e} (${CLASS_LABELS[i]})`
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

      <div className="px-5 py-4 space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">4-year plan</div>
        <ul className="space-y-1">
          {[0, 1, 2, 3].map(i => (
            <li key={i} className="text-sm text-slate-500 px-2 py-1 rounded bg-slate-700/20 tabular-nums">
              {yearLabel(kid.freshmanStartYear, i)}
            </li>
          ))}
        </ul>
        <div className="text-xs text-slate-600 italic pt-2">FV calculator + forecast coming next…</div>
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
