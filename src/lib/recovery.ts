import { useStore } from '../store'

const LEGACY_KEYS = ['cheddar-store-v4', 'cheddar-store-v3']
const NEVER_RESTORE = new Set(['hydrated', 'anthropicApiKey'])

function readLegacy(): Record<string, unknown> | null {
  for (const key of LEGACY_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
      if (parsed?.state) return parsed.state
    } catch {
      // fall through
    }
  }
  return null
}

function summarize(state: Record<string, unknown>): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  for (const [k, v] of Object.entries(state)) {
    if (Array.isArray(v)) out[k] = v.length
    else if (v && typeof v === 'object') out[k] = Object.keys(v).length
    else out[k] = String(v)
  }
  return out
}

export function installRecoveryHelpers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  w.__cheddarRestore = {
    inspect() {
      const state = readLegacy()
      if (!state) {
        console.log('No legacy data found in localStorage on this origin.')
        return null
      }
      const summary = summarize(state)
      console.table(summary)
      return summary
    },
    importAll() {
      const state = readLegacy()
      if (!state) {
        console.log('No legacy data found.')
        return
      }
      const subset: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(state)) {
        if (NEVER_RESTORE.has(k)) continue
        subset[k] = v
      }
      useStore.getState().hydrate(subset)
      console.log('Restored all legacy fields. If signed in, sync will push to Supabase within ~1s.')
    },
    importFields(fields: string[]) {
      const state = readLegacy()
      if (!state) {
        console.log('No legacy data found.')
        return
      }
      const subset: Record<string, unknown> = {}
      for (const f of fields) {
        if (NEVER_RESTORE.has(f)) continue
        if (f in state) subset[f] = state[f]
      }
      useStore.getState().hydrate(subset)
      console.log(`Restored fields: ${Object.keys(subset).join(', ')}. If signed in, sync will push to Supabase within ~1s.`)
    },
    importCC() {
      this.importFields(['ccAnalyses', 'ccMerchantMemory'])
    },
  }
}
