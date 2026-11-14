-- Apply in the ForgeRoster project's Supabase SQL Editor.
create table if not exists public.combat_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  scenario jsonb not null check (jsonb_typeof(scenario) = 'object' and octet_length(scenario::text) <= 120000),
  created_at timestamptz not null default now()
);
create index if not exists combat_scenarios_owner_created on public.combat_scenarios (user_id, created_at desc);
alter table public.combat_scenarios enable row level security;
revoke all on public.combat_scenarios from public, anon, authenticated;
grant select, insert, delete on public.combat_scenarios to authenticated;
drop policy if exists combat_select_own on public.combat_scenarios;
drop policy if exists combat_insert_own on public.combat_scenarios;
drop policy if exists combat_delete_own on public.combat_scenarios;
create policy combat_select_own on public.combat_scenarios for select to authenticated using ((select auth.uid()) = user_id);
create policy combat_insert_own on public.combat_scenarios for insert to authenticated with check ((select auth.uid()) = user_id);
create policy combat_delete_own on public.combat_scenarios for delete to authenticated using ((select auth.uid()) = user_id);
