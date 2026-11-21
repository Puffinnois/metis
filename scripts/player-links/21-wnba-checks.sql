-- undrafted WNBA players with US colleges the id did not link: in the women's college file by id or surname?
SELECT w.name AS wnba_name, w.espn_athlete_id, w.school, c.name AS college_name, c.espn_athlete_id AS college_espn,
  c.first_season, c.last_season, left(c.birth_date, 10) AS college_dob, w.birth_date AS wnba_dob
FROM wnba.player w
LEFT JOIN ncaaw.player c ON c.espn_athlete_id = w.espn_athlete_id
  OR (split_part(lower(c.name), ' ', -1) = split_part(lower(w.name), ' ', -1) AND left(lower(c.name), 3) = left(lower(w.name), 3))
WHERE w.name IN ('Holly Winterburn', 'Nadia Fingall', 'Peyton Williams', 'Kyra Lambert', 'Jovana Nogic', 'Jaelyn Brown',
  'Amy Okonkwo', 'Kathryn Westbeld', 'Robyn Parks', 'Ezinne Kalu', 'Rebekah Gardner')
ORDER BY 1
;
-- ESPN's women's college player bios: Fingall, Winterburn, Williams by surname, any season in the college file
SELECT season, athlete_id, display_name, date_of_birth FROM ncaaw.src_espn_player_core
WHERE lower(last_name) IN ('fingall', 'winterburn') OR (lower(display_name) = 'peyton williams') ORDER BY 3, 1
;
-- the WNBA id matches whose birth dates differ
SELECT w.name, w.birth_date AS wnba_roster_dob,
  (SELECT left(any_value(date_of_birth), 10) FROM wnba.src_espn_player_core e WHERE e.athlete_id = w.espn_athlete_id) AS wnba_espn_dob,
  left(c.birth_date, 10) AS college_dob, c.first_season, c.last_season
FROM wnba.player w JOIN ncaaw.player c ON c.espn_athlete_id = w.espn_athlete_id
WHERE (SELECT left(any_value(date_of_birth), 10) FROM wnba.src_espn_player_core e WHERE e.athlete_id = w.espn_athlete_id) <> left(c.birth_date, 10)
