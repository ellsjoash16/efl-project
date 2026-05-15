import { useRef, useState } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent } from '@/components/ui/card'
import { seasonLabel } from '@/lib/gameLogic'

const NEXA_DARK = '#2E4A52'
const NEXA_PURPLE = '#9B6BB5'
const IMG_KEY = 'efl-trophy-images-v1'

function loadImages(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(IMG_KEY) ?? '{}') } catch { return {} }
}
function saveImages(imgs: Record<string, string>) {
  localStorage.setItem(IMG_KEY, JSON.stringify(imgs))
}
function imgKey(teamId: number, season: number, type: 'league' | 'cup') {
  return `${teamId}-${season}-${type}`
}

function TrophyCard({
  label, season, type, teamId, emoji, accentColor,
}: {
  label: string; season: number; type: 'league' | 'cup'
  teamId: number; emoji: string; accentColor: string
}) {
  const [images, setImages] = useState<Record<string, string>>(loadImages)
  const fileRef = useRef<HTMLInputElement>(null)
  const key = imgKey(teamId, season, type)
  const src = images[key]

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target?.result as string
      const next = { ...loadImages(), [key]: data }
      saveImages(next)
      setImages(next)
    }
    reader.readAsDataURL(file)
  }

  function handleRemove() {
    const next = { ...loadImages() }
    delete next[key]
    saveImages(next)
    setImages(next)
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden" style={{ minWidth: 140 }}>
      {/* Trophy image area */}
      <div
        className="relative flex items-center justify-center cursor-pointer group"
        style={{ height: 120, background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)` }}
        onClick={() => !src && fileRef.current?.click()}
      >
        {src ? (
          <>
            <img src={src} alt={label} className="w-full h-full object-contain p-2" />
            <button
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); handleRemove() }}
              title="Remove image"
            >✕</button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center px-2">
            <span className="text-3xl">{emoji}</span>
            <p className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              Upload photo
            </p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          onClick={e => e.stopPropagation()}
        />
      </div>
      {/* Label */}
      <div className="px-2.5 py-2 border-t border-border/40 bg-muted/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: accentColor }}>
          {label}
        </p>
        <p className="text-xs font-bold leading-none mt-0.5">{seasonLabel(season)}</p>
      </div>
    </div>
  )
}

export function Trophies() {
  const { S } = useGame()
  const history = S.seasonHistory ?? []
  const allTeams = [...S.teams].sort((a, b) => a.name.localeCompare(b.name))
  const [activeId, setActiveId] = useState<number>(allTeams[0]?.id ?? 0)

  const activeTeam = allTeams.find(t => t.id === activeId) ?? allTeams[0]

  // Tally wins per team
  const leagueTitles: Record<string, number[]> = {}
  const cupTitles: Record<string, number[]> = {}
  for (const h of history) {
    const champ = h.standings[0]?.name
    if (champ) leagueTitles[champ] = [...(leagueTitles[champ] ?? []), h.season]
    if (h.cupWinner) cupTitles[h.cupWinner] = [...(cupTitles[h.cupWinner] ?? []), h.season]
  }

  const lg = activeTeam ? (leagueTitles[activeTeam.name] ?? []) : []
  const cp = activeTeam ? (cupTitles[activeTeam.name] ?? []) : []
  const total = lg.length + cp.length
  const isUser = activeTeam ? (S.userTeamIds ?? []).includes(activeTeam.id) : false

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl overflow-hidden px-6 py-5 flex items-center gap-4"
        style={{ background: `linear-gradient(135deg, #0a1820 0%, ${NEXA_DARK} 100%)` }}
      >
        <span className="text-4xl">🏆</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5" style={{ color: NEXA_PURPLE }}>
            Nexa Leading Division
          </p>
          <p className="text-white text-xl font-bold leading-tight">Trophy Cabinet</p>
          <p className="text-white/40 text-xs mt-0.5">{history.length} season{history.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {/* Club tabs */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none">
        {allTeams.map(team => {
          const wins = (leagueTitles[team.name]?.length ?? 0) + (cupTitles[team.name]?.length ?? 0)
          const active = team.id === activeId
          const isU = (S.userTeamIds ?? []).includes(team.id)
          return (
            <button
              key={team.id}
              onClick={() => setActiveId(team.id)}
              className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                active
                  ? 'text-white border-transparent'
                  : 'text-muted-foreground border-border/40 hover:text-foreground hover:border-border bg-muted/20'
              }`}
              style={active ? { background: 'linear-gradient(135deg, #2E4A52 0%, #1a3040 100%)' } : {}}
            >
              <span className={`text-[11px] font-semibold whitespace-nowrap ${active && isU ? 'text-purple-300' : ''}`}>
                {team.name.split(' ')[0]}
              </span>
              {wins > 0 && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={active ? { background: NEXA_PURPLE, color: '#fff' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {wins}🏆
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active team cabinet */}
      {activeTeam && (
        <Card className={`overflow-hidden border-0 shadow-sm ${isUser ? 'ring-1 ring-purple-400/30' : ''}`}>
          {/* Team name bar */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: `linear-gradient(135deg, #0a1820 0%, ${NEXA_DARK} 100%)` }}
          >
            <div className="flex items-center gap-2">
              <p className={`font-bold text-sm text-white`}>{activeTeam.name}</p>
              {isUser && (
                <span className="text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300">
                  You
                </span>
              )}
            </div>
            <p className="text-white/40 text-xs">
              {total > 0 ? `${total} trophy${total !== 1 ? 'ies' : ''}` : 'No trophies yet'}
            </p>
          </div>

          <CardContent className="p-5 space-y-6">
            {total === 0 && (
              <div className="py-10 text-center">
                <p className="text-3xl mb-2">🏟️</p>
                <p className="text-sm text-muted-foreground">Cabinet empty — no trophies won yet</p>
                {history.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Complete a season to start tracking</p>
                )}
              </div>
            )}

            {lg.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    League Title · {lg.length}×
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {lg.map(s => (
                    <TrophyCard
                      key={s} label="League Title" season={s} type="league"
                      teamId={activeTeam.id} emoji="🏆" accentColor={NEXA_PURPLE}
                    />
                  ))}
                </div>
              </div>
            )}

            {cp.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🥇</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Cup · {cp.length}×
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {cp.map(s => (
                    <TrophyCard
                      key={s} label="Cup" season={s} type="cup"
                      teamId={activeTeam.id} emoji="🥇" accentColor="#7c3aed"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
