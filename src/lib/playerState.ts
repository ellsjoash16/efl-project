import type { Player, NewsItem, TransferLogEntry } from '../types'
import playerDB from '../playerDB.json'

const BASE = playerDB as Player[]
export const STORAGE_KEY = 'efl-player-dyn-v2'

export interface PlayerOverride {
  pos?: Player['pos']
  importance?: number
  age?: number
  onForm?: boolean
}

export interface Contract {
  wage: number      // £/week
  yearsLeft: number // 0 = expired
}

export interface PlayerDyn {
  season: number
  overrides: Record<number, PlayerOverride>
  custom: Player[]     // user-added + academy graduates
  retired: number[]    // base player IDs that have retired
  contracts: Record<number, Contract>  // keyed by player id — user team only
  teamOverrides: Record<number, { teamId: number; team: string }>  // AI/manual transfers
}

function blank(): PlayerDyn {
  return { season: 0, overrides: {}, custom: [], retired: [], contracts: {}, teamOverrides: {} }
}

export function loadDyn(): PlayerDyn {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return blank()
    const parsed = JSON.parse(raw)
    return { ...blank(), ...parsed }
  } catch { return blank() }
}

export function saveDyn(d: PlayerDyn) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
}

/** Merge a partial override for a player and save */
export function patchPlayer(id: number, patch: Partial<PlayerOverride>, dyn: PlayerDyn): PlayerDyn {
  const next: PlayerDyn = {
    ...dyn,
    overrides: { ...dyn.overrides, [id]: { ...dyn.overrides[id], ...patch } },
  }
  saveDyn(next)
  return next
}

/** Effective player list — base with overrides applied, retired excluded, custom appended */
export function effectivePlayers(dyn: PlayerDyn): Player[] {
  const to = dyn.teamOverrides ?? {}
  return [
    ...BASE
      .filter(p => !dyn.retired.includes(p.id))
      .map(p => ({
        ...p,
        pos:        (dyn.overrides[p.id]?.pos        ?? p.pos) as Player['pos'],
        importance:  dyn.overrides[p.id]?.importance ?? p.importance,
        age:         dyn.overrides[p.id]?.age        ?? p.age,
        teamId:      to[p.id]?.teamId  ?? p.teamId,
        team:        to[p.id]?.team    ?? p.team,
      })),
    ...dyn.custom,
  ]
}

// ─── Contract helpers ─────────────────────────────────────────────────────────

const BASE_WAGE: Record<number, number> = { 1: 1500, 2: 4500, 3: 14000, 4: 32000, 5: 65000 }

export function randomWage(importance: number): number {
  const base = BASE_WAGE[importance] ?? 1500
  return Math.round(base * (0.8 + Math.random() * 0.4))
}

/** Generate contracts for a specific list of player IDs */
export function generateContractsForPlayers(players: Player[], dyn: PlayerDyn): PlayerDyn {
  const contracts: Record<number, Contract> = { ...dyn.contracts }
  for (const p of players) {
    contracts[p.id] = {
      wage: randomWage(p.importance),
      yearsLeft: 1 + Math.floor(Math.random() * 4),
    }
  }
  const next = { ...dyn, contracts }
  saveDyn(next)
  return next
}

/** Offer or renew a single contract */
export function setContract(id: number, wage: number, yearsLeft: number, dyn: PlayerDyn): PlayerDyn {
  const next = { ...dyn, contracts: { ...dyn.contracts, [id]: { wage, yearsLeft } } }
  saveDyn(next)
  return next
}

/** Release a player — removes their contract */
export function releaseContract(id: number, dyn: PlayerDyn): PlayerDyn {
  const contracts = { ...dyn.contracts }
  delete contracts[id]
  const next = { ...dyn, contracts }
  saveDyn(next)
  return next
}

// ─── Academy name pool ───────────────────────────────────────────────────────

