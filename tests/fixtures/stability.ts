import type { StatsDb } from '@main/stats/db'
import { addGame, addNbaLine, BOS, LAL, type Stats } from './boxScores'

/**
 * A league for the stability measure (Plan T1006): 2023-24 to 2025-26, Boston and the Lakers, four
 * games a season, thirty players a side who play 30 minutes of every game.
 *
 * Each player has a free-throw rate of their own, 50 % to 90 %, seen through a little noise; their
 * steals are noise alone. So free-throw percentage carries over and steals do not, and every value
 * can be recounted from `LINES` without the engine.
 */
export const SEASONS = [2024, 2025, 2026]
export const GAMES = 4
export const PLAYERS = 60
/** Free throws a game. */
export const FTA = 20

export interface FixtureLine {
  player: number
  season: number
  /** 0 to 3, by date: games 0 and 2 are the odd ones (the 1st and 3rd), 1 and 3 the even. */
  game: number
  ftm: number
  fta: number
  stl: number
  tov: number
  fga: number
  pts: number
}

export const lineOf = (player: number, season: number, game: number): FixtureLine => {
  const rate = 0.5 + (0.4 * player) / PLAYERS
  const noise = ((player * 7 + game * 3 + season * 2) % 5) - 2
  const ftm = Math.min(FTA, Math.max(0, Math.round(rate * FTA) + noise))
  // A hash of the game, so a season's steals do not add up to the same for everyone.
  const x = player * 31 + game * 17 + season * 11
  const stl = ((Math.imul(x ^ (x >>> 3), 0x45d9f3b) >>> 0) >>> 16) % 4
  const tov = 1 + ((player + game) % 3)
  return { player, season, game, ftm, fta: FTA, stl, tov, fga: 10, pts: ftm + 10 }
}

export const LINES: FixtureLine[] = SEASONS.flatMap((season) =>
  Array.from({ length: GAMES }, (_, game) =>
    Array.from({ length: PLAYERS }, (_, i) => lineOf(i + 1, season, game))
  ).flat(2)
)

export const teamOf = (player: number): number => (player <= PLAYERS / 2 ? BOS : LAL)

export async function addStabilityLeague(db: StatsDb): Promise<void> {
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  for (const season of SEASONS) {
    await db.exec(`INSERT INTO team VALUES
      (${season}, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
      (${season}, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
    for (let game = 0; game < GAMES; game++) {
      const id = `s${season}g${game}`
      const [home, away] = game % 2 === 0 ? [BOS, LAL] : [LAL, BOS]
      await addGame(db, {
        id,
        season,
        date: `${season}-01-0${game + 1}`,
        home,
        away,
        scores: [110, 100]
      })
      for (const team of [BOS, LAL]) {
        const lines = LINES.filter((l) => l.season === season && l.game === game).filter(
          (l) => teamOf(l.player) === team
        )
        const sum = (f: (l: FixtureLine) => number): number => lines.reduce((s, l) => s + f(l), 0)
        await db.exec(
          `INSERT INTO src_nba_team_box VALUES (?, ?, ?, '900:00', ?, ?, 0, 0, ?, ?, 0, 0, 0, 0, ?, 0, ?, 0, ?)`,
          [
            id,
            season,
            team,
            5 * lines.length,
            sum((l) => l.fga),
            sum((l) => l.ftm),
            sum((l) => l.fta),
            sum((l) => l.stl),
            sum((l) => l.tov),
            sum((l) => l.pts)
          ]
        )
      }
      for (const l of LINES.filter((x) => x.season === season && x.game === game)) {
        // FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PTS.
        const stats: Stats = [5, l.fga, 0, 0, l.ftm, l.fta, 0, 0, 0, l.stl, 0, l.tov, 0, l.pts]
        await addNbaLine(db, id, l.player, teamOf(l.player), {
          season,
          minutes: '30:00',
          position: l.player % 2 ? 'G' : 'F',
          stats
        })
      }
    }
  }
}
