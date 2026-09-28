-- 002_add_district_type.sql
-- Adds district and college_type to the college table (FR-008 / issue #115).
-- Values are loaded by the pipeline loader from data/processed/<year>/college-meta.json.
-- Additive only: never modify existing columns.

alter table college add column if not exists district text;
alter table college add column if not exists college_type text;

create index if not exists college_district_idx on college (district);
create index if not exists college_type_idx on college (college_type);
