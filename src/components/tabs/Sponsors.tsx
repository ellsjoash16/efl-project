import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmm } from '@/lib/gameLogic'
import { TEAM_DEFS } from '@/data'

const SLOTS = ['Shirt Front', 'Sleeve', 'Training Kit', 'Stadium Name', 'Match Ball', 'Digital / Social']

export function Sponsors() {
  const { S, setS, scheduleSave } = useGame()
  const [teamIdx, setTeamIdx] = useState(0)
  const [newSlot, setNewSlot] = useState(SLOTS[0])
  const [newName, setNewName] = useState('')
  const [newVal, setNewVal] = useState(2000000)

  const t = S.teams[teamIdx]
  const active = t.sponsors.filter(s => s.active).reduce((x, s) => x + s.value, 0)

  function updateSponsorName(si: number, name: string) {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? {
        ...tm, sponsors: tm.sponsors.map((s, j) => j === si ? { ...s, name } : s)
      } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function updateSponsorValue(si: number, value: number) {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? {
        ...tm, sponsors: tm.sponsors.map((s, j) => j === si ? { ...s, value } : s)
      } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function toggleSponsor(si: number) {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? {
        ...tm, sponsors: tm.sponsors.map((s, j) => j === si ? { ...s, active: !s.active } : s)
      } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function removeSponsor(si: number) {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? {
        ...tm, sponsors: tm.sponsors.filter((_, j) => j !== si)
      } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function addSponsor() {
    setS(prev => {
      const teams = prev.teams.map((tm, i) => i === teamIdx ? {
        ...tm, sponsors: [...tm.sponsors, { slot: newSlot, name: newName || 'New Sponsor', value: newVal, active: true }]
      } : tm)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
    setNewName('')
    setNewVal(2000000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground w-24">Club</span>
        <Select value={String(teamIdx)} onValueChange={v => setTeamIdx(parseInt(v))}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEAM_DEFS.map((td, i) => <SelectItem key={i} value={String(i)}>{td.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-[11px] uppercase tracking-wide">Active value</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{fmm(active)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">per season</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-[11px] uppercase tracking-wide">Deals</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{t.sponsors.filter(s => s.active).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">active of {t.sponsors.length} total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current deals</CardTitle>
          <CardDescription>Edit name and value inline. Pause/resume or remove permanently.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {t.sponsors.map((s, si) => (
            <div key={`${teamIdx}-${si}`} className="flex items-center gap-2.5 py-3 border-b last:border-0 flex-wrap">
              <Badge variant="neutral" className="text-[10px] flex-shrink-0">{s.slot}</Badge>
              <input
                className="flex-1 min-w-[120px] h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={s.name}
                onChange={e => updateSponsorName(si, e.target.value)}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-sm">£</span>
                <input
                  type="number" min={0}
                  className="w-24 h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={s.value}
                  onChange={e => updateSponsorValue(si, parseInt(e.target.value) || 0)}
                />
              </div>
              <Badge variant={s.active ? 'green' : 'red'} className="flex-shrink-0">{s.active ? 'Active' : 'Paused'}</Badge>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleSponsor(si)}>
                {s.active ? 'Pause' : 'Resume'}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => removeSponsor(si)}>
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add new deal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground min-w-[110px]">Slot</span>
            <Select value={newSlot} onValueChange={setNewSlot}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground min-w-[110px]">Sponsor name</span>
            <Input placeholder="e.g. MegaBank" value={newName} onChange={e => setNewName(e.target.value)} className="w-48" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground min-w-[110px]">Season value £</span>
            <Input type="number" value={newVal} onChange={e => setNewVal(parseInt(e.target.value) || 0)} className="w-36" />
          </div>
          <Button variant="default" onClick={addSponsor}>Add deal</Button>
        </CardContent>
      </Card>
    </div>
  )
}
