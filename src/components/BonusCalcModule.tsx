import React, { useState } from 'react'
import { useStore } from '../store'
import type { BonusCalcBucket, BonusCalcCategory } from '../types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

const CATEGORIES: { value: BonusCalcCategory; label: string; color: string }[] = [
  { value: 'spending',     label: 'Spending',     color: '#f59e0b' },
  { value: 'investments',  label: 'Investments',  color: '#6366f1' },
  { value: 'savings',      label: 'Savings',      color: '#10b981' },
  { value: 'home',         label: 'Home',         color: '#3b82f6' },
  { value: 'travel',       label: 'Travel',       color: '#ec4899' },
  { value: 'giving',       label: 'Giving',       color: '#a78bfa' },
  { value: 'other',        label: 'Other',        color: '#94a3b8' },
]

function catColor(c: BonusCalcCategory) {
  return CATEGORIES.find(x => x.value === c)?.color ?? '#94a3b8'
}
function catLabel(c: BonusCalcCategory) {
  return CATEGORIES.find(x => x.value === c)?.label ?? c
}

function DonutChart({ buckets, net }: { buckets: BonusCalcBucket[]; net: number }) {
  // Group by category
  const byCategory = new Map<BonusCalcCategory, number>()
  for (const b of buckets) {
    const amt = parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0
    if (amt > 0) byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + amt)
  }
  const unallocated = net - [...byCategory.values()].reduce((s, v) => s + v, 0)

  const slices: { label: string; value: number; color: string }[] = []
  for (const [cat, val] of byCategory) {
    slices.push({ label: catLabel(cat), value: val, color: catColor(cat) })
  }
  if (unallocated > 1) slices.push({ label: 'Unallocated', value: unallocated, color: '#1e293b' })

  if (slices.length === 0) return null

  const total = slices.reduce((s, sl) => s + sl.value, 0)
  const R = 54, cx = 70, cy = 70, stroke = 20
  let angle = -Math.PI / 2
  const paths = slices.map(sl => {
    const sweep = (sl.value / total) * 2 * Math.PI
    const x1 = cx + R * Math.cos(angle)
    const y1 = cy + R * Math.sin(angle)
    angle += sweep
    const x2 = cx + R * Math.cos(angle)
    const y2 = cy + R * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return { d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, color: sl.color, sweep }
  })

  return (
    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-700/40">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">net</text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
          {fmt(net).replace('$', '$')}
        </text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sl.color }} />
            <span className="text-xs text-slate-400 flex-1">{sl.label}</span>
            <span className="text-xs font-semibold text-slate-200 tabular-nums">{fmt(sl.value)}</span>
            <span className="text-xs text-slate-600 tabular-nums w-10 text-right">{pct(sl.value / net)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BonusCalcModule() {
  const { draft, snapshots } = useStore(s => s.bonusCalc)
  const setBonusCalcDraft = useStore(s => s.setBonusCalcDraft)
  const saveBonusSnapshot = useStore(s => s.saveBonusSnapshot)
  const deleteBonusSnapshot = useStore(s => s.deleteBonusSnapshot)

  const [snapshotName, setSnapshotName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [viewingSnapshot, setViewingSnapshot] = useState<string | null>(null)
  const [newBucketLabel, setNewBucketLabel] = useState('')

  const active = viewingSnapshot
    ? (snapshots.find(s => s.id === viewingSnapshot)?.draft ?? draft)
    : draft

  function set(updates: Partial<typeof draft>) {
    if (viewingSnapshot) return
    setBonusCalcDraft(updates)
  }
  function updateBucket(id: string, field: keyof BonusCalcBucket, val: string) {
    if (viewingSnapshot) return
    setBonusCalcDraft({ buckets: draft.buckets.map(b => b.id === id ? { ...b, [field]: val } : b) })
  }
  function deleteBucket(id: string) {
    if (viewingSnapshot) return
    setBonusCalcDraft({ buckets: draft.buckets.filter(b => b.id !== id) })
  }
  function addBucket(label: string) {
    if (viewingSnapshot) return
    setBonusCalcDraft({ buckets: [...draft.buckets, { id: Date.now().toString(), label, amount: '', category: 'other' }] })
  }

  const grossNum = parseFloat(active.gross.replace(/[^0-9.]/g, '')) || 0
  const federalPct = parseFloat(active.federalRate) / 100 || 0
  const statePct = parseFloat(active.stateRate) / 100 || 0
  const k401Pct = parseFloat(active.k401Rate) / 100 || 0
  const ssYtdNum = parseFloat(active.ssYtd.replace(/[^0-9.]/g, '')) || 0

  const SS_WAGE_BASE = 168600
  const k401Deduction = grossNum * k401Pct
  const taxableIncome = grossNum - k401Deduction
  const ssEligible = Math.max(0, Math.min(grossNum, SS_WAGE_BASE - ssYtdNum))
  const ssTax = ssEligible * 0.062
  const medicareTax = grossNum * 0.0145
  const federalTax = taxableIncome * federalPct
  const stateTax = taxableIncome * statePct
  const totalDeductions = k401Deduction + ssTax + medicareTax + federalTax + stateTax
  const netTakeHome = grossNum - totalDeductions

  const bucketTotal = active.buckets.reduce((s, b) => s + (parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0), 0)
  const unallocated = netTakeHome - bucketTotal

  const deductionRows = [
    { label: '401(k) contribution', note: `${active.k401Rate}% pre-tax`, value: k401Deduction },
    { label: 'Federal income tax', note: `${active.federalRate}% supplemental rate`, value: federalTax },
    { label: 'State income tax', note: `${active.stateRate}%`, value: stateTax },
    { label: 'Social Security', note: ssYtdNum > 0 ? `6.2% on $${Math.round(ssEligible).toLocaleString()} eligible` : '6.2%', value: ssTax },
    { label: 'Medicare', note: '1.45%', value: medicareTax },
  ]

  const readOnly = !!viewingSnapshot

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-white">Bonus Calculator</div>
        {snapshots.length > 0 && (
          <select
            className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500"
            value={viewingSnapshot ?? ''}
            onChange={e => setViewingSnapshot(e.target.value || null)}
          >
            <option value="">— current —</option>
            {snapshots.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {readOnly && (
        <div className="bg-slate-700/60 border border-slate-600/40 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Viewing saved snapshot — read only</span>
          <div className="flex gap-3">
            <button onClick={() => { setBonusCalcDraft(snapshots.find(s => s.id === viewingSnapshot)!.draft); setViewingSnapshot(null) }} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Load into current</button>
            <button onClick={() => { deleteBonusSnapshot(viewingSnapshot!); setViewingSnapshot(null) }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
          </div>
        </div>
      )}

      {/* Gross + rates */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-4">
        <div>
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1">Gross Bonus</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">$</span>
            <input
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xl font-bold text-white outline-none focus:border-blue-500 tabular-nums disabled:opacity-50"
              placeholder="0"
              value={active.gross}
              onChange={e => set({ gross: e.target.value })}
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RateInput label="Federal rate" value={active.federalRate} onChange={v => set({ federalRate: v })} hint="22% supplemental (default)" disabled={readOnly} />
          <RateInput label="State rate" value={active.stateRate} onChange={v => set({ stateRate: v })} disabled={readOnly} />
          <RateInput label="401(k) %" value={active.k401Rate} onChange={v => set({ k401Rate: v })} hint="% of bonus to defer" disabled={readOnly} />
          <div>
            <label className="text-xs text-slate-500 block mb-1">YTD wages (SS cap check)</label>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-xs">$</span>
              <input
                className="w-full bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums disabled:opacity-50"
                placeholder="optional"
                value={active.ssYtd}
                onChange={e => set({ ssYtd: e.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className="text-xs text-slate-600 mt-0.5">SS wage base: $168,600</div>
          </div>
        </div>
      </div>

      {/* Deductions */}
      {grossNum > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-2">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Deductions</div>
          {deductionRows.map(r => (
            <div key={r.label} className="flex items-baseline justify-between">
              <div>
                <span className="text-sm text-slate-300">{r.label}</span>
                <span className="text-xs text-slate-600 ml-2">{r.note}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-200 tabular-nums">{fmt(r.value)}</span>
                <span className="text-xs text-slate-600 ml-1.5">({pct(r.value / grossNum)})</span>
              </div>
            </div>
          ))}
          <div className="border-t border-slate-700/50 pt-2 mt-2 flex justify-between items-baseline">
            <span className="text-xs text-slate-500">Total out</span>
            <span className="text-sm font-semibold text-slate-400 tabular-nums">{fmt(totalDeductions)} <span className="text-slate-600 font-normal">({pct(totalDeductions / grossNum)})</span></span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-sm font-medium text-slate-300">Net take-home</span>
            <span className="text-xl font-bold text-emerald-400 tabular-nums">{fmt(netTakeHome)}</span>
          </div>
        </div>
      )}

      {/* Bucketing */}
      {grossNum > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">How to bucket it</div>
            <span className={`text-sm font-semibold tabular-nums ${Math.abs(unallocated) < 1 ? 'text-emerald-400' : unallocated < 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {Math.abs(unallocated) < 1 ? '✓ fully allocated' : unallocated > 0 ? `${fmt(unallocated)} left` : `${fmt(Math.abs(unallocated))} over`}
            </span>
          </div>

          <div className="space-y-2">
            {active.buckets.map(b => (
              <div key={b.id} className="flex items-center gap-2">
                <select
                  className="bg-slate-700/60 border border-slate-600/50 rounded px-1.5 py-1.5 text-xs outline-none focus:border-blue-500 disabled:opacity-50"
                  style={{ color: catColor(b.category) }}
                  value={b.category}
                  onChange={e => updateBucket(b.id, 'category', e.target.value)}
                  disabled={readOnly}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
                  value={b.label}
                  onChange={e => updateBucket(b.id, 'label', e.target.value)}
                  disabled={readOnly}
                />
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-xs">$</span>
                  <input
                    className="w-28 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums disabled:opacity-50"
                    placeholder="0"
                    value={b.amount}
                    onChange={e => updateBucket(b.id, 'amount', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                {netTakeHome > 0 && (parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0) > 0 && (
                  <span className="text-xs text-slate-600 w-10 text-right tabular-nums">
                    {pct((parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0) / netTakeHome)}
                  </span>
                )}
                {!readOnly && <button onClick={() => deleteBucket(b.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>}
              </div>
            ))}
          </div>

          {!readOnly && (
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 bg-slate-700/40 border border-slate-600/40 rounded px-2 py-1.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500"
                placeholder="add a bucket..."
                value={newBucketLabel}
                onChange={e => setNewBucketLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addBucket(newBucketLabel.trim()); setNewBucketLabel('') } }}
              />
              <button
                onClick={() => { if (newBucketLabel.trim()) { addBucket(newBucketLabel.trim()); setNewBucketLabel('') } }}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-3 py-1.5 transition-colors"
              >Add</button>
            </div>
          )}

          <DonutChart buckets={active.buckets} net={netTakeHome} />
        </div>
      )}

      {/* Save snapshot */}
      {grossNum > 0 && !readOnly && (
        <div className="flex items-center gap-2">
          {savingName ? (
            <>
              <input
                autoFocus
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-500"
                placeholder="snapshot name (e.g. 2025 Q1 bonus)"
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && snapshotName.trim()) { saveBonusSnapshot(snapshotName.trim()); setSnapshotName(''); setSavingName(false) }
                  if (e.key === 'Escape') setSavingName(false)
                }}
              />
              <button
                onClick={() => { if (snapshotName.trim()) { saveBonusSnapshot(snapshotName.trim()); setSnapshotName(''); setSavingName(false) } }}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 transition-colors"
              >Save</button>
              <button onClick={() => setSavingName(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
            </>
          ) : (
            <button
              onClick={() => setSavingName(true)}
              className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-3 py-1.5 transition-colors"
            >Save snapshot…</button>
          )}
        </div>
      )}
    </div>
  )
}

function RateInput({ label, value, onChange, hint, disabled }: { label: string; value: string; onChange: (v: string) => void; hint?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          className="w-full bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums disabled:opacity-50"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
        <span className="text-slate-500 text-xs">%</span>
      </div>
      {hint && <div className="text-xs text-slate-600 mt-0.5">{hint}</div>}
    </div>
  )
}
