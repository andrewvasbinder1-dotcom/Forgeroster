-- Run once in Supabase SQL Editor. Public clients use RLS.
create table if not exists public.rosters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Army',
  faction text not null default '',
  points_limit integer not null default 2000 check(points_limit between 1 and 10000),
  roster_data jsonb not null default '{"units":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists rosters_owner_updated_idx on public.rosters(user_id,updated_at desc);
alter table public.rosters enable row level security;
drop policy if exists "rosters_select_own" on public.rosters;
drop policy if exists "rosters_insert_own" on public.rosters;
drop policy if exists "rosters_update_own" on public.rosters;
drop policy if exists "rosters_delete_own" on public.rosters;
create policy "rosters_select_own" on public.rosters for select to authenticated using ((select auth.uid()) = user_id);
create policy "rosters_insert_own" on public.rosters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rosters_update_own" on public.rosters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rosters_delete_own" on public.rosters for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.rosters to authenticated;
revoke all on public.rosters from anon;