const FIRST = ['James','Tom','Luke','Ryan','Jack','Liam','Charlie','Ethan','Harry',
  'Oliver','Noah','Mason','Leo','Kai','Tyler','Marcus','Zak','Finn','Jamie','Sam',
  'Aaron','Dion','Jamal','Alfie','Regan','Josh','Kyle','Ben','Danny','Callum']
const LAST  = ['Wilson','Smith','Taylor','Brown','Davies','Evans','White','Clarke',
  'Roberts','Walker','Hill','Moore','Wright','Thompson','Mitchell','Cooper','Reed',
  'Price','Hughes','Foster','Barnes','Griffith','Nkosi','Osei','Ahmed','Patel',
  'Garcia','Novak','Costa','Diallo']
const NATS  = ['ENG','ENG','ENG','ENG','ENG','ENG','WAL','SCO','IRL','NGA','GHA','FRA','BRA']
const POSITIONS = ['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'] as const

function rnd<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomName() { return `${rnd(FIRST)[0]}. ${rnd(LAST).toUpperCase()}` }

// ─── Season-end processing ───────────────────────────────────────────────────

export interface TeamRef { id: number; name: string }

export function applySeasonEnd(
  dyn: PlayerDyn,
  teams: TeamRef[],
  justFinishedSeason: number,
  humanTeamIds: number[] = [],
): { dyn: PlayerDyn; news: NewsItem[] } {
  if (dyn.season >= justFinishedSeason) return { dyn, news: [] } // idempotent

  const news: NewsItem[] = []
  let newsId = Date.now()

  const overrides  = { ...dyn.overrides }
  const retired    = [...dyn.retired]
  const custom     = [...dyn.custom]

  // Build full player list before any mutations
  const all = effectivePlayers(dyn)

  // 1. Age +1 ────────────────────────────────────────────────────────────────
  for (const p of all) {
    const ov  = overrides[p.id] ?? {}
    const age = ov.age ?? p.age
    overrides[p.id] = { ...ov, age: age + 1 }
  }

  // 2. Retirement — oldest 31+ player per team ──────────────────────────────
  for (const team of teams) {
    const eligible = all
      .filter(p => p.team === team.name && !retired.includes(p.id))
      .filter(p => (overrides[p.id]?.age ?? p.age) >= 32)
      .sort((a, b) => (overrides[b.id]?.age ?? b.age) - (overrides[a.id]?.age ?? a.age))

    if (eligible.length > 0) {
      const p = eligible[0]
      retired.push(p.id)
      news.push({ id: String(newsId++), season: justFinishedSeason, teamId: team.id, team: team.name, type: 'info', msg: `${p.name} (${overrides[p.id]?.age ?? p.age}) retires from ${team.name}.` })
    }
  }

  // 3. Academy graduates — 2–3 per team ─────────────────────────────────────
  let nextId = Math.max(
    ...BASE.map(p => p.id),
    ...custom.map(p => p.id),
    9999
  ) + 1

  for (const team of teams) {
    const count = 2 + (Math.random() < 0.5 ? 1 : 0)
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      const name = randomName()
      names.push(name)
      custom.push({
        id: nextId++,
        name,
        teamId: team.id,
        team: team.name,
        pos: rnd(POSITIONS),
        age: Math.random() < 0.5 ? 17 : 18,
        importance: 1,
        nat: rnd(NATS),
      })
    }
    news.push({ id: String(newsId++), season: justFinishedSeason, teamId: team.id, team: team.name, type: 'good', msg: `${count} academy graduates promoted at ${team.name}: ${names.join(', ')}.` })
  }

  // 4. Contracts — tick down human teams, auto-manage AI teams ─────────────
  const allUpdated = effectivePlayers({ ...dyn, overrides, retired, custom, contracts: dyn.contracts })
  const contracts: Record<number, Contract> = {}

  // Tick existing contracts
  for (const [idStr, c] of Object.entries(dyn.contracts)) {
    contracts[Number(idStr)] = { ...c, yearsLeft: Math.max(0, c.yearsLeft - 1) }
  }

  // AI teams: generate missing contracts + auto-renew expired ones
  for (const team of teams) {
    if (humanTeamIds.includes(team.id)) continue
    const teamPlayers = allUpdated.filter(p => p.team === team.name)
    const renewed: string[] = []
    for (const p of teamPlayers) {
      const c = contracts[p.id]
      if (!c || c.yearsLeft === 0) {
        const baseWage = c ? Math.round(c.wage * (1 + Math.random() * 0.1)) : randomWage(p.importance)
        contracts[p.id] = { wage: baseWage, yearsLeft: 2 + Math.floor(Math.random() * 3) }
        if (c) renewed.push(p.name)
      }
    }
    if (renewed.length > 0) {
      news.push({ id: String(newsId++), season: justFinishedSeason, teamId: team.id, team: team.name, type: 'info', msg: `${team.name} renewed ${renewed.length} contract${renewed.length > 1 ? 's' : ''}: ${renewed.slice(0, 3).join(', ')}${renewed.length > 3 ? ` +${renewed.length - 3} more` : ''}.` })
    }
  }

  const next: PlayerDyn = {
    season: justFinishedSeason,
    overrides,
    retired,
    custom,
    contracts,
    teamOverrides: dyn.teamOverrides ?? {},
  }
  saveDyn(next)
  return { dyn: next, news }
}

