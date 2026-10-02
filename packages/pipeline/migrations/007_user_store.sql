-- Signed-in students' own data (issue #15): details, option form, compare list, allotment and
-- next-step progress, one row per piece, so each piece syncs on its own ("newest wins").
-- Written by the web app straight to Supabase with the student's session; row-level security
-- limits every row to its owner. The API's database role stays read-only and never sees it.
create table if not exists user_store (
  user_id     uuid not null references auth.users (id) on delete cascade,
  key         text not null check (key in ('profile', 'list', 'compare', 'allotment', 'progress')),
  value       jsonb,                   -- null: the piece was cleared on the student's device
  updated_at  timestamptz not null,    -- when the student changed it (client clock), not when stored
  stored_at   timestamptz not null default now(),
  primary key (user_id, key),
  constraint user_store_value_size check (value is null or pg_column_size(value) <= 262144)
);

alter table user_store enable row level security;

drop policy if exists user_store_select_own on user_store;
create policy user_store_select_own on user_store
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_store_insert_own on user_store;
create policy user_store_insert_own on user_store
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_store_update_own on user_store;
create policy user_store_update_own on user_store
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_store_delete_own on user_store;
create policy user_store_delete_own on user_store
  for delete to authenticated using (user_id = auth.uid());

-- No access for signed-out visitors at all.
revoke all on user_store from anon;
grant select, insert, update, delete on user_store to authenticated;

-- Save one piece unless the stored copy is newer (newest wins, also across two open devices).
-- Runs as the caller, so the policies above still apply. Returns the row that is now stored.
create or replace function put_user_item(p_key text, p_value jsonb, p_updated_at timestamptz)
returns user_store
language sql
security invoker
set search_path = public
as $$
  insert into user_store (user_id, key, value, updated_at)
  values (auth.uid(), p_key, p_value, p_updated_at)
  on conflict (user_id, key) do update
    set value = excluded.value, updated_at = excluded.updated_at, stored_at = now()
    where user_store.updated_at < excluded.updated_at
  returning *;
$$;

revoke all on function put_user_item(text, jsonb, timestamptz) from public, anon;
grant execute on function put_user_item(text, jsonb, timestamptz) to authenticated;
