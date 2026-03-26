import { createClient } from '@supabase/supabase-js'
import type { GameState } from '../types'
import { TEAM_DEFS } from '../data'

export const supabase = createClient(
  'https://dalkpvzjaywwjxnvavmx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGtwdnpqYXl3d2p4bnZhdm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzE1MzYsImV4cCI6MjA4OTUwNzUzNn0.lCf1c-ekbYsKHhCKdPdzbeAasR3tZOzyXu7SCTHXYdM'
)

export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Embed a save timestamp so stale clients can't overwrite newer data
export function serializeState(S: GameState) {
  return { ...S, cMDs: Array.from(S.cMDs), _savedAt: Date.now() }
}

export function getSavedAt(raw: Record<string, unknown>): number {
  return typeof raw._savedAt === 'number' ? raw._savedAt : 0
}

export function deserializeState(raw: Record<string, unknown>): GameState | null {
  try {
    const teams = raw.teams as unknown[]
    const mdFx = raw.mdFx as unknown[]
    if (!Array.isArray(teams) || teams.length !== TEAM_DEFS.length) return null
    if (!Array.isArray(mdFx) || mdFx.length !== 22) return null
    const cMDs = new Set<number>(Array.isArray(raw.cMDs) ? (raw.cMDs as number[]) : [])
    return {
      ...(raw as object),
      cMDs,
      results: Array.isArray(raw.results) ? raw.results : [],
      notices: Array.isArray(raw.notices) ? raw.notices : [],
      rivalries: Array.isArray(raw.rivalries) ? raw.rivalries : [],
      mdFx: (mdFx as unknown[][]).map((mdfx, mi) =>
        Array.from({ length: 6 }, (_, fi) => {
          const f = (mdfx?.[fi] ?? { hi: 0, ai: 1 }) as Record<string, unknown>
          return {
            hi: (f.hi as number) ?? 0,
            ai: (f.ai as number) ?? 1,
            hg: f.hg != null && f.hg !== '' ? f.hg : 0,
            ag: f.ag != null && f.ag !== '' ? f.ag : 0,
            saved: (f.saved as boolean) ?? (cMDs.has(mi) ? true : undefined),
          }
        })
      ),
      teams: teams.map((t: unknown, i: number) => {
        const team = t as Record<string, unknown>
        return {
          ...team,
          id: typeof team.id === 'number' ? team.id : i,
          stands: (Array.isArray(team.stands) ? team.stands : []).map((st: unknown) => {
            const s = st as Record<string, unknown>
            return {
              ...s,
              upgrades: Array.isArray(s.upgrades) ? s.upgrades : [],
              baseTP: typeof s.baseTP === 'number' ? s.baseTP : s.tp,
            }
          }),
          sponsors: Array.isArray(team.sponsors) ? team.sponsors : [],
          form: Array.isArray(team.form) ? team.form : [],
          transfers_in: (team.transfers_in as number) ?? 0,
          transfers_out: (team.transfers_out as number) ?? 0,
        }
      }),
    } as unknown as GameState
  } catch { return null }
}

const BACKUP_PREFIX = 'efl-backup-'

function localBackupKey(code: string) { return BACKUP_PREFIX + code }

function saveLocalBackup(code: string, serialized: ReturnType<typeof serializeState>) {
  try { localStorage.setItem(localBackupKey(code), JSON.stringify(serialized)) } catch { /* storage full */ }
}

function loadLocalBackup(code: string): GameState | null {
  try {
    const raw = localStorage.getItem(localBackupKey(code))
    if (!raw) return null
    return deserializeState(JSON.parse(raw))
  } catch { return null }
}

export async function loadRoom(code: string): Promise<GameState | null> {
  try {
    const { data } = await supabase
      .from('rooms')
      .select('state')
      .eq('code', code)
      .single()
    if (data) {
      const state = deserializeState(data.state as Record<string, unknown>)
      if (state) return state
    }
  } catch { /* fall through to local backup */ }
  // Supabase failed or returned nothing — try local backup
  return loadLocalBackup(code)
}

function isBlankState(S: GameState): boolean {
  return S.cMDs.size === 0 && S.teams.every(t => t.pts === 0 && t.p === 0)
}

export async function saveRoom(code: string, S: GameState): Promise<void> {
  if (isBlankState(S)) return
  const serialized = serializeState(S)
  // Always write local backup first — survives Supabase outages
  saveLocalBackup(code, serialized)
  await supabase.from('rooms').upsert({
    code,
    state: serialized,
    updated_at: new Date().toISOString(),
  })
}

export function getRawSavedAt(raw: Record<string, unknown>): number {
  return getSavedAt(raw)
}
