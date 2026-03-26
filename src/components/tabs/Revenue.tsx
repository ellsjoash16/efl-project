import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sorted, tva, tvn, prz, fmm, fms, teamRevenue } from '@/lib/gameLogic'
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

export function Revenue() {
  const { S, setS, scheduleSave } = useGame()
  const rows = sorted(S.teams)
  const totSol = [7,8,9,10,11,12].reduce((s, p) => s + (p - 6) * SOL, 0)
  const ded = totSol / 6
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="TV base/club" value="£100m" />
        <StatCard label="Solidarity pot" value={fms(totSol)} />
        <StatCard label="Top 6 deduction" value={fms(ded)} sub="each" />
        <StatCard label="League total" value={`£${(totAll/1e9).toFixed(2)}bn`} />
        <StatCard label="Transfer pots" value={fms(totT)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Revenue &amp; budgets</CardTitle>
          <CardDescription>Edit transfer budget and transfers inline — balance updates instantly.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Pos</TableHead>
                <TableHead className="hidden md:table-cell">Matchday</TableHead>
                <TableHead className="hidden lg:table-cell">TV base</TableHead>
                <TableHead className="hidden lg:table-cell">TV adj</TableHead>
                <TableHead className="hidden sm:table-cell">TV net</TableHead>
                <TableHead className="hidden md:table-cell">Commercial</TableHead>
                <TableHead className="hidden md:table-cell">Sponsorship</TableHead>
                <TableHead className="hidden sm:table-cell">Prize</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden sm:table-cell">Debt</TableHead>
                <TableHead className="border-l">Budget</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Bal.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t, i) => {
                const pos = i + 1
                const adj = tva(pos)
                const net = tvn(pos)
                const pm = prz(pos)
                const sp = t.sponsors.filter(s => s.active).reduce((x, s) => x + s.value, 0)
                const tot = teamRevenue(t, pos)
                const bal = tot - t.stadium_debt - (t.transfer_budget ?? 0) - (t.transfers_in ?? 0) + (t.transfers_out ?? 0)
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{pos}</TableCell>
                    <TableCell className="hidden md:table-cell">{fmm(t.matchday_rev)}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">£100.00m</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className={adj >= 0 ? 'text-[#3B6D11] font-medium' : 'text-[#A32D2D] font-medium'}>
                        {adj >= 0 ? '+' : ''}{fms(adj)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium hidden sm:table-cell">{fmm(net)}</TableCell>
                    <TableCell className="hidden md:table-cell">{fmm(t.commercial_rev)}</TableCell>
                    <TableCell className="hidden md:table-cell">{fmm(sp)}</TableCell>
                    <TableCell className={`hidden sm:table-cell ${pos <= 6 ? 'text-[#3B6D11] font-medium' : 'font-medium'}`}>{fmm(pm)}</TableCell>
                    <TableCell className="font-medium">{fmm(tot)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {t.stadium_debt > 0
                        ? <span className="text-[#A32D2D]">{fmm(t.stadium_debt)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="border-l">
                      <input
                        type="number" min={0} step={0.5}
                        className="w-16 text-right border border-input rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={+((t.transfer_budget ?? 0)/1e6).toFixed(1)}
                        onChange={e => updateTransfer(t.id, parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number" min={0} step={0.5}
                        className="w-16 text-right border border-input rounded-md px-2 py-1 text-xs bg-background text-[#A32D2D] focus:outline-none focus:ring-1 focus:ring-ring"
                        value={+((t.transfers_in ?? 0)/1e6).toFixed(1)}
                        onChange={e => updateTransfersIn(t.id, parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number" min={0} step={0.5}
                        className="w-16 text-right border border-input rounded-md px-2 py-1 text-xs bg-background text-[#3B6D11] focus:outline-none focus:ring-1 focus:ring-ring"
                        value={+((t.transfers_out ?? 0)/1e6).toFixed(1)}
                        onChange={e => updateTransfersOut(t.id, parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className={`font-medium ${bal >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>
                      {fmm(bal)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground p-4 border-t">
            TV: £100m base, −£2m per place below 6th (7th = −£2m, 12th = −£12m). Prize: £2m base + £2.5m per place in top 6. Balance = total − debt − budget − trans. in + trans. out.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
