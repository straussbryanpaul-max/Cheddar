import { useState } from 'react'
import type { CCMonthlyAnalysis, CCTransaction } from '../types'
import { useFormatCurrency } from '../lib/useFormatCurrency'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'com', 'inc', 'llc', 'us', 'co'])

function descriptionWords(s: string): string[] {
  return normalize(s).split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

// Returns true if two descriptions likely refer to the same merchant
function descriptionsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na.includes(nb) || nb.includes(na)) return true
  const wa = descriptionWords(a)
  const wb = new Set(descriptionWords(b))
  const overlap = wa.filter(w => wb.has(w)).length
  return overlap >= 2 || (overlap >= 1 && wa.length <= 2)
}

interface Props {
  midPeriod: CCMonthlyAnalysis
  baseAnalysis: CCMonthlyAnalysis | null
  sortedAnalyses: CCMonthlyAnalysis[]
  personFilter: 'All' | 'Bryan' | 'Rachel'
  projectionBaseId: string | null
  onChangeProjectionBase: (id: string) => void
}

export function MidPeriodView({
  midPeriod,
  baseAnalysis,
  sortedAnalyses,
  personFilter,
  projectionBaseId,
  onChangeProjectionBase,
}: Props) {
  const fmt = useFormatCurrency()
  const [openExpected, setOpenExpected] = useState(true)

  const filteredTxs = personFilter === 'All'
    ? midPeriod.transactions
    : midPeriod.transactions.filter(tx => tx.person === personFilter)

  const recurringTxs = filteredTxs.filter(tx => tx.isRecurring)
  const oneOffTxs = filteredTxs.filter(tx => !tx.isRecurring)
  const totalSoFar = filteredTxs.reduce((s, tx) => s + tx.amount, 0)
  const recurringSoFar = recurringTxs.reduce((s, tx) => s + tx.amount, 0)
  const oneOffSoFar = oneOffTxs.reduce((s, tx) => s + tx.amount, 0)

  // Determine which recurring items from the base statement haven't appeared yet
  const baseRecurring: CCTransaction[] = baseAnalysis
    ? (personFilter === 'All'
        ? baseAnalysis.transactions.filter(tx => tx.isRecurring)
        : baseAnalysis.transactions.filter(tx => tx.isRecurring && tx.person === personFilter))
    : []

  const stillExpected = baseRecurring.filter(baseTx =>
    !filteredTxs.some(midTx => descriptionsMatch(baseTx.description, midTx.description))
  )
  const stillExpectedTotal = stillExpected.reduce((s, tx) => s + tx.amount, 0)
  const projectedFinal = totalSoFar + stillExpectedTotal

  // Statements available for base selection (non-mid-period only)
  const statementOptions = sortedAnalyses.filter(a => a.type !== 'mid-period')

  return (
    <div className="space-y-4">

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Charged So Far</div>
          <div className="text-xl font-bold text-white tabular-nums">{fmt(totalSoFar)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{filteredTxs.length} charges · {midPeriod.statementRange}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Recurring So Far</div>
          <div className="text-xl font-bold text-blue-400 tabular-nums">{fmt(recurringSoFar)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{recurringTxs.length} items</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">One-offs So Far</div>
          <div className="text-xl font-bold text-amber-400 tabular-nums">{fmt(oneOffSoFar)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{oneOffTxs.length} items</div>
        </div>
      </div>

      {/* Projected final */}
      <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-6">
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Projected Final Bill</div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{fmt(projectedFinal)}</div>
          <div className="text-xs text-slate-600 mt-0.5">
            {fmt(totalSoFar)} charged + {fmt(stillExpectedTotal)} still expected
            {baseAnalysis ? ` (from ${baseAnalysis.month})` : ''}
          </div>
        </div>
        {statementOptions.length > 1 && (
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-slate-600">Base statement</div>
            <select
              className="bg-slate-700 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600/50 outline-none focus:border-blue-500"
              value={projectionBaseId ?? statementOptions[0]?.id ?? ''}
              onChange={e => onChangeProjectionBase(e.target.value)}
            >
              {statementOptions.map(a => (
                <option key={a.id} value={a.id}>{a.month}</option>
              ))}
            </select>
          </div>
        )}
        {!baseAnalysis && (
          <div className="text-xs text-slate-500 italic">Load a past statement to see forecasted items</div>
        )}
      </div>

      {/* Still Expected breakdown */}
      {baseAnalysis && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenExpected(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <svg className={`w-3.5 h-3.5 transition-transform flex-shrink-0 text-slate-500 ${openExpected ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">Still Expected</span>
              <span className="text-xs text-slate-600">{stillExpected.length} recurring items not yet posted</span>
            </div>
            <span className="text-sm font-semibold text-slate-300 tabular-nums">{fmt(stillExpectedTotal)}</span>
          </button>
          {openExpected && (
            stillExpected.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                All recurring items from {baseAnalysis.month} have already posted this period.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {stillExpected.map(tx => (
                  <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{tx.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-600">{tx.category}</span>
                        {tx.person && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-600 italic">~{tx.date.slice(5).replace('-', '/')}</span>
                      <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Charged so far — by category */}
      {filteredTxs.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">Charged So Far — All Transactions</span>
          </div>
          <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
            {[...filteredTxs].sort((a, b) => b.amount - a.amount).map(tx => (
              <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 truncate">{tx.description}</span>
                    {tx.isRecurring && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 flex-shrink-0">recurring</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-600">{tx.date}</span>
                    <span className="text-xs text-slate-700">{tx.category}</span>
                    {tx.person && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right flex-shrink-0">{fmt(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
