import { useEffect, useRef, useState } from 'react'
import { GameProvider, useGame } from '@/store/gameContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LeagueTable } from '@/components/tabs/LeagueTable'
import { Results } from '@/components/tabs/Results'
import { Revenue } from '@/components/tabs/Revenue'
import { Fans } from '@/components/tabs/Fans'
import { Stadiums } from '@/components/tabs/Stadiums'
import { Sponsors } from '@/components/tabs/Sponsors'
import { Rivals } from '@/components/tabs/Rivals'
import { TransferMarket } from '@/components/tabs/TransferMarket'
import { seasonLabel, makeInitialState, exportSave } from '@/lib/gameLogic'
import { supabase, generateRoomCode, loadRoom, saveRoom, deserializeState } from '@/lib/supabase'

const ROOM_KEY = 'efl-room-code'
const LAST_ROOM_KEY = 'efl-last-room-code'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('efl-theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark(d => !d) }
}

function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
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
  const { dark, toggle: toggleTheme } = useTheme()
  const { S, setS, scheduleSave } = useGame()

  // On mount, if we have a saved room code (or one from URL), load its state
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
        // Room from URL doesn't exist — go back to join screen with error
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
        <div className="fixed top-3 right-3"><ThemeToggle dark={dark} toggle={toggleTheme} /></div>
        <div className="w-full max-w-sm space-y-6">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Elite Football League</p>
            <h1 className="text-2xl font-semibold">Join a room</h1>
            <p className="text-sm text-muted-foreground mt-1">Rooms let you and a friend share the same save in real time.</p>
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

  // Push local changes to Supabase
  useEffect(() => {
    if (isRemote.current) { isRemote.current = false; return }
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      localSavedAt.current = Date.now()
      saveRoom(roomCode, S)
    }, 600)
  }, [S]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to remote changes
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
        // Reject updates that are older than our last local save (stale client overwrite prevention)
        const remoteSavedAt = typeof rawState._savedAt === 'number' ? rawState._savedAt : 0
        if (remoteSavedAt > 0 && remoteSavedAt < localSavedAt.current) return
        const loaded = deserializeState(rawState)
        if (loaded) { isRemote.current = true; setS(loaded) }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed bottom-3 right-2 sm:right-3 z-50 flex flex-col items-end gap-1 max-w-[calc(100vw-1rem)]">
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

function AppInner({ roomCode }: { roomCode: string }) {
  const { S, setS, saveStatus, manualSave, scheduleSave } = useGame()
  const [copied, setCopied] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()

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

  void roomCode // used by RoomSync above

  return (
    <div className="max-w-[1100px] mx-auto p-3 sm:p-4 pb-20">
      <div className="mb-4">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">
              Season {seasonLabel(S.season)}
            </p>
            <h1 className="text-lg sm:text-xl font-medium">Elite Football League</h1>
            <p className="text-xs text-muted-foreground mt-0.5">MD {S.matchday}/22 &nbsp;·&nbsp; Room <span className="font-mono font-semibold tracking-widest">{roomCode}</span></p>
            {saveStatus && <p className="text-[11px] text-muted-foreground">{saveStatus}</p>}
          </div>
          <ThemeToggle dark={dark} toggle={toggleTheme} />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Button size="sm" variant="outline" className="shrink-0" onClick={manualSave}>Save</Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => exportSave(S, S.season)}>Export</Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={handleImport}>Import</Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={handleShare}>{copied ? 'Copied!' : 'Share link'}</Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={handleReset}>New game</Button>
        </div>
      </div>

      <Tabs defaultValue="table">
        <div className="overflow-x-auto mb-4">
          <TabsList className="flex h-auto gap-1 w-max min-w-full justify-start">
            {[
              ['table', 'League table'],
              ['results', 'Enter results'],
              ['revenue', 'Revenue & budgets'],
              ['fans', 'Fans & mood'],
              ['stadiums', 'Stadiums'],
              ['sponsors', 'Sponsorships'],
              ['rivals', 'Rivalries'],
              ['transfers', 'Transfer market'],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="text-xs sm:text-[13px] whitespace-nowrap">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="table"><LeagueTable /></TabsContent>
        <TabsContent value="results"><Results /></TabsContent>
        <TabsContent value="revenue"><Revenue /></TabsContent>
        <TabsContent value="fans"><Fans /></TabsContent>
        <TabsContent value="stadiums"><Stadiums /></TabsContent>
        <TabsContent value="sponsors"><Sponsors /></TabsContent>
        <TabsContent value="rivals"><Rivals /></TabsContent>
        <TabsContent value="transfers"><TransferMarket /></TabsContent>
      </Tabs>
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
