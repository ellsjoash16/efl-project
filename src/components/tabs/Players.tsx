import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Player } from '@/types'
import playerDB from '@/playerDB.json'
import {
  loadDyn, saveDyn, patchPlayer, effectivePlayers,
  type PlayerDyn,
} from '@/lib/playerState'

const BASE_PLAYERS = playerDB as Player[]
const BASE_TEAMS   = Array.from(new Set(BASE_PLAYERS.map(p => p.team))).sort()
const TEAMS_FILTER = ['All', ...BASE_TEAMS]

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as const
const EDITABLE_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as const

type SortKey = 'name' | 'team' | 'pos' | 'age' | 'importance'

const POS_COLOR: Record<string, string> = {
  GK: '#b45309', CB: '#1d4ed8', LB: '#1d4ed8', RB: '#1d4ed8',
  CDM: '#15803d', CM: '#15803d', CAM: '#0e7490',
  LW: '#b91c1c', RW: '#b91c1c', ST: '#991b1b',
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-px leading-none">
      {[1,2,3,4,5].map(n => (
        <span
          key={n}
          className={onChange ? 'cursor-pointer' : ''}
          style={{ color: n <= value ? '#f59e0b' : '#d1d5db', fontSize: 14 }}
          onClick={() => onChange?.(n)}
          title={onChange ? `Set ${n} star${n > 1 ? 's' : ''}` : undefined}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function nextCustomId(dyn: PlayerDyn) {
  const ids = [...BASE_PLAYERS.map(p => p.id), ...dyn.custom.map(p => p.id)]
  return Math.max(...ids, 9999) + 1
}

const BLANK_FORM = { name: '', team: '', pos: 'CM' as Player['pos'], age: '', importance: '3', nat: '' }

export function Players() {
  const [dyn, setDyn]     = useState<PlayerDyn>(loadDyn)
  const [search, setSearch] = useState('')
  const [team, setTeam]   = useState('All')
  const [pos, setPos]     = useState<typeof POSITIONS[number]>('All')
  const [sort, setSort]   = useState<SortKey>('importance')
  const [asc, setAsc]     = useState(false)
  const [editing, setEditing] = useState<{ id: number; field: 'pos' | 'age' } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]   = useState(BLANK_FORM)

  const PLAYERS = useMemo(() => effectivePlayers(dyn), [dyn])

  const filtered = useMemo(() => {
    const q = search.toUpperCase()
    return PLAYERS
      .filter(p =>
        (team === 'All' || p.team === team) &&
        (pos  === 'All' || p.pos  === pos)  &&
        (q    === ''    || p.name.includes(q) || p.nat.toUpperCase().includes(q))
      )
      .sort((a, b) => {
        let d = 0
        if (sort === 'name') d = a.name.localeCompare(b.name)
        else if (sort === 'team') d = a.team.localeCompare(b.team)
        else if (sort === 'pos')  d = a.pos.localeCompare(b.pos)
        else if (sort === 'age')  d = a.age - b.age
        else d = a.importance - b.importance
        return asc ? d : -d
      })
  }, [PLAYERS, search, team, pos, sort, asc])

  function toggleSort(key: SortKey) {
    if (sort === key) setAsc(v => !v)
    else { setSort(key); setAsc(key === 'name' || key === 'team') }
  }

  // ── Inline editing ──────────────────────────────────────────────────────
  function startEdit(id: number, field: 'pos' | 'age', current: string) {
    setEditing({ id, field }); setEditVal(current)
  }

  function commitEdit(id: number, field: 'pos' | 'age') {
    const isCustom = dyn.custom.some(p => p.id === id)
    if (isCustom) {
      const updated = dyn.custom.map(p => {
        if (p.id !== id) return p
        if (field === 'age') { const n = parseInt(editVal); return n > 0 ? { ...p, age: n } : p }
        if (EDITABLE_POSITIONS.includes(editVal as Player['pos'])) return { ...p, pos: editVal as Player['pos'] }
        return p
      })
      const next = { ...dyn, custom: updated }
      saveDyn(next); setDyn(next)
    } else {
      let next = dyn
      if (field === 'age') { const n = parseInt(editVal); if (n > 0) next = patchPlayer(id, { age: n }, dyn) }
      else if (EDITABLE_POSITIONS.includes(editVal as Player['pos'])) next = patchPlayer(id, { pos: editVal as Player['pos'] }, dyn)
      setDyn(next)
    }
    setEditing(null)
  }

  // ── Importance edit ──────────────────────────────────────────────────────
  function setImportance(p: Player, value: number) {
    const isCustom = dyn.custom.some(c => c.id === p.id)
    if (isCustom) {
      const updated = dyn.custom.map(c => c.id === p.id ? { ...c, importance: value } : c)
      const next = { ...dyn, custom: updated }
      saveDyn(next); setDyn(next)
    } else {
      setDyn(patchPlayer(p.id, { importance: value }, dyn))
    }
  }

  // ── On-form toggle ──────────────────────────────────────────────────────
  function toggleForm(p: Player) {
    const cur = dyn.overrides[p.id]?.onForm ?? false
    setDyn(patchPlayer(p.id, { onForm: !cur }, dyn))
  }

  // ── Add player ──────────────────────────────────────────────────────────
  function addPlayer() {
    const name = form.name.trim().toUpperCase()
    const age  = parseInt(form.age)
    const importance = parseInt(form.importance)
    if (!name || !form.team.trim() || !age || !importance) return
    const p: Player = {
      id: nextCustomId(dyn),
      name, teamId: 0,
      team: form.team.trim(),
      pos: form.pos, age, importance,
      nat: form.nat.trim().toUpperCase() || '—',
    }
    const next = { ...dyn, custom: [...dyn.custom, p] }
    saveDyn(next); setDyn(next)
    setForm(BLANK_FORM); setShowAdd(false)
  }

  function deleteCustom(id: number) {
    const next = { ...dyn, custom: dyn.custom.filter(p => p.id !== id) }
    saveDyn(next); setDyn(next)
  }

  const editedCount  = Object.keys(dyn.overrides).length
  const retiredCount = dyn.retired.length

  const selectCls = 'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm'
  const thCls = 'text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 cursor-pointer select-none hover:text-foreground transition-colors'
  const inputCls = 'h-8 text-sm rounded border border-input bg-transparent px-2'

  function SortIcon({ k }: { k: SortKey }) {
    if (sort !== k) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1">{asc ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>
              Player Database
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {filtered.length} players
                {retiredCount > 0 && <> · {retiredCount} retired</>}
                {editedCount > 0 && (
                  <>
                    {' '}·{' '}
                    <button
                      className="text-xs text-destructive hover:underline"
                      onClick={() => { const n = { ...dyn, overrides: {} }; saveDyn(n); setDyn(n) }}
                    >
                      reset edits
                    </button>
                  </>
                )}
              </span>
            </CardTitle>
            <Button size="sm" onClick={() => setShowAdd(v => !v)}>
              {showAdd ? 'Cancel' : '+ Add Player'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add form */}
          {showAdd && (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Player</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input className="h-8 text-sm mt-0.5" placeholder="e.g. J. SMITH"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Team</label>
                  <input list="team-list" className={`${inputCls} w-full mt-0.5`} placeholder="Team name"
                    value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} />
                  <datalist id="team-list">
                    {BASE_TEAMS.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Position</label>
                  <select className={`${inputCls} w-full mt-0.5`} value={form.pos}
                    onChange={e => setForm(f => ({ ...f, pos: e.target.value as Player['pos'] }))}>
                    {EDITABLE_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Age</label>
                  <input type="number" className={`${inputCls} w-full mt-0.5`} placeholder="24"
                    value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Importance (1–5)</label>
                  <div className="mt-1">
                    <Stars
                      value={parseInt(form.importance) || 1}
                      onChange={n => setForm(f => ({ ...f, importance: String(n) }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nationality</label>
                  <Input className="h-8 text-sm mt-0.5" placeholder="ENG"
                    value={form.nat} onChange={e => setForm(f => ({ ...f, nat: e.target.value }))} />
                </div>
              </div>
              <Button size="sm" onClick={addPlayer}
                disabled={!form.name.trim() || !form.team.trim() || !form.age}>
                Add Player
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input className="text-sm h-9 w-48" placeholder="Search name / nationality…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className={selectCls} value={team} onChange={e => setTeam(e.target.value)}>
              {TEAMS_FILTER.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={selectCls} value={pos} onChange={e => setPos(e.target.value as typeof pos)}>
              {POSITIONS.map(p => <option key={p} value={p}>{p === 'All' ? 'All positions' : p}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4 px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={`${thCls} pl-4 w-8`}>#</th>
                  <th className={`${thCls} pl-2`} onClick={() => toggleSort('name')}>Name <SortIcon k="name" /></th>
                  <th className={`${thCls} hidden sm:table-cell`} onClick={() => toggleSort('team')}>Team <SortIcon k="team" /></th>
                  <th className={thCls} onClick={() => toggleSort('pos')}>Pos <SortIcon k="pos" /></th>
                  <th className={thCls} onClick={() => toggleSort('age')}>Age <SortIcon k="age" /></th>
                  <th className={thCls} onClick={() => toggleSort('importance')}>Importance <SortIcon k="importance" /></th>
                  <th className={`${thCls} hidden sm:table-cell`}>Nat</th>
                  <th className={`${thCls} pr-4`} title="On form">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p, i) => {
                  const isEditPos = editing?.id === p.id && editing.field === 'pos'
                  const isEditAge = editing?.id === p.id && editing.field === 'age'
                  const isCustom  = dyn.custom.some(c => c.id === p.id)
                  const isAcademy = isCustom && p.age <= 19
                  const onForm    = dyn.overrides[p.id]?.onForm ?? false
                  const hasEdit   = !isCustom && !!dyn.overrides[p.id]

                  return (
                    <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                      <td className="pl-4 py-2 text-xs text-muted-foreground w-8">{i + 1}</td>

                      {/* Name */}
                      <td className="pl-2 py-2 font-medium">
                        {p.name}
                        {hasEdit   && <span className="ml-1 text-[10px] text-muted-foreground">✎</span>}
                        {isAcademy && <span className="ml-1 text-[10px] font-semibold text-emerald-600">acad</span>}
                        {isCustom && !isAcademy && <span className="ml-1 text-[10px] text-blue-500">new</span>}
                      </td>

                      {/* Team */}
                      <td className="py-2 text-muted-foreground text-xs hidden sm:table-cell">{p.team}</td>

                      {/* Position — click to edit */}
                      <td className="py-2">
                        {isEditPos ? (
                          <select autoFocus className="text-xs font-bold px-1.5 py-0.5 rounded border"
                            value={editVal} onChange={e => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(p.id, 'pos')}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(p.id, 'pos'); if (e.key === 'Escape') setEditing(null) }}>
                            {EDITABLE_POSITIONS.map(pp => <option key={pp} value={pp}>{pp}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer hover:opacity-70"
                            style={{ color: POS_COLOR[p.pos], background: POS_COLOR[p.pos] + '18' }}
                            onClick={() => startEdit(p.id, 'pos', p.pos)} title="Click to edit">
                            {p.pos}
                          </span>
                        )}
                      </td>

                      {/* Age — click to edit */}
                      <td className="py-2 text-muted-foreground">
                        {isEditAge ? (
                          <input autoFocus type="number" className="w-14 text-sm border rounded px-1"
                            value={editVal} onChange={e => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(p.id, 'age')}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(p.id, 'age'); if (e.key === 'Escape') setEditing(null) }} />
                        ) : (
                          <span className="cursor-pointer hover:text-foreground hover:underline"
                            onClick={() => startEdit(p.id, 'age', String(p.age))} title="Click to edit">
                            {p.age}
                          </span>
                        )}
                      </td>

                      {/* Importance — click stars to edit */}
                      <td className="py-2">
                        <Stars value={p.importance} onChange={n => setImportance(p, n)} />
                      </td>

                      {/* Nationality */}
                      <td className="py-2 text-muted-foreground text-xs hidden sm:table-cell">{p.nat}</td>

                      {/* On-form checkbox + delete */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={onForm}
                            onChange={() => toggleForm(p)}
                            className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                            title="On form"
                          />
                          {isCustom && (
                            <button className="text-xs text-destructive opacity-40 hover:opacity-100"
                              onClick={() => deleteCustom(p.id)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No players found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
