import { useState } from 'react'
import { useStore } from '../store'
import { calcForecast } from '../lib/periods'
import type { ForecastItem } from '../types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtExact(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AmountColor({ amount }: { amount: number }) {
  const cls = amount >= 0 ? 'text-emerald-400' : 'text-red-400'
  return <span className={cls}>{amount >= 0 ? '+' : ''}{fmtExact(amount)}</span>
}

export function BigPictureModule() {
  const periods = useStore(s => s.periods)
  const periodItems = useStore(s => s.periodItems)
  const bills = useStore(s => s.bills)
  const extras = useStore(s => s.extras)
  const updatePeriod = useStore(s => s.updatePeriod)
  const wealthAccounts = useStore(s => s.wealthAccounts)
  const updateWealthAccount = useStore(s => s.updateWealthAccount)
  const ccAnalyses = useStore(s => s.ccAnalyses)
  const uiPrefs = useStore(s => s.uiPrefs)
  const setUiPrefs = useStore(s => s.setUiPrefs)
  const forecastItems = useStore(s => s.forecastItems)
  const addForecastItem = useStore(s => s.addForecastItem)
  const updateForecastItem = useStore(s => s.updateForecastItem)
  const deleteForecastItem = useStore(s => s.deleteForecastItem)

  // ── Current period ────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const currentPeriod = periods.reduce<typeof periods[0] | null>((found, p) =>
    p.startDate <= today ? p : found, null
  )

  // ── Checking balance editing ──────────────────────────────────────────────
  const [editingChecking, setEditingChecking] = useState(false)
  const [checkingDraft, setCheckingDraft] = useState('')

  const checkingBalance = currentPeriod?.openingBalance ?? null

  function commitChecking() {
    if (!currentPeriod) return
    const val = parseFloat(checkingDraft.replace(/[^0-9.-]/g, ''))
    if (!isNaN(val)) updatePeriod(currentPeriod.id, { openingBalance: val })
    setEditingChecking(false)
  }

  // ── Forecast at end of period ─────────────────────────────────────────────
  const periodForecast = currentPeriod
    ? calcForecast(currentPeriod, periodItems, bills, extras)
    : null

  // ── Unpaid items still coming out of checking ─────────────────────────────
  const [stillOutOpen, setStillOutOpen] = useState(false)
  const unpaidItems = currentPeriod
    ? periodItems
        .filter(i => i.periodId === currentPeriod.id && !i.paid && !i.dismissed)
        .map(i => {
          const bill = bills.find(b => b.id === i.billId)
          return bill ? { name: bill.name, amount: i.actualAmount ?? bill.amount } : null
        })
        .filter((x): x is { name: string; amount: number } => x !== null)
    : []
  const unpaidExtras = currentPeriod
    ? extras.filter(e => e.periodId === currentPeriod.id && !e.paid).map(e => ({ name: e.name, amount: e.amount }))
    : []
  const stillOutItems = [...unpaidItems, ...unpaidExtras]
  const stillOutTotal = stillOutItems.reduce((s, i) => s + i.amount, 0)

  // ── CC projection ─────────────────────────────────────────────────────────
  const { ccCurrentBalance, ccProjectionBaseId } = uiPrefs
  const [editingCC, setEditingCC] = useState(false)
  const [ccDraft, setCCDraft] = useState('')

  function commitCC() {
    const val = parseFloat(ccDraft.replace(/[^0-9.-]/g, ''))
    if (!isNaN(val)) setUiPrefs({ ccCurrentBalance: val })
    setEditingCC(false)
  }

  // Find most recent analysis for CC projection context
  const sortedAnalyses = [...ccAnalyses].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  const baseAnalysis = ccProjectionBaseId
    ? ccAnalyses.find(a => a.id === ccProjectionBaseId)
    : sortedAnalyses[0]

  // Remaining recurring charges after today's day-of-month
  const todayDay = new Date().getDate()
  const baseTxs = baseAnalysis?.transactions ?? []
  const remainingRecurring = baseTxs.filter(tx => {
    if (!tx.isRecurring) return false
    const day = parseInt(tx.date.split('-')[2] ?? '0', 10)
    return day > todayDay
  })
  const remainingRecurringTotal = remainingRecurring.reduce((s, tx) => s + tx.amount, 0)
  const ccProjectedFinal = ccCurrentBalance !== null
    ? ccCurrentBalance + remainingRecurringTotal
    : null
  const [ccStillOutOpen, setCCStillOutOpen] = useState(false)

  // ── Spec accounts ─────────────────────────────────────────────────────────
  const specAccounts = wealthAccounts.filter(a =>
    a.institution.toLowerCase() === 'spec' || a.institution.toLowerCase() === 'specfund'
  )
  const specTotal = specAccounts.reduce((s, a) => s + a.balance, 0)

  // ── HSA accounts ─────────────────────────────────────────────────────────
  const hsaAccounts = wealthAccounts.filter(a => a.type === 'hsa')
  const hsaTotal = hsaAccounts.reduce((s, a) => s + a.balance, 0)

  // ── BOA savings ──────────────────────────────────────────────────────────
  const boaAccount = wealthAccounts.find(a =>
    a.institution.toLowerCase().includes('boa') ||
    a.institution.toLowerCase().includes('bank of america')
  )
  const [editingBOA, setEditingBOA] = useState(false)
  const [boaDraft, setBoaDraft] = useState('')

  function commitBOA() {
    if (!boaAccount) return
    const val = parseFloat(boaDraft.replace(/[^0-9.-]/g, ''))
    if (!isNaN(val)) updateWealthAccount(boaAccount.id, { balance: val, balanceDate: today })
    setEditingBOA(false)
  }

  // ── Forecast items ────────────────────────────────────────────────────────
  const [addingItem, setAddingItem] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const [newDate, setNewDate] = useState(today)
  const [newAcct, setNewAcct] = useState('checking')

  function commitNewItem() {
    const amt = parseFloat(newAmt.replace(/[^0-9.-]/g, ''))
    if (!newDesc.trim() || isNaN(amt)) return
    addForecastItem({ description: newDesc.trim(), amount: amt, date: newDate, accountId: newAcct })
    setNewDesc('')
    setNewAmt('')
    setNewDate(today)
    setNewAcct('checking')
    setAddingItem(false)
  }

  // Build account options for the forecast item selector
  const savingsAccounts = wealthAccounts.filter(a =>
    ['checking', 'savings', 'money_market', 'cd', 'hsa'].includes(a.type)
  )
  const accountOptions: { id: string; label: string }[] = [
    { id: 'checking', label: 'Checking' },
    { id: 'cc', label: 'Credit Card' },
    ...savingsAccounts.map(a => ({ id: a.id, label: `${a.institution} – ${a.name}` })),
  ]

  function accountLabel(id: string) {
    if (id === 'checking') return 'Checking'
    if (id === 'cc') return 'Credit Card'
    const a = wealthAccounts.find(w => w.id === id)
    return a ? `${a.institution} – ${a.name}` : id
  }

  // ── Forecast item totals per account (for tile end-state) ────────────────
  const forecastTotals: Record<string, number> = {}
  for (const fi of forecastItems) {
    forecastTotals[fi.accountId] = (forecastTotals[fi.accountId] ?? 0) + fi.amount
  }

  // End-state forecasts for each tile
  const checkingEndForecast = periodForecast !== null
    ? periodForecast + (forecastTotals['checking'] ?? 0)
    : null
  const ccEndForecast = ccProjectedFinal !== null
    ? ccProjectedFinal + (forecastTotals['cc'] ?? 0)
    : null
  const boaEndForecast = boaAccount
    ? boaAccount.balance + (forecastTotals[boaAccount.id] ?? 0)
    : null
  const hsaEndForecast = hsaAccounts.length > 0
    ? hsaTotal + hsaAccounts.reduce((s, a) => s + (forecastTotals[a.id] ?? 0), 0)
    : null
  const specEndForecast = specAccounts.length > 0
    ? specTotal + specAccounts.reduce((s, a) => s + (forecastTotals[a.id] ?? 0), 0)
    : null

  // Compute running balances per account
  const sortedItems = [...forecastItems].sort((a, b) => a.date.localeCompare(b.date))

  // Group by account and compute running balance
  const accountBalances: Record<string, number> = {
    checking: checkingBalance ?? 0,
    cc: ccCurrentBalance ?? 0,
    ...savingsAccounts.reduce((acc, a) => ({ ...acc, [a.id]: a.balance }), {}),
  }

  const itemsWithRunning = sortedItems.map(item => {
    accountBalances[item.accountId] = (accountBalances[item.accountId] ?? 0) + item.amount
    return { ...item, runningBalance: accountBalances[item.accountId] }
  })

  // ── Account label shorthand ────────────────────────────────────────────────
  const acctGrouped = Object.entries(
    itemsWithRunning.reduce<Record<string, typeof itemsWithRunning>>((acc, item) => {
      const key = item.accountId
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {})
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white">Big Picture</h1>
        <span className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      </div>

      {/* Top tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

        {/* Checking */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Checking Now</div>
          {editingChecking ? (
            <input
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={checkingDraft}
              onChange={e => setCheckingDraft(e.target.value)}
              onBlur={commitChecking}
              onKeyDown={e => { if (e.key === 'Enter') commitChecking(); if (e.key === 'Escape') setEditingChecking(false) }}
            />
          ) : (
            <button
              onClick={() => { setCheckingDraft(checkingBalance?.toString() ?? ''); setEditingChecking(true) }}
              className="text-2xl font-bold text-white hover:text-blue-300 transition-colors text-left w-full"
            >
              {checkingBalance !== null ? fmt(checkingBalance) : <span className="text-slate-500 text-base">tap to set</span>}
            </button>
          )}
          <div className="text-xs text-slate-500">
            Forecast:{' '}
            {checkingEndForecast !== null
              ? <span className={checkingEndForecast >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(checkingEndForecast)}</span>
              : <span className="text-slate-600">—</span>
            }
            {forecastTotals['checking'] && periodForecast !== null && (
              <span className="text-slate-600 ml-1">(period {fmt(periodForecast)})</span>
            )}
          </div>
          {stillOutItems.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setStillOutOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${stillOutOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-amber-500/80">{fmt(stillOutTotal)} still out</span>
                <span className="text-slate-600">({stillOutItems.length})</span>
              </button>
              {stillOutOpen && (
                <div className="mt-1.5 space-y-0.5 pl-4">
                  {stillOutItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate pr-2">{item.name}</span>
                      <span className="text-slate-500 shrink-0">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CC */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">CC Balance</div>
          {editingCC ? (
            <input
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={ccDraft}
              onChange={e => setCCDraft(e.target.value)}
              onBlur={commitCC}
              onKeyDown={e => { if (e.key === 'Enter') commitCC(); if (e.key === 'Escape') setEditingCC(false) }}
            />
          ) : (
            <button
              onClick={() => { setCCDraft(ccCurrentBalance?.toString() ?? ''); setEditingCC(true) }}
              className="text-2xl font-bold text-white hover:text-blue-300 transition-colors text-left w-full"
            >
              {ccCurrentBalance !== null ? fmt(ccCurrentBalance) : <span className="text-slate-500 text-base">tap to set</span>}
            </button>
          )}
          <div className="text-xs text-slate-500">
            Forecast:{' '}
            {ccEndForecast !== null
              ? <span className="text-amber-400">{fmt(ccEndForecast)}</span>
              : <span className="text-slate-600">—</span>
            }
            {forecastTotals['cc'] && ccProjectedFinal !== null && (
              <span className="text-slate-600 ml-1">(period {fmt(ccProjectedFinal)})</span>
            )}
          </div>
          {remainingRecurring.length > 0 && ccCurrentBalance !== null && (
            <div className="pt-1">
              <button
                onClick={() => setCCStillOutOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${ccStillOutOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-amber-500/80">+{fmt(remainingRecurringTotal)} still expected</span>
                <span className="text-slate-600">({remainingRecurring.length})</span>
              </button>
              {ccStillOutOpen && (
                <div className="mt-1.5 space-y-0.5 pl-4">
                  {remainingRecurring.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate pr-2">{tx.description}</span>
                      <span className="text-slate-500 shrink-0">{fmtExact(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Spec */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Spec Total</div>
          <div className="text-2xl font-bold text-white">{fmt(specTotal)}</div>
          {specEndForecast !== null && specEndForecast !== specTotal && (
            <div className="text-xs text-slate-500">
              Forecast: <span className={specEndForecast >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(specEndForecast)}</span>
            </div>
          )}
          {specAccounts.length > 0 && (
            <div className="pt-1 space-y-0.5">
              {specAccounts.map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate pr-2">{a.name}</span>
                  <span className="text-slate-500 shrink-0">{fmt(a.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HSA */}
        {hsaAccounts.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">HSA</div>
            <div className="text-2xl font-bold text-white">{fmt(hsaTotal)}</div>
            {hsaEndForecast !== null && hsaEndForecast !== hsaTotal && (
              <div className="text-xs text-slate-500">
                Forecast: <span className={hsaEndForecast >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(hsaEndForecast)}</span>
              </div>
            )}
            <div className="text-xs text-slate-500">
              {hsaAccounts.length > 1
                ? `${hsaAccounts.length} accounts`
                : hsaAccounts[0]?.institution}
            </div>
          </div>
        )}

        {/* BOA Savings */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            {boaAccount ? boaAccount.institution : 'Savings'}
          </div>
          {!boaAccount ? (
            <div className="text-xs text-slate-600">No BOA account found in Savings & Retirement</div>
          ) : editingBOA ? (
            <input
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={boaDraft}
              onChange={e => setBoaDraft(e.target.value)}
              onBlur={commitBOA}
              onKeyDown={e => { if (e.key === 'Enter') commitBOA(); if (e.key === 'Escape') setEditingBOA(false) }}
            />
          ) : (
            <button
              onClick={() => { setBoaDraft(boaAccount.balance.toString()); setEditingBOA(true) }}
              className="text-2xl font-bold text-white hover:text-blue-300 transition-colors text-left w-full"
            >
              {fmt(boaAccount.balance)}
            </button>
          )}
          {boaAccount && boaEndForecast !== null && boaEndForecast !== boaAccount.balance && (
            <div className="text-xs text-slate-500">
              Forecast: <span className={boaEndForecast >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(boaEndForecast)}</span>
            </div>
          )}
          {boaAccount && <div className="text-xs text-slate-500">{boaAccount.name}</div>}
        </div>
      </div>

      {/* Forecast items */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Forecast Transactions</div>
          <button
            onClick={() => setAddingItem(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        {forecastItems.length === 0 && !addingItem ? (
          <div className="text-sm text-slate-600 text-center py-4">No forecast items yet — add expected deposits or expenses.</div>
        ) : (
          <div className="space-y-6">
            {acctGrouped.map(([acctId, items]) => (
              <div key={acctId}>
                <div className="text-xs text-slate-500 font-medium mb-2">{accountLabel(acctId)}</div>
                <div className="space-y-1">
                  {items.map(item => (
                    <ForecastRow
                      key={item.id}
                      item={item}
                      onUpdate={(updates) => updateForecastItem(item.id, updates)}
                      onDelete={() => deleteForecastItem(item.id)}
                      accountOptions={accountOptions}
                    />
                  ))}
                  {/* Final running balance for this account */}
                  <div className="flex justify-end pt-1 border-t border-slate-700/40">
                    <span className="text-xs text-slate-500 mr-2">Balance after:</span>
                    <span className={`text-xs font-semibold ${items[items.length - 1]!.runningBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtExact(items[items.length - 1]!.runningBalance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {addingItem && (
          <div className="mt-3 bg-slate-700/40 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                autoFocus
                placeholder="Description"
                className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <input
                placeholder="Amount (- to spend)"
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                value={newAmt}
                onChange={e => setNewAmt(e.target.value)}
              />
              <input
                type="date"
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
              <select
                className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                value={newAcct}
                onChange={e => setNewAcct(e.target.value)}
              >
                {accountOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAddingItem(false)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={commitNewItem}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1 font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ForecastRowProps {
  item: ForecastItem & { runningBalance: number }
  onUpdate: (updates: Partial<ForecastItem>) => void
  onDelete: () => void
  accountOptions: { id: string; label: string }[]
}

function ForecastRow({ item, onUpdate, onDelete, accountOptions }: ForecastRowProps) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(item.description)
  const [amt, setAmt] = useState(item.amount.toString())
  const [date, setDate] = useState(item.date)
  const [acct, setAcct] = useState(item.accountId)

  function commit() {
    const parsedAmt = parseFloat(amt.replace(/[^0-9.-]/g, ''))
    if (!desc.trim() || isNaN(parsedAmt)) { setEditing(false); return }
    onUpdate({ description: desc.trim(), amount: parsedAmt, date, accountId: acct })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-slate-700/40 rounded-lg p-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            autoFocus
            className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
          <input
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            value={amt}
            onChange={e => setAmt(e.target.value)}
          />
          <input
            type="date"
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <select
            className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            value={acct}
            onChange={e => setAcct(e.target.value)}
          >
            {accountOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white px-2 py-0.5">Cancel</button>
          <button onClick={commit} className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-0.5 font-medium">Save</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-slate-500 w-20 shrink-0">{item.date}</span>
      <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{item.description}</span>
      <AmountColor amount={item.amount} />
      <span className="text-xs text-slate-500 w-24 text-right shrink-0">{item.runningBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="text-slate-500 hover:text-slate-300 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button onClick={onDelete} className="text-slate-500 hover:text-red-400 p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
