begin;

create table if not exists forge_private.keyword_triage (
  faction text not null check (char_length(faction) between 1 and 120),
  category text not null check (char_length(category) between 1 and 80),
  keyword text not null check (char_length(keyword) between 1 and 180),
  status text not null check (status in ('pending', 'researching', 'resolved')),
  note text not null default '' check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (faction, category, keyword)
);
alter table forge_private.keyword_triage enable row level security;
revoke all on forge_private.keyword_triage from public, anon, authenticated;

create or replace function public.fr_keyword_triage_list(p_faction text)
returns table (category text, keyword text, status text, note text, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  return query select t.category, t.keyword, t.status, t.note, t.updated_at
    from forge_private.keyword_triage t where t.faction = p_faction
    order by t.category, t.keyword;
end;
$$;

create or replace function public.fr_keyword_triage_save(
  p_faction text, p_category text, p_keyword text, p_status text, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  insert into forge_private.keyword_triage (faction, category, keyword, status, note, updated_by)
    values (p_faction, p_category, p_keyword, p_status, p_note, auth.uid())
    on conflict (faction, category, keyword) do update
      set status = excluded.status, note = excluded.note, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.fr_keyword_triage_list(text) from public, anon, authenticated;
revoke all on function public.fr_keyword_triage_save(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.fr_keyword_triage_list(text) to authenticated;
grant execute on function public.fr_keyword_triage_save(text,text,text,text,text) to authenticated;
commit;
