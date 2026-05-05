import { useRef, useState } from 'react'
import { useStore } from '../store'
import { analyzeCreditCard, type StatementFile } from '../lib/analyzeCreditCard'
import { useFormatCurrency } from '../lib/useFormatCurrency'
import type { CCMonthlyAnalysis } from '../types'

const CC_CATEGORIES = [
  'Groceries', 'Dining', 'Gas', 'Amazon',
  'Streaming', 'Entertainment', 'Healthcare',
  'Home & Garden', 'Shopping', 'Travel',
  'Clothing', 'Personal Care', 'Insurance', 'Utilities', 'Other',
]

type Step = 'results' | 'upload' | 'loading'

function computeSummary(a: CCMonthlyAnalysis) {
  const totalSpend = a.transactions.reduce((sum, tx) => sum + tx.amount, 0)
  const recurringTotal = a.transactions.filter(tx => tx.isRecurring).reduce((sum, tx) => sum + tx.amount, 0)
  const oneOffTotal = a.transactions.filter(tx => !tx.isRecurring).reduce((sum, tx) => sum + tx.amount, 0)

  const catMap = new Map<string, { total: number; count: number; recurring: boolean }>()
  for (const tx of a.transactions) {
    const e = catMap.get(tx.category)
    if (e) { e.total += tx.amount; e.count++; if (tx.isRecurring) e.recurring = true }
    else catMap.set(tx.category, { total: tx.amount, count: 1, recurring: tx.isRecurring })
  }
  const categories = [...catMap.entries()]
    .map(([category, d]) => ({ category, ...d }))
    .sort((a, b) => b.total - a.total)

  return { totalSpend, recurringTotal, oneOffTotal, categories }
}

