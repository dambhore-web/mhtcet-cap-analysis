-- 003_seat_matrix.sql
-- Seats per branch (choice code) per seat type from the CET Cell's provisional seat matrix for
-- CAP Round I (issue #40). Loaded by `npm run load:seatmatrix -- <year>`; one row per seat type
-- with seats > 0 (a missing seat type means 0 seats). Additive only.
--
-- pool: state | minority | all-india | institute   → add up to the sanctioned intake
--       (state + minority + all-india = the printed "CAP Seats")
--       supernumerary (EWS, TFWS)                    → on top of the intake
--       common-reserved (PWDR, DEFR)                 → overlaps the other seats; never add it
-- seat_type: the cutoff-list codes (GOPENS, LOBCH, PWDOPENH, DEFSCS, ORPHANN, MI, AI, EWS, TFWS)
--       plus PWDR, DEFR and INSTITUTE, which only the matrix has.

create table if not exists seat_matrix (
  authority    text not null default 'MH-CET-CELL',
  exam         text not null default 'MHT-CET',
  year         integer not null,
  choice_code  text not null,                  -- 10 digits + optional suffix letters (normalised)
  college_code text not null,                  -- 5 digits (normalised)
  seat_type    text not null,
  pool         text not null check (pool in ('state', 'minority', 'all-india', 'institute', 'supernumerary', 'common-reserved')),
  seats        integer not null check (seats > 0),
  source       text not null,                  -- source PDF file name
  source_page  integer,
  run_id       text references ingest_run(id),
  updated_at   timestamptz not null default now(),
  primary key (authority, exam, year, choice_code, seat_type)
);
create index if not exists seat_matrix_college_idx on seat_matrix (year, college_code);
