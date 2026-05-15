import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CupMatch, CupRound, CupState, CupTeam } from '@/types'
import playerDB from '@/playerDB.json'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<CupRound, string> = {
  R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final',
}
const ROUND_ORDER: CupRound[] = ['R16', 'QF', 'SF', 'F']

// R16 pairs → QF, QF → SF, SF → F
const NEXT_MATCH: Record<string, { nextId: string; slot: 'home' | 'away' }> = {
  'R16-0': { nextId: 'QF-0', slot: 'home' }, 'R16-1': { nextId: 'QF-0', slot: 'away' },
  'R16-2': { nextId: 'QF-1', slot: 'home' }, 'R16-3': { nextId: 'QF-1', slot: 'away' },
  'R16-4': { nextId: 'QF-2', slot: 'home' }, 'R16-5': { nextId: 'QF-2', slot: 'away' },
  'R16-6': { nextId: 'QF-3', slot: 'home' }, 'R16-7': { nextId: 'QF-3', slot: 'away' },
  'QF-0': { nextId: 'SF-0', slot: 'home' }, 'QF-1': { nextId: 'SF-0', slot: 'away' },
  'QF-2': { nextId: 'SF-1', slot: 'home' }, 'QF-3': { nextId: 'SF-1', slot: 'away' },
  'SF-0': { nextId: 'F-0',  slot: 'home' }, 'SF-1': { nextId: 'F-0',  slot: 'away' },
}

// All unique teams in the player database
const DB_TEAMS = [...new Map(
  (playerDB as { teamId: number; team: string }[]).map(p => [p.teamId, { id: p.teamId, name: p.team }])
).values()].sort((a, b) => a.name.localeCompare(b.name))

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function teamName(id: string | null, teams: CupTeam[]): string {
  if (!id) return 'TBD'
  return teams.find(t => t.id === id)?.name ?? 'TBD'
}

function winnerId(m: CupMatch): string | null {
  if (m.penWinnerId) return m.penWinnerId
  if (m.homeGoals == null || m.awayGoals == null) return null
  if (m.homeGoals > m.awayGoals) return m.homeId
  if (m.awayGoals > m.homeGoals) return m.awayId
  return null
}

function isDraw(m: CupMatch) {
  return m.homeGoals != null && m.awayGoals != null && m.homeGoals === m.awayGoals
}

function propagateWinners(matches: CupMatch[]): CupMatch[] {
  const map = new Map(matches.map(m => [m.id, { ...m }]))
  for (const m of map.values()) {
    const w = winnerId(m)
    if (!w) continue
    const next = NEXT_MATCH[m.id]
    if (!next) continue
    const nm = map.get(next.nextId)
    if (!nm) continue
    const key = next.slot === 'home' ? 'homeId' : 'awayId'
    if (nm[key] !== w) {
      map.set(next.nextId, { ...nm, [key]: w, homeGoals: null, awayGoals: null, penWinnerId: undefined })
    }
  }
  return Array.from(map.values())
}