export function CCModule() {
  const fmt = useFormatCurrency()
  const anthropicApiKey = useStore(s => s.anthropicApiKey)
  const setAnthropicApiKey = useStore(s => s.setAnthropicApiKey)
  const ccAnalyses = useStore(s => s.ccAnalyses)
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

  const ccFileRef = useRef<HTMLInputElement>(null)
  const amazonFileRef = useRef<HTMLInputElement>(null)

  const analysis = ccAnalyses.find(a => a.id === selectedId) ?? null

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
      const result = await analyzeCreditCard(statementFile, amazonCsv || null, key)
      saveCCAnalysis(result)
      setSelectedId(result.id)
      setStep('results')
      setStatementFile(null); setStatementFileName(''); setAmazonCsv(''); setAmazonFileName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setStep('upload')
    }
  }

  // ── Upload form ──────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">New CC Analysis</h2>
          {ccAnalyses.length > 0 && (
            <button onClick={() => setStep('results')} className="text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
          )}
        </div>

        {/* API Key */}
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
              <button
                onClick={() => { if (apiKeyDraft) { setAnthropicApiKey(apiKeyDraft); setEditingKey(false) } }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 rounded-lg transition-colors"
              >Save</button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-mono text-sm">{'•'.repeat(20)} ...{anthropicApiKey.slice(-4)}</span>
              <button onClick={() => { setApiKeyDraft(anthropicApiKey); setEditingKey(true) }} className="text-xs text-blue-400 hover:text-blue-300">Change</button>
            </div>
          )}
          <p className="text-xs text-slate-600 mt-2">Stored locally only — sent only to the Anthropic API.</p>
        </div>

        {/* Statement file */}
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="text-xs text-slate-500 uppercase tracking-widest">Barclays Statement</div>
            <div className="text-xs text-red-400">required</div>
            <div className="text-xs text-slate-600 ml-auto">PDF or CSV</div>
          </div>
          <div
            className="border-2 border-dashed border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-blue-500/60 transition-colors"
            onClick={() => ccFileRef.current?.click()}
          >
            <input ref={ccFileRef} type="file" accept=".pdf,.csv,application/pdf,text/csv" className="hidden" onChange={handleStatementFile} />
            {statementFileName ? (
              <div>
                <div className="text-emerald-400 text-sm font-medium">{statementFileName}</div>
                <div className="text-slate-500 text-xs mt-1">
                  {statementFile?.type === 'pdf' ? 'PDF — dates read automatically' : `${(statementFile as { type: 'csv'; content: string })?.content.split('\n').length - 1} rows`}
                </div>
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

        {/* Amazon Order History CSV */}
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="text-xs text-slate-500 uppercase tracking-widest">Amazon Order History</div>
            <div className="text-xs text-slate-600">optional</div>
          </div>
          <div className="text-xs text-slate-600 mb-3">
            Enables item-level categorization of Amazon charges.
            Download from Amazon → Account → Order History Reports → Request Report (CSV).
          </div>
          <div
            className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500/40 transition-colors"
            onClick={() => amazonFileRef.current?.click()}
          >
            <input ref={amazonFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleAmazonFile} />
            {amazonFileName ? (
              <div>
                <div className="text-emerald-400 text-sm font-medium">{amazonFileName}</div>
                <div className="text-slate-500 text-xs mt-1">{amazonCsv.split('\n').length - 1} orders</div>
                <button
                  onClick={e => { e.stopPropagation(); setAmazonCsv(''); setAmazonFileName('') }}
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors mt-1"
                >Remove</button>
              </div>
            ) : (
              <div className="text-slate-600 text-sm">Click to add Amazon order history</div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">{error}</div>
        )}

        <button
          onClick={runAnalysis}
          disabled={!statementFile || (!anthropicApiKey && !apiKeyDraft)}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Analyze with Claude
        </button>
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

  // ── Empty results state ──────────────────────────────────────────────────────
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="text-slate-500 text-sm">No analyses yet</div>
        <button onClick={() => setStep('upload')} className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">
          Load a statement
        </button>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────────────────────
  const filteredTxs = personFilter === 'All'
    ? analysis.transactions
    : analysis.transactions.filter(tx => tx.person === personFilter)
  const { totalSpend, recurringTotal, oneOffTotal, categories } = computeSummary({ ...analysis, transactions: filteredTxs })
  const activeSuggestions = analysis.reductionSuggestions.filter(s => !s.dismissed)
  const sortedTxs = [...filteredTxs].sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Credit Card</h2>
          {sortedAnalyses.length > 1 ? (
            <select
              className="bg-slate-800 text-slate-300 text-sm rounded-lg px-2 py-1 border border-slate-700 outline-none"
              value={selectedId ?? ''}
              onChange={e => setSelectedId(e.target.value)}
            >
              {sortedAnalyses.map(a => (
                <option key={a.id} value={a.id}>{a.month}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-400">{analysis.month}</span>
          )}
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
            <button onClick={() => setDeleteConfirmId(analysis.id)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">
              Delete
            </button>
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

      {/* Person filter toggle */}
      <div className="flex items-center gap-1.5">
        {(['All', 'Bryan', 'Rachel'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPersonFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              personFilter === p
                ? 'bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
          >
            {p}
          </button>
        ))}
        {personFilter !== 'All' && (
          <span className="text-xs text-slate-600 ml-1">
            {analysis.transactions.filter(tx => tx.person === personFilter).length} of {analysis.transactions.length} assigned
          </span>
        )}
      </div>

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
          <div className="text-xs text-slate-600 mt-0.5">{filteredTxs.filter(t => t.isRecurring).length} items</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">One-offs</div>
          <div className="text-xl font-bold text-amber-400 tabular-nums">{fmt(oneOffTotal)}</div>
          <div className="text-xs text-slate-600 mt-0.5">{filteredTxs.filter(t => !t.isRecurring).length} items</div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: category breakdown + amazon + transactions */}
        <div className="lg:col-span-2 space-y-5">

          {/* Category Breakdown */}
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="text-xs text-slate-500 uppercase tracking-widest">By Category</div>
              <div className="text-xs text-slate-600">{analysis.transactions.length} transactions · {fmt(totalSpend)} total</div>
            </div>
            <div className="divide-y divide-slate-700/30">
              {categories.map(cat => (
                <div key={cat.category} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200">{cat.category}</span>
                    {cat.recurring && (
                      <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">recurring</span>
                    )}
                    <span className="text-xs text-slate-600">{cat.count} {cat.count === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="text-sm font-semibold text-white tabular-nums">{fmt(cat.total)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* All Transactions */}
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <div className="text-xs text-slate-500 uppercase tracking-widest">All Transactions</div>
              <div className="text-xs text-slate-600 mt-0.5">Click category badge to change · Click recurring/one-off to toggle</div>
            </div>
            <div className="divide-y divide-slate-700/30 max-h-[480px] overflow-y-auto">
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
                    {/* Recurring toggle */}
                    <button
                      onClick={() => updateCCTransaction(analysis.id, tx.id, { isRecurring: !tx.isRecurring })}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                        tx.isRecurring
                          ? 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60'
                          : 'bg-slate-700/50 text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {tx.isRecurring ? 'recurring' : 'one-off'}
                    </button>
                    {/* Category badge / inline select */}
                    {editingCatTxId === tx.id ? (
                      <select
                        autoFocus
                        className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 outline-none"
                        value={tx.category}
                        onChange={e => {
                          updateCCTransaction(analysis.id, tx.id, { category: e.target.value })
                          setEditingCatTxId(null)
                        }}
                        onBlur={() => setEditingCatTxId(null)}
                      >
                        {CC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingCatTxId(tx.id)}
                        className="text-xs bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors max-w-[120px] truncate"
                        title={`${tx.category} — click to change`}
                      >
                        {tx.category}
                      </button>
                    )}
                    {tx.person && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.person === 'Bryan' ? 'bg-violet-900/50 text-violet-300' : 'bg-pink-900/50 text-pink-300'}`}>
                        {tx.person}
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-300 tabular-nums w-16 text-right">{fmt(tx.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: notes + suggestions */}
        <div className="space-y-5">
          {/* Summary notes */}
          {analysis.notes && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Summary</div>
              <p className="text-slate-300 text-sm leading-relaxed">{analysis.notes}</p>
            </div>
          )}

          {/* Reduction suggestions */}
          {activeSuggestions.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Ways to Save</div>
              <div className="space-y-2">
                {activeSuggestions.map(sug => (
                  <div key={sug.id} className="bg-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-slate-300 leading-relaxed">{sug.description}</p>
                        {sug.potentialSavings != null && (
                          <div className="text-xs text-emerald-400 mt-1.5 font-medium">~{fmt(sug.potentialSavings)}/mo</div>
                        )}
                      </div>
                      <button
                        onClick={() => dismissCCSuggestion(analysis.id, sug.id)}
                        className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
                        title="Dismiss"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSuggestions.length === 0 && analysis.reductionSuggestions.length > 0 && (
            <div className="text-xs text-slate-600 text-center py-4">All suggestions dismissed</div>
          )}
        </div>
      </div>
    </div>
  )
}
