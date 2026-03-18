import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { moodLabel, posOf, teamRevenue, avgTicket, fm, fmm } from '@/lib/gameLogic'
import { UPG, TIERS, TSENS, SC, TEAM_DEFS } from '@/data'
import type { Stand } from '@/types'

function StandCard({ ti, si, st, mood }: { ti: number; si: number; st: Stand; mood: number }) {
  const { setS, scheduleSave } = useGame()
  const [seatCount, setSeatCount] = useState(2000)
  const [newTP, setNewTP] = useState(st.tp)

  const upgList = UPG[st.type] || []
  const installed = st.upgrades.map(u => u.id)
  const avail = upgList.filter(u => !installed.includes(u.id))
  const atm = Math.min(99, Math.max(20, Math.round(st.atm * (mood / 65))))
  const occ = Math.round(st.occ * 100)
  const aC = atm >= 70 ? 'bg-[#3B6D11]' : atm >= 50 ? 'bg-[#185FA5]' : 'bg-[#A32D2D]'
  const oC = occ >= 75 ? 'bg-[#3B6D11]' : occ >= 55 ? 'bg-[#185FA5]' : 'bg-[#A32D2D]'
  const sens = TSENS[st.type]
  const pct = st.baseTP > 0 ? Math.round(((st.tp - st.baseTP) / st.baseTP) * 100) : 0

  function updateStandName(name: string) {
    setS(prev => {
      const teams = prev.teams.map((t, i) => i === ti ? {
        ...t, stands: t.stands.map((s, j) => j === si ? { ...s, name } : s)
      } : t)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function addSeats() {
    if (seatCount < 100) { alert('Min 100.'); return }
    setS(prev => {
      const teams = prev.teams.map((t, i) => {
        if (i !== ti) return t
        const stands = t.stands.map((s, j) => j === si ? { ...s, cap: s.cap + seatCount } : s)
        return { ...t, stands, capacity: stands.reduce((sum, s) => sum + s.cap, 0), stadium_debt: t.stadium_debt + seatCount * SC }
      })
      const notice = { tid: ti, type: 'info' as const, msg: `${seatCount.toLocaleString()} seats added to ${st.name}. Cost: ${fm(seatCount * SC)}.` }
      const next = { ...prev, teams, notices: [notice, ...prev.notices] }
      scheduleSave(next)
      return next
    })
  }

  function changeTP() {
    if (isNaN(newTP) || newTP < 5 || newTP > 500) return
    setS(prev => {
      const teams = prev.teams.map((t, i) => {
        if (i !== ti) return t
        const tol = Math.round(st.baseTP * sens.t / 100)
        const diff = newTP - st.baseTP
        const old = st.tp
        let moodDelta = 0
        let notice: typeof prev.notices[0] | null = null
        if (diff > tol * 2) {
          const h = Math.round(Math.min(20, (diff - tol) * 0.8))
          moodDelta = -h
          notice = { tid: ti, type: 'bad', msg: `Ticket hike in ${st.name} (£${old}→£${newTP}). Mood –${h}%.` }
        } else if (diff > tol) {
          const h = Math.round(Math.min(8, (diff - tol) * 0.4))
          moodDelta = -h
          notice = { tid: ti, type: 'warn', msg: `${st.name} rise above tolerance. Mood –${h}%.` }
        } else if (diff < -tol) {
          const b = Math.round(Math.min(10, Math.abs(diff) * 0.3))
          moodDelta = b
          notice = { tid: ti, type: 'good', msg: `Price cut in ${st.name} well received. Mood +${b}%.` }
        }
        const stands = t.stands.map((s, j) => j === si ? { ...s, tp: newTP } : s)
        const newMood = Math.max(5, Math.min(99, t.mood + moodDelta))
        const filteredNotices = notice ? prev.notices.filter(n => !(n.tid === ti && n.msg.includes(st.name))) : prev.notices
        return { ...t, stands, mood: newMood, _notices: notice ? [notice, ...filteredNotices] : filteredNotices } as typeof t & { _notices: typeof prev.notices }
      })
      const allNotices = (teams.find((_, i) => i === ti) as (typeof teams[0]) & { _notices?: typeof prev.notices })?._notices ?? prev.notices
      const cleanTeams = teams.map(t => { const { ...rest } = t as typeof t & { _notices?: unknown }; delete rest._notices; return rest })
      const next = { ...prev, teams: cleanTeams, notices: allNotices }
      scheduleSave(next)
      return next
    })
  }

  function addUpgrade(uid: string) {
    const upg = (UPG[st.type] || []).find(u => u.id === uid)
    if (!upg) return
    setS(prev => {
      const teams = prev.teams.map((t, i) => {
        if (i !== ti) return t
        const stands = t.stands.map((s, j) => {
          if (j !== si) return s
          return {
            ...s,
            upgrades: [...s.upgrades, { ...upg }],
            atm: upg.effect === 'atmosphere' ? Math.min(99, s.atm + upg.val) : s.atm,
            occ: upg.effect === 'occupancy' ? Math.min(0.98, s.occ + upg.val / 100) : s.occ,
          }
        })
        return { ...t, stands, mood: upg.effect === 'mood' ? Math.min(99, t.mood + upg.val) : t.mood }
      })
      const notice = { tid: ti, type: 'good' as const, msg: `${upg.name} installed in ${st.name}.` }
      const next = { ...prev, teams, notices: [notice, ...prev.notices] }
      scheduleSave(next)
      return next
    })
  }

  function removeUpgrade(ui: number) {
    const upg = st.upgrades[ui]
    setS(prev => {
      const teams = prev.teams.map((t, i) => {
        if (i !== ti) return t
        const stands = t.stands.map((s, j) => {
          if (j !== si) return s
          return {
            ...s,
            upgrades: s.upgrades.filter((_, k) => k !== ui),
            atm: upg.effect === 'atmosphere' ? Math.max(10, s.atm - upg.val) : s.atm,
            occ: upg.effect === 'occupancy' ? Math.max(0.3, s.occ - upg.val / 100) : s.occ,
          }
        })
        return { ...t, stands, mood: upg.effect === 'mood' ? Math.max(5, t.mood - upg.val) : t.mood }
      })
      scheduleSave({ ...prev, teams })
      return { ...prev, teams }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <input
              className="text-[15px] font-semibold border border-transparent bg-transparent rounded px-1 py-0.5 hover:border-border focus:border-border focus:bg-background focus:outline-none cursor-text"
              value={st.name}
              onChange={e => updateStandName(e.target.value)}
            />
            <CardDescription className="mt-0.5">{st.type} · {st.cap.toLocaleString()} seats</CardDescription>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="neutral">{st.type}</Badge>
            {st.upgrades.length > 0 && (
              <Badge variant="blue">{st.upgrades.length} upgrade{st.upgrades.length > 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Occupancy & Atmosphere */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Occupancy</span>
              <span className="font-medium">{occ}%</span>
            </div>
            <Progress value={occ} className="h-2 bg-primary/10" indicatorClassName={oC} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Atmosphere</span>
              <span className="font-medium">{atm}%</span>
            </div>
            <Progress value={atm} className="h-2 bg-primary/10" indicatorClassName={aC} />
          </div>
        </div>

        <Separator />

        {/* Ticket price */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Ticket price</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">£</span>
            <Input type="number" min={5} max={500} value={newTP} onChange={e => setNewTP(parseInt(e.target.value))} className="w-20 h-8" />
            <Button size="sm" variant="outline" onClick={changeTP}>Update</Button>
            {pct !== 0 && (
              <span className={`text-xs font-medium ${pct > 10 ? 'text-[#A32D2D]' : pct < -5 ? 'text-[#3B6D11]' : ''}`}>
                {pct > 0 ? '+' : ''}{pct}% from base
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Base: £{st.baseTP} · Tolerance: ±{sens.t}%</p>
        </div>

        <Separator />

        {/* Add seats */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Add seats</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="number" min={100} max={20000} step={500}
              value={seatCount}
              onChange={e => setSeatCount(parseInt(e.target.value) || 0)}
              className="w-24 h-8"
            />
            <Button size="sm" variant="outline" onClick={addSeats}>Add seats</Button>
            <span className="text-xs text-muted-foreground">Est: {fm(seatCount * SC)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">£{SC.toLocaleString()} per seat</p>
        </div>

        {/* Installed upgrades */}
        {st.upgrades.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Installed</p>
              <div className="space-y-1">
                {st.upgrades.map((u, ui) => (
                  <div key={ui} className="flex justify-between items-center py-1.5 border-b last:border-0 text-sm">
                    <span>{u.name}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant="green" className="text-[10px]">{u.desc}</Badge>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-[#791F1F] border-[#791F1F]/30 hover:bg-[#FCEBEB]" onClick={() => removeUpgrade(ui)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Available upgrades */}
        {avail.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Available upgrades</p>
              <div className="space-y-1">
                {avail.map(u => (
                  <div key={u.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.desc} · {fm(u.cost)}</p>
                    </div>
                    <Button size="sm" onClick={() => addUpgrade(u.id)}>Install</Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {avail.length === 0 && st.upgrades.length === upgList.length && (
          <p className="text-xs text-muted-foreground">All upgrades installed.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function Stadiums() {
  const { S, setS, scheduleSave } = useGame()
  const [teamIdx, setTeamIdx] = useState(0)
  const [rebuildOpen, setRebuildOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)

  const t = S.teams[teamIdx]
  const pos = posOf(S.teams, teamIdx)
  const pr = teamRevenue(t, pos)

  function updateStadiumName(name: string) {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? { ...tm, stadiumName: name } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function confirmRebuild() {
    const tier = TIERS.find(tr => tr.id === selectedTier)
    if (!tier) return
    const cost = Math.round(pr * tier.cm)
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i !== teamIdx ? tm : {
        ...tm,
        stadiumName: tier.name + ' (' + tm.name + ')',
        stands: tier.stands.map(st => ({ ...st, upgrades: [], baseTP: st.tp })),
        capacity: tier.capacity,
        attp: tier.stands[0].occ,
        stadium_debt: tm.stadium_debt + cost,
        mood: Math.min(99, tm.mood + 12),
      })
      const notice = { tid: teamIdx, type: 'info' as const, msg: `New ${tier.name} opens! Mood +12%. Debt: ${fmm(cost)}.` }
      const next = { ...prev, teams, notices: [notice, ...prev.notices] }
      scheduleSave(next)
      return next
    })
    setRebuildOpen(false)
    setSelectedTier(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground w-24">Club</span>
        <Select value={String(teamIdx)} onValueChange={v => setTeamIdx(parseInt(v))}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEAM_DEFS.map((td, i) => <SelectItem key={i} value={String(i)}>{td.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stadium overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <CardDescription className="mb-1">Stadium</CardDescription>
              <input
                className="text-lg font-semibold border border-transparent bg-transparent rounded px-1 py-0.5 hover:border-border focus:border-border focus:bg-background focus:outline-none cursor-text"
                value={t.stadiumName}
                onChange={e => updateStadiumName(e.target.value)}
              />
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Capacity: <strong className="text-foreground">{t.capacity.toLocaleString()}</strong></p>
              <p>Season revenue: <strong className="text-foreground">{fmm(pr)}</strong></p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ['Avg ticket', `£${avgTicket(t)}`],
              ['Fan mood', `${t.mood}% — ${moodLabel(t.mood)[0]}`],
              ...(t.stadium_debt > 0 ? [['Stadium debt', fmm(t.stadium_debt), 'text-[#A32D2D]']] : []),
            ].map(([label, val, cls]) => (
              <div key={String(label)} className="bg-muted rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-lg font-semibold ${cls ?? ''}`}>{val}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stand cards */}
      {t.stands.map((st, si) => (
        <StandCard key={si} ti={teamIdx} si={si} st={st} mood={t.mood} />
      ))}

      {/* Rebuild stadium */}
      <Card className="border-[#854F0B]/40">
        <CardHeader>
          <CardTitle className="text-sm">Rebuild stadium</CardTitle>
          <CardDescription>Cost = season revenue × multiplier (currently <strong>{fmm(pr)}</strong>).</CardDescription>
        </CardHeader>
        <CardContent>
          {!rebuildOpen ? (
            <Button variant="outline" className="border-[#854F0B] text-[#854F0B] hover:bg-[#FAEEDA] hover:text-[#633806]" onClick={() => setRebuildOpen(true)}>
              Choose new stadium
            </Button>
          ) : (
            <div className="space-y-3">
              {TIERS.map(tier => {
                const cost = Math.round(pr * tier.cm)
                const sel = selectedTier === tier.id
                return (
                  <div
                    key={tier.id}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${sel ? 'border-[#185FA5] border-2 bg-[#E6F1FB]' : 'hover:border-muted-foreground'}`}
                    onClick={() => setSelectedTier(tier.id)}
                  >
                    <div className="flex justify-between mb-1.5 flex-wrap gap-2">
                      <div>
                        <p className="font-semibold">{tier.name}</p>
                        <p className="text-xs text-muted-foreground">{tier.capacity.toLocaleString()} cap · {tier.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#A32D2D]">{fmm(cost)}</p>
                        <p className="text-[10px] text-muted-foreground">{tier.cm}× revenue</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Includes: {tier.features.join(', ')}</p>
                  </div>
                )
              })}
              <div className="flex gap-2 pt-1">
                <Button disabled={!selectedTier} onClick={confirmRebuild}>Confirm rebuild</Button>
                <Button variant="outline" onClick={() => { setRebuildOpen(false); setSelectedTier(null) }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
