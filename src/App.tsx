import { useEffect, useRef, useState } from 'react'
import { GameProvider, useGame } from '@/store/gameContext'
import { Button } from '@/components/ui/button'
import { LeagueTable } from '@/components/tabs/LeagueTable'
import { Results } from '@/components/tabs/Results'
import { Revenue } from '@/components/tabs/Revenue'
import { Fans } from '@/components/tabs/Fans'
import { Stadiums } from '@/components/tabs/Stadiums'
import { Sponsors } from '@/components/tabs/Sponsors'
import { Rivals } from '@/components/tabs/Rivals'
import { TransferMarket } from '@/components/tabs/TransferMarket'
import { Cup } from '@/components/tabs/Cup'
import { Players } from '@/components/tabs/Players'
import { Contracts } from '@/components/tabs/Contracts'
import { News } from '@/components/tabs/News'
import { Trophies } from '@/components/tabs/Trophies'
import { seasonLabel, makeInitialState, exportSave } from '@/lib/gameLogic'
import { supabase, generateRoomCode, loadRoom, saveRoom, deserializeState } from '@/lib/supabase'

const ROOM_KEY = 'efl-room-code'
const LAST_ROOM_KEY = 'efl-last-room-code'

type ThemeMode = 'light' | 'dark' | 'system'

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const s = localStorage.getItem('efl-theme')
    return (s === 'light' || s === 'dark' || s === 'system') ? s : 'system'
  })

  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && prefersDark))
    }
    apply()
    localStorage.setItem('efl-theme', mode)
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode])

  const cycle = () => setMode(m => m === 'light' ? 'dark' : m === 'dark' ? 'system' : 'light')
  return { mode, cycle }
}

function ThemeToggle({ mode, cycle }: { mode: ThemeMode; cycle: () => void }) {
  return (
    <button
      onClick={cycle}
      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={`Theme: ${mode}`}
    >
      {mode === 'light' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : mode === 'dark' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      )}
    </button>
  )
}

