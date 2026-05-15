import { useState, useMemo } from 'react'
import { useGame } from '@/store/gameContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loadDyn, setContract as persistContract, effectivePlayers, type PlayerDyn } from '@/lib/playerState'
import type { Player, TransferLogEntry } from '@/types'
import playerDB from '@/playerDB.json'

const ALL_PLAYERS = playerDB as Player[]
type Position = Player['pos']
const POSITIONS: Position[] = ['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST']

// ─── Hidden valuation engine ──────────────────────────────────────────────────

const BASE_VAL: Record<number, number> = { 5: 65, 4: 28, 3: 10, 2: 3, 1: 0.8 }

function ageMult(age: number) {
  if (age < 18) return 1.4
  if (age < 21) return 1.6
  if (age < 24) return 1.5
  if (age < 27) return 1.2
  if (age < 30) return 0.9
  if (age < 33) return 0.6
  return 0.3
}

function posMult(pos: Position) {
  if (pos === 'ST') return 1.15
  if (pos === 'LW' || pos === 'RW') return 1.1
  if (pos === 'CAM') return 1.05
  if (pos === 'GK') return 0.85
  return 1.0
}

function marketVal(imp: number, age: number, pos: Position) {
  return (BASE_VAL[imp] ?? 2) * ageMult(age) * posMult(pos)
}

function r1(n: number) { return Math.round(n * 10) / 10 }
function rnd(lo: number, hi: number) { return lo + Math.random() * (hi - lo) }

// ─── Availability ─────────────────────────────────────────────────────────────

type Availability = 'locked' | 'reluctant' | 'open'

function getAvailability(imp: number, age: number, club: string): Availability {
  if (imp === 5 && age < 24) return 'locked'
  const squad = ALL_PLAYERS.filter(p => p.team === club)
  const stars = squad.filter(p => p.importance >= 4).length
  if (imp === 5 && stars <= 2) return 'locked'
  if (imp >= 4 && stars <= 1) return 'locked'
  if (imp === 5) return 'reluctant'
  if (imp >= 4 && age < 27) return 'reluctant'
  return 'open'
}

// ─── Transfer fee simulation ──────────────────────────────────────────────────

type SaleOutcome =
  | { kind: 'accepted'; fee: number; msg: string }
  | { kind: 'counter';  fee: number; msg: string }
  | { kind: 'rejected'; msg: string }

function simulateSale(bid: number, imp: number, age: number, pos: Position, name: string, club: string): SaleOutcome {
  const mv      = marketVal(imp, age, pos)
  const asking  = r1(mv * rnd(1.0, 1.25))
  const snap    = r1(asking * rnd(1.3, 1.6))
  const minAcc  = r1(asking * rnd(0.72, 0.88))
  const avail   = getAvailability(imp, age, club)
  const c = club || 'The selling club'
  const p = name || 'this player'

  if (avail === 'locked') {
    if (bid >= snap * 1.15) return { kind: 'accepted', fee: r1(bid), msg: `After lengthy deliberation, ${c} reluctantly agree to part with ${p}. An extraordinary offer they simply couldn't ignore.` }
    if (bid >= snap) {
      const fee = r1(snap * rnd(1.05, 1.2))
      return { kind: 'counter', fee, msg: `${c} insist ${p} is not for sale, but acknowledge the scale of this bid. They would need £${fee.toFixed(1)}M to even open discussions.` }
    }
    return { kind: 'rejected', msg: `${c}: "${p} is the cornerstone of our project. We will not be accepting bids at this time."` }
  }

  if (avail === 'reluctant') {
    if (bid >= snap) return { kind: 'accepted', fee: r1(bid), msg: `${c} accept. A difficult decision, but the fee for ${p} was impossible to decline.` }
    if (bid >= asking * 0.92) {
      const fee = r1(asking * rnd(1.0, 1.08))
      return { kind: 'counter', fee, msg: `${c} won't sell ${p} for less than £${fee.toFixed(1)}M. That is their firm valuation.` }
    }
    return { kind: 'rejected', msg: `${c}: "We value ${p} far higher than that. Please do not return with a similar offer."` }
  }

  if (bid >= snap) return { kind: 'accepted', fee: r1(bid), msg: `${c} snap up the offer immediately. ${p} is on his way.` }

  if (bid >= asking) {
    if (Math.random() < 0.85) return { kind: 'accepted', fee: r1(bid), msg: `${c} accept £${bid.toFixed(1)}M for ${p}. Terms agreed.` }
    const fee = r1(asking * rnd(1.0, 1.06))
    return { kind: 'counter', fee, msg: `Almost there — ${c} want £${fee.toFixed(1)}M to finalise the deal.` }
  }

  if (bid >= minAcc) {
    const roll = Math.random()
    if (roll < 0.35) return { kind: 'accepted', fee: r1(bid), msg: `${c} accept. A deal below expectations, but the funds are needed.` }
    if (roll < 0.70) {
      const fee = r1(asking * rnd(0.92, 1.03))
      return { kind: 'counter', fee, msg: `${c} are willing to sell ${p} but want £${fee.toFixed(1)}M. Meet them there and it's done.` }
    }
    return { kind: 'rejected', msg: `${c}: "That doesn't meet our valuation for ${p}. We need a better offer."` }
  }

  if (bid > mv * 0.5 && Math.random() < 0.18) {
    const fee = r1(asking)
    return { kind: 'counter', fee, msg: `${c} are surprised by the low offer but respond with a counter of £${fee.toFixed(1)}M.` }
  }

  return { kind: 'rejected', msg: `${c}: "Rejected. Come back with a serious offer for ${p}."` }
}

