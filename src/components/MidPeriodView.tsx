import { useState } from 'react'
import type { CCMonthlyAnalysis, CCTransaction } from '../types'
import { useFormatCurrency } from '../lib/useFormatCurrency'

function groupByCategory(txs: CCTransaction[]) {
  const map = new Map<string, { txList: CCTransaction[]; total: number }>()
  for (const tx of txs) {
    const e = map.get(tx.category)
    if (e) { e.txList.push(tx); e.total += tx.amount }
    else map.set(tx.category, { txList: [tx], total: tx.amount })
  }
  return [...map.entries()]
    .map(([cat, d]) => ({ cat, ...d }))
    .sort((a, b) => b.total - a.total)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'com', 'inc', 'llc', 'us', 'co'])

function descriptionWords(s: string): string[] {
  return normalize(s).split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function descriptionsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na.includes(nb) || nb.includes(na)) return true
  const wa = descriptionWords(a)
  const wb = new Set(descriptionWords(b))
  const overlap = wa.filter(w => wb.has(w)).length
  return overlap >= 2 || (overlap >= 1 && wa.length <= 2)
}

// A base recurring item is "covered" if either:
// 1. A mid-period transaction matches by description, OR
// 2. A mid-period RECURRING transaction is in the same category
//    (handles provider switches like Progressive → State Farm)
function isCovered(baseTx: CCTransaction, midRecurring: CCTransaction[], midAll: CCTransaction[]): boolean {
  if (midAll.some(mid => descriptionsMatch(baseTx.description, mid.description))) return true
  if (midRecurring.some(mid => mid.category === baseTx.category)) return true
  return false
}

