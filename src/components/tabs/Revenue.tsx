import { useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sorted, tvn, prz, fmm, fms, teamRevenue } from '@/lib/gameLogic'
import { SOL } from '@/data'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="text-[11px] uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SegmentedControl({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
          style={value === o.id
            ? { background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)', color: '#fff' }
            : { color: 'var(--muted-foreground)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Revenue() {
  const { S, setS, scheduleSave } = useGame()
  const [view, setView] = useState<'revenue' | 'budgets'>('revenue')
  const rows = sorted(S.teams)
  const totSol = [7,8,9,10,11,12].reduce((s, p) => s + (p - 6) * SOL, 0)
  const totAll = rows.reduce((s, t, i) => s + teamRevenue(t, i + 1), 0)
  const totT = S.teams.reduce((s, t) => s + (t.transfer_budget ?? 0), 0)

  function updateTransfer(id: number, val: number) {
    setS(prev => {
      const teams = prev.teams.map(t => t.id === id ? { ...t, transfer_budget: val * 1e6 } : t)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function updateTransfersIn(id: number, val: number) {
    setS(prev => {
      const teams = prev.teams.map(t => t.id === id ? { ...t, transfers_in: val * 1e6 } : t)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  function updateTransfersOut(id: number, val: number) {
    setS(prev => {
      const teams = prev.teams.map(t => t.id === id ? { ...t, transfers_out: val * 1e6 } : t)
      const next = { ...prev, teams }
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="TV base / club" value="£100m" sub="Solidarity pot shared below 6th" />
        <StatCard label="Solidarity pot" value={fms(totSol)} sub="Split among 7th–12th" />
        <StatCard label="League total" value={`£${(totAll/1e9).toFixed(2)}bn`} sub="All clubs combined" />
        <StatCard label="Total transfer pots" value={fms(totT)} sub="Across all clubs" />
      </div>

      {/* Section toggle */}
      <div className="flex items-center justify-between gap-4">
        <SegmentedControl
          value={view}
          onChange={v => setView(v as 'revenue' | 'budgets')}
          options={[
            { id: 'revenue', label: 'Revenue' },
            { id: 'budgets', label: 'Budgets' },
          ]}
        />
        {view === 'revenue' && (
          <p className="text-xs text-muted-foreground hidden sm:block">
            Read-only · what each club earns this season
          </p>
        )}
        {view === 'budgets' && (
          <p className="text-xs text-muted-foreground hidden sm:block">
            Editable · set each club's transfer budget and activity
          </p>
        )}
      </div>

      {view === 'revenue' && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Season revenue by club</CardTitle>
            <CardDescription>Breakdown of each income stream. Prize money applies to top 6 only.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Club</TableHead>
                  <TableHead className="text-center w-10">Pos</TableHead>
                  <TableHead className="text-right">TV</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Matchday</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Commercial</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Sponsors</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Prize</TableHead>
                  <TableHead className="text-right font-semibold pr-4">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t, i) => {
                  const pos = i + 1
                  const tv = tvn(pos)
                  const pm = prz(pos)
                  const sp = t.sponsors.filter(s => s.active).reduce((x, s) => x + s.value, 0)
                  const tot = teamRevenue(t, pos)
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium pl-4">{t.name}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{pos}</TableCell>
                      <TableCell className="text-right">
                        <span className={pos > 6 ? 'text-[#A32D2D]' : ''}>{fmm(tv)}</span>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">{fmm(t.matchday_rev)}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{fmm(t.commercial_rev)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {sp > 0 ? fmm(sp) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {pm > 0
                          ? <span className="text-[#3B6D11] font-medium">{fmm(pm)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold pr-4">{fmm(tot)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><span className="text-[#A32D2D] font-medium">Red TV</span> = solidarity deduction (7th–12th)</span>
              <span><span className="text-[#3B6D11] font-medium">Green prize</span> = top-6 bonus (£2m base + £2.5m/place)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'budgets' && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Transfer budgets</CardTitle>
            <CardDescription>
              Set each club's budget, spending, and sales. Net pot = budget − spent + received.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Club</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Season revenue</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    <span className="text-[#A32D2D]">Debt</span>
                  </TableHead>
                  <TableHead className="text-right">
                    Budget <span className="font-normal text-muted-foreground text-[10px]">(£m)</span>
                  </TableHead>
                  <TableHead className="text-right">
                    Spent <span className="font-normal text-muted-foreground text-[10px]">(£m)</span>
                  </TableHead>
                  <TableHead className="text-right">
                    Received <span className="font-normal text-muted-foreground text-[10px]">(£m)</span>
                  </TableHead>
                  <TableHead className="text-right font-semibold pr-4">Net pot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t, i) => {
                  const pos = i + 1
                  const tot = teamRevenue(t, pos)
                  const budget = t.transfer_budget ?? 0
                  const spent = t.transfers_in ?? 0
                  const received = t.transfers_out ?? 0
                  const net = budget - spent + received
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium pl-4">{t.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground hidden sm:table-cell">{fmm(tot)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {t.stadium_debt > 0
                          ? <span className="text-[#A32D2D]">{fmm(t.stadium_debt)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <input
                          type="number" min={0} step={0.5}
                          className="w-20 text-right border border-input rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          value={+(budget/1e6).toFixed(1)}
                          onChange={e => updateTransfer(t.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <input
                          type="number" min={0} step={0.5}
                          className="w-20 text-right border border-input rounded-md px-2 py-1 text-xs bg-background text-[#A32D2D] focus:outline-none focus:ring-1 focus:ring-ring"
                          value={+(spent/1e6).toFixed(1)}
                          onChange={e => updateTransfersIn(t.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <input
                          type="number" min={0} step={0.5}
                          className="w-20 text-right border border-input rounded-md px-2 py-1 text-xs bg-background text-[#3B6D11] focus:outline-none focus:ring-1 focus:ring-ring"
                          value={+(received/1e6).toFixed(1)}
                          onChange={e => updateTransfersOut(t.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className={`text-right font-semibold pr-4 ${net >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>
                        {fmm(net)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><span className="font-medium">Budget</span> = club's transfer allowance this window</span>
              <span><span className="text-[#A32D2D] font-medium">Spent</span> = transfers in</span>
              <span><span className="text-[#3B6D11] font-medium">Received</span> = transfers out</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
