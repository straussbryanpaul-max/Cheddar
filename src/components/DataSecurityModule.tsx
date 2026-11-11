import React from 'react'

function Shield({ color = '#10b981' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function Node({ title, subtitle, badges, color = '#334155' }: { title: string; subtitle: string; badges: string[]; color?: string }) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="rounded-xl border p-3.5" style={{ borderColor: color, background: color + '22' }}>
        <div className="text-xs font-semibold text-white mb-0.5">{title}</div>
        <div className="text-xs text-slate-500 mb-2">{subtitle}</div>
        <div className="flex flex-col gap-1">
          {badges.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Check />
              <span className="text-xs text-slate-300">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DataSecurityModule() {
  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      <div className="flex items-center gap-2">
        <Shield color="#10b981" />
        <span className="text-lg font-semibold text-white">Data & Security</span>
      </div>

      {/* Flow diagram */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-4">How it's wired</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Node
            title="You (Browser)"
            subtitle="cheddar.vercel.app"
            color="#6366f1"
            badges={[
              'HTTPS only',
              'Session stored locally',
              'Anon key (read-limited)',
            ]}
          />
          <Arrow />
          <Node
            title="Vercel"
            subtitle="Hosting + build"
            color="#0ea5e9"
            badges={[
              'Secrets in env vars',
              'Never in source code',
              'Production + Preview',
            ]}
          />
          <Arrow />
          <Node
            title="Supabase"
            subtitle="Auth + database"
            color="#10b981"
            badges={[
              'RLS on every table',
              '3 policies per table',
              'Password bcrypt-hashed',
              'Auth separate from data',
            ]}
          />
        </div>
      </div>

      {/* Git */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Git / Source Code</div>
        <div className="space-y-2">
          <Row label=".env files" value="Gitignored — never committed" />
          <Row label="Supabase keys" value="import.meta.env.VITE_* only" />
          <Row label="Secrets in history" value="None found" />
          <Row label="Repo" value="Private (github.com)" />
        </div>
      </div>

      {/* Supabase */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Supabase Database</div>
        <div className="space-y-2">
          <Row label="Row Level Security" value="Enabled on all tables" />
          <Row label="Active policies" value="3 per table (read / write / own)" />
          <Row label="Anon key scope" value="Only reaches your authenticated rows" />
          <Row label="Service role key" value="Not in frontend — backend only" />
        </div>
      </div>

      {/* Auth */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Authentication</div>
        <div className="space-y-2">
          <Row label="Password storage" value="bcrypt hash — plaintext never stored" />
          <Row label="Session" value="Auto-refreshed, persisted in browser" />
          <Row label="Recovery" value="Email reset → straussbryanpaul@gmail.com" />
          <Row label="Users" value="Single account" />
        </div>
      </div>

      {/* What the anon key can/can't do */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Anon Key — What It Can't Do</div>
        <p className="text-xs text-slate-500 mb-3">The anon key is visible in the browser bundle. That's normal — RLS is what makes it safe.</p>
        <div className="space-y-1.5">
          {[
            'Read another user\'s rows',
            'Write to tables without auth',
            'Access the auth schema',
            'Use the service role (admin) API',
            'Bypass RLS policies',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className="text-xs text-slate-400">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  )
}
