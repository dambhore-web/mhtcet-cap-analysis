-- 003_add_fees.sql
-- Adds FRA-approved total annual fee to the college table (tuition + development fee).
-- Source: mahafraportal.org (unaided) and State GR (government colleges).
-- Additive only: never modify existing columns.

alter table college add column if not exists total_fees integer; -- INR per annum, approved fee; null = not available
