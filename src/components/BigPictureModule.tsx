import React, { useState } from 'react'
import { useStore } from '../store'
import { calcForecast, periodEndDate, formatDate, buildProjectedOpenings } from '../lib/periods'
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
  const payFrequency = useStore(s => s.payFrequency)
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
  const bigPictureNotes = useStore(s => s.bigPictureNotes)
  const addBigPictureNote = useStore(s => s.addBigPictureNote)
  const updateBigPictureNote = useStore(s => s.updateBigPictureNote)
  const deleteBigPictureNote = useStore(s => s.deleteBigPictureNote)

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
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [ccStillOutOpen, setCCStillOutOpen] = useState(false)
  const [specOpen, setSpecOpen] = useState(false)
  const [hsaOpen, setHsaOpen] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(true)
  const [openAccts, setOpenAccts] = useState<Record<string, boolean>>({})

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

  // ── Period-aware checking forecast rows ───────────────────────────────────
  // Group checking forecast items by pay period
  const checkingByPeriod = new Map<string, number>()
  for (const fi of forecastItems) {
    if (fi.accountId !== 'checking') continue
    const idx = periods.findIndex((p, i) => {
      const nextStart = periods[i + 1]?.startDate ?? '9999-12-31'
      return fi.date >= p.startDate && fi.date < nextStart
    })
    if (idx >= 0) {
      const pid = periods[idx].id
      checkingByPeriod.set(pid, (checkingByPeriod.get(pid) ?? 0) + fi.amount)
    }
  }

  interface PeriodRow { label: string; end: number; isCurrent: boolean }
  const checkingPeriodRows: PeriodRow[] = []

  if (currentPeriod) {
    const currentPeriodIdx = periods.findIndex(p => p.id === currentPeriod.id)
    const allProjectedOpenings = buildProjectedOpenings(periods, periodItems, extras, bills)
    const lastIdx = Math.min(currentPeriodIdx + 5, periods.length - 1)

    let prevEnd: number | null = null
    for (let i = currentPeriodIdx; i <= lastIdx; i++) {
      const p = periods[i]
      const opening = i === currentPeriodIdx
        ? (p.openingBalance ?? allProjectedOpenings.get(p.id) ?? null)
        : (prevEnd !== null ? prevEnd + p.payAmount : null)
      if (opening === null) break
      const baseForecast = calcForecast(
        { ...p, openingBalance: opening },
        periodItems.filter(item => item.periodId === p.id),
        bills,
        extras.filter(e => e.periodId === p.id),
      )
      if (baseForecast === null) break
      const end = baseForecast + (checkingByPeriod.get(p.id) ?? 0)
      checkingPeriodRows.push({
        label: `${formatDate(p.startDate)} – ${formatDate(periodEndDate(p.startDate, payFrequency))}`,
        end,
        isCurrent: p.id === currentPeriod.id,
      })
      prevEnd = end
    }
  }

  // ── Month-aware CC forecast rows ──────────────────────────────────────────
  const ccByMonth = new Map<string, number>()
  for (const fi of forecastItems) {
    if (fi.accountId !== 'cc') continue
    const month = fi.date.slice(0, 7)
    ccByMonth.set(month, (ccByMonth.get(month) ?? 0) + fi.amount)
  }

  interface MonthRow { label: string; end: number; isCurrent: boolean }
  const ccMonthRows: MonthRow[] = []

  if (ccCurrentBalance !== null) {
    const currentMonth = today.slice(0, 7)
    const allMonths = new Set([currentMonth, ...Array.from(ccByMonth.keys())])
    const sortedMonths = [...allMonths].filter(m => m >= currentMonth).sort()
    let running = ccCurrentBalance
    for (const month of sortedMonths) {
      const isCurrentMonth = month === currentMonth
      if (isCurrentMonth) {
        running = (ccProjectedFinal ?? ccCurrentBalance) + (ccByMonth.get(month) ?? 0)
      } else {
        running = running + (ccByMonth.get(month) ?? 0)
      }
      const [y, m] = month.split('-')
      const label = new Date(parseInt(y!), parseInt(m!) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      ccMonthRows.push({ label, end: running, isCurrent: isCurrentMonth })
    }
  }

  // ── Simple totals for Spec / HSA / BOA (no period structure) ─────────────
  const forecastTotals: Record<string, number> = {}
  for (const fi of forecastItems) {
    forecastTotals[fi.accountId] = (forecastTotals[fi.accountId] ?? 0) + fi.amount
  }
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
    cc: ccProjectedFinal ?? ccCurrentBalance ?? 0,
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* Checking */}
        <Tile label="Checking">
          {editingChecking ? (
            <input autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={checkingDraft}
              onChange={e => setCheckingDraft(e.target.value)}
              onBlur={commitChecking}
              onKeyDown={e => { if (e.key === 'Enter') commitChecking(); if (e.key === 'Escape') setEditingChecking(false) }}
            />
          ) : (
            <TileBigNum onEdit={() => { setCheckingDraft(checkingBalance?.toString() ?? ''); setEditingChecking(true) }}>
              {checkingBalance !== null ? fmt(checkingBalance) : null}
            </TileBigNum>
          )}
          {checkingPeriodRows.length > 0 && (() => {
            const safeIdx = Math.min(selectedPeriodIdx, checkingPeriodRows.length - 1)
            const row = checkingPeriodRows[safeIdx]!
            return (
              <TileRow label={
                checkingPeriodRows.length > 1
                  ? <select
                      className="bg-transparent text-slate-500 text-xs outline-none cursor-pointer"
                      value={safeIdx}
                      onChange={e => setSelectedPeriodIdx(Number(e.target.value))}
                    >
                      {checkingPeriodRows.map((r, i) => (
                        <option key={i} value={i}>{r.label}</option>
                      ))}
                    </select>
                  : row.label
              }>
                <span className="text-sm font-semibold text-slate-100">{fmt(row.end)}</span>
              </TileRow>
            )
          })()}
          {stillOutItems.length > 0 && (
            <TileCollapsible
              open={stillOutOpen} onToggle={() => setStillOutOpen(o => !o)}
              summary={<><span className="text-amber-500/80">{fmt(stillOutTotal)} still out</span><span className="text-slate-600 ml-1">({stillOutItems.length})</span></>}
            >
              {stillOutItems.map((item, i) => (
                <TileRow key={i} label={item.name}><span className="text-slate-500">{fmt(item.amount)}</span></TileRow>
              ))}
            </TileCollapsible>
          )}
        </Tile>

        {/* CC */}
        <Tile label="Credit Card">
          {editingCC ? (
            <input autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={ccDraft}
              onChange={e => setCCDraft(e.target.value)}
              onBlur={commitCC}
              onKeyDown={e => { if (e.key === 'Enter') commitCC(); if (e.key === 'Escape') setEditingCC(false) }}
            />
          ) : (
            <TileBigNum onEdit={() => { setCCDraft(ccCurrentBalance?.toString() ?? ''); setEditingCC(true) }}>
              {ccCurrentBalance !== null ? fmt(ccCurrentBalance) : null}
            </TileBigNum>
          )}
          {ccMonthRows.map((row, i) => (
            <TileRow key={i} label={row.label}>
              <span className="text-sm font-semibold text-slate-100">{fmt(row.end)}</span>
            </TileRow>
          ))}
          {remainingRecurring.length > 0 && ccCurrentBalance !== null && (
            <TileCollapsible
              open={ccStillOutOpen} onToggle={() => setCCStillOutOpen(o => !o)}
              summary={<><span className="text-amber-500/80">+{fmt(remainingRecurringTotal)} expected</span><span className="text-slate-600 ml-1">({remainingRecurring.length})</span></>}
            >
              {remainingRecurring.map(tx => (
                <TileRow key={tx.id} label={tx.description}><span className="text-slate-500">{fmtExact(tx.amount)}</span></TileRow>
              ))}
            </TileCollapsible>
          )}
        </Tile>

        {/* Spec */}
        <Tile label="Spec">
          <TileBigNum>{fmt(specTotal)}</TileBigNum>
          {specEndForecast !== null && specEndForecast !== specTotal && (
            <TileRow label="Forecast">
              <span className="text-sm font-semibold text-slate-100">{fmt(specEndForecast)}</span>
            </TileRow>
          )}
          {specAccounts.length > 0 && (
            <TileCollapsible
              open={specOpen} onToggle={() => setSpecOpen(o => !o)}
              summary={<span className="text-slate-500">{specAccounts.length} account{specAccounts.length !== 1 ? 's' : ''}</span>}
            >
              {specAccounts.map(a => (
                <TileRow key={a.id} label={a.name}><span className="text-slate-500">{fmt(a.balance)}</span></TileRow>
              ))}
            </TileCollapsible>
          )}
        </Tile>

        {/* HSA */}
        {hsaAccounts.length > 0 && (
          <Tile label="HSA">
            <TileBigNum>{fmt(hsaTotal)}</TileBigNum>
            {hsaEndForecast !== null && hsaEndForecast !== hsaTotal && (
              <TileRow label="Forecast">
                <span className="text-sm font-semibold text-slate-100">{fmt(hsaEndForecast)}</span>
              </TileRow>
            )}
            {hsaAccounts.length > 1 ? (
              <TileCollapsible
                open={hsaOpen} onToggle={() => setHsaOpen(o => !o)}
                summary={<span className="text-slate-500">{hsaAccounts.length} accounts</span>}
              >
                {hsaAccounts.map(a => (
                  <TileRow key={a.id} label={a.name}><span className="text-slate-500">{fmt(a.balance)}</span></TileRow>
                ))}
              </TileCollapsible>
            ) : (
              <div className="text-xs text-slate-600 pt-0.5">{hsaAccounts[0]?.institution ?? ''}</div>
            )}
          </Tile>
        )}

        {/* BOA Savings */}
        <Tile label={boaAccount ? boaAccount.institution : 'Savings'}>
          {!boaAccount ? (
            <div className="text-xs text-slate-600 pt-1">No BOA/savings account found</div>
          ) : editingBOA ? (
            <input autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              value={boaDraft}
              onChange={e => setBoaDraft(e.target.value)}
              onBlur={commitBOA}
              onKeyDown={e => { if (e.key === 'Enter') commitBOA(); if (e.key === 'Escape') setEditingBOA(false) }}
            />
          ) : (
            <TileBigNum onEdit={() => { setBoaDraft(boaAccount.balance.toString()); setEditingBOA(true) }}>
              {fmt(boaAccount.balance)}
            </TileBigNum>
          )}
          {boaAccount && boaEndForecast !== null && boaEndForecast !== boaAccount.balance && (
            <TileRow label="Forecast">
              <span className="text-sm font-semibold text-slate-100">{fmt(boaEndForecast)}</span>
            </TileRow>
          )}
          {boaAccount && <TileRow label={boaAccount.name}><span /></TileRow>}
        </Tile>
      </div>

      {/* Forecast items */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setForecastOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-slate-400 font-medium uppercase tracking-wide hover:text-slate-200 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${forecastOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Forecast Transactions
            {forecastItems.length > 0 && <span className="text-slate-600 normal-case font-normal tracking-normal">({forecastItems.length})</span>}
          </button>
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

        {forecastOpen && (forecastItems.length === 0 && !addingItem ? (
          <div className="text-sm text-slate-600 text-center py-3">No forecast items yet — add expected deposits or expenses.</div>
        ) : (
          <div className="space-y-3">
            {acctGrouped.map(([acctId, items]) => {
              const isOpen = openAccts[acctId] === true // default closed
              const lastBalance = items[items.length - 1]!.runningBalance
              return (
                <div key={acctId}>
                  <button
                    onClick={() => setOpenAccts(s => ({ ...s, [acctId]: !isOpen }))}
                    className="flex items-center gap-1.5 w-full text-left mb-1"
                  >
                    <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-xs text-slate-400 font-medium">{accountLabel(acctId)}</span>
                    <span className="text-xs text-slate-600 ml-1">({items.length})</span>
                    {!isOpen && (
                      <span className="ml-auto text-xs text-slate-400">{fmtExact(lastBalance)}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="space-y-1 pl-4">
                      {items.map(item => (
                        <ForecastRow
                          key={item.id}
                          item={item}
                          onUpdate={(updates) => updateForecastItem(item.id, updates)}
                          onDelete={() => deleteForecastItem(item.id)}
                          accountOptions={accountOptions}
                        />
                      ))}
                      <div className="flex justify-end pt-1 border-t border-slate-700/40">
                        <span className="text-xs text-slate-500 mr-2">Balance after:</span>
                        <span className="text-xs font-semibold text-slate-300">{fmtExact(lastBalance)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

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

      {/* Scratch pad */}
      <ScratchPad notes={bigPictureNotes} onAdd={addBigPictureNote} onUpdate={updateBigPictureNote} onDelete={deleteBigPictureNote} />
    </div>
  )
}

// ── Scratch pad ───────────────────────────────────────────────────────────────

function ScratchPad({ notes, onAdd, onUpdate, onDelete }: { notes: string[]; onAdd: (t: string) => void; onUpdate: (i: number, t: string) => void; onDelete: (i: number) => void }) {
  const [draft, setDraft] = React.useState('')
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null)
  const [editDraft, setEditDraft] = React.useState('')

  function commit() {
    const t = draft.trim()
    if (t) { onAdd(t); setDraft('') }
  }
  function startEdit(i: number) {
    setEditingIdx(i)
    setEditDraft(notes[i] ?? '')
  }
  function commitEdit(i: number) {
    const t = editDraft.trim()
    if (t) onUpdate(i, t); else onDelete(i)
    setEditingIdx(null)
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Don't Forget</div>
      {notes.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-slate-500 mt-0.5 text-xs shrink-0">•</span>
              {editingIdx === i ? (
                <input
                  autoFocus
                  className="flex-1 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-white outline-none"
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => commitEdit(i)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(i); if (e.key === 'Escape') setEditingIdx(null) }}
                />
              ) : (
                <span
                  className="text-sm text-slate-200 flex-1 cursor-pointer hover:text-white"
                  onClick={() => startEdit(i)}
                >{note}</span>
              )}
              <button
                onClick={() => onDelete(i)}
                className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0 mt-0.5"
              >✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
          placeholder="add a note..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
        />
        <button
          onClick={commit}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-3 py-1.5 transition-colors"
        >Add</button>
      </div>
    </div>
  )
}

// ── Shared tile sub-components ────────────────────────────────────────────────

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-1 min-h-[110px]">
      <div className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-0.5">{label}</div>
      {children}
    </div>
  )
}

function TileBigNum({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  if (onEdit) {
    return (
      <button onClick={onEdit} className="text-2xl font-bold text-white hover:text-blue-300 transition-colors text-left w-full leading-tight">
        {children ?? <span className="text-slate-500 text-sm font-normal">tap to set</span>}
      </button>
    )
  }
  return <div className="text-2xl font-bold text-white leading-tight">{children}</div>
}

function TileRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500 truncate pr-2">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function TileCollapsible({ open, onToggle, summary, children }: {
  open: boolean
  onToggle: () => void
  summary: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-0.5">
      <button onClick={onToggle} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-left">
        <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {summary}
      </button>
      {open && <div className="mt-1 space-y-0.5 pl-3">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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
