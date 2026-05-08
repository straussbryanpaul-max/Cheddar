import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Profile {
  id: string
  email: string | null
  household_id: string | null
  ui_prefs: Record<string, unknown>
  anthropic_api_key: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Pick<Profile, 'household_id' | 'anthropic_api_key' | 'ui_prefs'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, household_id, ui_prefs, anthropic_api_key')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('loadProfile failed', error)
      setProfile(null)
      return
    }
    setProfile(data as Profile | null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? { error: error.message } : {}
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
    refreshProfile: async () => {
      if (session?.user) await loadProfile(session.user.id)
    },
    updateProfile: async (updates) => {
      if (!session?.user) return
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select('id, email, household_id, ui_prefs, anthropic_api_key')
        .maybeSingle()
      if (error) {
        console.error('updateProfile failed', error)
        return
      }
      if (data) setProfile(data as Profile)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
