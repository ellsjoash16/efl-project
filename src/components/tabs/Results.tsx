import { useRef, useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { moodFromPos, avgTicket } from '@/lib/gameLogic'
import { TEAM_DEFS, NFX } from '@/data'
import type { Team } from '@/types'
import { loadDyn, runAiTransfers, type AiTeamRef } from '@/lib/playerState'

// ─── Photo import helpers ─────────────────────────────────────────────────────

const ANTHROPIC_KEY = 'efl-anthropic-key'

function fuzzyMatchTeam(name: string, teams: Team[]): number | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = norm(name)
  if (!target) return null
  const exact = teams.find(t => norm(t.name) === target)
  if (exact) return exact.id
  let best: Team | null = null, bestScore = 0
  for (const team of teams) {
    const tn = norm(team.name)
    let score = 0
    for (let i = 0; i < target.length - 2; i++) {
      if (tn.includes(target.slice(i, i + 3))) score++
    }
    if (score > bestScore) { bestScore = score; best = team }
  }
  return bestScore > 1 ? best?.id ?? null : null
}

function parseLeagueText(text: string, teams: Team[]) {
  const pat = /([A-Za-z .'&-]+?)\s+(\d+)\s*[-–—]\s*(\d+)\s+([A-Za-z .'&-]+)/g
  const out: { hi: number; ai: number; hg: number; ag: number }[] = []
  let m: RegExpExecArray | null
  while ((m = pat.exec(text)) !== null) {
    const hi = fuzzyMatchTeam(m[1].trim(), teams)
    const ai = fuzzyMatchTeam(m[4].trim(), teams)
    if (hi != null && ai != null && hi !== ai) {
      out.push({ hi, ai, hg: +m[2], ag: +m[3] })
    }
  }
  return out
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function callClaudeVision(apiKey: string, b64: string, mt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } },
        { type: 'text', text: 'Extract every football match score from this screenshot. Return ONLY JSON array: [{"home":"Team","homeGoals":2,"awayGoals":1,"away":"Team"}]. Return [] if none found.' },
      ]}],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const d = await res.json()
  return d.content?.[0]?.text ?? '[]'
}

