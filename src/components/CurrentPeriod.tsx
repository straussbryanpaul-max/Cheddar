import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { calcForecast, formatDate, periodEndDate } from '../lib/periods'
import { useFormatCurrency } from '../lib/useFormatCurrency'
import { LineItem } from './LineItem'
import { ExtraItem } from './ExtraItem'
import { AddExtraForm } from './AddExtraForm'

interface Props {
  periodId: string
  projectedOpening: number | null
  label?: string
  collapsible?: boolean
}

export function CurrentPeriod({ periodId, projectedOpening, label = 'Current Period', collapsible = false }: Props) {
  const fmt = useFormatCurrency()
  const period = useStore(s => s.periods.find(p => p.id === periodId))
  const bills = useStore(s => s.bills)
  const allItems = useStore(s => s.periodItems)
  const allExtras = useStore(s => s.extras)
  const ensurePeriodItems = useStore(s => s.ensurePeriodItems)
  const updatePeriod = useStore(s => s.updatePeriod)
  const dismissPeriodItem = useStore(s => s.dismissPeriodItem)
  const payFrequency = useStore(s => s.payFrequency)
  const defaultPayAmount = useStore(s => s.defaultPayAmount)
  const allActuals = useStore(s => s.periodActuals)
  const clearPeriodActuals = useStore(s => s.clearPeriodActuals)
  const resetPeriod = useStore(s => s.resetPeriod)
  const actuals = allActuals.find(a => a.periodId === periodId) ?? null

  const [collapsed, setCollapsed] = useState(collapsible)
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceDraft, setBalanceDraft] = useState('')
  const [editingPay, setEditingPay] = useState(false)
  const [payDraft, setPayDraft] = useState('')
  const [confirmResetPeriod, setConfirmResetPeriod] = useState(false)

  useEffect(() => {
    ensurePeriodItems(periodId)
  }, [periodId, ensurePeriodItems, bills])

  if (!period) return null

  const items = allItems.filter(i => i.periodId === periodId)
  const extras = allExtras.filter(e => e.periodId === periodId)
  const billMap = new Map(bills.map(b => [b.id, b]))

  const visibleItems = items.filter(i => {
    const bill = billMap.get(i.billId)
    return bill?.active && !i.dismissed
  })
  const fixedItems = visibleItems.filter(i => billMap.get(i.billId)?.category === 'fixed')
  const variableItems = visibleItems.filter(i => billMap.get(i.billId)?.category === 'variable')
  const savingsItems = visibleItems.filter(i => billMap.get(i.billId)?.category === 'savings')

  const effectivePeriod = (period.openingBalance === null && projectedOpening !== null)
    ? { ...period, openingBalance: projectedOpening }
    : period
  const forecast = calcForecast(effectivePeriod, visibleItems, bills, extras)
  const paidCount = visibleItems.filter(i => i.paid).length + extras.filter(e => e.paid).length
  const totalCount = visibleItems.length + extras.length

  const forecastColor =
    forecast === null ? 'text-slate-400' :
    forecast < 500 ? 'text-red-400' :
    forecast < 1500 ? 'text-yellow-400' :
    'text-emerald-400'

  const hasDanger = forecast !== null && forecast < 500

  function startEditBalance(e: React.MouseEvent) {
    e.stopPropagation()
    const current = period!.openingBalance ?? projectedOpening
    setBalanceDraft(current !== null ? String(current) : '')
    setEditingBalance(true)
  }

  function commitBalance() {
    const val = parseFloat(balanceDraft)
    if (!isNaN(val)) updatePeriod(periodId, { openingBalance: val })
    setEditingBalance(false)
  }

  function startEditPay(e: React.MouseEvent) {
    e.stopPropagation()
    setPayDraft(String(period!.payAmount))
    setEditingPay(true)
  }

  function commitPay() {
    const val = parseFloat(payDraft)
    if (!isNaN(val)) updatePeriod(periodId, { payAmount: val })
    setEditingPay(false)
  }

  // Collapsed summary bar (only when collapsible)
  if (collapsible && collapsed) {
    return (
      <div
        className={`bg-slate-800/60 rounded-xl border cursor-pointer hover:bg-slate-800/80 transition-colors ${hasDanger ? 'border-red-500/30' : 'border-slate-700/50'}`}
        onClick={() => setCollapsed(false)}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">{label}</div>
            <div className="text-sm font-medium text-slate-300">
              {formatDate(period.startDate)} — {formatDate(periodEndDate(period.startDate, payFrequency))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {paidCount > 0 && (
              <span className="text-xs text-slate-500">{paidCount}/{totalCount} paid</span>
            )}
            {hasDanger && <span className="text-xs text-red-400 font-medium">⚠ Low</span>}
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-0.5">Forecast</div>
              <div className={`text-lg font-bold ${forecastColor}`}>
                {forecast !== null ? fmt(forecast) : '—'}
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-slate-800 rounded-2xl overflow-hidden shadow-2xl ${collapsible ? 'border border-slate-700/50' : ''}`}>
      {/* Header */}
      <div
        className={`bg-slate-700/50 px-6 py-4 ${collapsible ? 'cursor-pointer hover:bg-slate-700/70 transition-colors' : ''}`}
        onClick={collapsible ? () => setCollapsed(true) : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-400 uppercase tracking-widest">{label}</div>
              {collapsible && (
                <svg className="w-3.5 h-3.5 text-slate-500 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
            <div className="text-white font-semibold text-lg">
              {formatDate(period.startDate)} — {formatDate(periodEndDate(period.startDate, payFrequency))}
            </div>
          </div>
          <div className="text-right" onClick={e => e.stopPropagation()}>
            <div className="text-xs text-slate-400 mb-0.5">Pay</div>
            {editingPay ? (
              <input
                autoFocus
                className="bg-slate-600 text-white font-semibold text-base rounded px-2 py-0.5 border border-blue-500 outline-none w-28 text-right"
                value={payDraft}
                onChange={e => setPayDraft(e.target.value)}
                onBlur={commitPay}
                onKeyDown={e => { if (e.key === 'Enter') commitPay(); if (e.key === 'Escape') setEditingPay(false) }}
              />
            ) : (
              <button onClick={startEditPay} className="text-white font-semibold hover:text-blue-300 transition-colors flex items-center gap-1 ml-auto">
                {fmt(period.payAmount)}
                {period.payAmount !== defaultPayAmount && (
                  <span className="text-blue-400 text-xs font-bold" title="Overridden from default">*</span>
                )}
                <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between" onClick={e => e.stopPropagation()}>
          <div>
            <div className="text-xs text-slate-400 mb-0.5">Opening Balance</div>
            {editingBalance ? (
              <input
                autoFocus
                className="bg-slate-600 text-white text-xl font-bold rounded px-2 py-0.5 border border-blue-500 outline-none w-36"
                value={balanceDraft}
                onChange={e => setBalanceDraft(e.target.value)}
                onBlur={commitBalance}
                onKeyDown={e => { if (e.key === 'Enter') commitBalance(); if (e.key === 'Escape') setEditingBalance(false) }}
              />
            ) : (
              <button onClick={startEditBalance} className="text-xl font-bold text-white hover:text-blue-300 transition-colors">
                {period.openingBalance !== null
                  ? fmt(period.openingBalance)
                  : projectedOpening !== null
                  ? (
                    <span className="text-slate-400">
                      {fmt(projectedOpening)}
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        ({fmt(projectedOpening - period.payAmount)} + {fmt(period.payAmount)} pay)
                      </span>
                    </span>
                  )
                  : <span className="text-slate-500">Set balance</span>
                }
              </button>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 mb-0.5">Forecast</div>
            <div className={`text-2xl font-bold ${forecastColor}`}>
              {forecast !== null ? fmt(forecast) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bills */}
      <div className="px-4 pt-4">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Fixed Bills</div>
        <div className="divide-y divide-slate-700/50">
          {fixedItems.map(item => {
            const bill = billMap.get(item.billId)
            if (!bill) return null
            return <LineItem key={item.id} item={item} bill={bill} onDismiss={() => dismissPeriodItem(item.id)} />
          })}
        </div>
      </div>

      {/* Variable / Recurring */}
      <div className="px-4 pt-4">
        <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Every Period</div>
        <div className="divide-y divide-slate-700/50">
          {variableItems.map(item => {
            const bill = billMap.get(item.billId)
            if (!bill) return null
            return <LineItem key={item.id} item={item} bill={bill} onDismiss={() => dismissPeriodItem(item.id)} />
          })}
        </div>
      </div>

      {/* Savings */}
      {savingsItems.length > 0 && (
        <div className="px-4 pt-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Savings</div>
          <div className="divide-y divide-slate-700/50">
            {savingsItems.map(item => {
              const bill = billMap.get(item.billId)
              if (!bill) return null
              return <LineItem key={item.id} item={item} bill={bill} onDismiss={() => dismissPeriodItem(item.id)} />
            })}
          </div>
        </div>
      )}

      {/* Extras */}
      {extras.length > 0 && (
        <div className="px-4 pt-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Extras</div>
          <div className="divide-y divide-slate-700/50">
            {extras.map(extra => <ExtraItem key={extra.id} extra={extra} />)}
          </div>
        </div>
      )}

      {/* Statement Actuals */}
      {actuals && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <div className="text-xs text-slate-500 uppercase tracking-widest">
              Statement Actuals
              <span className="ml-2 text-slate-600 normal-case font-normal">{actuals.statementRange}</span>
            </div>
            <button
              onClick={() => clearPeriodActuals(periodId)}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
              title="Remove actuals"
            >
              ×
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/40">
            {actuals.entries.map((entry, i) => {
              const over = entry.actual > entry.budgeted
              const delta = entry.actual - entry.budgeted
              return (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30 last:border-0 bg-slate-700/10">
                  <span className="text-sm text-slate-300">{entry.billName}</span>
                  <div className="flex items-center gap-3 text-sm tabular-nums">
                    <span className="text-slate-500">{fmt(entry.budgeted)}</span>
                    <span className="text-slate-600">→</span>
                    <span className={over ? 'text-red-400' : 'text-emerald-400'}>
                      {fmt(entry.actual)}
                    </span>
                    <span className={`text-xs ${over ? 'text-red-500' : 'text-emerald-500'}`}>
                      {over ? '+' : ''}{fmt(delta)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 pb-4 pt-2">
        <AddExtraForm periodId={periodId} />
      </div>

      <div className="px-4 pb-3 flex justify-end">
        {confirmResetPeriod ? (
          <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3 text-sm w-full">
            <p className="text-red-300 mb-2 text-xs">Reset this period? Clears all paid status, extras, and balance overrides.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmResetPeriod(false)} className="text-slate-400 hover:text-slate-200 px-3 py-1 text-xs">Cancel</button>
              <button onClick={() => { resetPeriod(periodId); setConfirmResetPeriod(false) }} className="bg-red-600 hover:bg-red-500 text-white rounded px-3 py-1 text-xs font-medium">Reset Period</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmResetPeriod(true)}
            className="text-xs text-slate-700 hover:text-red-400 transition-colors"
          >
            Reset period
          </button>
        )}
      </div>
    </div>
  )
}
