begin;
create schema if not exists forge_private;
revoke all on schema forge_private from public;
grant usage on schema forge_private to authenticated;
create table if not exists forge_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on forge_private.admins from public, anon, authenticated;

create or replace function forge_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from forge_private.admins where user_id = (select auth.uid())) $$;
revoke all on function forge_private.is_admin() from public;
grant execute on function forge_private.is_admin() to authenticated;

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  title text not null check (length(title) between 1 and 160),
  category text not null check (category in ('Army Builder','Datasheets','Points','Wargear','Combat Calculator','Account and Sync','UI and Display','Performance','Other')),
  severity text not null check (severity in ('Low','Medium','High','Critical')),
  description text not null check (length(description) between 1 and 4000),
  steps text not null check (length(steps) <= 4000),
  expected text not null check (length(expected) <= 2000),
  actual text not null check (length(actual) <= 2000),
  contact text check (length(contact) <= 254),
  diagnostics jsonb not null default '{}' check (jsonb_typeof(diagnostics) = 'object' and length(diagnostics::text) <= 3000),
  screenshot bytea check (octet_length(screenshot) <= 524288),
  status text not null default 'New' check (status in ('New','Investigating','Confirmed','In Progress','Fixed','Closed','Duplicate')),
  internal_note text not null default '' check (length(internal_note) <= 4000),
  issue_url text not null default '' check (length(issue_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bug_reports_reporter_time on public.bug_reports(reporter_id,created_at desc);
create index if not exists bug_reports_creation on public.bug_reports(created_at desc);
alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from public, anon, authenticated;
grant select on public.bug_reports to authenticated;
drop policy if exists bug_reports_admin_read on public.bug_reports;
create policy bug_reports_admin_read on public.bug_reports for select to authenticated using ((select forge_private.is_admin()));

create table if not exists forge_private.audit (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  resource uuid not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on forge_private.audit from public, anon, authenticated;

create table if not exists forge_private.email_outbox (
  report_id uuid primary key references public.bug_reports(id),
  attempts integer not null default 0,
  state text not null default 'pending' check (state in ('pending','sent','failed')),
  last_attempt timestamptz,
  delivered_at timestamptz
);
revoke all on forge_private.email_outbox from public, anon, authenticated;

create or replace function public.fr_admin_access()
returns boolean language sql stable set search_path = ''
as $$ select forge_private.is_admin() $$;

create or replace function public.fr_submit_bug(title text, category text, severity text, description text,
  steps text, expected text, actual text, contact text, diagnostics jsonb, screenshot_base64 text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare reporter uuid := auth.uid(); report uuid; image bytea;
begin
  if reporter is null then raise exception 'Sign in to submit a report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(reporter::text, 0));
  if (select count(*) from public.bug_reports r where r.reporter_id = reporter
      and r.created_at >= now() - interval '1 hour') >= 5 then
    raise exception 'Report limit reached. Try again later.';
  end if;
  if contact is not null and trim(contact) <> '' and trim(contact) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid contact email';
  end if;
  if screenshot_base64 is not null then
    if length(screenshot_base64) > 699052 then raise exception 'Screenshot exceeds 512 KB'; end if;
    image := decode(screenshot_base64, 'base64');
    if octet_length(image) < 33 or substring(image for 8) <> decode('89504e470d0a1a0a','hex')
      or substring(image from 13 for 4) <> decode('49484452','hex') then
      raise exception 'Screenshot must be a PNG';
    end if;
  end if;
  insert into public.bug_reports(reporter_id,title,category,severity,description,steps,expected,actual,contact,diagnostics,screenshot)
  values (reporter,trim(title),category,severity,trim(description),steps,expected,actual,nullif(trim(contact),''),coalesce(diagnostics,'{}'),image)
  returning id into report;
  insert into forge_private.email_outbox(report_id) values (report);
  return report;
end $$;

create or replace function public.fr_update_bug(report uuid, next_status text, note text, link text)
returns void language plpgsql security definer set search_path = ''
as $$
declare previous text;
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  if link <> '' and link !~ '^https://github[.]com/andrewvasbinder1-dotcom/Forgeroster/(issues/[0-9]+|commit/[0-9a-f]{7,40})$' then
    raise exception 'Use a ForgeRoster GitHub issue or commit URL';
  end if;
  select status into strict previous from public.bug_reports where id = report for update;
  update public.bug_reports set status = next_status, internal_note = note, issue_url = link, updated_at = now() where id = report;
  insert into forge_private.audit(actor,action,resource,detail)
  values (auth.uid(),'bug.update',report,jsonb_build_object('from',previous,'to',next_status));
end $$;

create or replace function public.fr_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  return jsonb_build_object(
    'registered', (select count(*) from auth.users),
    'signedInLast30Days', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'rosters', (select count(*) from public.rosters),
    'reports', (select count(*) from public.bug_reports),
    'criticalOpen', (select count(*) from public.bug_reports where severity = 'Critical' and status not in ('Fixed','Closed','Duplicate')),
    'open', (select count(*) from public.bug_reports where status not in ('Fixed','Closed','Duplicate')),
    'emailPending', (select count(*) from forge_private.email_outbox where state = 'pending'),
    'emailSent', (select count(*) from forge_private.email_outbox where state = 'sent'),
    'emailFailed', (select count(*) from forge_private.email_outbox where state = 'failed'));
end $$;

revoke all on function public.fr_admin_access() from public, anon;
revoke all on function public.fr_submit_bug(text,text,text,text,text,text,text,text,jsonb,text) from public, anon;
revoke all on function public.fr_update_bug(uuid,text,text,text) from public, anon;
revoke all on function public.fr_admin_overview() from public, anon;
grant execute on function public.fr_admin_access(), public.fr_submit_bug(text,text,text,text,text,text,text,text,jsonb,text),
  public.fr_update_bug(uuid,text,text,text), public.fr_admin_overview() to authenticated;
commit;
