import { useState } from 'react'
import { useStore } from '../../store'
import { formatCurrency } from '../../lib/periods'
import { computeFV, MILESTONE_YEARS, MILESTONE_LABELS, addYears } from '../../lib/wealth'
import type { ProjectionCalcAccount, SnapshotMilestoneLabel, WealthAccount } from '../../types'

const inputCls = 'bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400 w-full'

const FV_HORIZONS: { label: string; years: number }[] = [
  { label: '5yr', years: 5 },
  { label: '10yr', years: 10 },
  { label: '20yr', years: 20 },
]

function CalcRow({ account, wealthAccounts }: {
  account: ProjectionCalcAccount
  wealthAccounts: WealthAccount[]
}) {
  const updateCalcAccount = useStore(s => s.updateCalcAccount)
  const deleteCalcAccount = useStore(s => s.deleteCalcAccount)
  const [fvHorizon] = useState(10)

  const linkedAccount = account.linkedAccountId
    ? wealthAccounts.find(a => a.id === account.linkedAccountId)
    : null
  const effectivePV = linkedAccount?.balance ?? account.presentValue

  const fv = computeFV(effectivePV, account.annualRate, account.annualContribution, account.periodsPerYear, fvHorizon)

  return (
    <tr className="border-b border-slate-700/40 group">
      <td className="py-2 pr-2">
        <input
          className={inputCls}
          value={account.name}
          onChange={e => updateCalcAccount(account.id, { name: e.target.value })}
          placeholder="Account"
        />
      </td>
      <td className="py-2 px-2">
        {linkedAccount ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-300 tabular-nums">{formatCurrency(linkedAccount.balance)}</span>
            <button
              onClick={() => updateCalcAccount(account.id, { linkedAccountId: null })}
              className="text-slate-600 hover:text-red-400 text-xs"
              title="Unlink account"
            >⊗</button>
          </div>
        ) : (
          <input
            className={inputCls}
            value={account.presentValue === 0 ? '' : account.presentValue}
            onChange={e => updateCalcAccount(account.id, { presentValue: parseFloat(e.target.value) || 0 })}
            placeholder="$0"
          />
        )}
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          <input
            className={inputCls}
            value={account.annualRate === 0 ? '' : (account.annualRate * 100).toFixed(account.annualRate * 100 % 1 === 0 ? 0 : 1)}
            onChange={e => updateCalcAccount(account.id, { annualRate: (parseFloat(e.target.value) || 0) / 100 })}
            placeholder="7"
          />
          <span className="text-slate-500 text-xs">%</span>
        </div>
      </td>
      <td className="py-2 px-2">
        <input
          className={inputCls}
          value={account.annualContribution === 0 ? '' : account.annualContribution}
          onChange={e => updateCalcAccount(account.id, { annualContribution: parseFloat(e.target.value) || 0 })}
          placeholder="$0"
        />
      </td>
      <td className="py-2 px-2">
        <select
          className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-400"
          value={account.periodsPerYear}
          onChange={e => updateCalcAccount(account.id, { periodsPerYear: parseInt(e.target.value) })}
        >
          <option value={1}>1×/yr</option>
          <option value={2}>2×/yr</option>
          <option value={4}>4×/yr</option>
          <option value={12}>12×/yr</option>
          <option value={26}>26×/yr</option>
        </select>
      </td>
      <td className="py-2 pl-2 text-right tabular-nums text-emerald-300 text-sm font-medium">
        {formatCurrency(fv)}
      </td>
      <td className="py-2 pl-2">
        <button
          type="button"
          onClick={() => deleteCalcAccount(account.id)}
          className="text-slate-500 hover:text-red-400 transition-colors"
          title="Remove from projections"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function MilestoneActualCell({ snapshotId, label, actual, actualDate }: {
  snapshotId: string
  label: string
  actual: number | null
  actualDate: string | null
}) {
  const updateSnapshotMilestone = useStore(s => s.updateSnapshotMilestone)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(actual !== null ? String(actual) : '')
    setEditing(true)
  }

  function commit() {
    const val = parseFloat(draft)
    updateSnapshotMilestone(snapshotId, label, {
      actual: isNaN(val) ? null : val,
      actualDate: isNaN(val) ? null : (actualDate ?? new Date().toISOString().split('T')[0]),
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="bg-slate-700 text-white text-sm rounded px-2 py-0.5 border border-blue-500 outline-none w-28 text-right tabular-nums"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <button onClick={startEdit} className="text-sm tabular-nums hover:text-blue-300 transition-colors text-left w-full">
      {actual !== null ? (
        <span className="text-emerald-300">{formatCurrency(actual)}</span>
      ) : (
        <span className="text-slate-600">— enter</span>
      )}
    </button>
  )
}

export function ProjectionsTab() {
  const calcAccounts = useStore(s => s.projectionCalcAccounts)
  const wealthAccounts = useStore(s => s.wealthAccounts)
  const snapshots = useStore(s => s.projectionSnapshots)
  const addCalcAccount = useStore(s => s.addCalcAccount)
  const addSnapshot = useStore(s => s.addSnapshot)
  const deleteSnapshot = useStore(s => s.deleteSnapshot)
  const updateSnapshotMilestone = useStore(s => s.updateSnapshotMilestone)

  const [fvHorizon, setFvHorizon] = useState(10)
  const [snapshotName, setSnapshotName] = useState('')
  const [takingSnapshot, setTakingSnapshot] = useState(false)

  function effectivePV(c: ProjectionCalcAccount) {
    const linked = c.linkedAccountId ? wealthAccounts.find(a => a.id === c.linkedAccountId) : null
    return linked?.balance ?? c.presentValue
  }

  const totalFV = calcAccounts.reduce((sum, c) =>
    sum + computeFV(effectivePV(c), c.annualRate, c.annualContribution, c.periodsPerYear, fvHorizon), 0)

  function takeSnapshot() {
    const today = new Date().toISOString().split('T')[0]
    addSnapshot({
      name: snapshotName.trim() || `Snapshot ${today}`,
      snapshotDate: today,
      milestones: MILESTONE_LABELS.map(label => ({
        label,
        targetDate: addYears(today, MILESTONE_YEARS[label]),
        projected: calcAccounts.reduce((sum, c) =>
          sum + computeFV(effectivePV(c), c.annualRate, c.annualContribution, c.periodsPerYear, MILESTONE_YEARS[label]), 0),
        actual: null,
        actualDate: null,
      })),
    })
    setTakingSnapshot(false)
    setSnapshotName('')
  }

  return (
    <div className="space-y-4">
      {/* Calculator */}
      <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">FV Calculator</h2>
            <p className="text-slate-400 text-sm mt-0.5">Future value of your retirement accounts</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Horizon selector */}
            <div className="flex items-center gap-1 bg-slate-700/60 rounded-lg p-1">
              {FV_HORIZONS.map(h => (
                <button
                  key={h.years}
                  onClick={() => setFvHorizon(h.years)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    fvHorizon === h.years ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            {/* Take Snapshot */}
            {takingSnapshot ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-blue-500 outline-none w-48"
                  placeholder="Snapshot name…"
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') takeSnapshot(); if (e.key === 'Escape') setTakingSnapshot(false) }}
                />
                <button onClick={takeSnapshot} className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 font-medium">Save</button>
                <button onClick={() => setTakingSnapshot(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setTakingSnapshot(true); setSnapshotName('') }}
                className="text-xs bg-slate-600 hover:bg-slate-500 text-white rounded px-3 py-1.5 font-medium transition-colors"
              >
                Take Snapshot
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-widest border-b border-slate-700/50">
                <th className="text-left pb-2 pr-2 font-normal">Account</th>
                <th className="text-left pb-2 px-2 font-normal">Present Value</th>
                <th className="text-left pb-2 px-2 font-normal">Rate</th>
                <th className="text-left pb-2 px-2 font-normal">Annual Contrib</th>
                <th className="text-left pb-2 px-2 font-normal">Freq</th>
                <th className="text-right pb-2 pl-2 font-normal">
                  FV ({fvHorizon}yr)
                </th>
                <th className="pb-2 pl-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {calcAccounts.map(c => (
                <CalcRow key={c.id} account={c} wealthAccounts={wealthAccounts} />
              ))}
            </tbody>
            {calcAccounts.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td colSpan={5} className="pt-3 text-xs text-slate-500 uppercase tracking-widest">Total</td>
                  <td className="pt-3 text-right tabular-nums text-emerald-300 font-bold">{formatCurrency(totalFV)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>

          {calcAccounts.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">No accounts yet — add one below</div>
          )}

          <div className="mt-3 space-y-2">
            {/* Add from flagged accounts */}
            {(() => {
              const linkedIds = new Set(calcAccounts.map(c => c.linkedAccountId).filter(Boolean))
              const available = wealthAccounts.filter(a => a.includeInProjections && !linkedIds.has(a.id))
              return available.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {available.map(a => (
                    <button
                      key={a.id}
                      onClick={() => addCalcAccount({ name: `${a.institution} ${a.name}`, linkedAccountId: a.id, presentValue: a.balance, annualRate: 0.07, annualContribution: 0, periodsPerYear: 1 })}
                      className="flex items-center gap-1.5 text-xs bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {a.institution} {a.name}
                    </button>
                  ))}
                </div>
              ) : null
            })()}
            <button
              onClick={() => addCalcAccount({ name: '', linkedAccountId: null, presentValue: 0, annualRate: 0.07, annualContribution: 0, periodsPerYear: 1 })}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-400 transition-colors py-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add manually
            </button>
          </div>
        </div>
      </div>

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div className="space-y-4">
          {[...snapshots].reverse().map(snap => (
            <div key={snap.id} className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-700/50 px-6 py-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{snap.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Snapshot taken {snap.snapshotDate}</div>
                </div>
                <button
                  onClick={() => deleteSnapshot(snap.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Delete snapshot"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="overflow-x-auto px-6 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-widest border-b border-slate-700/50">
                      <th className="text-left pb-2 pr-4 font-normal">Period</th>
                      <th className="text-left pb-2 px-4 font-normal">Target Date</th>
                      <th className="text-right pb-2 px-4 font-normal">Projected</th>
                      <th className="text-left pb-2 px-4 font-normal">Actual</th>
                      <th className="text-left pb-2 pl-4 font-normal">Actual Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.milestones.map(m => {
                      const delta = m.actual !== null ? m.actual - m.projected : null
                      return (
                        <tr key={m.label} className="border-b border-slate-700/30 last:border-0">
                          <td className="py-2 pr-4 text-slate-300 font-medium">{m.label}</td>
                          <td className="py-2 px-4 text-slate-500 text-xs">{m.targetDate}</td>
                          <td className="py-2 px-4 text-right tabular-nums text-slate-300">
                            {formatCurrency(m.projected)}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <MilestoneActualCell
                                snapshotId={snap.id}
                                label={m.label}
                                actual={m.actual}
                                actualDate={m.actualDate}
                              />
                              {delta !== null && (
                                <span className={`text-xs tabular-nums ${delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                  {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pl-4">
                            {m.actual !== null && (
                              <input
                                type="date"
                                className="bg-transparent text-slate-500 text-xs outline-none focus:text-white border-b border-transparent focus:border-slate-600"
                                value={m.actualDate ?? ''}
                                onChange={e => updateSnapshotMilestone(snap.id, m.label, { actual: m.actual, actualDate: e.target.value || null })}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {snapshots.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-sm">
          Configure your accounts above and click <span className="text-slate-400">Take Snapshot</span> to start tracking projections vs actuals.
        </div>
      )}
    </div>
  )
}
