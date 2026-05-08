import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    const { error } = await signInWithEmail(email.trim())
    if (error) {
      setErrorMsg(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🧀</div>
          <div className="text-2xl font-bold tracking-tight">Cheddar</div>
        </div>

        {status === 'sent' ? (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-sm text-slate-300 mb-1">Check your inbox</div>
            <div className="text-xs text-slate-500">We sent a sign-in link to <span className="text-slate-300">{email}</span>.</div>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' && (
              <div className="text-xs text-red-400 text-center">{errorMsg}</div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
