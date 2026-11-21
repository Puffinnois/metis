-- the reverse view: college players with a line in each season, how many have a professional line at all (any
-- season, by the ESPN id), all players and Division I teams' players
WITH seasons AS (
  SELECT 'ncaam' AS lg, s.season, s.player_id, bool_or(t.division_i) AS d1, any_value(c.espn_athlete_id) AS espn
  FROM ncaam.player_season s JOIN ncaam.player c USING (player_id) LEFT JOIN ncaam.team t ON t.team_id = s.team_id AND t.season = s.season
  GROUP BY ALL
  UNION ALL
  SELECT 'ncaaw', s.season, s.player_id, bool_or(t.division_i), any_value(c.espn_athlete_id)
  FROM ncaaw.player_season s JOIN ncaaw.player c USING (player_id) LEFT JOIN ncaaw.team t ON t.team_id = s.team_id AND t.season = s.season
  GROUP BY ALL
)
SELECT lg, season, count(*) AS players, count(*) FILTER (WHERE d1) AS d1_players,
  count(*) FILTER (WHERE espn IN (SELECT espn_athlete_id FROM nba.player UNION ALL SELECT espn_athlete_id FROM wnba.player)) AS with_pro,
  count(*) FILTER (WHERE d1 AND espn IN (SELECT espn_athlete_id FROM nba.player UNION ALL SELECT espn_athlete_id FROM wnba.player)) AS d1_with_pro,
  round(100.0 * count(*) FILTER (WHERE d1 AND espn IN (SELECT espn_athlete_id FROM nba.player UNION ALL SELECT espn_athlete_id FROM wnba.player))
    / count(*) FILTER (WHERE d1), 2) AS pct_d1
FROM seasons GROUP BY ALL ORDER BY 1, 2
;
-- split college records: a linked player's college career held under a second college player row with the same name
-- (another ESPN id, or a stats.ncaa.org-only player under D28's keys), sharing a team
WITH linked AS (
  SELECT 'ncaam' AS lg, c.player_id, nm(c.name) AS n FROM ncaam.player c JOIN nba.player p USING (espn_athlete_id)
  UNION ALL SELECT 'ncaaw', c.player_id, nm(c.name) FROM ncaaw.player c JOIN wnba.player p USING (espn_athlete_id)
),
others AS (
  SELECT 'ncaam' AS lg, c.player_id, nm(c.name) AS n, c.espn_athlete_id AS espn, s.team_id, s.season FROM ncaam.player c JOIN ncaam.player_season s USING (player_id)
  UNION ALL SELECT 'ncaaw', c.player_id, nm(c.name), c.espn_athlete_id, s.team_id, s.season FROM ncaaw.player c JOIN ncaaw.player_season s USING (player_id)
),
lteams AS (SELECT l.lg, l.player_id, l.n, o.team_id FROM linked l JOIN others o ON o.lg = l.lg AND o.player_id = l.player_id)
SELECT l.lg, count(DISTINCT l.player_id) AS linked_with_split,
  count(DISTINCT o.player_id) FILTER (WHERE o.espn IS NULL) AS split_rows_without_espn,
  count(DISTINCT o.player_id) FILTER (WHERE o.espn IS NOT NULL) AS split_rows_other_espn,
  sum(1) AS split_seasons
FROM lteams l JOIN others o ON o.lg = l.lg AND o.n = l.n AND o.team_id = l.team_id AND o.player_id <> l.player_id
GROUP BY 1
;
-- the split rows, listed
WITH linked AS (
  SELECT 'ncaam' AS lg, c.player_id, c.name, nm(c.name) AS n FROM ncaam.player c JOIN nba.player p USING (espn_athlete_id)
  UNION ALL SELECT 'ncaaw', c.player_id, c.name, nm(c.name) FROM ncaaw.player c JOIN wnba.player p USING (espn_athlete_id)
),
others AS (
  SELECT 'ncaam' AS lg, c.player_id, nm(c.name) AS n, c.espn_athlete_id AS espn, c.method, s.team_id, s.season, s.games FROM ncaam.player c JOIN ncaam.player_season s USING (player_id)
  UNION ALL SELECT 'ncaaw', c.player_id, nm(c.name), c.espn_athlete_id, c.method, s.team_id, s.season, s.games FROM ncaaw.player c JOIN ncaaw.player_season s USING (player_id)
),
lteams AS (SELECT DISTINCT l.lg, l.player_id, l.name, l.n, o.team_id FROM linked l JOIN others o ON o.lg = l.lg AND o.player_id = l.player_id)
SELECT l.lg, l.name, o.player_id AS other_row, o.espn AS other_espn, o.method, string_agg(o.season || ':' || o.games, ' ') AS seasons_games
FROM lteams l JOIN others o ON o.lg = l.lg AND o.n = l.n AND o.team_id = l.team_id AND o.player_id <> l.player_id
GROUP BY ALL ORDER BY 1, 2
