-- Annual fees per college (issue #42). One row per college and academic year.
-- source: 'FRA' (Fee Regulating Authority report, unaided colleges) or 'college' (the college's own
-- fee notice, e.g. government and aided colleges). Every row carries the URL it was taken from.
create table if not exists fee (
  authority        text not null default 'MH-CET-CELL',
  college_code     text not null,
  academic_year    text not null,                 -- e.g. '2026-27'
  tuition_fee      integer,
  development_fee  integer,
  other_fees       integer,
  total_fee        integer not null,
  source           text not null,                 -- 'FRA' | 'college'
  source_url       text not null,
  fra_institute_id text,
  fra_status       text,
  fra_meeting_date date,
  tfws_available   boolean,                       -- null = the source does not say
  notes            text,
  run_id           text references ingest_run(id),
  updated_at       timestamptz not null default now(),
  primary key (authority, college_code, academic_year)
);
create index if not exists fee_college_idx on fee (college_code);
