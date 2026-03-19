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

export function serializeState(S: GameState) {
  return { ...S, cMDs: Array.from(S.cMDs) }
}

export function deserializeState(raw: Record<string, unknown>): GameState | null {
  try {
    const teams = raw.teams as unknown[]
    const mdFx = raw.mdFx as unknown[]
    if (!Array.isArray(teams) || teams.length !== TEAM_DEFS.length) return null
    if (!Array.isArray(mdFx) || mdFx.length !== 22) return null
    return {
      ...(raw as object),
      cMDs: new Set<number>(Array.isArray(raw.cMDs) ? (raw.cMDs as number[]) : []),
      results: Array.isArray(raw.results) ? raw.results : [],
      notices: Array.isArray(raw.notices) ? raw.notices : [],
      rivalries: Array.isArray(raw.rivalries) ? raw.rivalries : [],
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

export async function loadRoom(code: string): Promise<GameState | null> {
  const { data } = await supabase
    .from('rooms')
    .select('state')
    .eq('code', code)
    .single()
  if (!data) return null
  return deserializeState(data.state as Record<string, unknown>)
}

export async function saveRoom(code: string, S: GameState): Promise<void> {
  await supabase.from('rooms').upsert({
    code,
    state: serializeState(S),
    updated_at: new Date().toISOString(),
  })
}
