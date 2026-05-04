import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { calcForecast, formatCurrency, formatDate, periodEndDate } from '../lib/periods'
import { LineItem } from './LineItem'
import { ExtraItem } from './ExtraItem'
import { AddExtraForm } from './AddExtraForm'

interface Props {
  periodId: string
  projectedOpening: number | null
}

export function UpcomingPeriod({ periodId, projectedOpening }: Props) {
  const period = useStore(s => s.periods.find(p => p.id === periodId))
  const bills = useStore(s => s.bills)
  const allItems = useStore(s => s.periodItems)
  const allExtras = useStore(s => s.extras)
  const ensurePeriodItems = useStore(s => s.ensurePeriodItems)
  const dismissPeriodItem = useStore(s => s.dismissPeriodItem)
  const updatePeriod = useStore(s => s.updatePeriod)
  const payFrequency = useStore(s => s.payFrequency)
  const defaultPayAmount = useStore(s => s.defaultPayAmount)
  const resetPeriod = useStore(s => s.resetPeriod)
  const [expanded, setExpanded] = useState(false)
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

  const effectiveOpening = period.openingBalance ?? projectedOpening
  const effectivePeriod = effectiveOpening !== null ? { ...period, openingBalance: effectiveOpening } : period
  const forecast = calcForecast(effectivePeriod, visibleItems, bills, extras)

  const forecastColor =
    forecast === null ? 'text-slate-400' :
    forecast < 500 ? 'text-red-400' :
    forecast < 1500 ? 'text-yellow-400' :
    'text-emerald-400'

  const hasDanger = forecast !== null && forecast < 500

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

  return (
    <div className={`bg-slate-800/60 rounded-xl overflow-hidden border ${hasDanger ? 'border-red-500/30' : 'border-slate-700/50'}`}>
      {/* Collapsed header */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-left">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Upcoming</div>
          <div className="text-sm font-medium text-slate-300">
            {formatDate(period.startDate)} — {formatDate(periodEndDate(period.startDate, payFrequency))}
          </div>
          {effectiveOpening !== null && (
            <div className="text-xs text-slate-500 mt-0.5">
              Opens {formatCurrency(effectiveOpening)}
              {period.openingBalance === null && <span className="text-slate-600 ml-1">projected</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {hasDanger && <span className="text-xs text-red-400 font-medium">⚠ Low</span>}
          <div className="text-right" onClick={e => e.stopPropagation()}>
            <div className="text-xs text-slate-500 mb-0.5">Pay</div>
            {editingPay ? (
              <input
                autoFocus
                className="bg-slate-600 text-white font-semibold text-sm rounded px-2 py-0.5 border border-blue-500 outline-none w-24 text-right"
                value={payDraft}
                onChange={e => setPayDraft(e.target.value)}
                onBlur={commitPay}
                onKeyDown={e => { if (e.key === 'Enter') commitPay(); if (e.key === 'Escape') setEditingPay(false) }}
              />
            ) : (
              <button onClick={startEditPay} className="text-white font-semibold text-sm hover:text-blue-300 transition-colors flex items-center gap-1 ml-auto">
                {formatCurrency(period.payAmount)}
                {period.payAmount !== defaultPayAmount && <span className="text-blue-400 text-xs">*</span>}
              </button>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-0.5">Forecast</div>
            <div className={`text-lg font-bold ${forecastColor}`}>
              {forecast !== null ? formatCurrency(forecast) : '—'}
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          {/* Balance summary row */}
          <div className="px-4 py-3 bg-slate-700/20 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Opening Balance</div>
              <div className="text-lg font-bold text-white">
                {effectiveOpening !== null ? formatCurrency(effectiveOpening) : <span className="text-slate-500">—</span>}
              </div>
              {period.openingBalance === null && effectiveOpening !== null && (
                <div className="text-xs text-slate-500">projected from prior period</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-0.5">Forecast</div>
              <div className={`text-2xl font-bold ${forecastColor}`}>
                {forecast !== null ? formatCurrency(forecast) : '—'}
              </div>
            </div>
          </div>

          {fixedItems.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Fixed Bills</div>
              <div className="divide-y divide-slate-700/50">
                {fixedItems.map(item => {
                  const bill = billMap.get(item.billId)
                  if (!bill) return null
                  return <LineItem key={item.id} item={item} bill={bill} onDismiss={() => dismissPeriodItem(item.id)} />
                })}
              </div>
            </div>
          )}

          {variableItems.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Every Period</div>
              <div className="divide-y divide-slate-700/50">
                {variableItems.map(item => {
                  const bill = billMap.get(item.billId)
                  if (!bill) return null
                  return <LineItem key={item.id} item={item} bill={bill} onDismiss={() => dismissPeriodItem(item.id)} />
                })}
              </div>
            </div>
          )}

          {savingsItems.length > 0 && (
            <div className="px-4 pt-3">
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

          {extras.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-1">Extras</div>
              <div className="divide-y divide-slate-700/30">
                {extras.map(extra => <ExtraItem key={extra.id} extra={extra} />)}
              </div>
            </div>
          )}

          <div className="px-4 pb-3 pt-2">
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
      )}
    </div>
  )
}
