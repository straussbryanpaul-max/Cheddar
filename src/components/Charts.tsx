import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import { useStore } from '../store'
import { calcForecast, formatCurrency, formatDate } from '../lib/periods'
import type { Bill, PayPeriod, PeriodItem, Extra } from '../types'

function buildChartData(
  periods: PayPeriod[],
  allItems: PeriodItem[],
  allExtras: Extra[],
  bills: Bill[],
) {
  const billMap = new Map(bills.map(b => [b.id, b]))

  return periods.map(period => {
    const items = allItems.filter(i => i.periodId === period.id && !i.dismissed)
    const extras = allExtras.filter(e => e.periodId === period.id)
    const visibleItems = items.filter(i => billMap.get(i.billId)?.active)

    const forecast = calcForecast(period, visibleItems, bills, extras)

    const fixedTotal = visibleItems
      .filter(i => !i.paid && billMap.get(i.billId)?.category === 'fixed')
      .reduce((s, i) => s + (i.actualAmount ?? billMap.get(i.billId)?.amount ?? 0), 0)

    const variableTotal = visibleItems
      .filter(i => !i.paid && billMap.get(i.billId)?.category !== 'fixed')
      .reduce((s, i) => s + (i.actualAmount ?? billMap.get(i.billId)?.amount ?? 0), 0)

    const extrasTotal = extras
      .filter(e => !e.paid)
      .reduce((s, e) => s + e.amount, 0)

    return {
      label: formatDate(period.startDate),
      forecast: forecast ?? undefined,
      fixed: Math.round(fixedTotal),
      variable: Math.round(variableTotal),
      extras: Math.round(extrasTotal),
    }
  })
}

const COLORS = {
  forecast: '#34d399',   // emerald
  warning: '#facc15',    // yellow
  danger: '#f87171',     // red
  fixed: '#818cf8',      // indigo
  variable: '#38bdf8',   // sky
  extras: '#fb923c',     // orange
}

function forecastColor(val: number | undefined) {
  if (val === undefined) return COLORS.forecast
  if (val < 500) return COLORS.danger
  if (val < 1500) return COLORS.warning
  return COLORS.forecast
}

function CurrencyTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (x === undefined || y === undefined || !payload) return null
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#64748b" fontSize={11}>
      {formatCurrency(payload.value)}
    </text>
  )
}

function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      <div className="font-semibold" style={{ color: forecastColor(val) }}>
        {val !== undefined ? formatCurrency(val) : '—'}
      </div>
    </div>
  )
}

function SpendingTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300 capitalize">{p.name}</span>
          <span className="ml-auto font-medium text-white">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function Charts() {
  const periods = useStore(s => s.periods)
  const allItems = useStore(s => s.periodItems)
  const allExtras = useStore(s => s.extras)
  const bills = useStore(s => s.bills)

  const data = buildChartData(periods, allItems, allExtras, bills)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      {/* Forecast trend */}
      <div className="bg-slate-800 rounded-2xl p-5">
        <div className="text-xs text-slate-500 uppercase tracking-widest mb-4">Balance Forecast</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ left: 10, right: 16, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={<CurrencyTick />} axisLine={false} tickLine={false} width={72} />
            <ReferenceLine y={500}  stroke="#f87171" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={1500} stroke="#facc15" strokeDasharray="4 2" strokeOpacity={0.4} />
            <Tooltip content={<ForecastTooltip />} />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={COLORS.forecast}
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: { forecast?: number } }
                if (cx === undefined || cy === undefined) return <g key="empty" />
                return (
                  <circle
                    key={`dot-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={forecastColor(payload.forecast)}
                    stroke={forecastColor(payload.forecast)}
                  />
                )
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Spending breakdown per period */}
      <div className="bg-slate-800 rounded-2xl p-5">
        <div className="text-xs text-slate-500 uppercase tracking-widest mb-4">Spending Breakdown</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ left: 10, right: 16, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={<CurrencyTick />} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<SpendingTooltip />} />
            <Legend
              formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="fixed"    name="Fixed"    stackId="a" fill={COLORS.fixed}    radius={[0,0,0,0]} />
            <Bar dataKey="variable" name="Variable" stackId="a" fill={COLORS.variable} radius={[0,0,0,0]} />
            <Bar dataKey="extras"   name="Extras"   stackId="a" fill={COLORS.extras}   radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
