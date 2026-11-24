import type { StatsDb } from '@main/stats/db'

/**
 * A small league for the attribute builder (D51): the identity and season tables it reads, and one
 * or two rows of each source with the columns and spellings the releases publish (checked on the
 * clean load of 2026-11-22: "6-11", "MAR 30, 2003", "1984-12-30T08:00Z", `6' 5"`, "205 lbs",
 * "Undrafted", "---"). Player 1 is drafted and went to a combine; player 2 is undrafted by the bio;
 * player 3 has only ESPN's line; player 4 played before the draft file starts; player 5's pick is listed
 * under two teams, and player 1's twice, once with no team (as the WNBA's 2024 file lists some). Two teams.
 */
export async function seedProLeague(db: StatsDb): Promise<void> {
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, espn_athlete_id BIGINT,
    method VARCHAR, first_season INTEGER, last_season INTEGER)`)
  await db.exec(`INSERT INTO player VALUES
    (1, 'Ana Drafted', 101, 'id', 2024, 2026), (2, 'Bea Undrafted', 102, 'id', 2025, 2026),
    (3, 'Cal Espn', 103, 'id', 2026, 2026), (4, 'Dee Veteran', 104, 'id', 1994, 2026),
    (5, 'Eve Traded Pick', NULL, 'nba', 2026, 2026)`)
  await db.exec(
    `CREATE TABLE player_ids (espn_athlete_id BIGINT, player_id BIGINT, method VARCHAR)`
  )
  await db.exec(
    `INSERT INTO player_ids VALUES (101, 1, 'id'), (102, 2, 'id'), (103, 3, 'id'), (104, 4, 'id')`
  )
  await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, espn_team_id INTEGER, code VARCHAR,
    name VARCHAR, conference VARCHAR, division VARCHAR)`)
  await db.exec(`INSERT INTO team VALUES
    (2025, 10, 1, 'AAA', 'Alpha', 'east', 'atlantic'), (2026, 10, 1, 'AAA', 'Alpha', 'east', 'atlantic'),
    (2026, 20, 2, 'BBB', 'Beta', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player_season (player_id BIGINT, season INTEGER, game_type VARCHAR,
    team_id BIGINT, last_team_id BIGINT, last_date DATE)`)
  await db.exec(`INSERT INTO player_season VALUES
    (1, 2024, 'regular', NULL, 10, DATE '2024-04-10'),
    (1, 2025, 'regular', NULL, 10, DATE '2025-04-10'),
    (1, 2026, 'regular', NULL, 20, DATE '2026-03-01'),
    (1, 2026, 'regular', 10, 10, DATE '2026-01-01'),
    (1, 2026, 'preseason', NULL, 10, DATE '2025-10-10'),
    (2, 2025, 'regular', NULL, 10, DATE '2025-04-10'),
    (2, 2026, 'regular', NULL, 10, DATE '2026-04-10'),
    (3, 2026, 'regular', NULL, 20, DATE '2026-04-10'),
    (4, 1994, 'regular', NULL, 10, DATE '1994-04-10'),
    (4, 2026, 'regular', NULL, 10, DATE '2026-04-10')`)
  await db.exec(`CREATE TABLE src_nba_rosters (team_id BIGINT, season INTEGER, player VARCHAR,
    num VARCHAR, position VARCHAR, height VARCHAR, weight VARCHAR, birth_date VARCHAR, age DOUBLE,
    exp VARCHAR, school VARCHAR, player_id BIGINT, how_acquired VARCHAR)`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES
    (10, 2025, 'Ana Drafted', '7', 'G', '6-10', '210', 'MAR 30, 2003', 22, 'R', 'Duke', 1, NULL),
    (20, 2026, 'Ana Drafted', '00', 'G-F', '6-11', '220', 'MAR 30, 2003', 23, '1', 'Duke', 1, 'Traded from AAA on 01/02/26'),
    (10, 2026, 'Ana Drafted', '7', 'G', '6-11', '215', 'MAR 30, 2003', 23, '1', 'Duke', 1, NULL),
    (10, 2026, 'Bea Undrafted', ' ', 'F', '6-5', '200', 'JUN 15, 2001', 25, 'R', '  ', 2, NULL)`)
  await db.exec(`CREATE TABLE src_espn_player_core (season INTEGER, athlete_id BIGINT,
    date_of_birth VARCHAR, birth_city VARCHAR, birth_state VARCHAR, birth_country VARCHAR,
    height DOUBLE, weight DOUBLE, jersey VARCHAR, position_abbreviation VARCHAR,
    experience_years INTEGER, draft_year INTEGER, draft_round INTEGER, draft_selection INTEGER)`)
  await db.exec(`INSERT INTO src_espn_player_core VALUES
    (2026, 101, '2003-03-29T08:00Z', 'Paris', NULL, 'France', 83, 222, '00', 'G', 2, 2023, 1, 5),
    (2026, 103, '1999-09-02T07:00Z', 'Toronto', 'ON', 'Canada', 77, 205, '3', 'F', 4, 2021, 2, 40),
    (2026, 104, '1975-01-01T08:00Z', NULL, NULL, NULL, 80, 230, '9', 'C', 29, 0, 0, 0)`)
  await db.exec(`CREATE TABLE src_espn_rosters (season INTEGER, athlete_id VARCHAR,
    date_of_birth VARCHAR, birth_place_city VARCHAR, birth_place_state VARCHAR,
    birth_place_country VARCHAR, height VARCHAR, weight VARCHAR, jersey VARCHAR,
    position_abbreviation VARCHAR, experience_display_value VARCHAR)`)
  await db.exec(`INSERT INTO src_espn_rosters VALUES
    (2026, '103', '1999-09-02T07:00Z', 'Toronto', 'ON', 'Canada', '6'' 5"', '205 lbs', '3', 'F', NULL)`)
  await db.exec(`CREATE TABLE src_nba_draft (person_id BIGINT, player_name VARCHAR, season INTEGER,
    round_number BIGINT, round_pick BIGINT, overall_pick BIGINT, team_id BIGINT, team_city VARCHAR,
    team_name VARCHAR, team_abbreviation VARCHAR, organization VARCHAR, organization_type VARCHAR)`)
  await db.exec(`INSERT INTO src_nba_draft VALUES
    (1, 'Ana Drafted', 2024, 1, 5, 5, 10, 'Alpha', 'City', 'AAA', 'Duke', 'College/University'),
    (1, 'Ana Drafted', 2024, 1, 5, 5, NULL, NULL, NULL, NULL, 'Duke', 'College/University'),
    (5, 'Eve Traded Pick', 2026, 2, 3, 33, 10, 'Alpha', 'City', 'AAA', NULL, NULL),
    (5, 'Eve Traded Pick', 2026, 2, 3, 33, 20, 'Beta', 'Town', 'BBB', NULL, NULL),
    (9, 'Somebody', 1997, 1, 1, 1, 20, 'Beta', 'Town', 'BBB', 'X', 'College/University')`)
  await db.exec(`CREATE TABLE src_dash_player_bio (player_id BIGINT, season INTEGER, country VARCHAR,
    college VARCHAR, draft_year VARCHAR)`)
  await db.exec(`INSERT INTO src_dash_player_bio VALUES
    (1, 2026, 'France', 'Duke', '2023'), (2, 2025, 'USA', 'Iowa', 'Undrafted'),
    (2, 2026, 'USA', 'Iowa', 'Undrafted')`)
  await db.exec(`CREATE TABLE src_nba_combine_anthro (player_id BIGINT, player_name VARCHAR,
    position VARCHAR, height_wo_shoes DOUBLE, weight VARCHAR, wingspan DOUBLE, season INTEGER)`)
  await db.exec(`INSERT INTO src_nba_combine_anthro VALUES
    (1, 'Ana Drafted', 'PG-SG', 81.5, '208.4', 86.25, 2023), (1, 'Ana Drafted', 'PG', 82, '212', 87, 2024),
    (-1, 'No Id', 'C', 85, '250', 90, 2024)`)
  await db.exec(`CREATE TABLE src_nba_combine_drills (player_id BIGINT, player_name VARCHAR,
    position VARCHAR, max_vertical_leap DOUBLE, bench_press BIGINT, season INTEGER)`)
  await db.exec(
    `INSERT INTO src_nba_combine_drills VALUES (1, 'Ana Drafted', 'PG', 38.5, 12, 2024)`
  )
  await db.exec(`CREATE TABLE src_nba_coaches (team_id BIGINT, season INTEGER, coach_id BIGINT,
    coach_name VARCHAR, coach_type VARCHAR, sort_sequence BIGINT)`)
  await db.exec(`INSERT INTO src_nba_coaches VALUES
    (10, 2026, 2, 'Second Head', 'Head Coach', 2), (10, 2026, 1, 'First Head', 'Head Coach', 1),
    (10, 2026, 3, 'An Assistant', 'Assistant Coach', 3),
    (20, 2026, 4, 'Stand In', 'Interim Head Coach', 1)`)
  await db.exec(`CREATE TABLE src_espn_schedule (season INTEGER, home_id INTEGER, neutral_site BOOLEAN,
    venue_full_name VARCHAR, venue_address_city VARCHAR, venue_address_state VARCHAR,
    venue_capacity DOUBLE, home_location VARCHAR)`)
  await db.exec(`INSERT INTO src_espn_schedule VALUES
    (2026, 1, false, 'Home Hall', 'Alphaville', 'AA', 18000, 'Alphaville'),
    (2026, 1, false, 'Home Hall', 'Alphaville', 'AA', 18000, 'Alphaville'),
    (2026, 1, false, 'Other Gym', 'Elsewhere', 'EE', 9000, 'Alphaville'),
    (2026, 1, true, 'Abroad Dome', 'Paris', NULL, 20000, 'Alphaville'),
    (2026, 1, true, 'Abroad Dome', 'Paris', NULL, 20000, 'Alphaville'),
    (2026, 1, true, 'Abroad Dome', 'Paris', NULL, 20000, 'Alphaville')`)
  await db.exec(
    `CREATE TABLE src_xwalk_team (season INTEGER, espn_team_id INTEGER, nba_team_city VARCHAR)`
  )
  await db.exec(`INSERT INTO src_xwalk_team VALUES (2026, 1, 'Alpha City')`)
}

/**
 * A small college league: player 7 with stats.ncaa.org's roster line through `ncaa_player_ids`,
 * player 8 with ESPN's roster alone, and a "---" class.
 */
export async function seedCollegeLeague(db: StatsDb): Promise<void> {
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, espn_athlete_id BIGINT,
    method VARCHAR, first_season INTEGER, last_season INTEGER)`)
  await db.exec(`INSERT INTO player VALUES (7, 'Gil College', 7, 'espn', 2025, 2026),
    (8, 'Hal Espn', 8, 'espn', 2026, 2026), (9, 'Ivy Dash', 9, 'espn', 2026, 2026)`)
  await db.exec(
    `CREATE TABLE player_ids (espn_athlete_id BIGINT, player_id BIGINT, method VARCHAR)`
  )
  await db.exec(`INSERT INTO player_ids VALUES (7, 7, 'espn'), (8, 8, 'espn'), (9, 9, 'espn')`)
  await db.exec(`CREATE TABLE team (season INTEGER, team_id INTEGER, espn_team_id INTEGER, code VARCHAR,
    name VARCHAR, conference VARCHAR, division VARCHAR, division_i BOOLEAN)`)
  await db.exec(`INSERT INTO team VALUES (2026, 150, 150, 'DUKE', 'Duke', 'ACC', NULL, true)`)
  await db.exec(`CREATE TABLE player_season (player_id BIGINT, season INTEGER, game_type VARCHAR,
    team_id BIGINT, last_team_id BIGINT, last_date DATE)`)
  await db.exec(`INSERT INTO player_season VALUES
    (7, 2025, 'regular', NULL, 150, DATE '2025-03-01'), (7, 2026, 'regular', NULL, 150, DATE '2026-03-01'),
    (8, 2026, 'regular', NULL, 150, DATE '2026-03-01'), (9, 2026, 'regular', NULL, 150, DATE '2026-03-01')`)
  await db.exec(
    `CREATE TABLE ncaa_player_ids (season INTEGER, ncaa_player_id VARCHAR, player_id BIGINT)`
  )
  await db.exec(`INSERT INTO ncaa_player_ids VALUES (2026, '555', 7), (2026, '556', 9)`)
  await db.exec(`CREATE TABLE src_ncaa_team_rosters (season INTEGER, player_id VARCHAR, jersey VARCHAR,
    class VARCHAR, position VARCHAR, ht_inches BIGINT, hometown VARCHAR, high_school VARCHAR)`)
  await db.exec(`INSERT INTO src_ncaa_team_rosters VALUES
    (2026, '555', '2', 'Fr.', 'F', 81, 'Newport, ME', 'Montverde Academy'),
    (2026, '556', '4', '---', 'G', 70, NULL, NULL)`)
  await db.exec(`CREATE TABLE src_espn_rosters (season INTEGER, athlete_id VARCHAR,
    date_of_birth VARCHAR, height VARCHAR, weight VARCHAR, jersey VARCHAR,
    position_abbreviation VARCHAR, experience_display_value VARCHAR)`)
  await db.exec(`INSERT INTO src_espn_rosters VALUES
    (2026, '8', NULL, '6'' 2"', '190 lbs', '11', 'G', 'Sophomore'),
    (2026, '7', NULL, '6'' 9"', '205 lbs', '2', 'F', 'Freshman')`)
  await db.exec(`CREATE TABLE src_espn_player_core (season INTEGER, athlete_id BIGINT,
    date_of_birth VARCHAR, experience_years INTEGER)`)
  await db.exec(`INSERT INTO src_espn_player_core VALUES (2026, 7, '2006-12-21T08:00Z', 1)`)
}
