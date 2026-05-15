import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { TEAM_DEFS } from '@/data'

const RIVALRY_TYPES = ['Local Derby', 'Historical Rivals', 'Title Rivals', 'Promotion Battle']

export function Rivals() {
  const { S, setS, scheduleSave } = useGame()
  const [rivA, setRivA] = useState(0)
  const [rivB, setRivB] = useState(1)
  const [rivType, setRivType] = useState(RIVALRY_TYPES[0])
  const [rivInt, setRivInt] = useState(60)

  function updateIntensity(ri: number, val: number) {
    setS(prev => {
      const rivalries = prev.rivalries.map((r, i) => i === ri ? { ...r, intensity: Math.max(1, Math.min(100, val)) } : r)
      const next = { ...prev, rivalries }
      scheduleSave(next)
      return next
    })
  }

  function removeRivalry(ri: number) {
    setS(prev => {
      const rivalries = prev.rivalries.filter((_, i) => i !== ri)
      const next = { ...prev, rivalries }
      scheduleSave(next)
      return next
    })
  }

  function addRivalry() {
    if (rivA === rivB) { alert('Pick two different clubs'); return }
    const exists = S.rivalries.find(r => (r.a === rivA && r.b === rivB) || (r.b === rivA && r.a === rivB))
    if (exists) { alert('Already registered'); return }
    setS(prev => {
      const rivalries = [...prev.rivalries, { a: rivA, b: rivB, type: rivType, intensity: Math.max(1, Math.min(100, rivInt)), h2h: [0, 0, 0] as [number, number, number], last: null }]
      const next = { ...prev, rivalries }
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rivalries</CardTitle>
          <CardDescription>Edit intensity (1–100) inline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {S.rivalries.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No rivalries yet.</p>
          )}
          {S.rivalries.map((r, ri) => {
            const teamA = S.teams[r.a]?.name ?? '?'
            const teamB = S.teams[r.b]?.name ?? '?'
            const [aW, draws, bW] = r.h2h
            return (
              <div key={ri} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{teamA} <span className="text-muted-foreground font-normal">vs</span> {teamB}</p>
                    <Badge variant="rival" className="text-[10px] mt-1">{r.type}</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50 shrink-0" onClick={() => removeRivalry(ri)}>
                    Remove
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <span>Intensity</span>
                    <input
                      type="number" min={1} max={100}
                      className="w-14 h-7 rounded-md border border-input bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring ml-1"
                      value={r.intensity}
                      onChange={e => updateIntensity(ri, parseInt(e.target.value) || 1)}
                    />
                    <span>/100</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">H2H: </span>
                    <span className="font-medium text-foreground">{teamA}</span>
                    <span className="mx-1 font-semibold text-foreground">{aW}–{draws}–{bW}</span>
                    <span className="font-medium text-foreground">{teamB}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add rivalry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Club A</span>
            <Select value={String(rivA)} onValueChange={v => setRivA(parseInt(v))}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_DEFS.map((t, i) => <SelectItem key={i} value={String(i)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Club B</span>
            <Select value={String(rivB)} onValueChange={v => setRivB(parseInt(v))}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_DEFS.map((t, i) => <SelectItem key={i} value={String(i)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Type</span>
            <Select value={rivType} onValueChange={setRivType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RIVALRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Starting intensity</span>
            <Input type="number" min={1} max={100} value={rivInt} onChange={e => setRivInt(parseInt(e.target.value) || 60)} className="w-20" />
          </div>
          <Button variant="default" onClick={addRivalry}>Add rivalry</Button>
        </CardContent>
      </Card>
    </div>
  )
}
