;
-- run after 10-match-nba.sql (T1304.2's check): the recommended matcher's links, written to
-- ${SCRATCH}/research-nba.parquet for `scripts/check-links.mjs` to compare with the app's
COPY (
  SELECT player_id AS pro_id, name, class, organization_type, espn,
    CASE WHEN n_id = 1 THEN id_col WHEN n_name_dob = 1 THEN dob_col
      WHEN espn IS NULL AND n_name_college = 1 THEN college_col END AS col_id,
    CASE WHEN n_id = 1 THEN 'id' WHEN n_name_dob = 1 THEN 'name+birth'
      WHEN espn IS NULL AND n_name_college = 1 THEN 'name+college' END AS method
  FROM per
) TO '${SCRATCH}/research-nba.parquet' (FORMAT parquet)
;
SELECT method, count(*) FROM read_parquet('${SCRATCH}/research-nba.parquet') GROUP BY 1 ORDER BY 1
