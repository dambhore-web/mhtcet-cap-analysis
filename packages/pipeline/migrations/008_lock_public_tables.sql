-- Close Supabase's public API to the data tables (#131; Supabase "RLS disabled" warning).
-- Tables created with plain SQL in schema public get row-level security OFF and full rights for the
-- anon and authenticated roles, so anyone holding the public anon key could read, change or delete
-- them through Supabase's REST API. Nothing in the app uses that API for these tables: the API and
-- the pipeline connect as the table owner, which row-level security doesn't apply to.
--
-- After this: every table in public has row-level security on; anon and authenticated have no table
-- rights except the student's own user_store rows (007); new tables start closed too.

do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('revoke all on table public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;

-- user_store stays usable by signed-in students, through its own-rows policies (007)
grant select, insert, update, delete on public.user_store to authenticated;

-- tables, sequences and functions created later start closed as well
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
