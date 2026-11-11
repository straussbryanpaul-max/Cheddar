import React, { useState } from 'react'

interface Bucket {
  id: string
  label: string
  amount: string
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

const DEFAULT_BUCKETS: Bucket[] = [
  { id: '1', label: 'Spending / fun', amount: '' },
  { id: '2', label: 'Investments', amount: '' },
  { id: '3', label: 'Emergency fund', amount: '' },
]

export function BonusCalcModule() {
  const [gross, setGross] = useState('')
  const [federalRate, setFederalRate] = useState('22')
  const [stateRate, setStateRate] = useState('5')
  const [ssYtd, setSsYtd] = useState('')          // YTD wages for SS cap check
  const [k401Rate, setK401Rate] = useState('6')   // % of bonus to 401k
  const [buckets, setBuckets] = useState<Bucket[]>(DEFAULT_BUCKETS)
  const [newBucketLabel, setNewBucketLabel] = useState('')

  const grossNum = parseFloat(gross.replace(/[^0-9.]/g, '')) || 0
  const federalPct = parseFloat(federalRate) / 100 || 0
  const statePct = parseFloat(stateRate) / 100 || 0
  const k401Pct = parseFloat(k401Rate) / 100 || 0
  const ssYtdNum = parseFloat(ssYtd.replace(/[^0-9.]/g, '')) || 0

  const SS_WAGE_BASE = 168600
  const ss401k = grossNum * k401Pct                              // 401k comes out pre-tax
  const taxableIncome = grossNum - ss401k                        // federal/state taxable
  const ssEligible = Math.max(0, Math.min(grossNum, SS_WAGE_BASE - ssYtdNum))
  const ssTax = ssEligible * 0.062
  const medicareTax = grossNum * 0.0145
  const federalTax = taxableIncome * federalPct
  const stateTax = taxableIncome * statePct
  const totalDeductions = ss401k + ssTax + medicareTax + federalTax + stateTax
  const netTakeHome = grossNum - totalDeductions

  const bucketTotal = buckets.reduce((s, b) => s + (parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0), 0)
  const unallocated = netTakeHome - bucketTotal

  function updateBucket(id: string, field: keyof Bucket, val: string) {
    setBuckets(bs => bs.map(b => b.id === id ? { ...b, [field]: val } : b))
  }
  function deleteBucket(id: string) {
    setBuckets(bs => bs.filter(b => b.id !== id))
  }
  function addBucket() {
    const label = newBucketLabel.trim()
    if (!label) return
    setBuckets(bs => [...bs, { id: Date.now().toString(), label, amount: '' }])
    setNewBucketLabel('')
  }

  const rows = [
    { label: '401(k) contribution', note: `${k401Rate}% pre-tax`, value: ss401k },
    { label: 'Federal income tax', note: `${federalRate}% supplemental rate`, value: federalTax },
    { label: 'State income tax', note: `${stateRate}%`, value: stateTax },
    { label: 'Social Security', note: ssYtdNum > 0 ? `6.2% on $${Math.round(ssEligible).toLocaleString()} eligible` : '6.2%', value: ssTax },
    { label: 'Medicare', note: '1.45%', value: medicareTax },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <div className="text-lg font-semibold text-white">Bonus Calculator</div>

      {/* Gross input */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-4">
        <div>
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1">Gross Bonus</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">$</span>
            <input
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xl font-bold text-white outline-none focus:border-blue-500 tabular-nums"
              placeholder="0"
              value={gross}
              onChange={e => setGross(e.target.value)}
            />
          </div>
        </div>

        {/* Rate knobs */}
        <div className="grid grid-cols-2 gap-3">
          <RateInput label="Federal rate" value={federalRate} onChange={setFederalRate} hint="22% supplemental (default)" />
          <RateInput label="State rate" value={stateRate} onChange={setStateRate} />
          <RateInput label="401(k) %" value={k401Rate} onChange={setK401Rate} hint="% of bonus to defer" />
          <div>
            <label className="text-xs text-slate-500 block mb-1">YTD wages (SS cap check)</label>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-xs">$</span>
              <input
                className="w-full bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums"
                placeholder="optional"
                value={ssYtd}
                onChange={e => setSsYtd(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-600 mt-0.5">SS wage base: $168,600</div>
          </div>
        </div>
      </div>

      {/* Deduction breakdown */}
      {grossNum > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-2">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Deductions</div>
          {rows.map(r => (
            <div key={r.label} className="flex items-baseline justify-between">
              <div>
                <span className="text-sm text-slate-300">{r.label}</span>
                <span className="text-xs text-slate-600 ml-2">{r.note}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-200 tabular-nums">{fmt(r.value)}</span>
                {grossNum > 0 && <span className="text-xs text-slate-600 ml-1.5">({pct(r.value / grossNum)})</span>}
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
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">How to bucket it</div>
            <span className={`text-sm font-semibold tabular-nums ${Math.abs(unallocated) < 1 ? 'text-emerald-400' : unallocated < 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {Math.abs(unallocated) < 1 ? '✓ fully allocated' : unallocated > 0 ? `${fmt(unallocated)} left` : `${fmt(Math.abs(unallocated))} over`}
            </span>
          </div>

          {buckets.map(b => (
            <div key={b.id} className="flex items-center gap-2">
              <input
                className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                value={b.label}
                onChange={e => updateBucket(b.id, 'label', e.target.value)}
              />
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-xs">$</span>
                <input
                  className="w-28 bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums"
                  placeholder="0"
                  value={b.amount}
                  onChange={e => updateBucket(b.id, 'amount', e.target.value)}
                />
              </div>
              {netTakeHome > 0 && (parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0) > 0 && (
                <span className="text-xs text-slate-600 w-10 text-right tabular-nums">
                  {pct((parseFloat(b.amount.replace(/[^0-9.]/g, '')) || 0) / netTakeHome)}
                </span>
              )}
              <button onClick={() => deleteBucket(b.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <input
              className="flex-1 bg-slate-700/40 border border-slate-600/40 rounded px-2 py-1.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500"
              placeholder="add a bucket..."
              value={newBucketLabel}
              onChange={e => setNewBucketLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addBucket() }}
            />
            <button
              onClick={addBucket}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-3 py-1.5 transition-colors"
            >Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RateInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          className="w-full bg-slate-700/60 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <span className="text-slate-500 text-xs">%</span>
      </div>
      {hint && <div className="text-xs text-slate-600 mt-0.5">{hint}</div>}
    </div>
  )
}