// 16 teamIds → 8 R16 matches (1v2, 3v4, ...) + QF/SF/F (all TBD)
function buildMatches(teamIds: string[]): CupMatch[] {
  const r16: CupMatch[] = Array.from({ length: 8 }, (_, i) => ({
    id: `R16-${i}`, round: 'R16' as CupRound, position: i,
    homeId: teamIds[i * 2] ?? null, awayId: teamIds[i * 2 + 1] ?? null,
    homeGoals: null, awayGoals: null,
  }))
  const qf: CupMatch[] = Array.from({ length: 4 }, (_, i) => ({
    id: `QF-${i}`, round: 'QF' as CupRound, position: i,
    homeId: null, awayId: null, homeGoals: null, awayGoals: null,
  }))
  const sf: CupMatch[] = Array.from({ length: 2 }, (_, i) => ({
    id: `SF-${i}`, round: 'SF' as CupRound, position: i,
    homeId: null, awayId: null, homeGoals: null, awayGoals: null,
  }))
  return [...r16, ...qf, ...sf, {
    id: 'F-0', round: 'F' as CupRound, position: 0,
    homeId: null, awayId: null, homeGoals: null, awayGoals: null,
  }]
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, teams, onUpdate }: {
  match: CupMatch; teams: CupTeam[]
  onUpdate: (u: Partial<CupMatch>) => void
}) {
  const isTbd = !match.homeId || !match.awayId
  const draw = isDraw(match)
  const winner = winnerId(match)

  return (
    <div className={`rounded-lg border p-3 space-y-2 text-sm ${winner ? 'bg-muted/30' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`flex-1 truncate ${winner === match.homeId ? 'font-semibold' : 'text-muted-foreground'}`}>
          {teamName(match.homeId, teams)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <input type="number" min={0} max={99} disabled={isTbd} placeholder="—"
            className="w-10 text-center border rounded px-1 py-1 text-sm bg-background disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
            value={match.homeGoals ?? ''}
            onChange={e => onUpdate({ homeGoals: e.target.value === '' ? null : +e.target.value, penWinnerId: undefined })} />
          <span className="text-muted-foreground text-xs">-</span>
          <input type="number" min={0} max={99} disabled={isTbd} placeholder="—"
            className="w-10 text-center border rounded px-1 py-1 text-sm bg-background disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
            value={match.awayGoals ?? ''}
            onChange={e => onUpdate({ awayGoals: e.target.value === '' ? null : +e.target.value, penWinnerId: undefined })} />
        </div>
        <span className={`flex-1 truncate text-right ${winner === match.awayId ? 'font-semibold' : 'text-muted-foreground'}`}>
          {teamName(match.awayId, teams)}
        </span>
      </div>
      {draw && !match.penWinnerId && (
        <div className="flex items-center gap-2 pt-1 border-t text-xs">
          <span className="text-muted-foreground">Pens winner:</span>
          <button className="px-2 py-0.5 rounded border hover:bg-muted" onClick={() => onUpdate({ penWinnerId: match.homeId ?? undefined })}>{teamName(match.homeId, teams)}</button>
          <button className="px-2 py-0.5 rounded border hover:bg-muted" onClick={() => onUpdate({ penWinnerId: match.awayId ?? undefined })}>{teamName(match.awayId, teams)}</button>
        </div>
      )}
      {draw && match.penWinnerId && (
        <div className="flex items-center gap-2 pt-1 border-t text-xs">
          <span className="text-muted-foreground">Pens: <strong>{teamName(match.penWinnerId, teams)}</strong></span>
          <button className="text-muted-foreground underline" onClick={() => onUpdate({ penWinnerId: undefined })}>clear</button>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Cup() {
  const { S, setS, scheduleSave } = useGame()
  const cup = S.cup

  // All teams available to pick from: league clubs + DB clubs
  const ALL_TEAMS = [
    ...S.teams.map(t => ({ id: `league-${t.id}`, name: t.name, group: 'League' })),
    ...DB_TEAMS.map(t => ({ id: `db-${t.id}`, name: t.name, group: 'Database' })),
  ]

  // 16 selected team IDs (default: all 12 league + first 4 DB)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const leagueIds = S.teams.map(t => `league-${t.id}`)
    const dbIds = DB_TEAMS.slice(0, 4).map(t => `db-${t.id}`)
    return [...leagueIds, ...dbIds].slice(0, 16)
  })

  // Active round for bracket view
  const [activeRound, setActiveRound] = useState<CupRound>('R16')

  function startCup() {
    const unique = new Set(selectedIds)
    if (unique.size !== 16) { alert('Each club must appear exactly once across all 16 slots.'); return }

    const allTeams: CupTeam[] = selectedIds.map(id => {
      if (id.startsWith('league-')) {
        const tid = +id.replace('league-', '')
        const t = S.teams.find(t => t.id === tid)
        return { id, name: t?.name ?? id, leagueId: tid }
      } else {
        const tid = +id.replace('db-', '')
        const t = DB_TEAMS.find(t => t.id === tid)
        return { id, name: t?.name ?? id }
      }
    })

    const newCup: CupState = {
      season: S.season,
      externalTeams: [],
      teams: allTeams,
      matches: buildMatches(selectedIds),
    }
    setS(prev => { const next = { ...prev, cup: newCup }; scheduleSave(next); return next })
    setActiveRound('R16')
  }

  function resetCup() {
    if (!confirm('Reset the cup? This clears all results and the bracket.')) return
    setS(prev => { const next = { ...prev, cup: null }; scheduleSave(next); return next })
  }

  function updateMatch(matchId: string, updates: Partial<CupMatch>) {
    if (!cup) return
    setS(prev => {
      const prevCup = prev.cup!
      const updated = prevCup.matches.map(m => m.id === matchId ? { ...m, ...updates } : m)
      const next = { ...prev, cup: { ...prevCup, matches: propagateWinners(updated) } }
      scheduleSave(next)
      return next
    })
  }

  const selectCls = 'flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm'

  // ─── Setup ──────────────────────────────────────────────────────────────────

  if (!cup) {
    const dupes = selectedIds.length !== new Set(selectedIds).size

    return (
      <div className="space-y-4 max-w-2xl">
        {/* Branded header */}
        <div
          className="rounded-2xl overflow-hidden px-6 py-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #0a0e24 0%, #1a2d6b 100%)' }}
        >
          <img src="/cup-logo.png" alt="Cup" className="w-14 h-14 object-contain shrink-0 drop-shadow-lg" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5" style={{ color: '#4169e1' }}>
              Cup Competition
            </p>
            <p className="text-white text-xl font-bold leading-tight">Set up the Cup</p>
            <p className="text-white/40 text-xs mt-0.5">Pick 16 clubs — seeded 1v2, 3v4… in the R16</p>
          </div>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Team selection</CardTitle>
            <CardDescription>Pick 16 clubs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            <div className="grid grid-cols-2 gap-2">
              {selectedIds.map((id, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <select
                    className={selectCls}
                    value={id}
                    onChange={e => setSelectedIds(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  >
                    {ALL_TEAMS.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {dupes && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Each club must appear exactly once.</p>
            )}

            <Button onClick={startCup} disabled={dupes} style={{ background: 'linear-gradient(135deg, #1a2d6b 0%, #0d1640 100%)', color: '#fff' }}>
              Start Cup →
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Active bracket ──────────────────────────────────────────────────────────

  const roundMatches = cup.matches.filter(m => m.round === activeRound)
  const final = cup.matches.find(m => m.round === 'F')
  const champion = final ? winnerId(final) : null

  return (
    <div className="space-y-4">
      {/* Branded header */}
      <div
        className="rounded-2xl overflow-hidden px-6 py-5 flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #0a0e24 0%, #1a2d6b 100%)' }}
      >
        <div className="flex items-center gap-4">
          <img src="/cup-logo.png" alt="Cup" className="w-14 h-14 object-contain shrink-0 drop-shadow-lg" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5" style={{ color: '#4169e1' }}>
              Cup Competition
            </p>
            <p className="text-white text-xl font-bold leading-tight">
              {S.season}/{(S.season + 1).toString().slice(2)} Cup
            </p>
            <p className="text-white/40 text-xs mt-0.5">{cup.teams.length} clubs · {cup.matches.length} matches</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={resetCup}
          className="border-white/20 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/30 shrink-0">
          Reset
        </Button>
      </div>

      {champion && (
        <div
          className="rounded-2xl p-6 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #0a0e24 0%, #1a2d6b 100%)' }}
        >
          <img src="/cup-logo.png" alt="" className="w-12 h-12 object-contain mx-auto mb-3 drop-shadow-lg" />
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: '#4169e1' }}>Cup Champions</p>
          <p className="text-2xl font-bold">🏆 {teamName(champion, cup.teams)}</p>
        </div>
      )}

      {/* Round tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit flex-wrap">
        {ROUND_ORDER.map(r => {
          const done = cup.matches.filter(m => m.round === r).every(m => winnerId(m) !== null)
          return (
            <button key={r} onClick={() => setActiveRound(r)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1"
              style={activeRound === r ? { background: '#1a2d6b', color: '#fff' } : { color: 'var(--muted-foreground)' }}>
              {ROUND_LABELS[r]}
              {done && <span className="text-[10px]">✓</span>}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roundMatches.map(match => (
          <MatchCard key={match.id} match={match} teams={cup.teams}
            onUpdate={u => updateMatch(match.id, u)} />
        ))}
      </div>

      {/* Teams reference */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Teams in this cup</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {cup.teams.map(t => (
              <div key={t.id} className="text-xs px-2 py-1 rounded border flex items-center gap-1.5">
                {t.leagueId != null && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4169e1' }} />}
                <span className="truncate">{t.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
