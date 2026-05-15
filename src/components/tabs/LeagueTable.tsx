import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { sorted, fmm, prz, tvn, moodLabel, seasonLabel } from '@/lib/gameLogic'
import { loadDyn, saveDyn, applySeasonEnd, effectivePlayers } from '@/lib/playerState'
import { NFX, UPG, SC } from '@/data'
import type { SeasonSnapshot, NewsItem } from '@/types'

function FormDot({ result }: { result: string }) {
  const color =
    result === 'W' ? 'bg-emerald-500' :
    result === 'D' ? 'bg-zinc-400' :
    'bg-red-500'
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold ${color}`}>
      {result}
    </span>
  )
}

const NEXA_DARK = '#2E4A52'
const NEXA_PURPLE = '#9B6BB5'

// Zone colours for position bar
function posZone(pos: number): string {
  if (pos <= 4) return '#9B6BB5'   // purple — top 4
  if (pos <= 6) return NEXA_DARK   // sidebar teal — safe
  return '#EF4444'                 // red — fine zone (bottom 6)
}

export function LeagueTable() {
  const { S, setS, scheduleSave } = useGame()
  const [viewSeason, setViewSeason] = useState<number | null>(null)

  const history: SeasonSnapshot[] = S.seasonHistory ?? []
  const snapshot = viewSeason != null ? history.find(h => h.season === viewSeason) ?? null : null

  const rows = snapshot
    ? snapshot.standings.map(s => ({ ...s, form: [] as ('W'|'D'|'L')[], mood: 60, sponsors: [], pts: s.pts }))
    : sorted(S.teams)


  function nextSeason() {
    setViewSeason(null)
    const dyn = loadDyn()
    const humanIds = S.userTeamIds ?? []
    const seasonNews: NewsItem[] = []
    let nid = Date.now()

    setS(prev => {
      const sortedTeams = sorted(prev.teams)
      const finalStandings = sortedTeams.map(t => ({
        id: t.id, name: t.name, p: t.p, w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga, pts: t.pts,
      }))
      // Resolve cup champion from the final match
      let cupWinner: string | undefined
      if (prev.cup) {
        const final = prev.cup.matches.find(m => m.round === 'F')
        if (final) {
          const wId = final.penWinnerId ?? (
            final.homeGoals != null && final.awayGoals != null
              ? final.homeGoals > final.awayGoals ? final.homeId
              : final.awayGoals > final.homeGoals ? final.awayId
              : null
              : null
          )
          if (wId) cupWinner = prev.cup.teams.find(t => t.id === wId)?.name
        }
      }
      const snapshot: SeasonSnapshot = { season: prev.season, standings: finalStandings, cupWinner }
      const prevHistory: SeasonSnapshot[] = prev.seasonHistory ?? []
      const newHistory = [snapshot, ...prevHistory].slice(0, 5)

      const teams = prev.teams.map(t => {
        const pos = sortedTeams.findIndex(st => st.id === t.id) + 1
        const sp = t.sponsors.filter(s => s.active).reduce((x, s) => x + s.value, 0)
        const revenue = t.matchday_rev + tvn(pos) + t.commercial_rev + sp + prz(pos)
        const net = revenue - t.stadium_debt - (t.transfers_in ?? 0) + (t.transfers_out ?? 0)
        let budgetNext = (t.transfer_budget ?? 0) + net

        const teamPlayers = effectivePlayers(dyn).filter(p => p.team === t.name)
        const weeklyWages = teamPlayers.reduce((s, p) => s + (dyn.contracts[p.id]?.wage ?? 0), 0)
        budgetNext -= Math.max(0, (weeklyWages - (t.wageBudget ?? 400000)) * 52)

        let stands = t.stands
        let mood = t.mood
        let capacity = t.capacity
        let stadiumDebt = 0

        if (!humanIds.includes(t.id)) {
          stands = stands.map((st, si) => {
            let s = { ...st }
            const tol = Math.round(st.baseTP * 0.05)
            if (mood > 68 && s.occ > 0.78 && s.tp < s.baseTP * 1.25) {
              const bump = Math.max(1, Math.round(s.baseTP * 0.05))
              s = { ...s, tp: Math.min(s.baseTP * 1.3, s.tp + bump) }
            } else if (mood < 50 || s.occ < 0.62) {
              const cut = Math.max(1, Math.round(s.baseTP * 0.05))
              s = { ...s, tp: Math.max(s.baseTP * 0.8, s.tp - cut) }
            }
            void tol; void si

            const installed = s.upgrades.map(u => u.id)
            const avail = (UPG[s.type] ?? []).filter(u => !installed.includes(u.id))
            if (avail.length > 0 && budgetNext > avail[0].cost * 2) {
              const upg = avail.sort((a, b) => b.val - a.val)[0]
              budgetNext -= upg.cost
              s = {
                ...s,
                upgrades: [...s.upgrades, { ...upg }],
                atm: upg.effect === 'atmosphere' ? Math.min(99, s.atm + upg.val) : s.atm,
                occ: upg.effect === 'occupancy' ? Math.min(0.98, s.occ + upg.val / 100) : s.occ,
              }
              if (upg.effect === 'mood') mood = Math.min(99, mood + upg.val)
              seasonNews.push({ id: String(nid++), season: prev.season, teamId: t.id, team: t.name, type: 'info', msg: `${t.name} installed ${upg.name} in the ${s.name}.` })
            }
            return s
          })

          const avgOcc = stands.reduce((s, st) => s + st.occ, 0) / stands.length
          if (avgOcc > 0.88 && budgetNext > 1_000_000 && Math.random() < 0.3) {
            const seats = 500 + Math.floor(Math.random() * 1000)
            const cost = seats * SC
            budgetNext -= cost
            stadiumDebt += cost
            capacity += seats
            stands = stands.map((st, i) => i === 0 ? { ...st, cap: st.cap + seats } : st)
            seasonNews.push({ id: String(nid++), season: prev.season, teamId: t.id, team: t.name, type: 'good', msg: `${t.name} expanded ${stands[0].name} by ${seats.toLocaleString()} seats.` })
          }
        }

        return {
          ...t,
          stands,
          capacity,
          mood: Math.max(45, Math.min(75, mood)),
          p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[] as ('W'|'D'|'L')[],
          matchday_rev: 0,
          stadium_debt: stadiumDebt,
          transfers_in: 0,
          transfers_out: 0,
          transfer_budget: budgetNext,
          fanbase: Math.max(5000, Math.min(2e6, t.fanbase + Math.round((t.mood - 50) * 80))),
          attp: Math.max(0.55, Math.min(0.96, t.attp)),
        }
      })

      const next = {
        ...prev,
        season: prev.season + 1,
        seasonHistory: newHistory,
        matchday: 0,
        cMDs: new Set<number>(),
        results: [],
        notices: [],
        mdFx: Array.from({length:22}, () => Array.from({length:NFX}, () => ({hi:0,ai:1,hg:0,ag:0}))),
        teams,
        newsLog: [...seasonNews, ...(prev.newsLog ?? [])].slice(0, 500),
      }
      scheduleSave(next)
      return next
    })

    const { dyn: updatedDyn, news: playerNews } = applySeasonEnd(
      dyn, S.teams.map(t => ({ id: t.id, name: t.name })), S.season, humanIds
    )
    saveDyn(updatedDyn)
    if (playerNews.length > 0) {
      setS(prev => ({
        ...prev,
        newsLog: [...playerNews, ...(prev.newsLog ?? [])].slice(0, 500),
      }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div
        className="rounded-2xl overflow-hidden px-6 py-5 flex items-center gap-4"
        style={{ background: `linear-gradient(135deg, #0a1820 0%, ${NEXA_DARK} 100%)` }}
      >
        <img src="/nexa-logo.png" alt="Nexa" className="w-12 h-12 object-contain shrink-0 opacity-95" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5" style={{ color: NEXA_PURPLE }}>
            Nexa Leading Division
          </p>
          <p className="text-white text-xl font-bold leading-tight">League Table</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Matchday</p>
          <p className="text-white text-2xl font-bold leading-none">{S.matchday}<span className="text-white/30 text-sm font-normal">/22</span></p>
        </div>
      </div>

{/* Table card */}
      <Card className="overflow-hidden border-0 shadow-md">
        {history.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">Season</span>
            <select
              className="h-7 rounded-md border border-input bg-transparent px-2 text-sm"
              value={viewSeason ?? ''}
              onChange={e => setViewSeason(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{seasonLabel(S.season)} (current)</option>
              {history.map(h => (
                <option key={h.season} value={h.season}>{seasonLabel(h.season)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="w-10 py-2.5 pl-4 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Club</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9">P</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9 hidden sm:table-cell">W</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9 hidden sm:table-cell">D</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9 hidden sm:table-cell">L</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9 hidden sm:table-cell">GF</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-9 hidden sm:table-cell">GA</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-12">GD</th>
                <th className="py-2.5 px-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-12">Pts</th>
                {!snapshot && <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xs:table-cell">Form</th>}
                {!snapshot && <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mood</th>}
                <th className="py-2.5 pr-4 pl-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Prize</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const pos = i + 1
                const gd = t.gf - t.ga
                const [mlt, mc] = moodLabel(t.mood)
                const isRiv = S.rivalries.some(r => r.a === t.id || r.b === t.id)
                const zone = posZone(pos)
                const isUserTeam = (S.userTeamIds ?? []).includes(t.id)
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border/40 transition-colors ${isUserTeam ? 'bg-purple-500/5' : 'hover:bg-muted/30'}`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <div className="flex items-center gap-2">
                        {zone !== 'transparent' ? (
                          <span className="inline-block w-1 h-5 rounded-full shrink-0" style={{ background: zone }} />
                        ) : (
                          <span className="inline-block w-1 h-5 shrink-0" />
                        )}
                        <span className={`text-sm font-semibold tabular-nums ${pos <= 4 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {pos}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold truncate ${isUserTeam ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                          {t.name}
                        </span>
                        {isRiv && <Badge variant="rival" className="text-[9px] px-1.5 py-0 shrink-0">derby</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground">{t.p}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{t.w}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{t.d}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{t.l}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{t.gf}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{t.ga}</td>
                    <td className={`py-3 px-2 text-center tabular-nums font-medium ${gd > 0 ? 'text-emerald-600 dark:text-emerald-400' : gd < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {gd > 0 ? '+' : ''}{gd}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold tabular-nums ${pos <= 4 ? 'text-white' : 'text-foreground bg-muted'}`}
                        style={pos <= 4 ? { background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)' } : {}}>
                        {t.pts}
                      </span>
                    </td>
                    {!snapshot && (
                      <td className="py-3 px-3 hidden xs:table-cell">
                        <div className="flex items-center gap-0.5">
                          {t.form.length > 0
                            ? t.form.slice(-5).map((r, idx) => <FormDot key={idx} result={r} />)
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                    )}
                    {!snapshot && (
                      <td className="py-3 px-3">
                        <Badge variant={mc} className="text-[10px]">{mlt}</Badge>
                      </td>
                    )}
                    <td className="py-3 pr-4 pl-2 text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {fmm(prz(pos))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Zone legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: NEXA_PURPLE }} />
            <span className="text-[10px] text-muted-foreground">Top 4</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: NEXA_DARK }} />
            <span className="text-[10px] text-muted-foreground">Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">Fine zone</span>
          </div>
        </div>
      </Card>

      {/* Season complete */}
      {S.matchday === 22 && !snapshot && (() => {
        const ch = sorted(S.teams)[0]
        return (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="p-8 text-white text-center" style={{ background: `linear-gradient(135deg, ${NEXA_DARK} 0%, #1a2030 100%)` }}>
              <img src="/nexa-logo.png" alt="Nexa Leading Division" className="w-14 h-14 object-contain mx-auto mb-4 opacity-90" />
              <p className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: NEXA_PURPLE }}>
                Season {seasonLabel(S.season)} complete
              </p>
              <p className="text-4xl font-bold mb-1">🏆 {ch.name}</p>
              <p className="text-sm opacity-60 mb-6">Champions · {ch.pts} pts · {ch.gf} goals scored</p>
              <Separator className="bg-white/10 mb-6" />
              <div className="flex justify-center gap-8 flex-wrap mb-7 text-sm">
                {rows.slice(0, 3).map((t, i) => (
                  <div key={t.id} className="text-center">
                    <p className="text-lg mb-0.5">{['🥇','🥈','🥉'][i]}</p>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-white/50 text-xs">{t.pts} pts</p>
                  </div>
                ))}
              </div>
              <Button
                className="h-11 px-10 text-white font-semibold rounded-xl"
                style={{ background: NEXA_PURPLE, borderColor: NEXA_PURPLE }}
                onClick={nextSeason}
              >
                Start {S.season + 1}/{(S.season + 2).toString().slice(2)} season →
              </Button>
            </div>
          </Card>
        )
      })()}
    </div>
  )
}
