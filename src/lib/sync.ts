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

// UI-only uiPrefs keys: per-tab view state, not household data. The screen
// you're on (currentModule), which sections are expanded, which tab or
// analysis is selected — syncing these is what yanked the screen around
// (Nov 17: a stale tab's save got dropped by the push guard and the screen
// snapped back to the module saved in the server row). They never leave the
// tab, and a remote write never overwrites the local ones.
// NOTE: ccCurrentBalance / ccProjectionBaseId / ccStatementCloseDay are
// DATA, not UI — they stay synced, so a balance edit in the Budget view
// persists instead of snapping back to the Plaid-fed value.
const UI_ONLY_UIPREFS_KEYS = new Set<string>([
  'currentModule',
  'ccSelectedId',
  'ccRecurringOpen',
  'ccOneOffOpen',
  'ccAllTxOpen',
  'ccExpandedCats',
  'ccSSListOpen',
  'collegeYearUi',
  'wealthTab',
  'wealthAccountExpanded',
  'wealthInstitutionExpanded',
  'wealthCategoryExpanded',
  'wealthExpandLevel',
  'periodExpanded',
])

// Top-level view state, same treatment as the uiPrefs keys above: which
// periods are shown and the window anchor are per-tab, not household data.
const UI_ONLY_TOP_LEVEL_KEYS = new Set<string>([
  'periodsVisible',
  'periodsWindowDate',
])

