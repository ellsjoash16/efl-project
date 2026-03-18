import type { Team, GameState } from '../types'
import { TEAM_DEFS, TV, SOL, PB, PS, NFX } from '../data'
import LZString from 'lz-string'

export function tva(p: number): number {
  if (p >= 7) return (p - 6) * SOL
  return -([7,8,9,10,11,12].reduce((s, x) => s + (x - 6) * SOL, 0) / 6)
}

export function tvn(p: number): number { return TV + tva(p) }

export function prz(p: number): number { return PB + (p <= 6 ? (7 - p) * PS : 0) }

export function fm(n: number): string { return '£' + Math.round(n).toLocaleString() }

export function fmm(n: number): string { return '£' + (n / 1e6).toFixed(2) + 'm' }

export function fms(n: number): string { return '£' + (n / 1e6).toFixed(1) + 'm' }

export function avgTicket(t: Team): number {
  return Math.round(t.stands.reduce((s, st) => s + st.tp, 0) / t.stands.length)
}

export function teamRevenue(t: Team, p: number): number {
  const sp = t.sponsors.filter(s => s.active).reduce((x, s) => x + s.value, 0)
  return t.matchday_rev + tvn(p) + t.commercial_rev + sp + prz(p)
}

export function seasonLabel(season: number): string {
  return season + '/' + (season + 1).toString().slice(2)
}

export function sorted(teams: Team[]): Team[] {
  return [...teams].sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
  )
}

export function posOf(teams: Team[], id: number): number {
  return sorted(teams).findIndex(t => t.id === id) + 1
}

export type MoodLabel = 'Ecstatic' | 'Positive' | 'Neutral' | 'Frustrated' | 'Furious'
export type MoodVariant = 'green' | 'blue' | 'neutral' | 'orange' | 'red'

export function moodLabel(m: number): [MoodLabel, MoodVariant] {
  if (m >= 80) return ['Ecstatic', 'green']
  if (m >= 65) return ['Positive', 'blue']
  if (m >= 50) return ['Neutral', 'neutral']
  if (m >= 35) return ['Frustrated', 'orange']
  return ['Furious', 'red']
}

export function moodFromPos(pos: number, form: string[]): number {
  const b = Math.max(10, Math.min(95, 100 - (pos - 1) * 7))
  const f = form.slice(-5).reduce((s, x) => s + (x === 'W' ? 3 : x === 'D' ? 0 : -3), 0)
  return Math.max(5, Math.min(99, Math.round(b + f)))
}

export function mkTeams() {
  return TEAM_DEFS.map((td, i) => ({
    ...td,
    p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] as ('W'|'D'|'L')[],
    fanbase: 18000 + i * 6500 + Math.floor(Math.random() * 4000),
    mood: 60,
    attp: 0.76 + Math.random() * 0.14,
    capacity: td.stands.reduce((s, st) => s + st.cap, 0),
    stands: td.stands.map(st => ({
      ...st,
      occ: 0.75 + Math.random() * 0.15,
      atm: 60 + Math.floor(Math.random() * 20),
      upgrades: [] as import('../types').Upgrade[],
      baseTP: st.tp,
    })),
    commercial_rev: 8e6 + i * 0.6e6,
    matchday_rev: 0,
    stadium_debt: 0,
    wage_bill: (35 + i * 4) * 1e6,
    transfer_budget: (20 + i * 2.5) * 1e6,
    transfers_in: 0,
    transfers_out: 0,
    sponsors: [
      {slot:"Shirt Front", name:"SportsBet Elite", value:12e6+i*0.5e6, active:true},
      {slot:"Sleeve", name:"LocalBank FC", value:4.5e6+i*0.2e6, active:true},
      {slot:"Training Kit", name:"KitCo", value:3e6+i*0.15e6, active:true},
      {slot:"Stadium Name", name:"Arena Corp", value:6e6+i*0.3e6, active:false},
    ],
  }))
}

export function makeInitialState(): GameState {
  return {
    season: 2024,
    matchday: 0,
    cMDs: new Set<number>(),
    mdFx: Array.from({length: 22}, () =>
      Array.from({length: NFX}, () => ({hi: 0, ai: 1, hg: '', ag: ''}))
    ),
    results: [],
    notices: [],
    teams: mkTeams(),
    rivalries: [
      {a:7, b:10, type:"Local Derby", intensity:95, h2h:[0,0,0], last:null},
      {a:0, b:2, type:"Historical Rivals", intensity:78, h2h:[0,0,0], last:null},
      {a:1, b:8, type:"Title Rivals", intensity:70, h2h:[0,0,0], last:null},
    ],
  }
}

