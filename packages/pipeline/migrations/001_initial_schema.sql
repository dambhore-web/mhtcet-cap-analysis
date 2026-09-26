-- 001_initial_schema.sql
-- Cutoff data layer for AG-002 (2026 first load). Additive only: never modify existing columns.
-- authority / exam columns make the schema ready for other states' admission authorities
-- (ASSUMPTION: 'MH-CET-CELL' is the only authority for now).

create table if not exists ingest_run (
  id            text primary key,              -- e.g. 2026-09-27T01-23-45-678Z
  kind          text not null,                 -- 'load'
  year          integer not null,
  git_commit    text,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  status        text not null default 'running',  -- running | succeeded | failed
  summary       jsonb not null default '{}'::jsonb -- counts and check results, no personal data
);

create table if not exists college (
  authority       text not null default 'MH-CET-CELL',
  code            text not null,                 -- 5-digit institute code, leading zeros kept
  exam            text not null default 'MHT-CET', -- admission process the college takes part in
  name            text not null,
  status          text,                          -- e.g. 'Un-Aided, Autonomous' (institute list)
  home_university text,                          -- from the cutoff lists' Status line
  total_intake    integer,
  run_id          text references ingest_run(id),
  updated_at      timestamptz not null default now(),
  primary key (authority, code)
);

create table if not exists branch (
  authority    text not null default 'MH-CET-CELL',
  choice_code  text not null,                    -- 10 digits + optional suffix letters
  college_code text not null,
  exam         text not null default 'MHT-CET',
  name         text not null,
  status       text,
  run_id       text references ingest_run(id),
  updated_at   timestamptz not null default now(),
  primary key (authority, choice_code),
  foreign key (authority, college_code) references college (authority, code)
);

-- One cell of an official cutoff list (ADR-006). Natural key per operator decision 2026-09-27.
create table if not exists cutoff (
  authority          text not null default 'MH-CET-CELL',
  exam               text not null,              -- MH: 'MHT-CET'; AI/Diploma: printed merit exam
  year               integer not null,
  list               text not null,              -- 'MH' | 'AI' | 'Diploma'
  round              text not null,              -- 'I' | 'II' | 'III' | 'IV'
  choice_code        text not null,
  section            text not null,              -- printed section / type label
  seat_type          text not null,              -- '' for the Diploma list (none printed)
  stage              text not null default '',   -- MH stage label ('I', 'II', 'I-Non PWD', ...)
  college_code       text not null,
  closing_merit      integer not null,
  closing_percentile numeric(12, 7),
  source             text not null,              -- source PDF file name
  source_page        integer,
  run_id             text references ingest_run(id),
  updated_at         timestamptz not null default now(),
  primary key (authority, exam, year, list, round, choice_code, section, seat_type, stage)
);
create index if not exists cutoff_lookup_idx on cutoff (authority, year, college_code, round);
create index if not exists cutoff_choice_idx on cutoff (authority, year, choice_code);

-- All India merit list lookup (merit -> exam, score). No names, no application IDs.
create table if not exists merit_lookup (
  authority text not null default 'MH-CET-CELL',
  year      integer not null,
  list      text not null,                       -- e.g. 'PCMAI' (All India, PCM group)
  merit     integer not null,
  exam      text not null,                       -- candidate's merit exam: JEE | MHT-CET-PCM | Diploma | D.Voc.
  score     numeric(12, 7) not null,             -- percentile (JEE / MHT-CET) or percentage (Diploma)
  run_id    text references ingest_run(id),
  primary key (authority, year, list, merit)
);
create index if not exists merit_lookup_score_idx on merit_lookup (authority, year, list, exam, score);
