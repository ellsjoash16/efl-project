import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sorted, fmm, prz, moodLabel, seasonLabel } from '@/lib/gameLogic'
import { NFX } from '@/data'

function FormDot({ result }: { result: string }) {
  const color = result === 'W' ? 'bg-[#3B6D11]' : result === 'D' ? 'bg-[#888780]' : 'bg-[#A32D2D]'
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-white text-[9px] font-medium mr-0.5 ${color}`}>
      {result}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="text-[11px] uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function LeagueTable() {
  const { S, setS, scheduleSave } = useGame()
  const rows = sorted(S.teams)
  const totFans = S.teams.reduce((s, t) => s + t.fanbase, 0)
  const totRev = rows.reduce((s, t, i) => {
    const sp = t.sponsors.filter(x => x.active).reduce((a, x) => a + x.value, 0)
    const pos = i + 1
    return s + t.matchday_rev + (100e6 + (pos >= 7 ? (pos - 6) * 1.5e6 : -([7,8,9,10,11,12].reduce((a,x)=>a+(x-6)*1.5e6,0)/6))) + t.commercial_rev + sp + prz(pos)
  }, 0)
  const avgMood = Math.round(S.teams.reduce((s, t) => s + t.mood, 0) / 12)

  function nextSeason() {
    setS(prev => {
      const next = {
        ...prev,
        season: prev.season + 1,
        matchday: 0,
        cMDs: new Set<number>(),
        results: [],
        notices: [],
        mdFx: Array.from({length:22}, () => Array.from({length:NFX}, () => ({hi:0,ai:1,hg:'',ag:''}))),
        teams: prev.teams.map(t => ({
          ...t,
          p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[] as ('W'|'D'|'L')[],
          matchday_rev: 0,
          stadium_debt: 0,
          fanbase: Math.max(5000, Math.min(2e6, t.fanbase + Math.round((t.mood - 50) * 80))),
          mood: Math.max(45, Math.min(75, t.mood)),
          attp: Math.max(0.55, Math.min(0.96, t.attp)),
        })),
      }
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Matchday" value={`${S.matchday}/22`} />
        <StatCard label="Total fans" value={`${(totFans/1000).toFixed(0)}k`} />
        <StatCard label="League revenue" value={`£${(totRev/1e9).toFixed(2)}bn`} />
        <StatCard label="Avg mood" value={`${avgMood}%`} sub={avgMood >= 60 ? 'Positive' : 'Concerning'} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="text-center">P</TableHead>
                <TableHead className="text-center hidden sm:table-cell">W</TableHead>
                <TableHead className="text-center hidden sm:table-cell">D</TableHead>
                <TableHead className="text-center hidden sm:table-cell">L</TableHead>
                <TableHead className="text-center hidden sm:table-cell">GF</TableHead>
                <TableHead className="text-center hidden sm:table-cell">GA</TableHead>
                <TableHead className="text-center">GD</TableHead>
                <TableHead className="text-center font-semibold">Pts</TableHead>
                <TableHead className="hidden xs:table-cell">Form</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead className="hidden sm:table-cell">Prize</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t, i) => {
                const pos = i + 1
                const gd = t.gf - t.ga
                const [mlt, mc] = moodLabel(t.mood)
                const isRiv = S.rivalries.some(r => r.a === t.id || r.b === t.id)
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground font-medium">{pos}</TableCell>
                    <TableCell className="font-medium">
                      {t.name}
                      {isRiv && <Badge variant="rival" className="ml-1.5 text-[10px]">derby</Badge>}
                    </TableCell>
                    <TableCell className="text-center">{t.p}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{t.w}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{t.d}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{t.l}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{t.gf}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{t.ga}</TableCell>
                    <TableCell className="text-center font-medium">{gd >= 0 ? '+' : ''}{gd}</TableCell>
                    <TableCell className="text-center font-semibold">{t.pts}</TableCell>
                    <TableCell className="hidden xs:table-cell">
                      {t.form.length > 0
                        ? t.form.slice(-6).map((r, idx) => <FormDot key={idx} result={r} />)
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><Badge variant={mc}>{mlt}</Badge></TableCell>
                    <TableCell className="text-xs hidden sm:table-cell">{fmm(prz(pos))}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {S.matchday === 22 && (() => {
        const ch = rows[0]
        return (
          <Card className="overflow-hidden">
            <div className="p-8 text-white text-center" style={{background:'linear-gradient(135deg,#1a1a2e,#0f3460)'}}>
              <p className="text-[11px] uppercase tracking-widest opacity-70 mb-2">
                Season {seasonLabel(S.season)} complete
              </p>
              <p className="text-3xl font-semibold mb-1">🏆 {ch.name}</p>
              <p className="text-sm opacity-85 mb-5">Champions · {ch.pts} pts · {ch.gf} goals</p>
              <Separator className="bg-white/20 mb-5" />
              <div className="flex justify-center gap-6 flex-wrap mb-6 text-sm">
                {rows.slice(0, 3).map((t, i) => (
                  <span key={t.id}>{['🥇','🥈','🥉'][i]} {t.name} — {t.pts}pts</span>
                ))}
              </div>
              <Button
                className="bg-[#27500A] text-white border-[#27500A] hover:bg-[#1e3d07] h-10 px-8"
                onClick={nextSeason}
              >
                Start season {S.season + 1}/{(S.season + 2).toString().slice(2)} →
              </Button>
            </div>
          </Card>
        )
      })()}
    </div>
  )
}