// ─── AI transfer window ───────────────────────────────────────────────────────

export interface AiTeamRef {
  id: number
  name: string
  budget: number   // £ (raw, not £M)
  isHuman: boolean
  pts: number      // current points — worse teams spend more aggressively
}

const AI_BASE_VAL: Record<number, number> = { 5: 62, 4: 26, 3: 9, 2: 2.5, 1: 0.7 }
const AI_BASE_WAGE: Record<number, number> = { 5: 68000, 4: 27000, 3: 9500, 2: 3000, 1: 900 }

const AI_POS_GROUP: Record<string, string> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
}
const AI_GROUP_MIN: Record<string, number> = { GK: 2, DEF: 5, MID: 5, ATT: 4 }

function aiMarketFee(imp: number, age: number): number {
  const base = AI_BASE_VAL[imp] ?? 2
  const aMult = age < 21 ? 1.5 : age < 25 ? 1.3 : age < 28 ? 1.1 : age < 31 ? 0.8 : age < 34 ? 0.55 : 0.3
  return Math.round(base * aMult * (0.9 + Math.random() * 0.2) * 10) / 10
}

function aiSquadNeeds(players: Player[]): string[] {
  const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 }
  const impSum: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 }
  for (const p of players) {
    const g = AI_POS_GROUP[p.pos]
    if (g) { counts[g] = (counts[g] ?? 0) + 1; impSum[g] = (impSum[g] ?? 0) + p.importance }
  }
  return Object.keys(AI_GROUP_MIN).filter(g => {
    const avg = counts[g] > 0 ? impSum[g] / counts[g] : 0
    return counts[g] < AI_GROUP_MIN[g] || avg < 2.6
  })
}

function aiTransferProb(imp: number, age: number, clubStars: number): number {
  if (imp === 5 && age < 24)       return 0.04
  if (imp === 5 && clubStars <= 2) return 0.07
  if (imp >= 4 && clubStars <= 1)  return 0.08
  if (imp === 5)                   return 0.22
  if (imp >= 4 && age < 27)        return 0.32
  return 0.72
}

// ─── AI fit-score helpers ─────────────────────────────────────────────────────

/** Club tier: average importance of their best 11 players */
function clubTier(players: Player[]): number {
  if (players.length === 0) return 1
  const sorted = [...players].sort((a, b) => b.importance - a.importance).slice(0, 11)
  return sorted.reduce((s, p) => s + p.importance, 0) / sorted.length
}

