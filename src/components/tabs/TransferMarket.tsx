import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Position = 'GK' | 'DEF' | 'MID' | 'ATT'
type Contribution = 'key' | 'regular' | 'rotation' | 'squad'

type TeamOffer = {
  name: string
  budget: number
  willingToPay: number | null
}

type Valuation = {
  playerName: string
  currentClub: string
  age: number
  position: Position
  contribution: Contribution
  rating: number
  yourValuation: number | null
  askingPrice: number | null
  snapUpAbove: number | null
  minAcceptable: number | null
}

type Outcome =
  | { type: 'accepted'; fee: number; message: string }
  | { type: 'counter'; fee: number; message: string }
  | { type: 'rejected'; message: string }
  | { type: 'error'; message: string }

type TransferLogItem = {
  season: string
  player: string
  sellingClub: string
  buyingClub: string
  fee: number
}

const TEAM_KEY = 'efl-transfer-interested-teams-v1'
const LOG_KEY = 'efl-transfer-log-v1'

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function currencyM(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return `£${round1(n).toFixed(1)}M`
}

function baseFeeFromRating(rating: number) {
  if (rating >= 90) return 120
  if (rating >= 87) return 80
  if (rating >= 85) return 55
  if (rating >= 83) return 38
  if (rating >= 81) return 25
  if (rating >= 79) return 16
  if (rating >= 77) return 10
  return 6
}

function ageFactor(age: number) {
  if (age <= 21) return 1.5
  if (age <= 24) return 1.3
  if (age <= 27) return 1.1
  if (age <= 30) return 0.95
  if (age <= 33) return 0.75
  return 0.5
}

function contributionFactor(contribution: Contribution) {
  if (contribution === 'key') return 1.3
  if (contribution === 'regular') return 1.0
  if (contribution === 'rotation') return 0.75
  return 0.5
}

function positionFactor(position: Position) {
  if (position === 'ATT') return 1.1
  if (position === 'MID') return 1.0
  if (position === 'DEF') return 0.95
  return 0.85
}

