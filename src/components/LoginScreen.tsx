import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true); setErrorMsg('')
    const { error } = await signInWithPassword(email.trim(), password)
    if (error) {
      setErrorMsg(error)
      setBusy(false)
    }
    // On success the AuthProvider's onAuthStateChange listener swaps us out of this screen.
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🧀</div>
          <div className="text-2xl font-bold tracking-tight">Cheddar</div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-slate-800 border border-slate-700 focus:border-slate-500 rounded-lg px-4 py-2.5 text-sm outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-800 border border-slate-700 focus:border-slate-500 rounded-lg px-4 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {errorMsg && (
            <div className="text-xs text-red-400 text-center">{errorMsg}</div>
          )}
        </form>
      </div>
    </div>
  )
}