/** How well does this player fit this buyer?
 *  Considers: importance match to club tier, age profile, budget proportion */
function fitScore(p: Player, buyer: AiTeamRef, buyerPlayers: Player[]): number {
  const tier = clubTier(buyerPlayers)
  // Importance fit: penalise if player is way above or below club tier
  const impDiff = Math.abs(p.importance - tier)
  const impScore = Math.max(0, 1 - impDiff * 0.35)

  // Age fit: younger clubs (avg age matters less here) prefer 17–24, mid-table 23–28, top 24–30
  const idealAge = tier >= 3.5 ? 27 : tier >= 2.5 ? 25 : 22
  const ageDiff = Math.abs(p.age - idealAge)
  const ageScore = Math.max(0, 1 - ageDiff * 0.06)

  // Budget proportionality: prefer players whose fee is 10–40% of budget
  const fee = aiMarketFee(p.importance, p.age) * 1e6
  const budgetPct = buyer.budget > 0 ? fee / buyer.budget : 1
  const budgetScore = budgetPct < 0.1 ? 0.5 : budgetPct <= 0.4 ? 1 : Math.max(0, 1 - (budgetPct - 0.4) * 2)

  // Small random factor so it's not deterministic
  const rand = 0.85 + Math.random() * 0.3

  return impScore * ageScore * budgetScore * rand
}

function aiOfferReason(buyerName: string, group: string): string {
  const groupLabel: Record<string, string> = {
    GK: 'goalkeeper options', DEF: 'defensive options',
    MID: 'midfield options', ATT: 'attacking options',
  }
  return `${buyerName} are looking to strengthen their ${groupLabel[group] ?? 'squad'}`
}

const OFFERS_STORAGE_KEY = 'efl-received-offers-v1'