export function Results() {
  const { S, setS, scheduleSave } = useGame()
  const [mdIndex, setMdIndex] = useState(Math.min(S.matchday, 21))

  // Photo import
  const fileRef = useRef<HTMLInputElement>(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(ANTHROPIC_KEY) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [pending, setPending] = useState<{ hi: number; ai: number; hg: number; ag: number }[]>([])

  function saveKey(k: string) { setApiKey(k); localStorage.setItem(ANTHROPIC_KEY, k) }

  async function handlePhoto(file: File) {
    setImportError(''); setPending([])
    if (apiKey) {
      setImporting(true)
      try {
        const b64 = await fileToBase64(file)
        const mt = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        const text = await callClaudeVision(apiKey, b64, mt)
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const raw = JSON.parse(jsonMatch[0]) as { home: string; homeGoals: number; awayGoals: number; away: string }[]
          const mapped = parseLeagueText(
            raw.map(r => `${r.home} ${r.homeGoals}-${r.awayGoals} ${r.away}`).join('\n'),
            S.teams
          )
          if (mapped.length) setPending(mapped)
          else setImportError('No league team names matched. Try text paste.')
        } else {
          setImportError('No scores found. Try text paste below.')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        setImportError(msg.includes('fetch') || msg.includes('CORS')
          ? 'Browser blocked the API call. Use text paste below.'
          : `Error: ${msg}`)
      } finally { setImporting(false) }
    } else {
      setImportError('No API key set — use text paste below.')
    }
  }

  function applyFromText() {
    const mapped = parseLeagueText(pasteText, S.teams)
    if (!mapped.length) { setImportError('No scores found. Format: "Team A 2-1 Team B" per line.'); return }
    setPending(mapped)
  }

  function confirmPending() {
    const done = S.cMDs.has(mdIndex)
    if (done) { alert('This matchday is already saved. Unlock it first.'); return }
    setS(prev => {
      const newFx = prev.mdFx.map((mdfx, mi) => {
        if (mi !== mdIndex) return mdfx
        const updated = [...mdfx]
        pending.forEach((r, pi) => {
          if (pi < NFX) updated[pi] = { ...updated[pi], hi: r.hi, ai: r.ai, hg: r.hg, ag: r.ag }
        })
        return updated
      })
      return { ...prev, mdFx: newFx }
    })
    setPending([]); setPasteText(''); setImportError('')
  }

  const done = S.cMDs.has(mdIndex)
  const fx = S.mdFx[mdIndex]

  function updateFixture(fi: number, field: 'hi' | 'ai' | 'hg' | 'ag', value: string | number) {
    setS(prev => {
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex
          ? mdfx.map((f, i) => i === fi ? { ...f, [field]: value } : f)
          : mdfx
      )
      return { ...prev, mdFx: newFx }
    })
  }

  function unlockMatchday() {
    if (!done) return
    setS(prev => {
      const newTeams = prev.teams.map(t => ({ ...t }))
      const newRivals = prev.rivalries.map(r => ({ ...r, h2h: [...r.h2h] as [number,number,number] }))
      prev.mdFx[mdIndex].filter(f => f.saved).forEach(f => {
        const hg = parseInt(String(f.hg)), ag = parseInt(String(f.ag))
        const h = newTeams[f.hi], a = newTeams[f.ai]
        const riv = newRivals.find(r => (r.a === f.hi && r.b === f.ai) || (r.b === f.hi && r.a === f.ai))
        h.p--; a.p--; h.gf -= hg; h.ga -= ag; a.gf -= ag; a.ga -= hg
        if (hg > ag) {
          h.w--; h.pts -= 3; a.l--
          h.fanbase = Math.max(h.fanbase - Math.round(400 * (riv ? 1.6 : 1)), 1000)
          a.fanbase = Math.min(a.fanbase + 100, 2e6)
          if (riv) { riv.h2h[0]--; riv.intensity = Math.max(0, riv.intensity - 2) }
        } else if (hg < ag) {
          a.w--; a.pts -= 3; h.l--
          a.fanbase = Math.max(a.fanbase - Math.round(400 * (riv ? 1.6 : 1)), 1000)
          h.fanbase = Math.min(h.fanbase + 100, 2e6)
          if (riv) { riv.h2h[2]--; riv.intensity = Math.max(0, riv.intensity - 2) }
        } else {
          h.d--; a.d--; h.pts--; a.pts--
          if (riv) { riv.h2h[1]--; riv.intensity = Math.max(0, riv.intensity - 1) }
        }
        h.form = h.form.slice(0, -1); a.form = a.form.slice(0, -1)
      })
      const newCMDs = new Set(prev.cMDs)
      newCMDs.delete(mdIndex)
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex ? mdfx.map(f => ({ ...f, saved: false })) : mdfx
      )
      const newResults = prev.results.filter(r => r.md !== mdIndex + 1)
      const sortedTeams = [...newTeams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
      sortedTeams.forEach((t, i) => { t.mood = moodFromPos(i + 1, t.form) })
      const next = { ...prev, teams: newTeams, rivalries: newRivals, mdFx: newFx, cMDs: newCMDs, matchday: newCMDs.size, results: newResults }
      scheduleSave(next)
      return next
    })
  }

  function clearScores() {
    if (done) return
    setS(prev => {
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex ? mdfx.map(f => ({ ...f, hg: 0, ag: 0 })) : mdfx
      )
      return { ...prev, mdFx: newFx }
    })
  }

  function submitResults() {
    if (done) { alert('Already saved.'); return }
    const used = new Set<number>()
    for (let fi = 0; fi < fx.length; fi++) {
      const f = fx[fi]
      if (f.hg === '' || f.ag === '' || isNaN(Number(f.hg)) || isNaN(Number(f.ag))) { alert('Fill in all scores.'); return }
      if (f.hi === f.ai) { alert(`Match ${fi + 1}: same team both sides.`); return }
      if (used.has(f.hi) || used.has(f.ai)) { alert('A team appears more than once.'); return }
      used.add(f.hi); used.add(f.ai)
    }

    setS(prev => {
      const newTeams = prev.teams.map(t => ({ ...t }))
      const newRivals = prev.rivalries.map(r => ({ ...r, h2h: [...r.h2h] as [number,number,number] }))
      const newResults = [...prev.results]
      const newFx = prev.mdFx.map((mdfx, mi) =>
        mi === mdIndex ? mdfx.map(f => ({ ...f })) : mdfx
      )

      fx.forEach((f, fi) => {
        const hg = parseInt(String(f.hg)), ag = parseInt(String(f.ag))
        const h = newTeams[f.hi], a = newTeams[f.ai]
        const riv = newRivals.find(r => (r.a === f.hi && r.b === f.ai) || (r.b === f.hi && r.a === f.ai))
        const rm = riv ? 1.6 : 1
        h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
        if (hg > ag) {
          h.w++; h.pts += 3; h.form = [...h.form, 'W']
          a.l++; a.form = [...a.form, 'L']
          h.fanbase = Math.min(h.fanbase + Math.round(400 * rm), 2e6)
          a.fanbase = Math.max(a.fanbase - 100, 1000)
          if (riv) { riv.h2h[0]++; riv.last = h.name + ' ' + hg + '–' + ag + ' ' + a.name; riv.intensity = Math.min(100, riv.intensity + 2) }
        } else if (hg < ag) {
          a.w++; a.pts += 3; a.form = [...a.form, 'W']
          h.l++; h.form = [...h.form, 'L']
          a.fanbase = Math.min(a.fanbase + Math.round(400 * rm), 2e6)
          h.fanbase = Math.max(h.fanbase - 100, 1000)
          if (riv) { riv.h2h[2]++; riv.last = a.name + ' ' + ag + '–' + hg + ' ' + h.name; riv.intensity = Math.min(100, riv.intensity + 2) }
        } else {
          h.d++; a.d++; h.pts++; a.pts++
          h.form = [...h.form, 'D']; a.form = [...a.form, 'D']
          if (riv) { riv.h2h[1]++; riv.last = 'Draw ' + hg + '–' + ag; riv.intensity = Math.min(100, riv.intensity + 1) }
        }
        const att = Math.floor(h.capacity * h.attp * (0.88 + Math.random() * 0.12) * (riv ? 1.08 : 1))
        h.matchday_rev += att * avgTicket(h) + att * 6.5
        h.attp = Math.min(0.98, Math.max(0.4, h.attp + (hg > ag ? 0.008 : -0.006)))
        newFx[mdIndex][fi].saved = true
        newResults.unshift({ hn: h.name, an: a.name, hg, ag, riv: !!riv, md: mdIndex + 1 })
      })

      const newCMDs = new Set(prev.cMDs)
      newCMDs.add(mdIndex)
      const newMatchday = newCMDs.size
      const sortedTeams = [...newTeams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
      sortedTeams.forEach((t, i) => { t.mood = moodFromPos(i + 1, t.form) })

      // ── AI transfer window ──────────────────────────────────────────────
      // Fires on MD 2 (pre-season only)
      let aiTransfers: ReturnType<typeof runAiTransfers> | null = null
      if (newMatchday === 2) {
        const teamRefs: AiTeamRef[] = prev.teams.map(t => ({
          id: t.id,
          name: t.name,
          budget: t.transfer_budget ?? 0,
          isHuman: (prev.userTeamIds ?? []).includes(t.id),
          pts: newTeams.find(nt => nt.id === t.id)?.pts ?? t.pts,
        }))
        aiTransfers = runAiTransfers(loadDyn(), teamRefs, prev.season)
      }

      const next = {
        ...prev,
        teams: newTeams,
        rivalries: newRivals,
        results: newResults,
        mdFx: newFx,
        cMDs: newCMDs,
        matchday: newMatchday,
        transferLog: aiTransfers
          ? [...aiTransfers.transfers, ...(prev.transferLog ?? [])]
          : prev.transferLog ?? [],
        newsLog: aiTransfers
          ? [...aiTransfers.news, ...(prev.newsLog ?? [])]
          : prev.newsLog ?? [],
      }
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Matchday results</CardTitle>
          <CardDescription>Pick who plays who, enter scores, save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Matchday selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-24">Matchday</span>
            <Select value={String(mdIndex)} onValueChange={v => setMdIndex(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 22}, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {done ? <Badge variant="green">✓ saved</Badge> : <Badge variant="neutral">pending</Badge>}
          </div>

          <Separator />

          {/* Photo import */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = '' }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing || S.cMDs.has(mdIndex)}>
                {importing ? 'Reading…' : '📷 Import from photo'}
              </Button>
              <button className="text-xs text-muted-foreground underline" onClick={() => setShowKey(s => !s)}>
                {showKey ? 'Hide API key' : 'API key'}
              </button>
            </div>
            {showKey && (
              <Input type="password" className="text-sm font-mono max-w-sm" placeholder="sk-ant-..."
                value={apiKey} onChange={e => saveKey(e.target.value)} />
            )}
            <div className="flex gap-2 max-w-lg">
              <input
                className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder='Or paste text: "Team A 2-1 Team B" per line'
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFromText()}
              />
              <Button size="sm" variant="outline" onClick={applyFromText}>Parse</Button>
            </div>
            {importError && <p className="text-xs text-red-500">{importError}</p>}
            {pending.length > 0 && (
              <div className="rounded-md border p-3 space-y-1.5 bg-muted/30">
                <p className="text-xs font-medium">Found {pending.length} result{pending.length > 1 ? 's' : ''} — confirm to fill in scores:</p>
                {pending.map((r, i) => {
                  const hn = S.teams.find(t => t.id === r.hi)?.name ?? `Team ${r.hi}`
                  const an = S.teams.find(t => t.id === r.ai)?.name ?? `Team ${r.ai}`
                  return (
                    <p key={i} className="text-sm">
                      <span className="font-medium">{hn}</span>
                      <span className="text-muted-foreground mx-1">{r.hg}–{r.ag}</span>
                      <span className="font-medium">{an}</span>
                    </p>
                  )
                })}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={confirmPending} style={{ background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)', color: '#fff' }}>Apply scores</Button>
                  <Button size="sm" variant="outline" onClick={() => setPending([])}>Discard</Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Fixtures */}
          {done ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">Results locked.</p>
                <Button size="sm" variant="outline" onClick={unlockMatchday}>Unlock</Button>
              </div>
              {fx.filter(f => f.saved).map((f, fi) => {
                const riv = S.rivalries.find(r => (r.a === f.hi && r.b === f.ai) || (r.b === f.hi && r.a === f.ai))
                return (
                  <div key={fi} className="flex items-center gap-2 py-2.5 border-b last:border-0 flex-wrap">
                    <span className="text-xs text-muted-foreground w-5">{fi + 1}</span>
                    <span className="flex-1 font-medium text-right text-sm">
                      {TEAM_DEFS[f.hi].name}
                      {riv && <Badge variant="rival" className="ml-1.5 text-[10px]">{riv.type}</Badge>}
                    </span>
                    <span className="text-xl font-semibold px-3 tabular-nums">{f.hg} – {f.ag}</span>
                    <span className="flex-1 font-medium text-sm">{TEAM_DEFS[f.ai].name}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {fx.map((f, fi) => (
                <div key={fi} className="py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{fi + 1}.</span>
                    {/* Teams — stacked on mobile, side by side on sm+ */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5">
                      <Select value={String(f.hi)} onValueChange={v => updateFixture(fi, 'hi', parseInt(v))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_DEFS.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-xs hidden sm:block shrink-0">vs</span>
                      <Select value={String(f.ai)} onValueChange={v => updateFixture(fi, 'ai', parseInt(v))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_DEFS.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Score */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number" min={0} max={20}
                        className="w-12 text-center text-base font-semibold tabular-nums"
                        placeholder="0"
                        value={f.hg}
                        onChange={e => updateFixture(fi, 'hg', e.target.value)}
                      />
                      <span className="text-muted-foreground font-medium">–</span>
                      <Input
                        type="number" min={0} max={20}
                        className="w-12 text-center text-base font-semibold tabular-nums"
                        placeholder="0"
                        value={f.ag}
                        onChange={e => updateFixture(fi, 'ag', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={submitResults}>Save matchday</Button>
            <Button variant="outline" onClick={clearScores}>Clear scores</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Result log</CardTitle>
        </CardHeader>
        <CardContent>
          {S.results.length === 0 ? (
            <p className="text-xs text-muted-foreground">No results yet.</p>
          ) : (
            <div className="text-xs space-y-1 max-h-72 overflow-y-auto">
              {S.results.slice(0, 60).map((r, i) => {
                const col = r.hg > r.ag ? '#3B6D11' : r.hg < r.ag ? '#A32D2D' : '#888780'
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    {r.riv && <Badge variant="rival" className="text-[10px]">derby</Badge>}
                    <span className="text-muted-foreground">MD{r.md}</span>
                    <span className="font-medium">{r.hn}</span>
                    <span className="font-semibold tabular-nums" style={{color: col}}>{r.hg}–{r.ag}</span>
                    <span className="font-medium">{r.an}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
