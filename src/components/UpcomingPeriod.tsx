import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { calcForecast, formatCurrency, formatDate, periodEndDate } from '../lib/periods'
import { ExtraItem } from './ExtraItem'
import { AddExtraForm } from './AddExtraForm'

interface Props {
  periodId: string
}

export function UpcomingPeriod({ periodId }: Props) {
  const period = useStore(s => s.periods.find(p => p.id === periodId))
  const bills = useStore(s => s.bills)
  const allItems = useStore(s => s.periodItems)
  const allExtras = useStore(s => s.extras)
  const ensurePeriodItems = useStore(s => s.ensurePeriodItems)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    ensurePeriodItems(periodId)
  }, [periodId, ensurePeriodItems, bills])

  if (!period) return null

  const items = allItems.filter(i => i.periodId === periodId)
  const extras = allExtras.filter(e => e.periodId === periodId)
  const billMap = new Map(bills.map(b => [b.id, b]))

  const fixedItems = items.filter(i => billMap.get(i.billId)?.category === 'fixed')
  const variableItems = items.filter(i => billMap.get(i.billId)?.category === 'variable')
  const forecast = calcForecast(period, items, bills, extras)

  const forecastColor =
    forecast === null ? 'text-slate-500' :
    forecast < 500 ? 'text-red-400' :
    forecast < 1500 ? 'text-yellow-400' :
    'text-emerald-400'

  const hasDanger = forecast !== null && forecast < 500

  return (
    <div className={`bg-slate-800/60 rounded-xl overflow-hidden border ${hasDanger ? 'border-red-500/30' : 'border-slate-700/50'}`}>
      {/* Header row — always visible, click to expand */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-left">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Upcoming</div>
          <div className="text-sm font-medium text-slate-300">
            {formatDate(period.startDate)} — {formatDate(periodEndDate(period.startDate))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasDanger && <span className="text-xs text-red-400 font-medium">⚠ Low</span>}
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
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          {fixedItems.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Fixed Bills</div>
              <div className="space-y-1">
                {fixedItems.map(item => {
                  const bill = billMap.get(item.billId)
                  if (!bill) return null
                  return (
                    <div key={item.id} className="flex justify-between text-sm text-slate-400 py-1">
                      <div className="flex items-center gap-2">
                        <span>{bill.name}</span>
                        <span className="text-xs text-slate-600">due {bill.dueDayOfMonth}</span>
                      </div>
                      <span className="tabular-nums">{formatCurrency(item.actualAmount ?? bill.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {variableItems.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Every Period</div>
              <div className="space-y-1">
                {variableItems.map(item => {
                  const bill = billMap.get(item.billId)
                  if (!bill) return null
                  return (
                    <div key={item.id} className="flex justify-between text-sm text-slate-400 py-1">
                      <span>{bill.name}</span>
                      <span className="tabular-nums">{formatCurrency(item.actualAmount ?? bill.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {extras.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Extras</div>
              <div className="divide-y divide-slate-700/30">
                {extras.map(extra => <ExtraItem key={extra.id} extra={extra} />)}
              </div>
            </div>
          )}

          <div className="px-4 pb-3 pt-2">
            <AddExtraForm periodId={periodId} />
          </div>
        </div>
      )}
    </div>
  )
}