export function runAiTransfers(
  dyn: PlayerDyn,
  teams: AiTeamRef[],
  season: number,
): { dyn: PlayerDyn; news: NewsItem[]; transfers: TransferLogEntry[] } {
  const news: NewsItem[] = []
  const transfers: TransferLogEntry[] = []
  let newsId = Date.now()

  const effective = effectivePlayers(dyn)
  const teamOverrides = { ...(dyn.teamOverrides ?? {}) }
  const contracts     = { ...dyn.contracts }

  // Build roster snapshot (before any moves in this window)
  const roster = new Map<number, Player[]>()
  for (const ref of teams) {
    roster.set(ref.id, effective.filter(p => p.team === ref.name))
  }

  // Load existing human-team offers so we can append
  let pendingOffers: {
    id: string; playerId: number; playerName: string; fromClub: string
    fee: number; teamId: number; reason: string
  }[] = []
  try {
    const raw = localStorage.getItem(OFFERS_STORAGE_KEY)
    if (raw) pendingOffers = JSON.parse(raw)
    if (!Array.isArray(pendingOffers)) pendingOffers = []
  } catch { pendingOffers = [] }

  // AI-controlled teams only, worst-performing first (more incentive to buy)
  const aiTeams = teams
    .filter(t => !t.isHuman)
    .sort((a, b) => a.pts - b.pts)

  const claimed = new Set<number>()

  for (const buyer of aiTeams) {
    if ((buyer.budget ?? 0) < 500_000) continue

    const buyerRoster = roster.get(buyer.id) ?? []
    const needs = aiSquadNeeds(buyerRoster).sort(() => Math.random() - 0.5)
    if (needs.length === 0) continue

    // Worse teams try harder (1–3 signings), stronger teams 0–2
    const maxSignings = buyer.pts < 15 ? 3 : buyer.pts < 30 ? 2 : 1
    let signed = 0

    for (const need of needs) {
      if (signed >= maxSignings) break

      // Candidates from AI teams (execute immediately) and human teams (send offer)
      const aiCandidates = effective.filter(p => {
        if (claimed.has(p.id)) return false
        if (AI_POS_GROUP[p.pos] !== need) return false
        if (p.importance < 2) return false
        if (p.team === buyer.name) return false
        const sellerRef = teams.find(t => t.name === p.team)
        if (sellerRef?.isHuman) return false
        const fee = aiMarketFee(p.importance, p.age) * 1e6
        return fee <= (buyer.budget ?? 0) * 0.65
      })

      const humanCandidates = effective.filter(p => {
        if (claimed.has(p.id)) return false
        if (AI_POS_GROUP[p.pos] !== need) return false
        if (p.importance < 2) return false
        if (p.team === buyer.name) return false
        const sellerRef = teams.find(t => t.name === p.team)
        if (!sellerRef?.isHuman) return false
        const fee = aiMarketFee(p.importance, p.age) * 1e6
        return fee <= (buyer.budget ?? 0) * 0.65
      })

      // Score and pick best-fit from AI candidates
      const scoredAi = aiCandidates.map(p => ({ p, score: fitScore(p, buyer, buyerRoster) }))
      scoredAi.sort((a, b) => b.score - a.score)

      const target = scoredAi[0]?.p ?? null

      if (target) {
        const sellerClubPlayers = effective.filter(p => p.team === target.team)
        const sellerStars = sellerClubPlayers.filter(p => p.importance >= 4).length
        const prob = aiTransferProb(target.importance, target.age, sellerStars)
        if (Math.random() > prob) {
          // Transfer fell through — still try human offer below
        } else {
          const fee  = aiMarketFee(target.importance, target.age)
          const wage = Math.round((AI_BASE_WAGE[target.importance] ?? 3000) * (0.88 + Math.random() * 0.24) / 100) * 100

          teamOverrides[target.id] = { teamId: buyer.id, team: buyer.name }
          contracts[target.id] = { wage, yearsLeft: 2 + Math.floor(Math.random() * 3) }
          claimed.add(target.id)

          const sellerRef = teams.find(t => t.name === target.team)
          transfers.push({
            player: target.name,
            sellerName: target.team,
            sellerId: sellerRef?.id,
            buyerName: buyer.name,
            buyerId: buyer.id,
            fee,
          })
          news.push({
            id: String(newsId++),
            season,
            teamId: buyer.id,
            team: buyer.name,
            type: 'info',
            msg: `${buyer.name} sign ${target.name} from ${target.team} for £${fee.toFixed(1)}M.`,
          })
          signed++
          continue
        }
      }

      // If no AI transfer executed, maybe send offer to a human team player
      if (humanCandidates.length === 0) continue
      // Only ~40% chance per need to actually send a human offer (keeps inbox manageable)
      if (Math.random() > 0.4) continue

      const scoredHuman = humanCandidates.map(p => ({ p, score: fitScore(p, buyer, buyerRoster) }))
      scoredHuman.sort((a, b) => b.score - a.score)
      const htarget = scoredHuman[0].p

      // Don't send duplicate offers for the same player from the same club
      const alreadyOffered = pendingOffers.some(
        o => o.playerId === htarget.id && o.fromClub === buyer.name
      )
      if (alreadyOffered) continue

      const sellerRef = teams.find(t => t.name === htarget.team)
      if (!sellerRef) continue

      const fee = aiMarketFee(htarget.importance, htarget.age)
      pendingOffers.push({
        id: `ai-${newsId++}`,
        playerId: htarget.id,
        playerName: htarget.name,
        fromClub: buyer.name,
        fee,
        teamId: sellerRef.id,
        reason: aiOfferReason(buyer.name, need),
      })
      claimed.add(htarget.id)
      signed++
    }
  }

  // Persist updated human-team offers
  try {
    localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(pendingOffers))
  } catch { /* storage full — skip */ }

  const next: PlayerDyn = { ...dyn, teamOverrides, contracts }
  saveDyn(next)
  return { dyn: next, news, transfers }
}
