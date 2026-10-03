-- Placement figures that colleges publish on their own websites (issue #132): the latest year's
-- highest, average and median package and placement %. These are the college's own claims, not
-- verified; every figure keeps the page and the sentence it was read from (claims).
create table if not exists placement_claim (
  college_code  text primary key,
  year          text,                  -- year stated next to the figures ('2024-25', '2025'), null if none
  highest       integer,               -- rupees per year
  average       integer,
  median        integer,
  placed_pct    numeric(5, 1),
  claims        jsonb not null,        -- [{ metric, value, year, snippet, sourceUrl }]
  crawled_at    date not null,
  run_id        text references ingest_run(id),
  updated_at    timestamptz not null default now()
);
