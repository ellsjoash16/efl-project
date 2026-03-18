import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { moodFromPos, avgTicket } from '@/lib/gameLogic'
import { TEAM_DEFS } from '@/data'

export function Results() {
  const { S, setS, scheduleSave } = useGame()
  const [mdIndex, setMdIndex] = useState(Math.min(S.matchday, 21))

  const done = S.cMDs.has(mdIndex)
  const fx = S.mdFx[mdIndex]

  function updateFixture(fi: number, field: 'hi' | 'ai' | 'hg' | 'ag', value: string | number) {
    setS(prev => {
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex
          ? mdfx.map((f, i) => i === fi ? { ...f, [field]: value } : f)
          : mdfx
      )
      return { ...prev, mdFx: newFx }
    })
  }

  function clearScores() {
    if (done) return
    setS(prev => {
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex ? mdfx.map(f => ({ ...f, hg: '', ag: '' })) : mdfx
      )
      return { ...prev, mdFx: newFx }
    })
  }

  function submitResults() {
    if (done) { alert('Already saved.'); return }
    const used = new Set<number>()
    for (let fi = 0; fi < fx.length; fi++) {
      const f = fx[fi]
      if (f.hg === '' || f.ag === '') { alert('Fill in all scores.'); return }
      if (f.hi === f.ai) { alert(`Match ${fi + 1}: same team both sides.`); return }
      if (used.has(f.hi) || used.has(f.ai)) { alert('A team appears more than once.'); return }
      used.add(f.hi); used.add(f.ai)
    }

    setS(prev => {
      const newTeams = prev.teams.map(t => ({ ...t }))
      const newRivals = prev.rivalries.map(r => ({ ...r, h2h: [...r.h2h] as [number,number,number] }))
      const newResults = [...prev.results]
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex ? mdfx.map(f => ({ ...f })) : mdfx
      )

      fx.forEach((f, fi) => {
        const hg = parseInt(String(f.hg)), ag = parseInt(String(f.ag))
        const h = newTeams[f.hi], a = newTeams[f.ai]
        const riv = newRivals.find(r => (r.a === f.hi && r.b === f.ai) || (r.b === f.hi && r.a === f.ai))
        const rm = riv ? 1.6 : 1
        h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
        if (hg > ag) {
          h.w++; h.pts += 3; h.form = [...h.form, 'W']
          a.l++; a.form = [...a.form, 'L']
          h.fanbase = Math.min(h.fanbase + Math.round(400 * rm), 2e6)
          a.fanbase = Math.max(a.fanbase - 100, 1000)
          if (riv) { riv.h2h[0]++; riv.last = h.name + ' ' + hg + '–' + ag + ' ' + a.name; riv.intensity = Math.min(100, riv.intensity + 2) }
        } else if (hg < ag) {
          a.w++; a.pts += 3; a.form = [...a.form, 'W']
          h.l++; h.form = [...h.form, 'L']
          a.fanbase = Math.min(a.fanbase + Math.round(400 * rm), 2e6)
          h.fanbase = Math.max(h.fanbase - 100, 1000)
          if (riv) { riv.h2h[2]++; riv.last = a.name + ' ' + ag + '–' + hg + ' ' + h.name; riv.intensity = Math.min(100, riv.intensity + 2) }
        } else {
          h.d++; a.d++; h.pts++; a.pts++
          h.form = [...h.form, 'D']; a.form = [...a.form, 'D']
          if (riv) { riv.h2h[1]++; riv.last = 'Draw ' + hg + '–' + ag; riv.intensity = Math.min(100, riv.intensity + 1) }
        }
        const att = Math.floor(h.capacity * h.attp * (0.88 + Math.random() * 0.12) * (riv ? 1.08 : 1))
        h.matchday_rev += att * avgTicket(h) + att * 6.5
        h.attp = Math.min(0.98, Math.max(0.4, h.attp + (hg > ag ? 0.008 : -0.006)))
        newFx[mdIndex][fi].saved = true
        newResults.unshift({ hn: h.name, an: a.name, hg, ag, riv: !!riv, md: mdIndex + 1 })
      })

      const newCMDs = new Set(prev.cMDs)
      newCMDs.add(mdIndex)
      const newMatchday = newCMDs.size
      const sortedTeams = [...newTeams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
      sortedTeams.forEach((t, i) => { t.mood = moodFromPos(i + 1, t.form) })

      const next = { ...prev, teams: newTeams, rivalries: newRivals, results: newResults, mdFx: newFx, cMDs: newCMDs, matchday: newMatchday }
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Matchday results</CardTitle>
          <CardDescription>Pick who plays who, enter scores, save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Matchday selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Matchday</span>
            <Select value={String(mdIndex)} onValueChange={v => setMdIndex(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 22}, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {done ? <Badge variant="green">✓ saved</Badge> : <Badge variant="neutral">pending</Badge>}
          </div>

          <Separator />

          {/* Fixtures */}
          {done ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-3">Results locked.</p>
              {fx.filter(f => f.saved).map((f, fi) => {
                const riv = S.rivalries.find(r => (r.a === f.hi && r.b === f.ai) || (r.b === f.hi && r.a === f.ai))
                return (
                  <div key={fi} className="flex items-center gap-2 py-2.5 border-b last:border-0 flex-wrap">
                    <span className="text-xs text-muted-foreground w-5">{fi + 1}</span>
                    <span className="flex-1 font-medium text-right text-sm">
                      {TEAM_DEFS[f.hi].name}
                      {riv && <Badge variant="rival" className="ml-1.5 text-[10px]">{riv.type}</Badge>}
                    </span>
                    <span className="text-xl font-semibold px-3 tabular-nums">{f.hg} – {f.ag}</span>
                    <span className="flex-1 font-medium text-sm">{TEAM_DEFS[f.ai].name}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {fx.map((f, fi) => (
                <div key={fi} className="flex items-center gap-2 py-2 border-b last:border-0 flex-wrap">
                  <span className="text-xs text-muted-foreground w-5">{fi + 1}.</span>
                  {/* Home team */}
                  <Select value={String(f.hi)} onValueChange={v => updateFixture(fi, 'hi', parseInt(v))}>
                    <SelectTrigger className="flex-1 min-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_DEFS.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">vs</span>
                  {/* Away team */}
                  <Select value={String(f.ai)} onValueChange={v => updateFixture(fi, 'ai', parseInt(v))}>
                    <SelectTrigger className="flex-1 min-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_DEFS.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* Score */}
                  <div className="flex items-center gap-1.5 ml-1">
                    <Input
                      type="number" min={0} max={20}
                      className="w-14 text-center text-base font-semibold tabular-nums"
                      placeholder="0"
                      value={f.hg}
                      onChange={e => updateFixture(fi, 'hg', e.target.value)}
                    />
                    <span className="text-muted-foreground font-medium">–</span>
                    <Input
                      type="number" min={0} max={20}
                      className="w-14 text-center text-base font-semibold tabular-nums"
                      placeholder="0"
                      value={f.ag}
                      onChange={e => updateFixture(fi, 'ag', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={submitResults}>Save matchday</Button>
            <Button variant="outline" onClick={clearScores}>Clear scores</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Result log</CardTitle>
        </CardHeader>
        <CardContent>
          {S.results.length === 0 ? (
            <p className="text-xs text-muted-foreground">No results yet.</p>
          ) : (
            <div className="text-xs space-y-1 max-h-72 overflow-y-auto">
              {S.results.slice(0, 60).map((r, i) => {
                const col = r.hg > r.ag ? '#3B6D11' : r.hg < r.ag ? '#A32D2D' : '#888780'
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    {r.riv && <Badge variant="rival" className="text-[10px]">derby</Badge>}
                    <span className="text-muted-foreground">MD{r.md}</span>
                    <span className="font-medium">{r.hn}</span>
                    <span className="font-semibold tabular-nums" style={{color: col}}>{r.hg}–{r.ag}</span>
                    <span className="font-medium">{r.an}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
