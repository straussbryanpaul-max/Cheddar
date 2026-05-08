import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export function HouseholdOnboarding() {
  const { user, signOut, refreshProfile, updateProfile } = useAuth()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState('My Household')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function createHousehold() {
    if (!user) return
    setBusy(true); setErr('')
    const { data, error } = await supabase
      .from('households')
      .insert({ name: name.trim() || 'My Household', created_by: user.id })
      .select('id')
      .single()
    if (error || !data) {
      setErr(error?.message ?? 'Failed to create household')
      setBusy(false)
      return
    }
    await updateProfile({ household_id: data.id })
    await refreshProfile()
    setBusy(false)
  }

  async function joinHousehold() {
    if (!user) return
    setBusy(true); setErr('')
    const id = code.trim()
    // Confirm the household exists & is readable (RLS only lets us read it once we're a member,
    // but the update below is what actually attaches us. Simplest path: just attempt the update.)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ household_id: id })
      .eq('id', user.id)
    if (updateError) {
      setErr(updateError.message)
      setBusy(false)
      return
    }
    // Verify we can now read household_state for that household — if invalid id, profile got
    // updated to garbage; check by fetching the household row.
    const { data: hh, error: hhError } = await supabase
      .from('households')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (hhError || !hh) {
      // roll back
      await supabase.from('profiles').update({ household_id: null }).eq('id', user.id)
      setErr('Invalid household code')
      setBusy(false)
      return
    }
    await refreshProfile()
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🧀</div>
          <div className="text-2xl font-bold tracking-tight">Welcome</div>
          <div className="text-sm text-slate-400 mt-1">Set up your household to continue</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-6">
          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                Create a new household
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                Join with a code
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-3">
              <label className="block text-xs text-slate-400">Household name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <button
                onClick={createHousehold}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                {busy ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => setMode('choose')} className="w-full text-xs text-slate-500 hover:text-slate-300">
                Back
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-3">
              <label className="block text-xs text-slate-400">Household code (UUID from your partner)</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-slate-500"
              />
              <button
                onClick={joinHousehold}
                disabled={busy || !code.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                {busy ? 'Joining…' : 'Join'}
              </button>
              <button onClick={() => setMode('choose')} className="w-full text-xs text-slate-500 hover:text-slate-300">
                Back
              </button>
            </div>
          )}

          {err && <div className="mt-3 text-xs text-red-400 text-center">{err}</div>}
        </div>

        <div className="text-center mt-4">
          <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-300">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
