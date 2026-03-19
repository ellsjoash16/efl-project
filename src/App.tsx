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
import { seasonLabel, makeInitialState, exportSave, encodeShareCode, decodeShareCode } from '@/lib/gameLogic'
import { supabase, generateRoomCode, loadRoom, saveRoom, deserializeState } from '@/lib/supabase'

const ROOM_KEY = 'efl-room-code'

function RoomGate({ children }: { children: (roomCode: string) => React.ReactNode }) {
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem(ROOM_KEY))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { S, setS, scheduleSave } = useGame()

  // On mount, if we have a saved room code, load its state
  useEffect(() => {
    if (!roomCode) return
    loadRoom(roomCode).then(state => {
      if (state) { setS(state); scheduleSave(state) }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setLoading(true)
    const code = generateRoomCode()
    await saveRoom(code, S)
    localStorage.setItem(ROOM_KEY, code)
    setRoomCode(code)
    setLoading(false)
  }

  async function handleJoin() {
    const code = input.trim().toUpperCase()
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
    setLoading(false)
  }

  function handleLeave() {
    localStorage.removeItem(ROOM_KEY)
    setRoomCode(null)
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
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
              <Button onClick={handleJoin} disabled={loading || !input}>Join</Button>
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
        </div>
      </div>
    )
  }

  return <>{children(roomCode)}<RoomSync roomCode={roomCode} onLeave={handleLeave} /></>
}

function RoomSync({ roomCode, onLeave }: { roomCode: string; onLeave: () => void }) {
  const { S, setS } = useGame()
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemote = useRef(false)

  // Push local changes to Supabase
  useEffect(() => {
    if (isRemote.current) { isRemote.current = false; return }
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => { saveRoom(roomCode, S) }, 600)
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
        const loaded = deserializeState(newRow.state as Record<string, unknown>)
        if (loaded) { isRemote.current = true; setS(loaded) }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 shadow-sm text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="text-muted-foreground">Room</span>
      <span className="font-mono font-semibold tracking-widest">{roomCode}</span>
      <button
        className="ml-1 text-muted-foreground hover:text-foreground"
        onClick={async () => {
          await navigator.clipboard.writeText(roomCode).catch(() => {})
          alert(`Room code copied: ${roomCode}`)
        }}
      >copy</button>
      <span className="text-border">·</span>
      <button className="text-muted-foreground hover:text-red-500" onClick={onLeave}>leave</button>
    </div>
  )
}

function AppInner({ roomCode }: { roomCode: string }) {
  const { S, setS, saveStatus, manualSave, scheduleSave } = useGame()

  // Auto-load from ?s= share param on first render
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('s')
    if (!code) return
    const loaded = decodeShareCode(code)
    if (!loaded) return
    history.replaceState(null, '', location.pathname)
    setS(loaded)
    scheduleSave(loaded)
  }, [])

  function handleImport() {
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
    if (!confirm('Start a fresh game? All progress will be lost.')) return
    const fresh = makeInitialState()
    setS(fresh)
    scheduleSave(fresh)
  }

  async function handleShare() {
    const code = encodeShareCode(S)
    const url = `${location.origin}${location.pathname}?s=${encodeURIComponent(code)}`
    try {
      await navigator.clipboard.writeText(url)
      alert('Share link copied!')
    } catch {
      prompt('Copy this share link:', url)
    }
  }

  void roomCode // used by RoomSync above

  return (
    <div className="max-w-[1100px] mx-auto p-3 sm:p-4">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">
            Season {seasonLabel(S.season)}
          </p>
          <h1 className="text-lg sm:text-xl font-medium">Elite Football League</h1>
          <p className="text-xs text-muted-foreground mt-0.5">MD {S.matchday}/22</p>
          {saveStatus && <p className="text-[11px] text-muted-foreground">{saveStatus}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={manualSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => exportSave(S, S.season)}>Export</Button>
          <Button size="sm" variant="outline" onClick={handleImport}>Import</Button>
          <Button size="sm" variant="outline" onClick={handleShare}>Share link</Button>
          <Button size="sm" variant="outline" onClick={handleReset}>New game</Button>
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
