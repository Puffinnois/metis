import type { StatsDb } from '@main/stats/db'
import { addGame, BOS, LAL, MIA } from './boxScores'

/**
 * A three-team league whose SRS is solved by hand. 2025-26: Boston beats the Lakers by 10 at home
 * (Nov 1), the Lakers beat Miami by 4 at home (Nov 2), Miami beats Boston by 2 at home (Nov 3).
 *
 * Ratings sum to zero, and games × rating − Σ opponents = Σ margins for each team:
 * - after Nov 1: BOS +5, LAL −5;
 * - after Nov 2: BOS +8, LAL −2, MIA −6 (BOS − LAL = 10, MIA − LAL = −4);
 * - after Nov 3: 2·BOS − LAL − MIA = 8 with the sum zero gives BOS 8/3, LAL −2, MIA −2/3.
 *   MOV: BOS +4, LAL −3, MIA −1; SOS: BOS −4/3, LAL +1, MIA +1/3.
 *
 * Games the solve must leave out: a playoff game, an All-Star game ESPN files under the regular
 * season (typed `all-star` in the game table) and a Cup final. 2024-25 has one game: BOS by 6.
 */
export async function addLeague(db: StatsDb): Promise<void> {
  await db.exec(`INSERT INTO team VALUES
    (2025, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2025, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast')`)
  await addGame(db, { id: 'a', date: '2025-11-01', home: BOS, away: LAL, scores: [110, 100] })
  await addGame(db, { id: 'b', date: '2025-11-02', home: LAL, away: MIA, scores: [104, 100] })
  await addGame(db, { id: 'c', date: '2025-11-03', home: MIA, away: BOS, scores: [102, 100] })
  await addGame(db, {
    id: 'cup',
    date: '2025-12-16',
    home: LAL,
    away: BOS,
    scores: [140, 90],
    type: 'cup-final'
  })
  await addGame(db, {
    id: 'star',
    date: '2026-02-15',
    home: MIA,
    away: BOS,
    scores: [190, 120],
    type: 'all-star'
  })
  await addGame(db, {
    id: 'po',
    date: '2026-04-20',
    home: LAL,
    away: MIA,
    scores: [130, 80],
    type: 'playoffs'
  })
  await addGame(db, {
    id: 'old',
    date: '2025-01-10',
    home: BOS,
    away: LAL,
    scores: [106, 100],
    season: 2025
  })
}
