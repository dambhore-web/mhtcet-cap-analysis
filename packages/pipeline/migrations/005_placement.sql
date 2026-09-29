-- Placement outcomes per college (issue #132), from the data each institution submitted to NIRF
-- (National Institutional Ranking Framework) and published on its website. One row per college,
-- program and graduating batch. Figures are self-reported by the institution; every row carries
-- the URL of the NIRF data PDF it was read from.
create table if not exists placement (
  authority          text not null default 'NIRF',
  college_code       text not null,
  program            text not null default 'UG4',    -- UG 4-year programs (B.E./B.Tech)
  graduation_year    text not null,                  -- academic year the batch graduated, e.g. '2024-25'
  graduates          integer not null,               -- graduating in minimum stipulated time
  placed             integer,
  median_salary      integer,                        -- rupees per year, of placed graduates
  higher_studies     integer,
  nirf_year          integer not null,               -- NIRF edition the figures come from, e.g. 2026
  nirf_category      text not null,                  -- 'Engineering' | 'Overall' | 'University' | ...
  nirf_institute_id  text not null,                  -- e.g. 'IR-E-C-12345'
  source_url         text not null,
  run_id             text references ingest_run(id),
  updated_at         timestamptz not null default now(),
  primary key (authority, college_code, program, graduation_year)
);
create index if not exists placement_college_idx on placement (college_code);