const STORAGE_KEY = 'efl-project:v1'

export function saveToStorage(S: GameState): boolean {
  try {
    const payload = { S: { ...S, cMDs: Array.from(S.cMDs) } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch { return false }
}

export function loadFromStorage(): GameState | null {
  try {
    const rawStr = localStorage.getItem(STORAGE_KEY)
    if (!rawStr) return null
    const raw = JSON.parse(rawStr)
    if (!raw?.S?.teams || raw.S.teams.length !== TEAM_DEFS.length) return null
    if (!raw.S.mdFx || raw.S.mdFx.length !== 22) return null
    const ns = raw.S
    return {
      ...ns,
      cMDs: new Set<number>(Array.isArray(ns.cMDs) ? ns.cMDs : []),
      teams: ns.teams.map((t: Team, i: number) => ({
        ...t,
        id: typeof t.id === 'number' ? t.id : i,
        stands: (t.stands || []).map((st: Team['stands'][0]) => ({
          ...st,
          upgrades: Array.isArray(st.upgrades) ? st.upgrades : [],
          baseTP: typeof st.baseTP === 'number' ? st.baseTP : st.tp,
        })),
        sponsors: Array.isArray(t.sponsors) ? t.sponsors : [],
        form: Array.isArray(t.form) ? t.form : [],
        transfers_in: t.transfers_in ?? 0,
        transfers_out: t.transfers_out ?? 0,
      })),
    }
  } catch { return null }
}

export function encodeShareCode(S: GameState): string {
  const slim = {
    season: S.season,
    matchday: S.matchday,
    cMDs: Array.from(S.cMDs),
    rivalries: S.rivalries,
    mdFx: S.mdFx.map((mdfx, mi) =>
      S.cMDs.has(mi)
        ? mdfx.map(f => ({ hi: f.hi, ai: f.ai, hg: f.hg, ag: f.ag, saved: f.saved }))
        : mdfx.map(f => ({ hi: f.hi, ai: f.ai }))
    ),
    teams: S.teams.map(t => ({
      ...t,
      form: t.form.slice(-10),
    })),
  }
  return LZString.compressToEncodedURIComponent(JSON.stringify(slim))
}

export function decodeShareCode(code: string): GameState | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(code.trim())
    if (!decompressed) return null
    const ns = JSON.parse(decompressed)
    if (!ns?.teams || ns.teams.length !== TEAM_DEFS.length) return null
    if (!ns.mdFx || ns.mdFx.length !== 22) return null
    const cMDs = new Set<number>(Array.isArray(ns.cMDs) ? ns.cMDs : [])
    return {
      ...ns,
      results: [],
      notices: [],
      cMDs,
      mdFx: ns.mdFx.map((mdfx: typeof ns.mdFx[0], mi: number) =>
        Array.from({ length: NFX }, (_, fi) => {
          const f = mdfx[fi] ?? { hi: 0, ai: 1 }
          return {
            hi: f.hi ?? 0,
            ai: f.ai ?? 1,
            hg: f.hg ?? '',
            ag: f.ag ?? '',
            saved: f.saved ?? (cMDs.has(mi) ? true : undefined),
          }
        })
      ),
      teams: ns.teams.map((t: Team, i: number) => ({
        ...t,
        id: typeof t.id === 'number' ? t.id : i,
        stands: (t.stands || []).map((st: Team['stands'][0]) => ({
          ...st,
          upgrades: Array.isArray(st.upgrades) ? st.upgrades : [],
          baseTP: typeof st.baseTP === 'number' ? st.baseTP : st.tp,
        })),
        sponsors: Array.isArray(t.sponsors) ? t.sponsors : [],
        form: Array.isArray(t.form) ? t.form : [],
        transfers_in: t.transfers_in ?? 0,
        transfers_out: t.transfers_out ?? 0,
      })),
    }
  } catch { return null }
}

export function exportSave(S: GameState, season: number): void {
  const payload = { S: { ...S, cMDs: Array.from(S.cMDs) } }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `efl-save-${seasonLabel(season).replace('/', '-')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
