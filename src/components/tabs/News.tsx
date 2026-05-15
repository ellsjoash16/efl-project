import { useState, useMemo } from 'react'
import { useGame } from '@/store/gameContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { seasonLabel } from '@/lib/gameLogic'

const TYPE_STYLE = {
  good: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', dot: '#15803d', label: 'Good news' },
  bad:  { bg: 'bg-red-100 dark:bg-red-900/30',     dot: '#dc2626', label: 'Bad news' },
  warn: { bg: 'bg-amber-100 dark:bg-amber-900/30', dot: '#d97706', label: 'Warning' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20',    dot: '#2563eb', label: 'Info' },
}

export function News() {
  const { S } = useGame()
  const newsLog = S.newsLog ?? []

  const seasons = useMemo(() => [...new Set(newsLog.map(n => n.season))].sort((a, b) => b - a), [newsLog])
  const teams   = useMemo(() => [...new Set(newsLog.map(n => n.team))].sort(), [newsLog])

  const [filterSeason, setFilterSeason] = useState<number | 'all'>('all')
  const [filterTeam,   setFilterTeam]   = useState<string | 'all'>('all')
  const [filterType,   setFilterType]   = useState<string | 'all'>('all')

  const filtered = useMemo(() => newsLog.filter(n =>
    (filterSeason === 'all' || n.season === filterSeason) &&
    (filterTeam   === 'all' || n.team   === filterTeam) &&
    (filterType   === 'all' || n.type   === filterType)
  ), [newsLog, filterSeason, filterTeam, filterType])

  const selectCls = 'flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>
              News Feed
              <span className="ml-2 text-xs font-normal text-muted-foreground">{filtered.length} items</span>
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <select className={selectCls} value={String(filterSeason)}
                onChange={e => setFilterSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">All seasons</option>
                {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
              </select>
              <select className={selectCls} value={filterTeam}
                onChange={e => setFilterTeam(e.target.value)}>
                <option value="all">All teams</option>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className={selectCls} value={filterType}
                onChange={e => setFilterType(e.target.value)}>
                <option value="all">All types</option>
                <option value="good">Good news</option>
                <option value="bad">Bad news</option>
                <option value="warn">Warnings</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">No news yet — advance a season to see activity.</p>
      ) : (
        <Card>
          <CardContent className="pt-2 divide-y">
            {filtered.map(item => {
              const style = TYPE_STYLE[item.type] ?? TYPE_STYLE.info
              return (
                <div key={item.id} className={`flex gap-3 py-3 px-2 rounded-lg my-0.5 ${style.bg}`}>
                  <div className="mt-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full" style={{ background: style.dot }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{item.msg}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.team} &middot; {seasonLabel(item.season)}
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
