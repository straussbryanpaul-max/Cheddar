import { useEffect, useState } from 'react'
import { useStore } from './store'
import { CurrentPeriod } from './components/CurrentPeriod'
import { UpcomingPeriod } from './components/UpcomingPeriod'
import { BillsManager } from './components/BillsManager'
import { QuickLinks } from './components/QuickLinks'
import { Charts } from './components/Charts'
import { StatementPanel } from './components/StatementPanel'
import { formatDate, periodEndDate, buildProjectedOpenings } from './lib/periods'

type Module = 'budget' | 'savings' | 'college' | 'retirement' | 'bills'

const MODULES: { id: Module; label: string; soon?: boolean }[] = [
  { id: 'budget',     label: 'Budget' },
  { id: 'savings',    label: 'Savings',    soon: true },
  { id: 'college',    label: 'College',    soon: true },
  { id: 'retirement', label: 'Retirement', soon: true },
]

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 xl:grid-cols-4',
  5: 'grid-cols-2 xl:grid-cols-5',
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-4xl mb-4">🚧</div>
      <div className="text-slate-300 font-semibold text-lg">{label}</div>
      <div className="text-slate-500 text-sm mt-1">Coming soon</div>
    </div>
  )
}

export default function App() {
  const periods = useStore(s => s.periods)
  const ensureFuturePeriods = useStore(s => s.ensureFuturePeriods)
  const ensurePastPeriods = useStore(s => s.ensurePastPeriods)
  const periodsVisible = useStore(s => s.periodsVisible)
  const setPeriodsVisible = useStore(s => s.setPeriodsVisible)
  const periodsWindowDate = useStore(s => s.periodsWindowDate)
  const setPeriodsWindowDate = useStore(s => s.setPeriodsWindowDate)
  const payFrequency = useStore(s => s.payFrequency)
  const bills = useStore(s => s.bills)
  const allItems = useStore(s => s.periodItems)
  const allExtras = useStore(s => s.extras)
  const [module, setModule] = useState<Module>('budget')
  const [showStatement, setShowStatement] = useState(false)

  useEffect(() => {
    ensurePastPeriods(8)
    ensureFuturePeriods(8)
  }, [ensurePastPeriods, ensureFuturePeriods])

  // Find index of the period containing today
  const today = new Date().toISOString().split('T')[0]
  const currentPeriodIdx = Math.max(0,
    periods.reduce((found, p, i) => p.startDate <= today ? i : found, 0)
  )

  // Window start: use stored date if valid, else fall back to current period
  const windowStartIdx = (() => {
    if (!periodsWindowDate) return currentPeriodIdx
    const idx = periods.findIndex(p => p.startDate === periodsWindowDate)
    return idx >= 0 ? idx : currentPeriodIdx
  })()

  const projectedOpenings = buildProjectedOpenings(periods, allItems, allExtras, bills)

  const isAtPresent = windowStartIdx === currentPeriodIdx

  const visible = periods.slice(windowStartIdx, windowStartIdx + periodsVisible)
  const upcoming = isAtPresent
    ? periods.slice(windowStartIdx + periodsVisible, windowStartIdx + periodsVisible + 3)
    : []

  function shiftWindow(delta: number) {
    const newIdx = Math.max(0, Math.min(periods.length - periodsVisible, windowStartIdx + delta))
    const newDate = periods[newIdx]?.startDate ?? null
    setPeriodsWindowDate(newDate === periods[currentPeriodIdx]?.startDate ? null : newDate)
  }

  function goToPresent() {
    setPeriodsWindowDate(null)
  }

  const windowLabel = visible.length > 0
    ? `${formatDate(visible[0].startDate)} – ${formatDate(periodEndDate(visible[visible.length - 1].startDate, payFrequency))}`
    : ''

  const periodLabel = (i: number) => {
    if (isAtPresent) {
      if (i === 0) return 'Current Period'
      if (i === 1) return 'Next Period'
      return `Period +${i}`
    }
    const p = visible[i]
    if (!p) return ''
    if (p.startDate < today) return 'Past Period'
    if (p.startDate === periods[currentPeriodIdx]?.startDate) return 'Current Period'
    return `Period +${i}`
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <span className="text-xl font-bold tracking-tight">Cheddar 🧀</span>

            <nav className="flex items-center gap-1">
              {MODULES.map(m => (
                <button
                  key={m.id}
                  onClick={() => !m.soon && setModule(m.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    module === m.id
                      ? 'bg-slate-700 text-white'
                      : m.soon
                      ? 'text-slate-600 cursor-default'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                  {m.soon && <span className="ml-1 text-slate-600">·</span>}
                </button>
              ))}
            </nav>

            <button
              onClick={() => setModule(module === 'bills' ? 'budget' : 'bills')}
              className={`p-2 rounded-md transition-colors ${
                module === 'bills' ? 'text-white bg-slate-700' : 'text-slate-500 hover:text-white hover:bg-slate-800'
              }`}
              title="Manage bills"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-4 items-start">
        <main className="flex-1 min-w-0">
          {module === 'bills'      && <BillsManager />}
          {module === 'savings'    && <ComingSoon label="Savings" />}
          {module === 'college'    && <ComingSoon label="College" />}
          {module === 'retirement' && <ComingSoon label="Retirement" />}

          {module === 'budget' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4">
                {/* Period navigator */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => shiftWindow(-1)}
                    disabled={windowStartIdx === 0}
                    className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous period"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="text-center min-w-[160px]">
                    <div className="text-xs text-slate-400 font-medium">{windowLabel}</div>
                    {!isAtPresent && (
                      <button
                        onClick={goToPresent}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5"
                      >
                        Back to today
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => shiftWindow(1)}
                    disabled={windowStartIdx + periodsVisible >= periods.length}
                    className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next period"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowStatement(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Analyze Statement
                  </button>
                  <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => setPeriodsVisible(n)}
                        className={`w-7 h-7 rounded-md text-sm font-medium transition-colors ${
                          periodsVisible === n
                            ? 'bg-slate-600 text-white'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Period cards */}
              <div className={`grid gap-4 ${GRID_COLS[periodsVisible] ?? 'grid-cols-2'}`}>
                {visible.map((p, i) => (
                  <CurrentPeriod
                    key={p.id}
                    periodId={p.id}
                    label={periodLabel(i)}
                  />
                ))}
              </div>

              {/* Charts */}
              <Charts />

              {/* Upcoming (only shown when at present view) */}
              {upcoming.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Coming Up</div>
                  <div className="space-y-3">
                    {upcoming.map(p => (
                      <UpcomingPeriod key={p.id} periodId={p.id} projectedOpening={projectedOpenings.get(p.id) ?? null} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="w-44 flex-shrink-0 sticky top-20">
          <QuickLinks />
        </aside>
      </div>

      {showStatement && (
        <StatementPanel
          periodId={visible[0]?.id ?? periods[currentPeriodIdx]?.id ?? ''}
          periodStart={visible[0]?.startDate ?? periods[currentPeriodIdx]?.startDate ?? ''}
          onClose={() => setShowStatement(false)}
        />
      )}
    </div>
  )
}