// Copy of a uiPrefs object with the UI-only keys removed (undefined when the
// input isn't a plain object).
function stripUiOnlyPrefs(uiPrefs: unknown): Record<string, unknown> | undefined {
  if (!uiPrefs || typeof uiPrefs !== 'object' || Array.isArray(uiPrefs)) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(uiPrefs as Record<string, unknown>)) {
    if (UI_ONLY_UIPREFS_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

// Snapshot only the data fields (no functions, no excluded keys, no
// per-tab view state — the screen you're on and expanded sections never
// leave this tab).
function snapshotData(): Record<string, unknown> {
  const state = useStore.getState() as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (typeof v === 'function') continue
    if (EXCLUDED_KEYS.has(k)) continue
    if (UI_ONLY_TOP_LEVEL_KEYS.has(k)) continue
    out[k] = v
  }
  if (out.uiPrefs) {
    out.uiPrefs = stripUiOnlyPrefs(out.uiPrefs) ?? {}
  }
  return out
}

// Tagged push: writes data + sender clientId so we can ignore our own echo.
// Returns the updated_at stamped on the write, or null on failure.
async function pushState(householdId: string, userId: string): Promise<string | null> {
  const updatedAt = new Date().toISOString()
  const payload = {
    household_id: householdId,
    data: { ...snapshotData(), _meta: { clientId: CLIENT_ID } },
    updated_at: updatedAt,
    updated_by: userId,
  }
  const { error } = await supabase
    .from('household_state')
    .upsert(payload, { onConflict: 'household_id' })
  if (error) {
    console.error('pushState failed', error)
    return null
  }
  return updatedAt
}

// Apply a remote payload to the store, stripping the meta envelope.
// GUARD (Nov 15 incident): the row's `data` must be a plain object. If it
// arrives wrapped in a list (a corrupt write), unwrap a one-element
// [{data: {...}}] payload; anything else is refused outright — hydrating a
// bad shape leaves the store on seed defaults, and the next push would
// overwrite the good row with seed data.
function applyRemote(data: unknown): boolean {
  let doc: unknown = data
  if (Array.isArray(doc)) {
    console.error('applyRemote: household_state data arrived as a list; attempting unwrap')
    doc = doc.length === 1 && doc[0] != null && typeof doc[0] === 'object'
      ? (doc[0] as Record<string, unknown>).data
      : undefined
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    console.error('applyRemote: refusing to hydrate from non-object payload', data)
    return false
  }
  const { _meta: _ignored, ...rest } = doc as Record<string, unknown> & { _meta?: unknown }
  void _ignored
  // Preserve this tab's view state: a remote write must never move the
  // screen you're on or collapse what you have open. hydrate() merges
  // uiPrefs shallowly, so dropping the UI-only keys from the incoming doc
  // leaves the local ones untouched. Same for the top-level view keys.
  if (rest.uiPrefs && typeof rest.uiPrefs === 'object' && !Array.isArray(rest.uiPrefs)) {
    const kept = stripUiOnlyPrefs(rest.uiPrefs)
    if (kept) rest.uiPrefs = kept
    else delete rest.uiPrefs
  }
  for (const k of UI_ONLY_TOP_LEVEL_KEYS) delete rest[k]
  useStore.getState().hydrate(rest)
  return true
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
  // GUARD (Nov 15 incident): only push if this client actually loaded a real
  // remote doc (or a valid legacy import). A client sitting on seed defaults
  // must never push — that is how the live row got replaced with seed data.
  const hydratedFromRemote = useRef(false)
  // updated_at of the row as this client last saw it. A push is only allowed
  // while the server row still carries this stamp.
  const lastSeenUpdatedAt = useRef<string | null>(null)

  // Reset the "ran initial fetch" flag when household or user changes.
  useEffect(() => {
    ranInitialFetch.current = false
    lastPushedJson.current = ''
    hydratedFromRemote.current = false
    lastSeenUpdatedAt.current = null
    useStore.getState().setHydrated(false)
  }, [householdId, userId])

  // 1. Initial fetch — pull household_state, hydrate store, mark hydrated.
  useEffect(() => {
    if (!householdId || !userId || ranInitialFetch.current) return
    ranInitialFetch.current = true
    ;(async () => {
      const { data, error } = await supabase
        .from('household_state')
        .select('data, updated_at')
        .eq('household_id', householdId)
        .maybeSingle()
      if (error) {
        console.error('initial fetch failed', error)
        useStore.getState().setHydrated(true)
        return
      }
      const row = data as { data?: unknown; updated_at?: string | null } | null
      const remoteEmpty = !row?.data || (typeof row.data === 'object' && !Array.isArray(row.data) && Object.keys(row.data as Record<string, unknown>).length === 0)
      if (!remoteEmpty) {
        if (applyRemote(row!.data)) {
          hydratedFromRemote.current = true
          lastSeenUpdatedAt.current = row!.updated_at ?? null
        }
      } else {
        // First load on this household: try to import legacy localStorage data.
        const legacy = readLegacyLocalStorage()
        if (legacy) {
          useStore.getState().hydrate(legacy)
          hydratedFromRemote.current = true
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
        void (async () => {
          // GUARD (Nov 15 incident): never push seed/stale state. Only push
          // if this client actually loaded a real remote doc.
          if (!hydratedFromRemote.current) return
          const json = JSON.stringify(snapshotData())
          if (json === lastPushedJson.current) return
          // GUARD: only push while the server row is still the one we loaded.
          // If someone else wrote first, drop our push and re-hydrate from
          // the newer row instead of overwriting it.
          const { data: fresh, error: freshError } = await supabase
            .from('household_state')
            .select('data, updated_at')
            .eq('household_id', householdId)
            .maybeSingle()
          if (freshError) {
            console.error('push guard: could not re-check updated_at, skipping push', freshError)
            return
          }
          const freshRow = fresh as { data?: unknown; updated_at?: string | null } | null
          if (freshRow?.updated_at && lastSeenUpdatedAt.current && freshRow.updated_at !== lastSeenUpdatedAt.current) {
            // Another writer touched the row since we loaded it (an auto-save
            // run, or this tab's realtime channel missed an event). The old
            // behaviour dropped our push and re-hydrated from the server,
            // which silently ate the user's edit and yanked the screen back
            // to the saved module (Nov 17: CC balance edits in Budget kept
            // snapping back to the Plaid-fed value; bill toggles reverted).
            // Single-user household: last-writer-wins — adopt the fresh
            // stamp and push our snapshot, which already contains the user's
            // edit. The hydratedFromRemote guard above still blocks pushing
            // seed/stale state, so a fresh tab can never clobber the row.
            lastSeenUpdatedAt.current = freshRow.updated_at
          }
          lastPushedJson.current = json
          const pushedAt = await pushState(householdId, userId)
          if (pushedAt) lastSeenUpdatedAt.current = pushedAt
        })()
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
          const newRow = payload.new as { data?: unknown; updated_at?: string | null } | null
          if (!newRow?.data) return
          const raw = newRow.data
          const meta = (Array.isArray(raw) ? undefined : (raw as { _meta?: { clientId?: string } })._meta)
          if (meta?.clientId === CLIENT_ID) return  // our own echo
          if (applyRemote(raw)) {
            if (newRow.updated_at) lastSeenUpdatedAt.current = newRow.updated_at
            // Sync the lastPushed marker so we don't fight the remote write.
            lastPushedJson.current = JSON.stringify(snapshotData())
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId])
}
