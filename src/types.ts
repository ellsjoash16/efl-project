export interface Stand {
  name: string
  type: 'Home End' | 'Away End' | 'Family' | 'VIP'
  cap: number
  tp: number
  occ: number
  atm: number
  upgrades: Upgrade[]
  baseTP: number
}

export interface Upgrade {
  id: string
  name: string
  cost: number
  effect: 'atmosphere' | 'occupancy' | 'revenue' | 'mood'
  val: number
  desc: string
}

export interface Sponsor {
  slot: string
  name: string
  value: number
  active: boolean
}

export interface Team {
  id: number
  name: string
  stadiumName: string
  stands: Stand[]
  // stats
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  pts: number
  form: ('W' | 'D' | 'L')[]
  // finance
  fanbase: number
  mood: number
  attp: number
  capacity: number
  commercial_rev: number
  matchday_rev: number
  stadium_debt: number
  wage_bill: number
  wageBudget: number  // weekly £ cap for human team
  transfer_budget: number
  transfers_in: number
  transfers_out: number
  sponsors: Sponsor[]
}

export interface Fixture {
  hi: number
  ai: number
  hg: string | number
  ag: string | number
  saved?: boolean
}

export interface Result {
  hn: string
  an: string
  hg: number
  ag: number
  riv: boolean
  md: number
}

export interface Notice {
  tid: number
  type: 'info' | 'warn' | 'good' | 'bad'
  msg: string
}

export interface Rivalry {
  a: number
  b: number
  type: string
  intensity: number
  h2h: [number, number, number]
  last: string | null
}

export interface SeasonSnapshot {
  season: number
  standings: { id: number; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }[]
  cupWinner?: string   // team name of cup winner, if cup was completed that season
}

// ── Cup competition ──────────────────────────────────────────────────────────

export interface CupTeam {
  id: string          // 'league-{id}'
  name: string
  leagueId?: number   // set for all teams (all are league clubs now)
  isQualifier?: boolean  // true = top-4 qualifier (bye in R1)
}

export type CupRound = 'R16' | 'QF' | 'SF' | 'F'

export interface CupMatch {
  id: string          // e.g. 'R1-0', 'QF-2', 'F-0'
  round: CupRound
  position: number    // 0-based within round
  homeId: string | null   // null = TBD
  awayId: string | null
  homeGoals: number | null
  awayGoals: number | null
  penWinnerId?: string    // penalty shootout winner id (drawn matches)
}

export interface CupState {
  season: number
  externalTeams: string[]   // kept for backwards compat, unused
  teams: CupTeam[]          // all 12 league teams
  matches: CupMatch[]       // R1 (4) + QF (4) + SF (2) + F (1) = 11
}

// ── Player database ──────────────────────────────────────────────────────────

export interface Player {
  id: number
  name: string
  teamId: number
  team: string
  pos: 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'
  age: number
  importance: number  // 1–5 stars
  nat: string
}

// ── News feed ─────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string
  season: number
  teamId: number
  team: string
  type: 'info' | 'good' | 'bad' | 'warn'
  msg: string
}

// ── Transfer log ─────────────────────────────────────────────────────────────

export interface TransferLogEntry {
  player: string
  sellerName: string
  sellerId?: number   // set if seller is a game club
  buyerName: string
  buyerId?: number    // set if buyer is a game club
  fee: number         // in millions
}

export interface GameState {
  season: number
  matchday: number
  cMDs: Set<number>
  mdFx: Fixture[][]
  results: Result[]
  notices: Notice[]
  teams: Team[]
  rivalries: Rivalry[]
  seasonHistory: SeasonSnapshot[]
  transferLog: TransferLogEntry[]
  newsLog: NewsItem[]
  cup: CupState | null
  userTeamIds: number[]  // teams managed by human players
}

export interface UpgradeTemplate {
  id: string
  name: string
  cost: number
  effect: 'atmosphere' | 'occupancy' | 'revenue' | 'mood'
  val: number
  desc: string
}

export interface StadiumTierStand {
  name: string
  type: 'Home End' | 'Away End' | 'Family' | 'VIP'
  cap: number
  tp: number
  occ: number
  atm: number
}

export interface StadiumTier {
  id: string
  name: string
  capacity: number
  cm: number
  desc: string
  stands: StadiumTierStand[]
  features: string[]
}
