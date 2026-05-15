import { useState, useMemo } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  loadDyn, effectivePlayers, generateContractsForPlayers, setContract, releaseContract, randomWage,
  type PlayerDyn, type Contract,
} from '@/lib/playerState'
import type { Player } from '@/types'

// ── Received offers ────────────────────────────────────────────────────────

const OFFERS_KEY = 'efl-received-offers-v1'

type ReceivedOffer = {
  id: string
  playerId: number
  playerName: string
  fromClub: string
  fee: number        // £M
  teamId: number     // which user team received this
  reason: string     // why this club wants this player
}

type OfferStatus = 'pending' | 'negotiating'

type OffersState = {
  offers: ReceivedOffer[]
  status: Record<string, OfferStatus>
  counters: Record<string, string>
}


function loadOffers(): OffersState {
  try {
    const raw = localStorage.getItem(OFFERS_KEY)
    if (!raw) return { offers: [], status: {}, counters: {} }
    return { offers: [], status: {}, counters: {}, ...JSON.parse(raw) }
  } catch { return { offers: [], status: {}, counters: {} } }
}

function saveOffers(o: OffersState) {
  localStorage.setItem(OFFERS_KEY, JSON.stringify(o))
}

function feeLabel(fee: number) {
  return `£${fee.toFixed(1)}M`
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-px">
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= value ? '#f59e0b' : '#d1d5db', fontSize: 13 }}>★</span>
      ))}
    </span>
  )
}

function fmt(n: number) {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `£${Math.round(n)}`
}

function StatusBadge({ yearsLeft }: { yearsLeft: number }) {
  if (yearsLeft === 0) return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Expired</span>
  )
  if (yearsLeft === 1) return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Expiring</span>
  )
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{yearsLeft}y</span>
  )
}

type ResignState = { wage: string; years: string }

