import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { CCTransaction } from '../types'
import { useFormatCurrency } from '../lib/useFormatCurrency'

type ChartMode = 'category' | 'vendor'

const CATEGORY_COLORS: Record<string, string> = {
  Groceries:        '#4ade80',
  Dining:           '#fb923c',
  Gas:              '#facc15',
  Amazon:           '#60a5fa',
  Streaming:        '#c084fc',
  Entertainment:    '#f472b6',
  Healthcare:       '#f87171',
  'Home & Garden':  '#2dd4bf',
  Shopping:         '#818cf8',
  Travel:           '#38bdf8',
  Clothing:         '#fb7185',
  'Personal Care':  '#a78bfa',
  Insurance:        '#94a3b8',
  Utilities:        '#fbbf24',
  Other:            '#64748b',
}

function CCTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { label: string } }[] }) {
  const fmt = useFormatCurrency()
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
      <div className="text-slate-300 text-xs mb-0.5">{payload[0].payload.label}</div>
      <div className="text-white font-bold">{fmt(payload[0].value)}</div>
    </div>
  )
}

function AmountLabel({ x, y, width, height, value }: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const fmt = useFormatCurrency()
  if (x == null || y == null || width == null || height == null || value == null) return null
  return (
    <text x={x + width + 4} y={y + height / 2 + 4} fill="#64748b" fontSize={10} textAnchor="start">
      {fmt(value)}
    </text>
  )
}

export function CCCharts({ transactions }: { transactions: CCTransaction[] }) {
  const [mode, setMode] = useState<ChartMode>('category')

  const categoryData = (() => {
    const map = new Map<string, number>()
    for (const tx of transactions) map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount)
    return [...map.entries()]
      .map(([name, amount]) => ({ name, label: name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
  })()

  const vendorData = (() => {
    const map = new Map<string, { label: string; amount: number }>()
    for (const tx of transactions) {
      const existing = map.get(tx.description)
      if (existing) existing.amount += tx.amount
      else map.set(tx.description, { label: tx.description, amount: tx.amount })
    }
    return [...map.values()]
      .map(({ label, amount }) => ({
        name: label.length > 16 ? label.slice(0, 16) + '…' : label,
        label,
        amount: Math.round(amount),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 14)
  })()

  const data = mode === 'category' ? categoryData : vendorData
  const rowH = 28
  const chartH = data.length * rowH + 8

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 uppercase tracking-widest">Spend by</div>
        <div className="flex gap-1">
          {(['category', 'vendor'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors capitalize ${mode === m ? 'bg-slate-600 text-white' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'}`}
            >{m}</button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-slate-600 text-xs text-center py-6">No transactions</div>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 0, bottom: 0 }} barSize={rowH - 6}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={mode === 'category' ? 88 : 104}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CCTooltip />} cursor={{ fill: '#1e293b80' }} />
            <Bar dataKey="amount" radius={[0, 3, 3, 0]} label={<AmountLabel />}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={mode === 'category' ? (CATEGORY_COLORS[entry.name.replace('…', '')] ?? '#64748b') : '#60a5fa'}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
