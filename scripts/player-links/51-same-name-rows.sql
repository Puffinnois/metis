-- the second same-name college rows seen beside linked players: what are they? (Orlando Robinson, Brandon Miller)
SELECT c.player_id, c.name, c.espn_athlete_id, c.method, c.first_season, c.last_season,
  (SELECT count(*) FROM ncaam.player_season s WHERE s.player_id = c.player_id) AS season_rows,
  (SELECT string_agg(DISTINCT t.name, ' / ') FROM ncaam.player_season s JOIN ncaam.team t ON t.team_id = s.team_id AND t.season = s.season WHERE s.player_id = c.player_id) AS teams
FROM ncaam.player c WHERE c.name IN ('Orlando Robinson', 'Brandon Miller', 'Vince Williams Jr.', 'Isaiah Crawford')
ORDER BY c.name, c.first_season
