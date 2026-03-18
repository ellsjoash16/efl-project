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
        <CardContent>
          <div className="grid grid-cols-[1fr_1fr_110px_90px_90px_80px] gap-2 pb-2 mb-1 border-b text-[11px] text-muted-foreground">
            <span>Club A</span><span>Club B</span><span>Type</span><span>Intensity</span><span>H2H</span><span></span>
          </div>
          {S.rivalries.length === 0 && (
            <p className="text-xs text-muted-foreground py-4">No rivalries yet.</p>
          )}
          {S.rivalries.map((r, ri) => (
            <div key={ri} className="grid grid-cols-[1fr_1fr_110px_90px_90px_80px] gap-2 items-center py-2 border-b last:border-0">
              <span className="font-medium text-sm">{S.teams[r.a]?.name}</span>
              <span className="font-medium text-sm">{S.teams[r.b]?.name}</span>
              <span><Badge variant="rival" className="text-[10px]">{r.type}</Badge></span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} max={100}
                  className="w-14 h-7 rounded-md border border-input bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  value={r.intensity}
                  onChange={e => updateIntensity(ri, parseInt(e.target.value) || 1)}
                />
                <span className="text-[11px] text-muted-foreground">/100</span>
              </div>
              <span className="text-xs">{r.h2h[0]}W–{r.h2h[1]}D–{r.h2h[2]}L</span>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => removeRivalry(ri)}>
                Remove
              </Button>
            </div>
          ))}
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
