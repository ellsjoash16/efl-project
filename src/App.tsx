import { useEffect } from 'react'
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
import { seasonLabel, loadFromStorage, makeInitialState, exportSave, encodeShareCode, decodeShareCode } from '@/lib/gameLogic'

function AppInner() {
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
        const ns = loadFromStorage()
        // Try to hydrate from the raw JSON directly
        if (!raw?.S?.teams || raw.S.teams.length !== 12) { alert('Invalid save file.'); return }
        if (!raw.S.mdFx || raw.S.mdFx.length !== 22) { alert('Invalid save file.'); return }
        const loaded = {
          ...raw.S,
          cMDs: new Set<number>(Array.isArray(raw.S.cMDs) ? raw.S.cMDs : []),
          teams: raw.S.teams.map((t: typeof S.teams[0], i: number) => ({
            ...t,
            id: typeof t.id === 'number' ? t.id : i,
            stands: (t.stands || []).map((st: typeof S.teams[0]['stands'][0]) => ({
              ...st,
              upgrades: Array.isArray(st.upgrades) ? st.upgrades : [],
              baseTP: typeof st.baseTP === 'number' ? st.baseTP : st.tp,
            })),
            sponsors: Array.isArray(t.sponsors) ? t.sponsors : [],
            form: Array.isArray(t.form) ? t.form : [],
            transfers_in: t.transfers_in ?? 0,
            transfers_out: t.transfers_out ?? 0,
          })),
        }
        setS(loaded)
        scheduleSave(loaded)
        void ns // suppress unused warning
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
      alert('Share link copied! Send it to your friend — they just open it and the save loads automatically.')
    } catch {
      prompt('Copy this share link:', url)
    }
  }

  function handleLoadCode() {
    const input = prompt('Paste a share link or code:')
    if (!input) return
    let code = input.trim()
    try {
      const u = new URL(code)
      code = u.searchParams.get('s') ?? code
    } catch { /* raw code, use as-is */ }
    const loaded = decodeShareCode(code)
    if (!loaded) { alert('Invalid share link or code.'); return }
    setS(loaded)
    scheduleSave(loaded)
    history.replaceState(null, '', location.pathname)
  }

  return (
    <div className="max-w-[1100px] mx-auto p-3 sm:p-4">
      {/* Header */}
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
          <Button size="sm" variant="outline" onClick={handleShare}>Share</Button>
          <Button size="sm" variant="outline" onClick={handleLoadCode}>Load code</Button>
          <Button size="sm" variant="outline" onClick={handleReset}>New game</Button>
        </div>
      </div>

      {/* Main tabs */}
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

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  )
}
