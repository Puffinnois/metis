-- known players, NBA: is the professional ESPN athlete id the college one?
WITH names(n) AS (VALUES ('Paolo Banchero'), ('Chet Holmgren'), ('Jabari Smith Jr.'), ('Zach Edey'), ('Reed Sheppard'),
  ('Cooper Flagg'), ('Dalton Knecht'), ('Stephon Castle'), ('Dylan Harper'), ('Brandon Miller'), ('Keegan Murray'), ('Jaden Ivey'))
SELECT n, p.espn_athlete_id AS nba_espn, p.player_id AS nba_pid, c.espn_athlete_id AS ncaa_espn, c.name AS ncaa_name,
  c.first_season, c.last_season, c.birth_date AS ncaa_birth
FROM names
LEFT JOIN nba.player p ON p.name = n
LEFT JOIN ncaam.player c ON c.name = n
ORDER BY n
;
-- known players, WNBA
WITH names(n) AS (VALUES ('Caitlin Clark'), ('Paige Bueckers'), ('Angel Reese'), ('Cameron Brink'), ('Aliyah Boston'),
  ('Kamilla Cardoso'), ('Rickea Jackson'), ('JuJu Watkins'), ('Kiki Iriafen'), ('Sonia Citron'), ('Haley Jones'), ('Rhyne Howard'))
SELECT n, p.espn_athlete_id AS wnba_espn, p.player_id AS wnba_pid, p.birth_date AS wnba_birth, p.school,
  c.espn_athlete_id AS ncaa_espn, c.name AS ncaa_name, c.first_season, c.last_season, c.birth_date AS ncaa_birth
FROM names
LEFT JOIN wnba.player p ON p.name = n
LEFT JOIN ncaaw.player c ON c.name = n
ORDER BY n
;
-- ESPN draft rows: the athlete id the draft gives, against the NBA player table and the college
SELECT d.season, d.overall_pick, d.athlete_display_name, d.athlete_id AS draft_espn, d.college_name,
  p.espn_athlete_id AS nba_espn, c.espn_athlete_id AS ncaa_espn
FROM nba.src_espn_draft d
LEFT JOIN nba.player p ON p.espn_athlete_id = d.athlete_id
LEFT JOIN ncaam.player c ON c.espn_athlete_id = d.athlete_id
WHERE d.season = 2024 AND d.overall_pick <= 12
ORDER BY d.overall_pick
