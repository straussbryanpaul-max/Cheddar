import { useRef, useState } from 'react'
import { useStore } from '../store'
import { analyzeCreditCard, type StatementFile } from '../lib/analyzeCreditCard'
import { useFormatCurrency } from '../lib/useFormatCurrency'
import { CCCharts } from './CCCharts'
import type { CCMonthlyAnalysis, CCTransaction } from '../types'

const CC_CATEGORIES = [
  'Groceries', 'Dining', 'Gas', 'Amazon',
  'Streaming', 'Entertainment', 'Healthcare',
  'Home & Garden', 'Shopping', 'Travel',
  'Clothing', 'Personal Care', 'Insurance', 'Utilities', 'Other',
]

type Step = 'results' | 'upload' | 'loading'

function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''} ${className}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

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

export function CCModule() {
  const fmt = useFormatCurrency()
  const anthropicApiKey = useStore(s => s.anthropicApiKey)
  const setAnthropicApiKey = useStore(s => s.setAnthropicApiKey)
  const ccAnalyses = useStore(s => s.ccAnalyses)
  const ccMerchantMemory = useStore(s => s.ccMerchantMemory)
  const saveCCAnalysis = useStore(s => s.saveCCAnalysis)
  const updateCCTransaction = useStore(s => s.updateCCTransaction)
  const dismissCCSuggestion = useStore(s => s.dismissCCSuggestion)
  const deleteCCAnalysis = useStore(s => s.deleteCCAnalysis)

  const sortedAnalyses = [...ccAnalyses].sort((a, b) => b.id.localeCompare(a.id))
  const [selectedId, setSelectedId] = useState<string | null>(sortedAnalyses[0]?.id ?? null)
  const [step, setStep] = useState<Step>(ccAnalyses.length === 0 ? 'upload' : 'results')
  const [apiKeyDraft, setApiKeyDraft] = useState(anthropicApiKey)
  const [editingKey, setEditingKey] = useState(!anthropicApiKey)
  const [statementFile, setStatementFile] = useState<StatementFile | null>(null)
  const [statementFileName, setStatementFileName] = useState('')
  const [amazonCsv, setAmazonCsv] = useState('')
  const [amazonFileName, setAmazonFileName] = useState('')
  const [error, setError] = useState('')
  const [editingCatTxId, setEditingCatTxId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [personFilter, setPersonFilter] = useState<'All' | 'Bryan' | 'Rachel'>('All')
  const [showFlagged, setShowFlagged] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(true)
  const [oneOffOpen, setOneOffOpen] = useState(true)
  const [allTxOpen, setAllTxOpen] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  const ccFileRef = useRef<HTMLInputElement>(null)
  const amazonFileRef = useRef<HTMLInputElement>(null)

  const analysis = ccAnalyses.find(a => a.id === selectedId) ?? null

  function toggleCat(key: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleStatementFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatementFileName(file.name)
    const reader = new FileReader()
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setStatementFile({ type: 'pdf', base64: dataUrl.split(',')[1] })
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = ev => setStatementFile({ type: 'csv', content: ev.target?.result as string })
      reader.readAsText(file)
    }
  }

  function handleAmazonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAmazonFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setAmazonCsv(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function runAnalysis() {
    if (!statementFile) { setError('Please select a statement file first.'); return }
    const key = editingKey ? apiKeyDraft : anthropicApiKey
    if (!key) { setError('An Anthropic API key is required.'); return }
    if (editingKey) { setAnthropicApiKey(apiKeyDraft); setEditingKey(false) }
    setError('')
    setStep('loading')
    try {
      const result = await analyzeCreditCard(statementFile, amazonCsv || null, key, ccMerchantMemory)
      saveCCAnalysis(result)
      setSelectedId(result.id)
      setStep('results')
      setStatementFile(null); setStatementFileName(''); setAmazonCsv(''); setAmazonFileName('')
      setExpandedCats(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setStep('upload')
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">New CC Analysis</h2>
          {ccAnalyses.length > 0 && (
            <button onClick={() => setStep('results')} className="text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Anthropic API Key</div>
          {editingKey ? (
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none font-mono"
                placeholder="sk-ant-..."
                value={apiKeyDraft}
                onChange={e => setApiKeyDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && apiKeyDraft) { setAnthropicApiKey(apiKeyDraft); setEditingKey(false) } }}
              />
              <button onClick={() => { if (apiKeyDraft) { setAnthropicApiKey(apiKeyDraft); setEditingKey(false) } }} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 rounded-lg transition-colors">Save</button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-mono text-sm">{'•'.repeat(20)} ...{anthropicApiKey.slice(-4)}</span>
              <button onClick={() => { setApiKeyDraft(anthropicApiKey); setEditingKey(true) }} className="text-xs text-blue-400 hover:text-blue-300">Change</button>
            </div>
          )}
          <p className="text-xs text-slate-600 mt-2">Stored locally only — sent only to the Anthropic API.</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="text-xs text-slate-500 uppercase tracking-widest">Barclays Statement</div>
            <div className="text-xs text-red-400">required</div>
            <div className="text-xs text-slate-600 ml-auto">PDF or CSV</div>
          </div>
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-blue-500/60 transition-colors" onClick={() => ccFileRef.current?.click()}>
            <input ref={ccFileRef} type="file" accept=".pdf,.csv,application/pdf,text/csv" className="hidden" onChange={handleStatementFile} />
            {statementFileName ? (
              <div>
                <div className="text-emerald-400 text-sm font-medium">{statementFileName}</div>
                <div className="text-slate-500 text-xs mt-1">{statementFile?.type === 'pdf' ? 'PDF — dates read automatically' : `${(statementFile as { type: 'csv'; content: string })?.content.split('\n').length - 1} rows`}</div>
              </div>
            ) : (
              <div>
                <svg className="w-7 h-7 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-slate-400 text-sm">Click to select statement</div>
                <div className="text-slate-600 text-xs mt-1">Barclays account → Statements → Download (PDF or CSV)</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="text-xs text-slate-500 uppercase tracking-widest">Amazon Order History</div>
            <div className="text-xs text-slate-600">optional</div>
          </div>
          <div className="text-xs text-slate-600 mb-3">Enables item-level categorization of Amazon charges. Download from Amazon → Account → Order History Reports → Request Report (CSV).</div>
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500/40 transition-colors" onClick={() => amazonFileRef.current?.click()}>
            <input ref={amazonFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleAmazonFile} />
            {amazonFileName ? (
              <div>
                <div className="text-emerald-400 text-sm font-medium">{amazonFileName}</div>
                <div className="text-slate-500 text-xs mt-1">{amazonCsv.split('\n').length - 1} orders</div>
                <button onClick={e => { e.stopPropagation(); setAmazonCsv(''); setAmazonFileName('') }} className="text-xs text-slate-600 hover:text-red-400 transition-colors mt-1">Remove</button>
              </div>
            ) : (
              <div className="text-slate-600 text-sm">Click to add Amazon order history</div>
            )}
          </div>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">{error}</div>}

        <button
          onClick={runAnalysis}
          disabled={!statementFile || (!anthropicApiKey && !apiKeyDraft)}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >Analyze with Claude</button>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <div className="text-slate-400 text-sm">Analyzing with Claude...</div>
        <div className="text-slate-600 text-xs">This may take 20–40 seconds</div>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="text-slate-500 text-sm">No analyses yet</div>
        <button onClick={() => setStep('upload')} className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">Load a statement</button>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────────────────────
  const filteredByPerson = personFilter === 'All'
    ? analysis.transactions
    : analysis.transactions.filter(tx => tx.person === personFilter)

  const filteredTxs = showFlagged
    ? filteredByPerson.filter(tx => tx.flagged)
    : filteredByPerson

  const flaggedCount = analysis.transactions.filter(tx => tx.flagged).length

  const recurringTxs = filteredTxs.filter(tx => tx.isRecurring)
  const oneOffTxs = filteredTxs.filter(tx => !tx.isRecurring)
  const totalSpend = filteredTxs.reduce((s, tx) => s + tx.amount, 0)
  const recurringTotal = recurringTxs.reduce((s, tx) => s + tx.amount, 0)
  const oneOffTotal = oneOffTxs.reduce((s, tx) => s + tx.amount, 0)
  const recurringGroups = groupByCategory(recurringTxs)
  const oneOffGroups = groupByCategory(oneOffTxs)
  const activeSuggestions = analysis.reductionSuggestions.filter(s => !s.dismissed)
  const sortedTxs = [...filteredTxs].sort((a, b) => b.amount - a.amount)
  const selectedIdx = sortedAnalyses.findIndex(a => a.id === selectedId)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Credit Card</h2>
          <span className="text-xs text-slate-600">{analysis.statementRange}</span>
        </div>
        <div className="flex items-center gap-2">
          {deleteConfirmId === analysis.id ? (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-300">Delete this month?</span>
              <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
              <button
                onClick={() => {
                  deleteCCAnalysis(analysis.id)
                  const remaining = sortedAnalyses.filter(a => a.id !== analysis.id)
                  setSelectedId(remaining[0]?.id ?? null)
                  setDeleteConfirmId(null)
                  if (remaining.length === 0) setStep('upload')
                }}
                className="text-xs bg-red-600 hover:bg-red-500 text-white rounded px-2 py-0.5 font-medium"
              >Delete</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirmId(analysis.id)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete</button>
          )}
          <button
            onClick={() => setStep('upload')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            New Analysis
          </button>
        </div>
      </div>

      {/* Month tabs */}
      {sortedAnalyses.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {sortedAnalyses.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${a.id === selectedId ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >{a.month}</button>
          ))}
        </div>
      )}

      {/* Person filter + Flagged toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(['All', 'Bryan', 'Rachel'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPersonFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${personFilter === p ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
            >{p}</button>
          ))}
          {personFilter !== 'All' && (
            <span className="text-xs text-slate-600 ml-1">
              {analysis.transactions.filter(tx => tx.person === personFilter).length} of {analysis.transactions.length} assigned
            </span>
          )}
        </div>
        <button
          onClick={() => setShowFlagged(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${showFlagged ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
        >
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${showFlagged ? 'fill-amber-400' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z" />
          </svg>
          Flagged{flaggedCount > 0 ? ` (${flaggedCount})` : ''}
        </button>
      </div>

      {/* Two-column: transactions left, chart sidebar right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
      <div className="space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Total Spend</div>
          <div className="text-xl font-bold text-white tabular-nums">{fmt(totalSpend)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{filteredTxs.length} charges</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Recurring</div>
          <div className="text-xl font-bold text-blue-400 tabular-nums">{fmt(recurringTotal)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{recurringTxs.length} items</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">One-offs</div>
          <div className="text-xl font-bold text-amber-400 tabular-nums">{fmt(oneOffTotal)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{oneOffTxs.length} items</div>
        </div>
      </div>

      {/* ── By Category — Recurring ─────────────────────────────────────────── */}
      {recurringGroups.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setRecurringOpen(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <Chevron open={recurringOpen} className="text-slate-500" />
              <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">By Category — Recurring</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500">{recurringTxs.length} items</span>
              <span className="text-sm font-semibold text-blue-400 tabular-nums">{fmt(recurringTotal)}</span>
            </div>
          </button>

          {recurringOpen && recurringGroups.map(({ cat, txList, total: catTotal }) => {
            const catKey = `r:${cat}`
            const catOpen = expandedCats.has(catKey)
            return (
              <div key={catKey} className="border-b border-slate-700/30 last:border-b-0">
                <button
                  onClick={() => toggleCat(catKey)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Chevron open={catOpen} className="text-slate-600" />
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
                          <button
                            onClick={() => updateCCTransaction(analysis.id, tx.id, { isRecurring: false })}
                            className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 transition-colors"
                          >recurring</button>
                          {editingCatTxId === tx.id ? (
                            <select
                              autoFocus
                              className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none"
                              value={tx.category}
                              onChange={e => { updateCCTransaction(analysis.id, tx.id, { category: e.target.value }); setEditingCatTxId(null) }}
                              onBlur={() => setEditingCatTxId(null)}
                            >
                              {CC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCatTxId(tx.id)}
                              className="text-xs bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors max-w-[100px] truncate"
                            >{tx.category}</button>
                          )}
                          {tx.person && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>
                          )}
                          <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                          <button onClick={() => updateCCTransaction(analysis.id, tx.id, { flagged: !tx.flagged })} className="flex-shrink-0 ml-0.5" title={tx.flagged ? 'Unflag' : 'Flag for follow-up'}>
                            <svg className={`w-3.5 h-3.5 transition-colors ${tx.flagged ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-600 hover:text-amber-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z" />
                            </svg>
                          </button>
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

      {/* ── By Category — One Off ───────────────────────────────────────────── */}
      {oneOffGroups.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setOneOffOpen(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors border-b border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <Chevron open={oneOffOpen} className="text-slate-500" />
              <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">By Category — One Off</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500">{oneOffTxs.length} items</span>
              <span className="text-sm font-semibold text-amber-400 tabular-nums">{fmt(oneOffTotal)}</span>
            </div>
          </button>

          {oneOffOpen && oneOffGroups.map(({ cat, txList, total: catTotal }) => {
            const catKey = `o:${cat}`
            const catOpen = expandedCats.has(catKey)
            return (
              <div key={catKey} className="border-b border-slate-700/30 last:border-b-0">
                <button
                  onClick={() => toggleCat(catKey)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Chevron open={catOpen} className="text-slate-600" />
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
                          <button
                            onClick={() => updateCCTransaction(analysis.id, tx.id, { isRecurring: true })}
                            className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
                          >one-off</button>
                          {editingCatTxId === tx.id ? (
                            <select
                              autoFocus
                              className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none"
                              value={tx.category}
                              onChange={e => { updateCCTransaction(analysis.id, tx.id, { category: e.target.value }); setEditingCatTxId(null) }}
                              onBlur={() => setEditingCatTxId(null)}
                            >
                              {CC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCatTxId(tx.id)}
                              className="text-xs bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors max-w-[100px] truncate"
                            >{tx.category}</button>
                          )}
                          {tx.person && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>
                          )}
                          <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                          <button onClick={() => updateCCTransaction(analysis.id, tx.id, { flagged: !tx.flagged })} className="flex-shrink-0 ml-0.5" title={tx.flagged ? 'Unflag' : 'Flag for follow-up'}>
                            <svg className={`w-3.5 h-3.5 transition-colors ${tx.flagged ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-600 hover:text-amber-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z" />
                            </svg>
                          </button>
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

      {/* ── All Transactions ────────────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setAllTxOpen(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Chevron open={allTxOpen} className="text-slate-500" />
            <span className="text-xs text-slate-300 font-medium uppercase tracking-widest">All Transactions</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500">{filteredTxs.length} items</span>
            <span className="text-sm font-semibold text-slate-300 tabular-nums">{fmt(totalSpend)}</span>
          </div>
        </button>

        {allTxOpen && (
          <div className="border-t border-slate-700/50 divide-y divide-slate-700/30 max-h-[480px] overflow-y-auto">
            {sortedTxs.map(tx => (
              <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 truncate">{tx.description}</span>
                    {tx.category !== tx.aiCategory && (
                      <span className="text-xs text-amber-500/60 flex-shrink-0" title={`AI suggested: ${tx.aiCategory}`}>edited</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{tx.date}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => updateCCTransaction(analysis.id, tx.id, { isRecurring: !tx.isRecurring })}
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors ${tx.isRecurring ? 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60' : 'bg-slate-700/50 text-slate-600 hover:text-slate-400'}`}
                  >
                    {tx.isRecurring ? 'recurring' : 'one-off'}
                  </button>
                  {editingCatTxId === tx.id ? (
                    <select
                      autoFocus
                      className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none"
                      value={tx.category}
                      onChange={e => { updateCCTransaction(analysis.id, tx.id, { category: e.target.value }); setEditingCatTxId(null) }}
                      onBlur={() => setEditingCatTxId(null)}
                    >
                      {CC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingCatTxId(tx.id)}
                      className="text-xs bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors max-w-[120px] truncate"
                      title={`${tx.category} — click to change`}
                    >{tx.category}</button>
                  )}
                  {tx.person && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>{tx.person}</span>
                  )}
                  <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                  <button onClick={() => updateCCTransaction(analysis.id, tx.id, { flagged: !tx.flagged })} className="flex-shrink-0 ml-0.5" title={tx.flagged ? 'Unflag' : 'Flag for follow-up'}>
                    <svg className={`w-3.5 h-3.5 transition-colors ${tx.flagged ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-600 hover:text-amber-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes + Ways to Save */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {analysis.notes && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Summary</div>
            <p className="text-slate-300 text-sm leading-relaxed">{analysis.notes}</p>
          </div>
        )}
        {activeSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Ways to Save</div>
            {activeSuggestions.map(sug => (
              <div key={sug.id} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-slate-300 leading-relaxed">{sug.description}</p>
                    {sug.potentialSavings != null && (
                      <div className="text-xs text-emerald-400 mt-1.5 font-medium">~{fmt(sug.potentialSavings)}/mo</div>
                    )}
                  </div>
                  <button onClick={() => dismissCCSuggestion(analysis.id, sug.id)} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" title="Dismiss">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeSuggestions.length === 0 && analysis.reductionSuggestions.length > 0 && (
          <div className="text-xs text-slate-600 text-center py-4">All suggestions dismissed</div>
        )}
      </div>

      </div>{/* end left column */}

      {/* Chart sidebar */}
      <div className="lg:sticky lg:top-4">
        <CCCharts transactions={filteredByPerson} />
      </div>

      </div>{/* end two-column grid */}
    </div>
  )
}
