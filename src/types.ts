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

export interface GameState {
  season: number
  matchday: number
  cMDs: Set<number>
  mdFx: Fixture[][]
  results: Result[]
  notices: Notice[]
  teams: Team[]
  rivalries: Rivalry[]
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
