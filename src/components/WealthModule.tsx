import { useState } from 'react'
import { AccountsTab } from './wealth/AccountsTab'
import { ProjectionsTab } from './wealth/ProjectionsTab'
import { RetirementTab } from './wealth/RetirementTab'

type WealthTab = 'accounts' | 'projections' | 'retirement'

const TABS: { id: WealthTab; label: string }[] = [
  { id: 'accounts',    label: 'Accounts' },
  { id: 'projections', label: 'Projections' },
  { id: 'retirement',  label: 'Retirement' },
]

export function WealthModule() {
  const [tab, setTab] = useState<WealthTab>('accounts')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts'    && <AccountsTab />}
      {tab === 'projections' && <ProjectionsTab />}
      {tab === 'retirement'  && <RetirementTab />}
    </div>
  )
}
