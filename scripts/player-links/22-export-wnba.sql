;
-- run after 20-match-wnba.sql (T1304.2's check): the recommended matcher's links, the name and class
-- alone where the draft names no school, written to ${SCRATCH}/research-wnba.parquet
COPY (
  SELECT player_id AS pro_id, name, class, organization_type, espn,
    CASE WHEN n_id = 1 THEN id_col WHEN n_name_dob = 1 THEN dob_col
      WHEN espn IS NULL AND school IS NOT NULL AND n_name_college = 1 THEN college_col
      WHEN espn IS NULL AND school IS NULL AND n_name_class = 1 THEN class_col END AS col_id,
    CASE WHEN n_id = 1 THEN 'id' WHEN n_name_dob = 1 THEN 'name+birth'
      WHEN espn IS NULL AND school IS NOT NULL AND n_name_college = 1 THEN 'name+college'
      WHEN espn IS NULL AND school IS NULL AND n_name_class = 1 THEN 'name+college' END AS method
  FROM per
) TO '${SCRATCH}/research-wnba.parquet' (FORMAT parquet)
;
SELECT method, count(*) FROM read_parquet('${SCRATCH}/research-wnba.parquet') GROUP BY 1 ORDER BY 1
