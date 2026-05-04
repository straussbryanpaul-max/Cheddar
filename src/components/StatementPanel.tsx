import { useRef, useState } from 'react'
import { useStore } from '../store'
import { analyzeStatement, type StatementAnalysis } from '../lib/analyzeStatement'
import { formatCurrency, formatDate, periodEndDate } from '../lib/periods'

interface Props {
  periodId: string
  periodStart: string
  onClose: () => void
}

type Step = 'upload' | 'loading' | 'results'

export function StatementPanel({ periodId, periodStart, onClose }: Props) {
  const bills = useStore(s => s.bills)
  const periods = useStore(s => s.periods)
  const anthropicApiKey = useStore(s => s.anthropicApiKey)
  const setAnthropicApiKey = useStore(s => s.setAnthropicApiKey)
  const updateBill = useStore(s => s.updateBill)
  const setPeriodActuals = useStore(s => s.setPeriodActuals)
  const payFrequency = useStore(s => s.payFrequency)

  const [step, setStep] = useState<Step>('upload')
  const [apiKeyDraft, setApiKeyDraft] = useState(anthropicApiKey)
  const [editingKey, setEditingKey] = useState(!anthropicApiKey)
  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [startDate, setStartDate] = useState(periodStart)
  const [endDate, setEndDate] = useState(periodEndDate(periodStart, payFrequency))
  const [analysis, setAnalysis] = useState<StatementAnalysis | null>(null)
  const [error, setError] = useState('')
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set())
  const [savedToPeriod, setSavedToPeriod] = useState<string | null>(null)
  const [savePeriodId, setSavePeriodId] = useState(periodId)

  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setCsvContent(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function runAnalysis() {
    if (!csvContent) { setError('Please select a CSV file first.'); return }
    const key = editingKey ? apiKeyDraft : anthropicApiKey
    if (!key) { setError('An Anthropic API key is required.'); return }
    if (editingKey) {
      setAnthropicApiKey(apiKeyDraft)
      setEditingKey(false)
    }
    setError('')
    setStep('loading')
    try {
      const result = await analyzeStatement(csvContent, bills, startDate, endDate, key)
      setAnalysis(result)
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setStep('upload')
    }
  }

  function applySuggestion(billId: string, amount: number) {
    updateBill(billId, { amount })
    setAppliedSuggestions(prev => new Set([...prev, billId]))
  }

  function saveActuals() {
    if (!analysis) return
    const entries = analysis.summary.map(row => ({
      category: row.category,
      billId: row.billId,
      billName: row.billName,
      budgeted: row.budgeted,
      actual: Math.abs(row.actual),
    }))
    const rangeLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`
    setPeriodActuals(savePeriodId, entries, rangeLabel)
    setSavedToPeriod(savePeriodId)
  }

  const periodLabel = `${startDate} → ${endDate}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-xl h-screen bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Statement Analysis</div>
            <div className="text-white font-semibold">{analysis ? analysis.periodLabel : periodLabel}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Upload step */}
          {step === 'upload' && (
            <div className="p-5 space-y-5">
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
                      onKeyDown={e => {
                        if (e.key === 'Enter' && apiKeyDraft) {
                          setAnthropicApiKey(apiKeyDraft)
                          setEditingKey(false)
                        }
                      }}
                    />
                    <button
                      onClick={() => { if (apiKeyDraft) { setAnthropicApiKey(apiKeyDraft); setEditingKey(false) } }}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-mono text-sm">{'•'.repeat(20)} ...{anthropicApiKey.slice(-4)}</span>
                    <button
                      onClick={() => { setApiKeyDraft(anthropicApiKey); setEditingKey(true) }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-2">Key is stored locally only and never sent anywhere except the Anthropic API.</p>
              </div>

              {/* Date range */}
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Statement Date Range</div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">From</label>
                    <input
                      type="date"
                      className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">To</label>
                    <input
                      type="date"
                      className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* File upload */}
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Bank Statement (CSV)</div>
                <div
                  className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500/60 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                  {fileName ? (
                    <div>
                      <div className="text-emerald-400 text-sm font-medium mb-1">{fileName}</div>
                      <div className="text-slate-500 text-xs">{csvContent.split('\n').length - 1} rows</div>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <div className="text-slate-400 text-sm">Click to select CSV</div>
                      <div className="text-slate-600 text-xs mt-1">Export from your bank's website</div>
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">{error}</div>}

              <button
                onClick={runAnalysis}
                disabled={!csvContent || (!anthropicApiKey && !apiKeyDraft)}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Analyze with Claude
              </button>
            </div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <div className="text-slate-400 text-sm">Analyzing with Claude...</div>
              <div className="text-slate-600 text-xs">This may take 15–30 seconds</div>
            </div>
          )}

          {/* Results */}
          {step === 'results' && analysis && (
            <div className="p-5 space-y-5">
              {/* Notes */}
              {analysis.notes && (
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Summary</div>
                  <p className="text-slate-300 text-sm leading-relaxed">{analysis.notes}</p>
                </div>
              )}

              {/* Actuals vs Budget */}
              {analysis.summary.length > 0 && (
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/50">
                    <div className="text-xs text-slate-500 uppercase tracking-widest">Actuals vs Budget</div>
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {analysis.summary.map((row, i) => {
                      const over = row.delta < 0
                      return (
                        <div key={i} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm text-slate-200 font-medium">{row.billName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Budgeted {formatCurrency(row.budgeted)} · Actual {formatCurrency(Math.abs(row.actual))}
                            </div>
                          </div>
                          <div className={`text-sm font-semibold tabular-nums ${over ? 'text-red-400' : 'text-emerald-400'}`}>
                            {over ? '−' : '+'}{formatCurrency(Math.abs(row.delta))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Budget Suggestions</div>
                  <div className="space-y-2">
                    {analysis.suggestions.map((s, i) => {
                      const applied = appliedSuggestions.has(s.billId)
                      return (
                        <div key={i} className="bg-slate-800 rounded-xl p-4 flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-200">{s.billName}</span>
                              <span className="text-xs text-slate-500">{formatCurrency(s.currentAmount)} → {formatCurrency(s.suggestedAmount)}</span>
                            </div>
                            <p className="text-xs text-slate-500">{s.reason}</p>
                          </div>
                          <button
                            onClick={() => applySuggestion(s.billId, s.suggestedAmount)}
                            disabled={applied}
                            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              applied
                                ? 'bg-emerald-900/40 text-emerald-500 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                          >
                            {applied ? 'Applied' : 'Apply'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Transactions */}
              {analysis.transactions.length > 0 && (
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/50">
                    <div className="text-xs text-slate-500 uppercase tracking-widest">
                      Transactions ({analysis.transactions.length})
                    </div>
                  </div>
                  <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
                    {analysis.transactions.map((tx, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-300 truncate">{tx.description}</div>
                          <div className="text-xs text-slate-600">{tx.date} · {tx.category}</div>
                        </div>
                        <div className={`text-sm font-medium tabular-nums flex-shrink-0 ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncategorized */}
              {analysis.uncategorized.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/50">
                    <div className="text-xs text-slate-500 uppercase tracking-widest">
                      Uncategorized ({analysis.uncategorized.length})
                    </div>
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {analysis.uncategorized.map((tx, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-400 truncate">{tx.description}</div>
                          <div className="text-xs text-slate-600">{tx.date}</div>
                        </div>
                        <div className="text-sm text-slate-500 tabular-nums flex-shrink-0">
                          {tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save actuals to period */}
              {analysis.summary.length > 0 && (
                <div className="bg-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Save Actuals to Period</div>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                      value={savePeriodId}
                      onChange={e => { setSavePeriodId(e.target.value); setSavedToPeriod(null) }}
                    >
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>
                          {formatDate(p.startDate)} – {formatDate(periodEndDate(p.startDate, payFrequency))}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={saveActuals}
                      disabled={savedToPeriod === savePeriodId}
                      className={`flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                        savedToPeriod === savePeriodId
                          ? 'bg-emerald-900/40 text-emerald-500 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {savedToPeriod === savePeriodId ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Actuals will appear on the selected period card.</p>
                </div>
              )}

              <button
                onClick={() => { setStep('upload'); setAnalysis(null); setAppliedSuggestions(new Set()); setSavedToPeriod(null) }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Analyze Another Statement
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