export function Contracts() {
  const { S, setS, scheduleSave } = useGame()
  const [dyn, setDyn] = useState<PlayerDyn>(loadDyn)
  const [resigning, setResigning] = useState<Record<number, ResignState>>({})
  const [budgetInput, setBudgetInput] = useState('')
  const [editingBudgetFor, setEditingBudgetFor] = useState<number | null>(null)
  const [offersState, setOffersState] = useState<OffersState>(loadOffers)

  const userTeamIds: number[] = S.userTeamIds ?? []
  const userTeams = S.teams.filter(t => userTeamIds.includes(t.id))

  // Which team's contracts are currently shown
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const activeTeam = activeTeamId != null
    ? S.teams.find(t => t.id === activeTeamId) ?? userTeams[0] ?? null
    : userTeams[0] ?? null

  // ── Toggle team management ────────────────────────────────────────────────
  function toggleTeam(id: number) {
    const isManaged = userTeamIds.includes(id)
    let next: number[]
    if (isManaged) {
      next = userTeamIds.filter(x => x !== id)
    } else {
      // Generate contracts for this team when adding
      const team = S.teams.find(t => t.id === id)
      if (team) {
        const players = effectivePlayers(dyn).filter(p =>
          p.team === team.name
        )
        const updated = generateContractsForPlayers(players, dyn)
        setDyn(updated)
      }
      next = [...userTeamIds, id]
      setActiveTeamId(id)
    }
    setS(prev => {
      const n = { ...prev, userTeamIds: next }
      scheduleSave(n)
      return n
    })
  }

  // ── Players for active team ───────────────────────────────────────────────
  const teamPlayers = useMemo(() => {
    if (!activeTeam) return []
    return effectivePlayers(dyn)
      .filter(p => p.team === activeTeam.name)
      .sort((a, b) => {
        const ca = dyn.contracts[a.id]
        const cb = dyn.contracts[b.id]
        const statusA = !ca ? -1 : ca.yearsLeft
        const statusB = !cb ? -1 : cb.yearsLeft
        if (statusA !== statusB) return statusA - statusB
        return b.importance - a.importance
      })
  }, [dyn, activeTeam])

  // ── Wage bill ─────────────────────────────────────────────────────────────
  const weeklyWages = useMemo(() =>
    teamPlayers.reduce((sum, p) => sum + (dyn.contracts[p.id]?.wage ?? 0), 0),
    [teamPlayers, dyn]
  )
  const wageBudget = activeTeam?.wageBudget ?? 400000
  const overBudget = weeklyWages > wageBudget
  const pct = Math.min(100, Math.round((weeklyWages / wageBudget) * 100))

  // ── Wage budget adjustment ────────────────────────────────────────────────
  function openBudgetEdit(teamId: number, current: number) {
    setBudgetInput(String(Math.round(current / 1000)))
    setEditingBudgetFor(teamId)
  }

  function commitBudgetEdit() {
    if (editingBudgetFor == null) return
    const newWeekly = parseInt(budgetInput) * 1000
    if (!newWeekly || newWeekly < 0) { setEditingBudgetFor(null); return }
    const team = S.teams.find(t => t.id === editingBudgetFor)
    if (!team) return
    const diff = newWeekly - (team.wageBudget ?? 400000)
    setS(prev => {
      const n = {
        ...prev,
        teams: prev.teams.map(t => t.id === editingBudgetFor ? {
          ...t,
          wageBudget: newWeekly,
          transfer_budget: (t.transfer_budget ?? 0) - diff * 52,
        } : t),
      }
      scheduleSave(n)
      return n
    })
    setEditingBudgetFor(null)
  }

  // ── Re-sign ───────────────────────────────────────────────────────────────
  function openResign(p: Player, c: Contract | undefined) {
    const suggested = c
      ? Math.round(c.wage * (c.yearsLeft <= 1 ? 1.15 : 1))
      : randomWage(p.importance)
    setResigning(r => ({ ...r, [p.id]: { wage: String(suggested), years: '3' } }))
  }

  function confirmResign(id: number) {
    const r = resigning[id]
    if (!r) return
    const wage = parseInt(r.wage)
    const years = parseInt(r.years)
    if (!wage || !years) return
    setDyn(setContract(id, wage, years, dyn))
    setResigning(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function handleRelease(id: number) {
    if (!confirm('Release this player?')) return
    setDyn(releaseContract(id, dyn))
  }

  function offerContract(p: Player) {
    setDyn(setContract(p.id, randomWage(p.importance), 3, dyn))
  }

  function generateAllMissing() {
    const missing = teamPlayers.filter(p => !dyn.contracts[p.id])
    if (missing.length === 0) return
    setDyn(generateContractsForPlayers(missing, dyn))
  }

  const noContract  = teamPlayers.filter(p => !dyn.contracts[p.id])
  const withContract = teamPlayers.filter(p => !!dyn.contracts[p.id])

  // ── Received offer handlers ───────────────────────────────────────────────
  function rejectOffer(id: string) {
    const next: OffersState = {
      offers: offersState.offers.filter(o => o.id !== id),
      status: { ...offersState.status },
      counters: { ...offersState.counters },
    }
    delete next.status[id]
    delete next.counters[id]
    saveOffers(next)
    setOffersState(next)
  }

  function startNegotiate(id: string, currentFee: number) {
    const next: OffersState = {
      ...offersState,
      status: { ...offersState.status, [id]: 'negotiating' },
      counters: { ...offersState.counters, [id]: String(currentFee) },
    }
    saveOffers(next)
    setOffersState(next)
  }

  function cancelNegotiate(id: string) {
    const next: OffersState = {
      ...offersState,
      status: { ...offersState.status, [id]: 'pending' },
    }
    saveOffers(next)
    setOffersState(next)
  }

  function acceptOffer(offer: ReceivedOffer, fee: number) {
    if (!confirm(`Accept ${feeLabel(fee)} from ${offer.fromClub} for ${offer.playerName}?`)) return
    // Remove contract
    setDyn(releaseContract(offer.playerId, dyn))
    // Log transfer
    setS(prev => {
      const n = {
        ...prev,
        transferLog: [
          ...(prev.transferLog ?? []),
          {
            player: offer.playerName,
            sellerName: activeTeam?.name ?? '',
            sellerId: activeTeam?.id,
            buyerName: offer.fromClub,
            fee,
          },
        ],
      }
      scheduleSave(n)
      return n
    })
    rejectOffer(offer.id)
  }

  const teamOffers = offersState.offers.filter(o => activeTeam && o.teamId === activeTeam.id)

  return (
    <div className="space-y-4">
      {/* Team management setup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Human-managed clubs</CardTitle>
          <CardDescription>Tick the clubs you manage — AI controls the rest.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {S.teams.map(t => {
              const managed = userTeamIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeam(t.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={managed
                    ? { background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)', color: '#fff', borderColor: '#2E4A52' }
                    : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                  }
                >
                  {managed ? '✓ ' : ''}{t.name}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* No teams selected */}
      {userTeams.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">Select at least one club above to manage contracts.</p>
      )}

      {/* Team tabs + contracts panel */}
      {userTeams.length > 0 && (
        <>
          {/* Tab strip */}
          {userTeams.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {userTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTeamId(t.id)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all border"
                  style={activeTeam?.id === t.id
                    ? { background: '#9B6BB5', color: '#fff', borderColor: '#9B6BB5' }
                    : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {activeTeam && (
            <>
              {/* Budget card */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Wage budget</p>
                      {editingBudgetFor === activeTeam.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">£</span>
                          <Input
                            autoFocus type="number" className="h-7 w-20 text-xs"
                            value={budgetInput}
                            onChange={e => setBudgetInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitBudgetEdit(); if (e.key === 'Escape') setEditingBudgetFor(null) }}
                          />
                          <span className="text-xs text-muted-foreground">k/wk</span>
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={commitBudgetEdit}>✓</Button>
                          <button className="text-xs text-muted-foreground" onClick={() => setEditingBudgetFor(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="text-sm font-semibold hover:underline" onClick={() => openBudgetEdit(activeTeam.id, wageBudget)}>
                          {fmt(wageBudget)}/wk <span className="text-[10px] font-normal text-muted-foreground">edit</span>
                        </button>
                      )}
                      <p className="text-[11px] text-muted-foreground">Adjusting moves money to/from transfer budget (×52)</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Transfer budget</p>
                      <p className={`text-sm font-semibold ${(activeTeam.transfer_budget ?? 0) < 0 ? 'text-red-600' : ''}`}>
                        {(activeTeam.transfer_budget ?? 0) < 0 ? '-' : ''}{fmt(Math.abs(activeTeam.transfer_budget ?? 0))}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={overBudget ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                        {fmt(weeklyWages)}/wk used
                      </span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct >= 100 ? '#dc2626' : pct >= 85 ? '#f59e0b' : '#15803d' }} />
                    </div>
                    {overBudget && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        ⚠ Over by {fmt(weeklyWages - wageBudget)}/wk — excess deducted from transfer budget at season end
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Contract table */}
              <Card>
                <CardContent className="pt-4 px-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 pl-4">Player</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">Pos</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">★</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">Wage/wk</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">Status</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {withContract.map(p => {
                          const c = dyn.contracts[p.id]!
                          const r = resigning[p.id]
                          return (
                            <tr key={p.id} className={`hover:bg-muted/40 transition-colors ${c.yearsLeft === 0 ? 'opacity-60' : ''}`}>
                              <td className="pl-4 py-2 font-medium">{p.name}</td>
                              <td className="py-2 text-xs text-muted-foreground">{p.pos}</td>
                              <td className="py-2"><Stars value={p.importance} /></td>
                              <td className="py-2 font-mono text-xs">{fmt(c.wage)}</td>
                              <td className="py-2"><StatusBadge yearsLeft={c.yearsLeft} /></td>
                              <td className="py-2 pr-4">
                                {r ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Input type="number" className="h-7 w-24 text-xs"
                                      value={r.wage}
                                      onChange={e => setResigning(prev => ({ ...prev, [p.id]: { ...prev[p.id], wage: e.target.value } }))}
                                    />
                                    <select className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                                      value={r.years}
                                      onChange={e => setResigning(prev => ({ ...prev, [p.id]: { ...prev[p.id], years: e.target.value } }))}>
                                      {[1,2,3,4].map(y => <option key={y} value={y}>{y}yr</option>)}
                                    </select>
                                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => confirmResign(p.id)}>✓</Button>
                                    <button className="text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => setResigning(prev => { const n = { ...prev }; delete n[p.id]; return n })}>✕</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button className="text-xs text-blue-600 hover:underline" onClick={() => openResign(p, c)}>Re-sign</button>
                                    <button className="text-xs text-red-500 hover:underline opacity-50 hover:opacity-100" onClick={() => handleRelease(p.id)}>Release</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}

                        {noContract.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={6} className="pl-4 pr-4 py-2 bg-muted/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Without contract</span>
                                  <button className="text-xs text-blue-600 hover:underline" onClick={generateAllMissing}>Generate all</button>
                                </div>
                              </td>
                            </tr>
                            {noContract.map(p => (
                              <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                                <td className="pl-4 py-2 font-medium">{p.name}</td>
                                <td className="py-2 text-xs text-muted-foreground">{p.pos}</td>
                                <td className="py-2"><Stars value={p.importance} /></td>
                                <td className="py-2 text-xs text-muted-foreground">—</td>
                                <td className="py-2">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Free</span>
                                </td>
                                <td className="py-2 pr-4">
                                  <button className="text-xs text-blue-600 hover:underline" onClick={() => offerContract(p)}>Offer contract</button>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}

                        {teamPlayers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No players found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {/* Received offers */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Received Offers</CardTitle>
                  <CardDescription>Incoming transfer bids for your players</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {teamOffers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">No incoming offers. Clubs will make bids at the start of pre-season.</p>
                  ) : (
                    <div className="space-y-3">
                      {teamOffers.map(offer => {
                        const st = offersState.status[offer.id] ?? 'pending'
                        const counter = offersState.counters[offer.id] ?? String(offer.fee)
                        const isNeg = st === 'negotiating'
                        return (
                          <div key={offer.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{offer.playerName}</p>
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium" style={{ color: '#9B6BB5' }}>{offer.fromClub}</span>
                                {' '}offering{' '}
                                <span className="font-semibold text-foreground">{feeLabel(offer.fee)}</span>
                              </p>
                              {offer.reason && (
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">{offer.reason}</p>
                              )}
                            </div>
                            {isNeg ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">Counter:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">£</span>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    className="h-7 w-20 text-xs"
                                    value={counter}
                                    onChange={e => setOffersState(prev => {
                                      const next = { ...prev, counters: { ...prev.counters, [offer.id]: e.target.value } }
                                      saveOffers(next)
                                      return next
                                    })}
                                  />
                                  <span className="text-xs text-muted-foreground">M</span>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  style={{ background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)' }}
                                  onClick={() => acceptOffer(offer, parseFloat(counter) || offer.fee)}
                                >
                                  Accept
                                </Button>
                                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => cancelNegotiate(offer.id)}>✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  className="text-xs font-medium px-2.5 py-1 rounded border hover:bg-accent transition-colors"
                                  onClick={() => acceptOffer(offer, offer.fee)}
                                >
                                  Accept
                                </button>
                                <button
                                  className="text-xs font-medium px-2.5 py-1 rounded border hover:bg-accent transition-colors"
                                  style={{ color: '#9B6BB5', borderColor: '#9B6BB5' }}
                                  onClick={() => startNegotiate(offer.id, offer.fee)}
                                >
                                  Negotiate
                                </button>
                                <button
                                  className="text-xs text-red-500 hover:underline"
                                  onClick={() => rejectOffer(offer.id)}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