function TxRow({ tx, fmt }: { tx: CCTransaction; fmt: (n: number) => string }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-300 truncate">{tx.description}</div>
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
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform flex-shrink-0 text-slate-500 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
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
  const [openRecurring, setOpenRecurring] = useState(true)
  const [openOneOff, setOpenOneOff] = useState(true)
  const [openExpected, setOpenExpected] = useState(true)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const toggleCat = (key: string) => setExpandedCats(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [manualItems, setManualItems] = useState<{ id: string; description: string; amount: number }[]>([])
  const [addingManual, setAddingManual] = useState(false)
  const [manualDesc, setManualDesc] = useState('')
  const [manualAmt, setManualAmt] = useState('')
  const dismiss = (id: string) => setDismissedIds(prev => new Set([...prev, id]))
  function commitManual() {
    const desc = manualDesc.trim()
    const amt = parseFloat(manualAmt)
    if (!desc || !Number.isFinite(amt) || amt <= 0) return
    setManualItems(prev => [...prev, { id: `manual-${Date.now()}`, description: desc, amount: amt }])
    setManualDesc(''); setManualAmt(''); setAddingManual(false)
  }

  const filteredTxs = personFilter === 'All'
    ? midPeriod.transactions
    : midPeriod.transactions.filter(tx => tx.person === personFilter)

  const recurringTxs = filteredTxs.filter(tx => tx.isRecurring).sort((a, b) => b.amount - a.amount)
  const oneOffTxs = filteredTxs.filter(tx => !tx.isRecurring).sort((a, b) => b.amount - a.amount)
  const totalSoFar = filteredTxs.reduce((s, tx) => s + tx.amount, 0)
  const recurringSoFar = recurringTxs.reduce((s, tx) => s + tx.amount, 0)
  const oneOffSoFar = oneOffTxs.reduce((s, tx) => s + tx.amount, 0)

  // Base statement recurring — apply person filter
  const baseRecurring: CCTransaction[] = baseAnalysis
    ? (personFilter === 'All'
        ? baseAnalysis.transactions.filter(tx => tx.isRecurring)
        : baseAnalysis.transactions.filter(tx => tx.isRecurring && tx.person === personFilter))
    : []

  // Recurring items from base statement not yet covered mid-period
  // "Covered" = dismissed, description match, OR same category already has a recurring charge mid-period
  const stillExpectedRecurring = baseRecurring.filter(baseTx =>
    !dismissedIds.has(baseTx.id) && !isCovered(baseTx, recurringTxs, filteredTxs)
  )
  const stillExpectedRecurringTotal = stillExpectedRecurring.reduce((s, tx) => s + tx.amount, 0)
    + manualItems.filter(i => !dismissedIds.has(i.id)).reduce((s, i) => s + i.amount, 0)

  // One-off estimate: average one-off spend from base statement (can't predict specifics)
  const baseOneOffTotal = baseAnalysis
    ? (personFilter === 'All'
        ? baseAnalysis.transactions.filter(tx => !tx.isRecurring)
        : baseAnalysis.transactions.filter(tx => !tx.isRecurring && tx.person === personFilter)
      ).reduce((s, tx) => s + tx.amount, 0)
    : 0
  const estimatedRemainingOneOff = Math.max(0, baseOneOffTotal - oneOffSoFar)

  const projectedFinal = totalSoFar + stillExpectedRecurringTotal + estimatedRemainingOneOff

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
          {baseAnalysis ? (
            <div className="text-xs text-slate-600 mt-0.5">
              {fmt(totalSoFar)} charged
              {stillExpectedRecurringTotal > 0 && ` + ${fmt(stillExpectedRecurringTotal)} recurring still coming`}
              {estimatedRemainingOneOff > 0 && ` + ~${fmt(estimatedRemainingOneOff)} one-offs est.`}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-0.5 italic">Load a past statement to project remaining charges</div>
          )}
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
      </div>

      {/* Still Expected — Recurring */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setOpenExpected(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
        >
          <div className="flex items-center gap-2">
            <Chevron open={openExpected} />
            <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">Still Expected — Recurring</span>
            <span className="text-xs text-slate-600">{stillExpectedRecurring.length + manualItems.filter(i => !dismissedIds.has(i.id)).length} items</span>
          </div>
          <span className="text-sm font-semibold text-blue-400 tabular-nums">{fmt(stillExpectedRecurringTotal)}</span>
        </button>
        {openExpected && (
          <div className="divide-y divide-slate-700/30">
            {stillExpectedRecurring.length === 0 && manualItems.filter(i => !dismissedIds.has(i.id)).length === 0 && (
              <div className="px-4 py-4 text-center text-xs text-slate-500">
                {baseAnalysis ? `All recurring items from ${baseAnalysis.month} have already posted.` : 'No items — add one below.'}
              </div>
            )}
            {/* From base statement */}
            {stillExpectedRecurring.map(tx => (
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
                  <button onClick={() => dismiss(tx.id)} title="Remove" className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {/* Manually added */}
            {manualItems.filter(i => !dismissedIds.has(i.id)).map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-300 truncate">{item.description}</div>
                  <div className="text-xs text-slate-600 mt-0.5">manually added</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(item.amount)}</span>
                  <button onClick={() => dismiss(item.id)} title="Remove" className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {/* Add row */}
            {addingManual ? (
              <div className="px-4 py-2.5 flex items-center gap-2 bg-slate-900/30">
                <input
                  autoFocus
                  placeholder="Description"
                  className="flex-1 bg-slate-700 text-sm text-slate-200 rounded px-2 py-1 border border-slate-600 focus:border-blue-500 outline-none"
                  value={manualDesc}
                  onChange={e => setManualDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitManual(); if (e.key === 'Escape') setAddingManual(false) }}
                />
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  className="w-24 bg-slate-700 text-sm text-slate-200 rounded px-2 py-1 border border-slate-600 focus:border-blue-500 outline-none text-right tabular-nums"
                  value={manualAmt}
                  onChange={e => setManualAmt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitManual(); if (e.key === 'Escape') setAddingManual(false) }}
                />
                <button onClick={commitManual} className="text-slate-500 hover:text-emerald-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </button>
                <button onClick={() => setAddingManual(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingManual(true)}
                className="w-full px-4 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors text-left flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add expected item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Still Expected — One-offs estimate */}
      {baseAnalysis && baseOneOffTotal > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">One-offs Estimate</span>
            <span className="text-sm font-semibold text-amber-400 tabular-nums">~{fmt(estimatedRemainingOneOff)}</span>
          </div>
          <div className="text-xs text-slate-600">
            {fmt(baseOneOffTotal)} one-off total in {baseAnalysis.month} — {fmt(oneOffSoFar)} already posted this period
            {estimatedRemainingOneOff <= 0 && ' — you\'ve already matched or exceeded last month\'s one-off spend'}
          </div>
        </div>
      )}

      {/* By Category — Recurring (posted) */}
      {recurringTxs.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenRecurring(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <Chevron open={openRecurring} />
              <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">By Category — Recurring</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500">{recurringTxs.length} items</span>
              <span className="text-sm font-semibold text-blue-400 tabular-nums">{fmt(recurringSoFar)}</span>
            </div>
          </button>
          {openRecurring && groupByCategory(recurringTxs).map(({ cat, txList, total: catTotal }) => {
            const catKey = `r:${cat}`
            const catOpen = expandedCats.has(catKey)
            return (
              <div key={catKey} className="border-b border-slate-700/30 last:border-b-0">
                <button onClick={() => toggleCat(catKey)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <Chevron open={catOpen} />
                    <span className="text-sm text-slate-200">{cat}</span>
                    <span className="text-xs text-slate-600">{txList.length} {txList.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-300 tabular-nums">{fmt(catTotal)}</span>
                </button>
                {catOpen && (
                  <div className="bg-slate-900/30">
                    {txList.map(tx => (
                      <div key={tx.id} className="pl-8 pr-4 py-2 flex items-center gap-2 border-t border-slate-700/20">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-300 truncate">{tx.description}</div>
                          <div className="text-xs text-slate-600">{tx.date}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {tx.person && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>}
                          <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* By Category — One-off (posted) */}
      {oneOffTxs.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenOneOff(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <Chevron open={openOneOff} />
              <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">By Category — One Off</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500">{oneOffTxs.length} items</span>
              <span className="text-sm font-semibold text-amber-400 tabular-nums">{fmt(oneOffSoFar)}</span>
            </div>
          </button>
          {openOneOff && groupByCategory(oneOffTxs).map(({ cat, txList, total: catTotal }) => {
            const catKey = `o:${cat}`
            const catOpen = expandedCats.has(catKey)
            return (
              <div key={catKey} className="border-b border-slate-700/30 last:border-b-0">
                <button onClick={() => toggleCat(catKey)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <Chevron open={catOpen} />
                    <span className="text-sm text-slate-200">{cat}</span>
                    <span className="text-xs text-slate-600">{txList.length} {txList.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-300 tabular-nums">{fmt(catTotal)}</span>
                </button>
                {catOpen && (
                  <div className="bg-slate-900/30">
                    {txList.map(tx => (
                      <div key={tx.id} className="pl-8 pr-4 py-2 flex items-center gap-2 border-t border-slate-700/20">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-300 truncate">{tx.description}</div>
                          <div className="text-xs text-slate-600">{tx.date}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {tx.person && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>}
                          <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