function RoomGate({ children }: { children: (roomCode: string) => React.ReactNode }) {
  const urlRoom = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? null
  const [roomCode, setRoomCode] = useState<string | null>(() => urlRoom ?? localStorage.getItem(ROOM_KEY))
  const [input, setInput] = useState('')
  const lastRoom = localStorage.getItem(LAST_ROOM_KEY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roomLoaded, setRoomLoaded] = useState(false)
  const { mode, cycle } = useTheme()
  const { S, setS, scheduleSave } = useGame()

  useEffect(() => {
    if (!roomCode) return
    if (urlRoom) history.replaceState(null, '', location.pathname)
    loadRoom(roomCode).then(state => {
      if (state) {
        setS(state)
        scheduleSave(state)
        localStorage.setItem(ROOM_KEY, roomCode)
        setRoomLoaded(true)
      } else if (urlRoom) {
        setRoomCode(null)
        setError('Room not found. Check the code and try again.')
      } else {
        setRoomLoaded(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setLoading(true)
    const code = generateRoomCode()
    await saveRoom(code, S)
    localStorage.setItem(ROOM_KEY, code)
    setRoomCode(code)
    setRoomLoaded(true)
    setLoading(false)
  }

  async function handleJoin(codeOverride?: string) {
    const code = (codeOverride ?? input).trim().toUpperCase()
    if (!code) return
    setLoading(true)
    setError('')
    const state = await loadRoom(code)
    if (!state) {
      setError('Room not found. Check the code and try again.')
      setLoading(false)
      return
    }
    setS(state)
    scheduleSave(state)
    localStorage.setItem(ROOM_KEY, code)
    setRoomCode(code)
    setRoomLoaded(true)
    setLoading(false)
  }

  async function handleSwitch(code: string) {
    if (roomCode) localStorage.setItem(LAST_ROOM_KEY, roomCode)
    await handleJoin(code)
  }

  function handleLeave() {
    if (roomCode) localStorage.setItem(LAST_ROOM_KEY, roomCode)
    localStorage.removeItem(ROOM_KEY)
    setRoomCode(null)
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="fixed top-3 right-3"><ThemeToggle mode={mode} cycle={cycle} /></div>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 mb-2">
            <img src="/nexa-logo.png" alt="Nexa Leading Division" className="w-20 h-20 object-contain" />
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Nexa Leading Division</p>
              <h1 className="text-2xl font-semibold">Join a room</h1>
              <p className="text-sm text-muted-foreground mt-1">Rooms let you and a friend share the same save in real time.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Have a room code?</p>
            <div className="flex gap-2">
              <input
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. ABC123"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                maxLength={6}
              />
              <Button onClick={() => handleJoin()} disabled={loading || !input}>Join</Button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or</span></div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create new room'}
          </Button>

          {lastRoom && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground text-xs"
              disabled={loading}
              onClick={() => { setInput(lastRoom) }}
            >
              Rejoin last room: <span className="font-mono font-semibold tracking-widest ml-1">{lastRoom}</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return <>{children(roomCode)}{roomLoaded && <RoomSync roomCode={roomCode} onLeave={handleLeave} onSwitch={handleSwitch} loading={loading} switchError={error} />}</>
}

function RoomSync({ roomCode, onLeave, onSwitch, loading, switchError }: { roomCode: string; onLeave: () => void; onSwitch: (code: string) => Promise<void>; loading: boolean; switchError: string }) {
  const { S, setS } = useGame()
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemote = useRef(false)
  const localSavedAt = useRef<number>(0)
  const [switching, setSwitching] = useState(false)
  const [switchInput, setSwitchInput] = useState('')

  useEffect(() => {
    if (isRemote.current) { isRemote.current = false; return }
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      localSavedAt.current = Date.now()
      saveRoom(roomCode, S)
    }, 600)
  }, [S]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `code=eq.${roomCode}`,
      }, payload => {
        const newRow = payload.new as Record<string, unknown>
        if (!newRow?.state) return
        const rawState = newRow.state as Record<string, unknown>
        const remoteSavedAt = typeof rawState._savedAt === 'number' ? rawState._savedAt : 0
        if (remoteSavedAt > 0 && remoteSavedAt < localSavedAt.current) return
        const loaded = deserializeState(rawState)
        if (loaded) { isRemote.current = true; setS(loaded) }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed bottom-28 sm:bottom-3 right-2 sm:right-3 z-50 flex flex-col items-end gap-1 max-w-[calc(100vw-1rem)]">
      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 shadow-sm text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-muted-foreground">Room</span>
        <span className="font-mono font-semibold tracking-widest">{roomCode}</span>
        <button
          className="ml-1 text-muted-foreground hover:text-foreground"
          onClick={async () => {
            const url = `${location.origin}${location.pathname}?room=${roomCode}`
            await navigator.clipboard.writeText(url).catch(() => {})
            alert(`Share link copied!`)
          }}
        >copy link</button>
        <span className="text-border">·</span>
        <button className="text-muted-foreground hover:text-foreground" onClick={() => { setSwitching(s => !s); setSwitchInput('') }}>
          switch room
        </button>
        <span className="text-border">·</span>
        <button className="text-muted-foreground hover:text-red-500" onClick={onLeave}>leave</button>
      </div>
      {switching && (
        <div className="flex flex-col gap-1 bg-card border rounded-lg px-3 py-2 shadow-sm text-xs w-full">
          <div className="flex gap-1.5">
            <input
              autoFocus
              className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Room code"
              value={switchInput}
              onChange={e => setSwitchInput(e.target.value.toUpperCase())}
              onKeyDown={async e => {
                if (e.key === 'Enter' && switchInput.length === 6) {
                  await onSwitch(switchInput)
                  setSwitching(false)
                }
                if (e.key === 'Escape') setSwitching(false)
              }}
              maxLength={6}
              disabled={loading}
            />
            <button
              className="px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
              disabled={loading || switchInput.length !== 6}
              onClick={async () => { await onSwitch(switchInput); setSwitching(false) }}
            >
              {loading ? '…' : 'Go'}
            </button>
          </div>
          {switchError && <p className="text-red-500">{switchError}</p>}
        </div>
      )}
    </div>
  )
}

const NAV_SECTIONS = [
  {
    label: 'League',
    items: [
      { id: 'table',     label: 'League Table',    short: 'Table',    icon: 'M3 10h18M3 14h18M3 6h18M3 18h18' },
      { id: 'results',   label: 'Enter Results',   short: 'Results',  icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
      { id: 'cup',       label: 'Cup',             short: 'Cup',      icon: '', imgSrc: '/cup-logo.png' },
      { id: 'rivals',    label: 'Rivalries',       short: 'Rivals',   icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { id: 'news',      label: 'News',            short: 'News',     icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
    ],
  },
  {
    label: 'Squad',
    items: [
      { id: 'players',   label: 'Players',         short: 'Players',  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
      { id: 'contracts', label: 'Transfer Hub',    short: 'Hub',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'transfers', label: 'Transfer Market', short: 'Market',   icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    ],
  },
  {
    label: 'Club',
    items: [
      { id: 'revenue',   label: 'Revenue',         short: 'Revenue',  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'fans',      label: 'Fans & Mood',     short: 'Fans',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { id: 'stadiums',  label: 'Stadiums',        short: 'Stadium',  icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { id: 'sponsors',  label: 'Sponsorships',    short: 'Sponsors', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
      { id: 'trophies',  label: 'Trophy Cabinet',  short: 'Trophies', icon: 'M5 3h14M5 3a2 2 0 00-2 2v3a6 6 0 0012 0V5a2 2 0 00-2-2M5 3l-.5 9.5A3.5 3.5 0 008 16h8a3.5 3.5 0 003.5-3.5L19 3' },
    ],
  },
]

const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

const CUP_THEME = {
  gradient: 'linear-gradient(180deg, #0a0e24 0%, #1a2d6b 100%)',
  accent: '#4169e1',
  accentBg: 'rgba(65,105,225,0.25)',
}
const DEFAULT_THEME = {
  gradient: 'linear-gradient(180deg, #0a1820 0%, #2E4A52 100%)',
  accent: '#9B6BB5',
  accentBg: 'rgba(155,107,181,0.25)',
}

function Sidebar({ active, onSelect, mode, cycle }: { active: string; onSelect: (id: string) => void; mode: ThemeMode; cycle: () => void }) {
  const isCup = active === 'cup'
  const theme = isCup ? CUP_THEME : DEFAULT_THEME

  return (
    <aside className="flex flex-col w-56 shrink-0 min-h-screen border-r border-white/10 transition-all duration-500" style={{ background: theme.gradient }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {isCup ? (
          <img src="/cup-logo.png" alt="Elite X League" className="w-9 h-9 object-contain shrink-0" />
        ) : (
          <img src="/nexa-logo.png" alt="Nexa Leading Division" className="w-9 h-9 object-contain shrink-0" />
        )}
        <div>
          <p className="text-white font-bold text-sm leading-none tracking-wide">{isCup ? 'ELITE X' : 'NEXA'}</p>
          <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: theme.accent }}>{isCup ? 'League Cup' : 'Leading Division'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-1">
            <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30 select-none">
              {section.label}
            </p>
            {section.items.map(item => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left relative group ${
                    isActive ? 'text-white' : 'text-white/55 hover:text-white/90'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: theme.accent }} />
                  )}
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all ${
                      isActive ? 'text-white' : 'group-hover:bg-white/8'
                    }`}
                    style={isActive ? { background: theme.accentBg } : {}}
                  >
                    {item.imgSrc ? (
                      <img src={item.imgSrc} alt={item.label} className="w-4 h-4 object-contain" style={{ opacity: isActive ? 1 : 0.55 }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={item.icon} />
                      </svg>
                    )}
                  </span>
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Theme toggle — tucked at bottom */}
      <div className="px-4 py-3 border-t border-white/10 flex justify-end">
        <ThemeToggle mode={mode} cycle={cycle} />
      </div>
    </aside>
  )
}

function MobileNav({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const activeSectionLabel = NAV_SECTIONS.find(s => s.items.some(i => i.id === active))?.label ?? NAV_SECTIONS[0].label
  const currentItems = NAV_SECTIONS.find(s => s.label === activeSectionLabel)?.items ?? NAV_SECTIONS[0].items
  const isCup = active === 'cup'
  const theme = isCup ? CUP_THEME : DEFAULT_THEME

  function handleSectionClick(sectionLabel: string) {
    const section = NAV_SECTIONS.find(s => s.label === sectionLabel)!
    if (!section.items.some(i => i.id === active)) onSelect(section.items[0].id)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-500"
      style={{ background: theme.gradient }}
    >
      {/* Items for active section */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {currentItems.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[9px] font-medium transition-all relative"
              style={isActive ? { color: '#fff' } : { color: 'rgba(255,255,255,0.45)' }}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-b-full" style={{ background: theme.accent }} />
              )}
              <span
                className="flex items-center justify-center w-7 h-7 rounded-xl transition-all"
                style={isActive ? { background: theme.accentBg } : {}}
              >
                {item.imgSrc ? (
                  <img src={item.imgSrc} alt={item.label} className="w-4 h-4 object-contain" style={{ opacity: isActive ? 1 : 0.5 }} />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon} />
                  </svg>
                )}
              </span>
              <span className="uppercase tracking-wide leading-none">{item.short}</span>
            </button>
          )
        })}
      </div>
      {/* Section tabs */}
      <div className="flex">
        {NAV_SECTIONS.map(section => {
          const isActive = activeSectionLabel === section.label
          return (
            <button
              key={section.label}
              onClick={() => handleSectionClick(section.label)}
              className="flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-all"
              style={isActive ? { color: theme.accent } : { color: 'rgba(255,255,255,0.3)' }}
            >
              {section.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AppInner({ roomCode }: { roomCode: string }) {
  const { S, setS, saveStatus, manualSave, scheduleSave } = useGame()
  const [copied, setCopied] = useState(false)
  const [activePage, setActivePage] = useState('table')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const { mode, cycle } = useTheme()

  function handleImport() {
    if (!confirm('Import a save file? This will overwrite the current save for everyone in this room.')) return
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'application/json'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return
      try {
        const txt = await f.text()
        const raw = JSON.parse(txt)
        if (!raw?.S?.teams || raw.S.teams.length !== 12) { alert('Invalid save file.'); return }
        if (!raw.S.mdFx || raw.S.mdFx.length !== 22) { alert('Invalid save file.'); return }
        const loaded = deserializeState({ ...raw.S, cMDs: Array.isArray(raw.S.cMDs) ? raw.S.cMDs : [] })
        if (!loaded) { alert('Could not read save file.'); return }
        setS(loaded)
        scheduleSave(loaded)
      } catch {
        alert('Could not import save file.')
      }
    }
    inp.click()
  }

  function handleReset() {
    const answer = prompt('This will permanently wipe the save for everyone in this room.\n\nType RESET to confirm:')
    if (answer !== 'RESET') return
    const fresh = makeInitialState()
    setS(fresh)
    scheduleSave(fresh)
  }

  async function handleShare() {
    const url = `${location.origin}${location.pathname}?room=${roomCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this share link:', url)
    }
  }

  void roomCode

  const PAGE_MAP: Record<string, React.ReactNode> = {
    table:     <LeagueTable />,
    results:   <Results />,
    revenue:   <Revenue />,
    fans:      <Fans />,
    stadiums:  <Stadiums />,
    sponsors:  <Sponsors />,
    rivals:    <Rivals />,
    transfers: <TransferMarket />,
    cup:       <Cup />,
    players:   <Players />,
    contracts: <Contracts />,
    news:      <News />,
    trophies:  <Trophies />,
  }

  const currentNav = NAV_ITEMS.find(n => n.id === activePage)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <Sidebar active={activePage} onSelect={setActivePage} mode={mode} cycle={cycle} />
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile logo */}
            <img src="/nexa-logo.png" alt="Nexa" className="w-7 h-7 object-contain lg:hidden shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-none truncate">{currentNav?.label ?? 'Nexa Leading Division'}</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Season {seasonLabel(S.season)} &nbsp;·&nbsp; MD {S.matchday}/22
                {saveStatus && <> &nbsp;·&nbsp; {saveStatus}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 hidden sm:flex" onClick={manualSave}>Save</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 hidden sm:flex" onClick={() => exportSave(S, S.season)}>Export</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 hidden sm:flex" onClick={handleImport}>Import</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleShare}>{copied ? 'Copied!' : 'Share'}</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 hidden sm:flex" onClick={handleReset}>New game</Button>
            {/* Mobile overflow menu */}
            <div className="sm:hidden relative ml-0.5">
              <button
                onClick={() => setShowMoreMenu(m => !m)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="More options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
                </svg>
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg py-1 z-50 min-w-[130px]">
                  <button className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors" onClick={() => { manualSave(); setShowMoreMenu(false) }}>Save</button>
                  <button className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors" onClick={() => { exportSave(S, S.season); setShowMoreMenu(false) }}>Export</button>
                  <button className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors" onClick={() => { handleImport(); setShowMoreMenu(false) }}>Import</button>
                  <button className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors text-destructive" onClick={() => { handleReset(); setShowMoreMenu(false) }}>New game</button>
                  <div className="border-t my-1" />
                  <button className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between" onClick={cycle}>
                    <span>Theme</span>
                    <span className="text-xs text-muted-foreground capitalize">{mode}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 pb-36 lg:pb-6">
          {PAGE_MAP[activePage]}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <MobileNav active={activePage} onSelect={setActivePage} />
      </div>
    </div>
  )
}

function AppWithRoom() {
  return (
    <RoomGate>
      {roomCode => <AppInner roomCode={roomCode} />}
    </RoomGate>
  )
}

export default function App() {
  return (
    <GameProvider>
      <AppWithRoom />
    </GameProvider>
  )
}