function rejectionLine(sellingClub: string, playerName: string) {
  const club = sellingClub || 'The selling club'
  const player = playerName || 'the player'
  const lines = [
    `${club}: "${player} is not leaving at that price."`,
    `${club}: "Rejected. We need a serious offer for ${player}."`,
    `${club}: "No deal. Keep negotiating or move on."`,
    `${club}: "The board has turned this bid down."`,
    `${club}: "Talks ended. ${player} stays unless terms improve."`,
  ]
  return lines[Math.floor(Math.random() * lines.length)]
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function TransferMarket() {
  const [valuation, setValuation] = useState<Valuation>({
    playerName: '',
    currentClub: '',
    age: 24,
    position: 'MID',
    contribution: 'regular',
    rating: 80,
    yourValuation: null,
    askingPrice: null,
    snapUpAbove: null,
    minAcceptable: null,
  })

  const [interestedTeams, setInterestedTeams] = useState<TeamOffer[]>(
    () => loadJSON<TeamOffer[]>(TEAM_KEY, [])
  )
  const [transferLog, setTransferLog] = useState<TransferLogItem[]>(
    () => loadJSON<TransferLogItem[]>(LOG_KEY, [])
  )

  const [teamName, setTeamName] = useState('')
  const [teamBudget, setTeamBudget] = useState('')

  const [seasonLabel, setSeasonLabel] = useState('S1')
  const [sellingClub, setSellingClub] = useState('')
  const [buyingClub, setBuyingClub] = useState('')
  const [bid, setBid] = useState('')
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const canGenerateOffers = valuation.askingPrice != null && valuation.yourValuation != null

  const summary = useMemo(() => {
    return `${interestedTeams.length} interested team${interestedTeams.length === 1 ? '' : 's'}`
  }, [interestedTeams.length])

  function rollValuation() {
    const base =
      baseFeeFromRating(valuation.rating) *
      ageFactor(valuation.age) *
      contributionFactor(valuation.contribution) *
      positionFactor(valuation.position)

    const yourValuation = round1(base * randFloat(0.88, 1.12))
    const askingPrice = round1(base * randFloat(1.05, 1.4))
    const snapUpAbove = round1(askingPrice * randFloat(1.18, 1.4))
    const minAcceptable = round1(askingPrice * randFloat(0.76, 0.9))

    setValuation(v => ({
      ...v,
      yourValuation,
      askingPrice,
      snapUpAbove,
      minAcceptable,
    }))

    setSellingClub(prev => prev || valuation.currentClub)
    setBid(String(askingPrice))
    setOutcome(null)

    generateTeamOffers(askingPrice, yourValuation)
  }

  function generateTeamOffers(askingPrice?: number, yourValuation?: number) {
    const ask = askingPrice ?? valuation.askingPrice
    const yourVal = yourValuation ?? valuation.yourValuation
    if (ask == null || yourVal == null) return

    const contributionMult =
      valuation.contribution === 'key'
        ? 1.07
        : valuation.contribution === 'regular'
          ? 1.0
          : valuation.contribution === 'rotation'
            ? 0.94
            : 0.88

    const ageMult = valuation.age > 33 ? 0.92 : valuation.age <= 24 ? 1.04 : 1.0

    const next = interestedTeams.map(team => {
      const anchor = ask * 0.62 + yourVal * 0.38
      const appetite = randFloat(0.9, 1.18) * contributionMult * ageMult
      const budgetPressure = team.budget < ask ? randFloat(0.78, 0.96) : randFloat(0.92, 1.08)
      const willing = round1(Math.min(team.budget, anchor * appetite * budgetPressure))
      return { ...team, willingToPay: willing }
    })

    setInterestedTeams(next)
    saveJSON(TEAM_KEY, next)
  }

  function addTeam() {
    const name = teamName.trim()
    const budgetNum = Number(teamBudget)
    if (!name || !Number.isFinite(budgetNum) || budgetNum <= 0) return

    if (interestedTeams.some(t => t.name.toLowerCase() === name.toLowerCase())) return

    const next = [...interestedTeams, { name, budget: round1(budgetNum), willingToPay: null }]
    setInterestedTeams(next)
    saveJSON(TEAM_KEY, next)
    setTeamName('')
    setTeamBudget('')
  }

  function removeTeam(idx: number) {
    const next = interestedTeams.filter((_, i) => i !== idx)
    setInterestedTeams(next)
    saveJSON(TEAM_KEY, next)
  }

  function resetRun() {
    setValuation(v => ({
      ...v,
      yourValuation: null,
      askingPrice: null,
      snapUpAbove: null,
      minAcceptable: null,
    }))
    const cleared = interestedTeams.map(t => ({ ...t, willingToPay: null }))
    setInterestedTeams(cleared)
    saveJSON(TEAM_KEY, cleared)
    setBid('')
    setReason('')
    setOutcome(null)
  }

  function useOffer(team: TeamOffer) {
    setBuyingClub(team.name)
    if (team.willingToPay != null) setBid(String(team.willingToPay))
    setOutcome(null)
  }

  function negotiate() {
    if (
      valuation.askingPrice == null ||
      valuation.snapUpAbove == null ||
      valuation.minAcceptable == null ||
      valuation.yourValuation == null
    ) {
      setOutcome({ type: 'error', message: 'Roll valuation first.' })
      return
    }

    const bidValue = Number(bid)
    if (!sellingClub.trim() || !buyingClub.trim() || !Number.isFinite(bidValue) || bidValue <= 0) {
      setOutcome({ type: 'error', message: 'Enter selling club, buying club, and a valid bid.' })
      return
    }

    const asking = valuation.askingPrice
    const snapUp = valuation.snapUpAbove
    const minAcceptable = valuation.minAcceptable
    const yourVal = valuation.yourValuation
    const reasonBoost = clamp(reason.trim().length / 600, 0, 0.12)

    if (bidValue >= snapUp) {
      const accepted: Outcome = {
        type: 'accepted',
        fee: round1(bidValue),
        message: 'Snap-up threshold reached.',
      }
      setOutcome(accepted)
      appendLog(round1(bidValue))
      return
    }

    if (bidValue >= asking) {
      const acceptedChance = clamp(0.88 + reasonBoost, 0, 0.97)
      if (Math.random() < acceptedChance) {
        const accepted: Outcome = {
          type: 'accepted',
          fee: round1(bidValue),
          message: 'Bid meets the asking price.',
        }
        setOutcome(accepted)
        appendLog(round1(bidValue))
      } else {
        setOutcome({
          type: 'counter',
          fee: round1(asking * randFloat(0.9, 1.05)),
          message: 'Selling club wants a better structure/fee.',
        })
      }
      return
    }

    if (bidValue >= minAcceptable) {
      let accept = 0.42
      let counter = 0.3
      let reject = 0.28

      const shift = Math.min(reasonBoost, reject)
      reject -= shift
      accept += shift * 0.6
      counter += shift * 0.4

      if (valuation.contribution === 'key' && bidValue < asking) {
        const bump = Math.min(0.38, accept + counter)
        const pullA = Math.min(accept, bump * 0.7)
        accept -= pullA
        const pullC = Math.min(counter, bump - pullA)
        counter -= pullC
        reject += pullA + pullC
      }

      if (valuation.age > 33 && bidValue > asking * 1.2) {
        const bump = Math.min(0.28, accept + counter)
        const pullA = Math.min(accept, bump * 0.7)
        accept -= pullA
        const pullC = Math.min(counter, bump - pullA)
        counter -= pullC
        reject += pullA + pullC
      }

      const roll = Math.random()
      if (roll < accept) {
        const accepted: Outcome = {
          type: 'accepted',
          fee: round1(bidValue),
          message: 'Deal accepted from acceptable range.',
        }
        setOutcome(accepted)
        appendLog(round1(bidValue))
      } else if (roll < accept + counter) {
        setOutcome({
          type: 'counter',
          fee: round1(asking * randFloat(0.9, 1.05)),
          message: 'Counter from the selling club.',
        })
      } else {
        setOutcome({
          type: 'rejected',
          message: rejectionLine(sellingClub, valuation.playerName),
        })
      }
      return
    }

    if (bidValue >= yourVal) {
      const counterChance = clamp(0.22 + reasonBoost * 0.8, 0, 0.4)
      if (Math.random() < counterChance) {
        setOutcome({
          type: 'counter',
          fee: round1(asking * randFloat(0.9, 1.05)),
          message: 'Bid is low, but they still return with a counter.',
        })
      } else {
        setOutcome({
          type: 'rejected',
          message: rejectionLine(sellingClub, valuation.playerName),
        })
      }
      return
    }

    setOutcome({
      type: 'rejected',
      message: rejectionLine(sellingClub, valuation.playerName),
    })
  }

  function appendLog(fee: number) {
    const item: TransferLogItem = {
      season: seasonLabel.trim() || 'S1',
      player: valuation.playerName || 'Player',
      sellingClub: sellingClub.trim(),
      buyingClub: buyingClub.trim(),
      fee,
    }
    const next = [item, ...transferLog]
    setTransferLog(next)
    saveJSON(LOG_KEY, next)
  }

  function clearLog() {
    setTransferLog([])
    saveJSON(LOG_KEY, [])
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Player valuation</CardTitle>
            <CardDescription>
              Roll to generate your valuation, asking price, snap-up threshold, and min acceptable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Player name</label>
                <Input value={valuation.playerName} onChange={e => setValuation(v => ({ ...v, playerName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Current club</label>
                <Input value={valuation.currentClub} onChange={e => setValuation(v => ({ ...v, currentClub: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Age</label>
                <Input type="number" value={valuation.age} onChange={e => setValuation(v => ({ ...v, age: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">PES rating (60-99)</label>
                <Input type="number" min={60} max={99} value={valuation.rating} onChange={e => setValuation(v => ({ ...v, rating: clamp(Number(e.target.value) || 60, 60, 99) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Position</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={valuation.position}
                  onChange={e => setValuation(v => ({ ...v, position: e.target.value as Position }))}
                >
                  <option value="GK">GK</option>
                  <option value="DEF">DEF</option>
                  <option value="MID">MID</option>
                  <option value="ATT">ATT</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contribution</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={valuation.contribution}
                  onChange={e => setValuation(v => ({ ...v, contribution: e.target.value as Contribution }))}
                >
                  <option value="key">Key player</option>
                  <option value="regular">Regular starter</option>
                  <option value="rotation">Rotation</option>
                  <option value="squad">Squad depth</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={rollValuation}>Roll valuation</Button>
              <Button variant="outline" onClick={resetRun}>Reset run</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2"><span className="text-muted-foreground">Your valuation:</span> {currencyM(valuation.yourValuation)}</div>
              <div className="rounded-md border p-2"><span className="text-muted-foreground">Asking price:</span> {currencyM(valuation.askingPrice)}</div>
              <div className="rounded-md border p-2"><span className="text-muted-foreground">Snap up above:</span> {currencyM(valuation.snapUpAbove)}</div>
              <div className="rounded-md border p-2"><span className="text-muted-foreground">Min acceptable:</span> {currencyM(valuation.minAcceptable)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Negotiate transfer</CardTitle>
            <CardDescription>Uses the latest valuation output and your bid.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Selling club</label>
                <Input value={sellingClub} onChange={e => setSellingClub(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Buying club</label>
                <Input value={buyingClub} onChange={e => setBuyingClub(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bid (£M)</label>
                <Input type="number" step="0.1" value={bid} onChange={e => setBid(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Season label</label>
                <Input value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reason (optional)</label>
              <textarea
                className="flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <Button onClick={negotiate}>Submit bid</Button>

            {outcome && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium capitalize">{outcome.type}</p>
                {'fee' in outcome && <p className="text-muted-foreground">Figure: {currencyM(outcome.fee)}</p>}
                <p className="text-muted-foreground">{outcome.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interested teams</CardTitle>
          <CardDescription>{summary}. Add/remove teams, set budgets, then generate offers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <Input placeholder="Budget (£M)" type="number" step="0.1" value={teamBudget} onChange={e => setTeamBudget(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={addTeam}>Add team</Button>
              <Button variant="outline" onClick={() => generateTeamOffers()} disabled={!canGenerateOffers}>
                Generate offers
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Willing to pay</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {interestedTeams.map((team, idx) => (
                <TableRow key={`${team.name}-${idx}`}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>{currencyM(team.budget)}</TableCell>
                  <TableCell>{currencyM(team.willingToPay)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" onClick={() => useOffer(team)} disabled={team.willingToPay == null}>Use offer</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeTeam(idx)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer log</CardTitle>
          <CardDescription>Accepted deals only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Button size="sm" variant="outline" onClick={clearLog}>Clear log</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Selling club</TableHead>
                <TableHead>Buying club</TableHead>
                <TableHead>Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferLog.map((item, i) => (
                <TableRow key={`${item.player}-${item.buyingClub}-${i}`}>
                  <TableCell>{item.season}</TableCell>
                  <TableCell>{item.player}</TableCell>
                  <TableCell>{item.sellingClub}</TableCell>
                  <TableCell>{item.buyingClub}</TableCell>
                  <TableCell>{currencyM(item.fee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
