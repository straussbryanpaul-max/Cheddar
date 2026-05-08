import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { useStore } from '../store'
import { useAuth } from './auth'

// A unique id per browser tab, so we can ignore realtime events that came from
// our own write and avoid an echo loop.
const CLIENT_ID = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (!g.__cheddarClientId) {
    g.__cheddarClientId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  return g.__cheddarClientId as string
})()

// State keys we *don't* persist to household_state.
const EXCLUDED_KEYS = new Set<string>([
  'anthropicApiKey',  // per-user, lives on profiles
  'hydrated',         // local sync flag
])

// Snapshot only the data fields (no functions, no excluded keys).
function snapshotData(): Record<string, unknown> {
  const state = useStore.getState() as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (typeof v === 'function') continue
    if (EXCLUDED_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

// Tagged push: writes data + sender clientId so we can ignore our own echo.
async function pushState(householdId: string, userId: string) {
  const payload = {
    household_id: householdId,
    data: { ...snapshotData(), _meta: { clientId: CLIENT_ID } },
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }
  const { error } = await supabase
    .from('household_state')
    .upsert(payload, { onConflict: 'household_id' })
  if (error) console.error('pushState failed', error)
}

// Apply a remote payload to the store, stripping the meta envelope.
function applyRemote(data: Record<string, unknown>) {
  const { _meta: _ignored, ...rest } = data as Record<string, unknown> & { _meta?: unknown }
  void _ignored
  useStore.getState().hydrate(rest)
}

// Reads the legacy zustand-persist localStorage payload, if any.
// Returns the inner state slice (without zustand wrapper), or null if absent.
function readLegacyLocalStorage(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem('cheddar-store-v4') ?? window.localStorage.getItem('cheddar-store-v3')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
    if (!parsed?.state) return null
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.state)) {
      if (EXCLUDED_KEYS.has(k)) continue
      out[k] = v
    }
    return out
  } catch (e) {
    console.warn('legacy localStorage import failed', e)
    return null
  }
}

export function useHouseholdSync(householdId: string | null, userId: string | null) {
  const ranInitialFetch = useRef(false)
  const pushTimer = useRef<number | null>(null)
  const lastPushedJson = useRef<string>('')

  // Reset the "ran initial fetch" flag when household or user changes.
  useEffect(() => {
    ranInitialFetch.current = false
    lastPushedJson.current = ''
    useStore.getState().setHydrated(false)
  }, [householdId, userId])

  // 1. Initial fetch — pull household_state, hydrate store, mark hydrated.
  useEffect(() => {
    if (!householdId || !userId || ranInitialFetch.current) return
    ranInitialFetch.current = true
    ;(async () => {
      const { data, error } = await supabase
        .from('household_state')
        .select('data')
        .eq('household_id', householdId)
        .maybeSingle()
      if (error) {
        console.error('initial fetch failed', error)
        useStore.getState().setHydrated(true)
        return
      }
      const remoteEmpty = !data?.data || Object.keys(data.data).length === 0
      if (!remoteEmpty) {
        applyRemote(data!.data as Record<string, unknown>)
      } else {
        // First load on this household: try to import legacy localStorage data.
        const legacy = readLegacyLocalStorage()
        if (legacy) {
          useStore.getState().hydrate(legacy)
          // Clear so we don't re-import next time.
          window.localStorage.removeItem('cheddar-store-v4')
          window.localStorage.removeItem('cheddar-store-v3')
        }
      }
      // Record the just-loaded snapshot so we don't immediately re-push it.
      lastPushedJson.current = JSON.stringify(snapshotData())
      useStore.getState().setHydrated(true)
    })()
  }, [householdId, userId])

  // 2. Subscribe to store changes — debounced push.
  useEffect(() => {
    if (!householdId || !userId) return
    const unsub = useStore.subscribe(() => {
      if (!useStore.getState().hydrated) return
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(() => {
        const json = JSON.stringify(snapshotData())
        if (json === lastPushedJson.current) return
        lastPushedJson.current = json
        pushState(householdId, userId)
      }, 600)
    })
    return () => {
      unsub()
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
    }
  }, [householdId, userId])

  // 3. Realtime subscription — apply remote changes from other clients.
  useEffect(() => {
    if (!householdId) return
    const channel = supabase
      .channel(`household_state:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_state',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newRow = payload.new as { data?: Record<string, unknown> } | null
          if (!newRow?.data) return
          const meta = newRow.data._meta as { clientId?: string } | undefined
          if (meta?.clientId === CLIENT_ID) return  // our own echo
          applyRemote(newRow.data)
          // Sync the lastPushed marker so we don't fight the remote write.
          lastPushedJson.current = JSON.stringify(snapshotData())
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId])
}
