import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { moodLabel, posOf } from '@/lib/gameLogic'
import { TEAM_DEFS } from '@/data'

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="text-[11px] uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

const noticeVariant: Record<string, 'warn' | 'good' | 'bad' | 'info'> = {
  warn: 'warn', good: 'good', bad: 'bad', info: 'info',
}

export function Fans() {
  const { S } = useGame()
  const [teamIdx, setTeamIdx] = useState(0)
  const t = S.teams[teamIdx]
  const pos = posOf(S.teams, teamIdx)
  const [mlt, mc] = moodLabel(t.mood)
  const riv = S.rivalries.find(r => r.a === teamIdx || r.b === teamIdx)
  const rival = riv ? S.teams[riv.a === teamIdx ? riv.b : riv.a] : null
  const notices = S.notices.filter(n => n.tid === teamIdx)

  const posEffect = Math.max(10, Math.min(95, 100 - (pos - 1) * 7))
  const formBonus = Math.max(0, t.form.slice(-5).reduce((s, f) => s + (f === 'W' ? 3 : f === 'D' ? 0 : -3), 0))

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Fan base" value={t.fanbase.toLocaleString()} />
        <StatCard label="Fan mood" value={`${t.mood}%`} sub={<Badge variant={mc}>{mlt}</Badge>} />
        <StatCard label="Position" value={ordinal(pos)} />
        <StatCard
          label="Avg attendance"
          value={`${Math.round(t.attp * 100)}%`}
          sub={`${Math.round(t.capacity * t.attp).toLocaleString()} / game`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mood breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            ['Position effect', posEffect, 'bg-[#185FA5]'],
            ['Recent form bonus', formBonus, 'bg-[#3B6D11]'],
            ['Overall mood', t.mood, 'bg-[#533AB7]'],
          ] as [string, number, string][]).map(([label, val, cls]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{val}%</span>
              </div>
              <Progress value={val} className="h-2 bg-primary/10" indicatorClassName={cls} />
            </div>
          ))}

          {notices.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Fan reactions</p>
                <div className="space-y-2">
                  {notices.map((n, i) => (
                    <Alert key={i} variant={noticeVariant[n.type]}>
                      <AlertDescription>{n.msg}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {riv && rival && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Derby effect</CardTitle>
            <CardDescription>vs {rival.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={riv.intensity} className="h-2 bg-[#FAECE7]" indicatorClassName="bg-[#993C1D]" />
            <p className="text-xs text-muted-foreground mt-2">
              Intensity: {riv.intensity}% · H2H: {riv.h2h[0]}W {riv.h2h[1]}D {riv.h2h[2]}L
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