// ─── Contract simulation ──────────────────────────────────────────────────────

const BASE_WAGE: Record<number, number> = { 5: 72000, 4: 30000, 3: 11000, 2: 3500, 1: 1000 }

type ContractOutcome =
  | { kind: 'accepted'; msg: string }
  | { kind: 'counter'; wage: number; years: number; msg: string }
  | { kind: 'rejected'; msg: string }

function preferredYears(age: number): { min: number; max: number } {
  if (age < 22) return { min: 3, max: 5 }
  if (age < 26) return { min: 3, max: 4 }
  if (age < 30) return { min: 2, max: 4 }
  if (age < 33) return { min: 1, max: 3 }
  return { min: 1, max: 2 }
}

function simulateContract(wage: number, years: number, player: Player, teamRank: number): ContractOutcome {
  // Bottom-half teams need to pay more to attract/retain; top teams get a discount
  const rankMult = 1 + (teamRank - 6) * 0.035
  const expectation = Math.round((BASE_WAGE[player.importance] ?? 3500) * rankMult * rnd(0.88, 1.12) / 100) * 100
  const pref = preferredYears(player.age)
  const yearOk = years >= pref.min && years <= pref.max
  const prefYrs = Math.min(Math.max(years, pref.min), pref.max)
  const n = player.name

  if (wage >= expectation * 1.1 && yearOk)
    return { kind: 'accepted', msg: `${n} is delighted to sign. Contract agreed.` }

  if (wage >= expectation && yearOk) {
    if (Math.random() < 0.8) return { kind: 'accepted', msg: `${n} is happy with the terms. Deal done.` }
    const cw = Math.round(expectation * rnd(1.0, 1.08) / 100) * 100
    return { kind: 'counter', wage: cw, years: prefYrs, msg: `${n}'s agent: Close, but we need £${(cw/1000).toFixed(0)}k/wk on a ${prefYrs}-year deal.` }
  }

  if (wage >= expectation && !yearOk)
    return { kind: 'counter', wage, years: prefYrs, msg: `${n}'s agent: The wage works, but ${n} wants a ${prefYrs}-year contract.` }

  if (wage >= expectation * 0.75) {
    const cw = Math.round(expectation * rnd(0.97, 1.05) / 100) * 100
    return { kind: 'counter', wage: cw, years: prefYrs, msg: `${n}'s agent: We're looking for £${(cw/1000).toFixed(0)}k/wk on a ${prefYrs}-year deal.` }
  }

  return { kind: 'rejected', msg: `${n} has declined. The terms don't reflect his ambitions.` }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtM(n: number) { return `£${r1(n).toFixed(1)}M` }
function fmtW(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `£${n}`
}

function outcomeCls(k: string) {
  if (k === 'accepted') return 'border-green-500 bg-green-50 dark:bg-green-950/30'
  if (k === 'counter')  return 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
  return 'border-red-400 bg-red-50 dark:bg-red-950/30'
}

function outcomeLabel(k: string) {
  if (k === 'counter') return 'Counter Offer'
  return k.charAt(0).toUpperCase() + k.slice(1)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransferMarket() {
  const { S, setS, scheduleSave } = useGame()
  const [dyn, setDyn] = useState<PlayerDyn>(loadDyn)

  const userTeamIds: number[] = S.userTeamIds ?? []
  const managedTeams = S.teams.filter(t => userTeamIds.includes(t.id))

  const [tab, setTab] = useState<'sign' | 'contracts' | 'log'>('sign')

  // ── Sign a Player ──────────────────────────────────────────────────────────
  const [source, setSource] = useState<'db' | 'ext'>('db')

  // DB search
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Player[]>([])
  const [selected, setSelected] = useState<Player | null>(null)

  // External player form
  const [ext, setExt] = useState({ name: '', club: '', pos: 'CM' as Position, age: '24', importance: 3 })

  // Deal
  const [buyerId, setBuyerId] = useState<number | null>(null)
  const [bid, setBid] = useState('')
  const [saleOutcome, setSaleOutcome] = useState<SaleOutcome | null>(null)

  // Personal terms (shown after fee accepted)
  const [showPersonal, setShowPersonal] = useState(false)
  const [pWage, setPWage] = useState('')
  const [pYears, setPYears] = useState('3')
  const [personalOutcome, setPersonalOutcome] = useState<ContractOutcome | null>(null)

  // ── Contract Talks ─────────────────────────────────────────────────────────
  const [ctTeamId, setCtTeamId] = useState<number | null>(null)
  const [ctPlayerId, setCtPlayerId] = useState<number | null>(null)
  const [ctWage, setCtWage] = useState('')
  const [ctYears, setCtYears] = useState('3')
  const [ctOutcome, setCtOutcome] = useState<ContractOutcome | null>(null)

  const activeCtTeam = S.teams.find(t => t.id === (ctTeamId ?? managedTeams[0]?.id)) ?? null

  const ctPlayers = useMemo(() => {
    if (!activeCtTeam) return []
    return effectivePlayers(dyn)
      .filter(p => p.team === activeCtTeam.name)
      .sort((a, b) => b.importance - a.importance)
  }, [dyn, activeCtTeam])

  const ctPlayer = ctPlayers.find(p => p.id === ctPlayerId) ?? null

  // ── Helpers ────────────────────────────────────────────────────────────────

  function teamRank(id: number): number {
    const sorted = [...S.teams].sort((a, b) => b.pts - a.pts)
    return (sorted.findIndex(t => t.id === id) + 1) || 6
  }

  function handleSearch(v: string) {
    setQuery(v)
    setSuggestions(v.length < 2 ? [] :
      ALL_PLAYERS.filter(p => p.name.toUpperCase().includes(v.toUpperCase())).slice(0, 8)
    )
  }

  function pickPlayer(p: Player) {
    setSelected(p)
    setQuery(p.name)
    setSuggestions([])
    setSaleOutcome(null)
    setShowPersonal(false)
    setBid('')
  }

  function clearSign() {
    setSelected(null)
    setQuery('')
    setSuggestions([])
    setSaleOutcome(null)
    setShowPersonal(false)
    setBid('')
    setPWage('')
    setPersonalOutcome(null)
  }

  function getPlayerInfo(): { name: string; club: string; pos: Position; age: number; imp: number } | null {
    if (source === 'db') {
      if (!selected) return null
      return { name: selected.name, club: selected.team, pos: selected.pos, age: selected.age, imp: selected.importance }
    }
    if (!ext.name.trim()) return null
    return { name: ext.name.trim(), club: ext.club.trim(), pos: ext.pos, age: parseInt(ext.age) || 24, imp: ext.importance }
  }

  function makeOffer() {
    const info = getPlayerInfo()
    const bidVal = parseFloat(bid)
    if (!info || !bidVal || bidVal <= 0) return

    const outcome = simulateSale(bidVal, info.imp, info.age, info.pos, info.name, info.club)
    setSaleOutcome(outcome)

    if (outcome.kind === 'accepted') {
      const buyer = S.teams.find(t => t.id === (buyerId ?? managedTeams[0]?.id))
      if (buyer) {
        const entry: TransferLogEntry = {
          player: info.name,
          sellerName: info.club || 'External',
          buyerName: buyer.name,
          buyerId: buyer.id,
          fee: outcome.fee,
        }
        setS(prev => {
          const n = {
            ...prev,
            transferLog: [entry, ...(prev.transferLog ?? [])],
            teams: prev.teams.map(t =>
              t.id === buyer.id ? { ...t, transfers_in: (t.transfers_in ?? 0) + outcome.fee * 1e6 } : t
            ),
          }
          scheduleSave(n)
          return n
        })
        setShowPersonal(true)
        setPWage('')
        setPYears('3')
        setPersonalOutcome(null)
      }
    }
  }

  function offerPersonalTerms() {
    const info = getPlayerInfo()
    const buyer = S.teams.find(t => t.id === (buyerId ?? managedTeams[0]?.id))
    if (!info || !buyer) return
    const wage = parseInt(pWage)
    const years = parseInt(pYears)
    if (!wage || !years) return

    const synth: Player = {
      id: selected?.id ?? -1,
      name: info.name,
      teamId: buyer.id,
      team: buyer.name,
      pos: info.pos,
      age: info.age,
      importance: info.imp,
      nat: selected?.nat ?? '???',
    }
    const outcome = simulateContract(wage, years, synth, teamRank(buyer.id))
    setPersonalOutcome(outcome)

    if (outcome.kind === 'accepted' && selected) {
      setDyn(persistContract(selected.id, wage, years, dyn))
    }
  }

  function submitCtTalk() {
    if (!ctPlayer || !activeCtTeam) return
    const wage = parseInt(ctWage)
    const years = parseInt(ctYears)
    if (!wage || !years) return
    const outcome = simulateContract(wage, years, ctPlayer, teamRank(activeCtTeam.id))
    setCtOutcome(outcome)
    if (outcome.kind === 'accepted') {
      setDyn(persistContract(ctPlayer.id, wage, years, dyn))
    }
  }

  function clearLog() {
    setS(prev => { const n = { ...prev, transferLog: [] }; scheduleSave(n); return n })
  }

  const transferLog = S.transferLog ?? []
  const info = getPlayerInfo()
  const canBid = !!info && !!bid && parseFloat(bid) > 0 && managedTeams.length > 0

  function tabStyle(t: string) {
    return {
      padding: '0.375rem 1rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      borderRadius: '0.375rem',
      transition: 'all 0.15s',
      background: tab === t ? '#9B6BB5' : 'transparent',
      color: tab === t ? '#fff' : 'var(--muted-foreground)',
    }
  }

  const selectCls = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm'

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button style={tabStyle('sign')} onClick={() => setTab('sign')}>Sign a Player</button>
        <button style={tabStyle('contracts')} onClick={() => setTab('contracts')}>Contract Talks</button>
        <button style={tabStyle('log')} onClick={() => setTab('log')}>
          Transfer Log{transferLog.length > 0 && <span className="ml-1.5 opacity-60 text-xs">({transferLog.length})</span>}
        </button>
      </div>

      {/* ── SIGN A PLAYER ───────────────────────────────────────────────────── */}
      {tab === 'sign' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Sign a Player</CardTitle>
            <CardDescription>Search any club's player or enter an external signing manually, then make an offer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Source toggle */}
            <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
              <button
                className="px-4 py-1.5 transition-colors"
                style={source === 'db' ? { background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)', color: '#fff' } : { color: 'var(--muted-foreground)' }}
                onClick={() => { setSource('db'); clearSign() }}
              >
                In database
              </button>
              <button
                className="px-4 py-1.5 border-l transition-colors"
                style={source === 'ext' ? { background: '#2E4A52', color: '#fff' } : { color: 'var(--muted-foreground)' }}
                onClick={() => { setSource('ext'); clearSign() }}
              >
                External player
              </button>
            </div>

            {/* Database search */}
            {source === 'db' && (
              <div>
                <label className="text-xs text-muted-foreground">Search player</label>
                <div className="relative mt-1">
                  <Input
                    className="text-sm"
                    placeholder="Name..."
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-md overflow-hidden">
                      {suggestions.map(p => (
                        <button
                          key={p.id}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                          onMouseDown={() => pickPlayer(p)}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-3">{p.team} · {p.pos} · {p.age}y</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selected && (
                  <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{selected.name}</p>
                      <p className="text-xs text-muted-foreground">{selected.team} · {selected.pos} · Age {selected.age}</p>
                    </div>
                    <div className="flex gap-px shrink-0">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ color: n <= selected.importance ? '#f59e0b' : '#d1d5db', fontSize: 12 }}>★</span>
                      ))}
                    </div>
                    <button className="text-xs text-muted-foreground hover:text-foreground shrink-0" onClick={clearSign}>✕</button>
                  </div>
                )}
              </div>
            )}

            {/* External player form */}
            {source === 'ext' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Player name</label>
                  <Input className="text-sm mt-1" placeholder="e.g. M. Rashford" value={ext.name}
                    onChange={e => { setExt(x => ({ ...x, name: e.target.value })); setSaleOutcome(null) }} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Current club</label>
                  <Input className="text-sm mt-1" placeholder="e.g. Man United" value={ext.club}
                    onChange={e => setExt(x => ({ ...x, club: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Age</label>
                  <Input type="number" className="text-sm mt-1" value={ext.age}
                    onChange={e => setExt(x => ({ ...x, age: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Position</label>
                  <select className={`${selectCls} mt-1`} value={ext.pos}
                    onChange={e => setExt(x => ({ ...x, pos: e.target.value as Position }))}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Quality</label>
                  <div className="flex gap-1 mt-2.5">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setExt(x => ({ ...x, importance: n }))}
                        style={{ color: n <= ext.importance ? '#f59e0b' : '#d1d5db', fontSize: 20, lineHeight: 1 }}>★</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Buyer + bid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Buying club</label>
                {managedTeams.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">No managed clubs — set them in Transfer Hub first.</p>
                ) : (
                  <select className={`${selectCls} mt-1`}
                    value={buyerId ?? managedTeams[0].id}
                    onChange={e => { setBuyerId(Number(e.target.value)); setSaleOutcome(null) }}>
                    {managedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bid (£M)</label>
                <Input type="number" step="0.5" className="text-sm mt-1" placeholder="e.g. 25"
                  value={bid} onChange={e => { setBid(e.target.value); setSaleOutcome(null) }} />
              </div>
            </div>

            <Button onClick={makeOffer} disabled={!canBid}>Make Offer</Button>

            {/* Fee outcome */}
            {saleOutcome && (
              <div className={`rounded-md border p-3 text-sm space-y-1 ${outcomeCls(saleOutcome.kind)}`}>
                <p className="font-semibold">{outcomeLabel(saleOutcome.kind)}</p>
                {'fee' in saleOutcome && <p className="font-medium">{fmtM(saleOutcome.fee)}</p>}
                <p className="text-muted-foreground">{saleOutcome.msg}</p>
              </div>
            )}

            {/* Personal terms — shown after fee accepted */}
            {showPersonal && saleOutcome?.kind === 'accepted' && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div>
                  <p className="text-sm font-semibold">Agree personal terms</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Transfer fee agreed. Now negotiate the player's contract.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Wage (£/wk)</label>
                    <Input type="number" className="text-sm mt-1" placeholder="e.g. 25000"
                      value={pWage} onChange={e => { setPWage(e.target.value); setPersonalOutcome(null) }} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Contract length</label>
                    <select className={`${selectCls} mt-1`} value={pYears}
                      onChange={e => { setPYears(e.target.value); setPersonalOutcome(null) }}>
                      {[1,2,3,4,5].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <Button size="sm" onClick={offerPersonalTerms} disabled={!pWage}>Offer Terms</Button>
                {personalOutcome && (
                  <div className={`rounded-md border p-3 text-sm space-y-0.5 ${outcomeCls(personalOutcome.kind)}`}>
                    <p className="font-semibold">{outcomeLabel(personalOutcome.kind)}</p>
                    {'wage' in personalOutcome && (
                      <p className="font-medium">{fmtW(personalOutcome.wage)}/wk · {personalOutcome.years}yr</p>
                    )}
                    <p className="text-muted-foreground">{personalOutcome.msg}</p>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* ── CONTRACT TALKS ──────────────────────────────────────────────────── */}
      {tab === 'contracts' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Contract Talks</CardTitle>
            <CardDescription>
              Re-sign players or offer new deals. Players at struggling clubs demand higher wages to stay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {managedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No managed clubs — set them in Transfer Hub first.</p>
            ) : (
              <>
                {/* Team tabs */}
                {managedTeams.length > 1 && (
                  <div className="flex gap-1 flex-wrap">
                    {managedTeams.map(t => (
                      <button key={t.id}
                        onClick={() => { setCtTeamId(t.id); setCtPlayerId(null); setCtOutcome(null) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        style={(ctTeamId ?? managedTeams[0].id) === t.id
                          ? { background: '#9B6BB5', color: '#fff', borderColor: '#9B6BB5' }
                          : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >{t.name}</button>
                    ))}
                  </div>
                )}

                {/* Player list */}
                <div className="rounded-md border overflow-hidden divide-y max-h-72 overflow-y-auto">
                  {ctPlayers.length === 0 && (
                    <p className="text-sm text-muted-foreground px-3 py-4">No players found.</p>
                  )}
                  {ctPlayers.map(p => {
                    const contract = dyn.contracts[p.id]
                    const isSelected = ctPlayerId === p.id
                    return (
                      <button key={p.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                        style={isSelected ? { background: 'var(--accent)' } : {}}
                        onClick={() => { setCtPlayerId(p.id); setCtOutcome(null); setCtWage(''); setCtYears('3') }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.pos} · Age {p.age}</p>
                        </div>
                        <div className="text-right shrink-0 mr-1">
                          {contract ? (
                            <>
                              <p className="text-xs font-medium">{fmtW(contract.wage)}/wk</p>
                              <p className={`text-[10px] ${contract.yearsLeft <= 1 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                {contract.yearsLeft === 0 ? 'Expired' : `${contract.yearsLeft}yr left`}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">No contract</p>
                          )}
                        </div>
                        <div className="flex gap-px shrink-0">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{ color: n <= p.importance ? '#f59e0b' : '#d1d5db', fontSize: 11 }}>★</span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Negotiation form */}
                {ctPlayer && (
                  <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                    <p className="text-sm font-semibold">Negotiating with {ctPlayer.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Wage offer (£/wk)</label>
                        <Input type="number" className="text-sm mt-1" placeholder="e.g. 15000"
                          value={ctWage} onChange={e => { setCtWage(e.target.value); setCtOutcome(null) }} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Contract length</label>
                        <select className={`${selectCls} mt-1`} value={ctYears}
                          onChange={e => { setCtYears(e.target.value); setCtOutcome(null) }}>
                          {[1,2,3,4,5].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
                        </select>
                      </div>
                    </div>
                    <Button size="sm" onClick={submitCtTalk} disabled={!ctWage}>Make Offer</Button>
                    {ctOutcome && (
                      <div className={`rounded-md border p-3 text-sm space-y-0.5 ${outcomeCls(ctOutcome.kind)}`}>
                        <p className="font-semibold">{outcomeLabel(ctOutcome.kind)}</p>
                        {'wage' in ctOutcome && (
                          <p className="font-medium">{fmtW(ctOutcome.wage)}/wk · {ctOutcome.years}yr</p>
                        )}
                        <p className="text-muted-foreground">{ctOutcome.msg}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TRANSFER LOG ────────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transfer Log</CardTitle>
                <CardDescription>All completed deals this save.</CardDescription>
              </div>
              {transferLog.length > 0 && <Button size="sm" variant="outline" onClick={clearLog}>Clear</Button>}
            </div>
          </CardHeader>
          <CardContent>
            {transferLog.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No deals logged yet.</p>
            ) : (
              <div className="space-y-2">
                {transferLog.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.player}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sellerName} → {item.buyerName}</p>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap shrink-0">{fmtM(item.fee)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
