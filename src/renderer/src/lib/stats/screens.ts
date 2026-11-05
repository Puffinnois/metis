/**
 * `player` and `team` are the dashboards, `players` and `teams` the leaderboards, `explore` Chart,
 * Compare and Trends, `games` a day's games, `data` what is loaded (opened from the status line).
 */
export type StatsScreen =
  'home' | 'player' | 'players' | 'team' | 'teams' | 'explore' | 'games' | 'glossary' | 'data'

export const NAV_ITEMS: { id: StatsScreen; label: string }[] = [
  { id: 'home', label: 'Leaderboards' },
  { id: 'player', label: 'Players' },
  { id: 'team', label: 'Teams' },
  { id: 'explore', label: 'Explore' },
  { id: 'games', label: 'Games' },
  { id: 'glossary', label: 'Glossary' }
]
