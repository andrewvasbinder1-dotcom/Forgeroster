begin;
create or replace function public.fr_admin_users(search_uuid text default '')
returns table(id uuid, role text, status text, created_at timestamptz, last_sign_in_at timestamptz, rosters bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  return query select u.id,
    case when a.user_id is null then 'Member' else 'Administrator' end,
    case when u.banned_until > now() then 'Suspended' when u.email_confirmed_at is null then 'Pending verification' else 'Active' end,
    u.created_at, u.last_sign_in_at, (select count(*) from public.rosters r where r.user_id = u.id)
  from auth.users u left join forge_private.admins a on a.user_id = u.id
  where length(coalesce($1,'')) <= 36 and left(u.id::text,length(coalesce($1,''))) = lower(coalesce($1,''))
  order by u.created_at desc,u.id limit 100;
end $$;

create or replace function public.fr_admin_audit()
returns table(actor uuid, action text, resource uuid, detail jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not forge_private.is_admin() then raise exception 'Administrator access required'; end if;
  return query select a.actor,a.action,a.resource,a.detail,a.created_at from forge_private.audit a order by a.id desc limit 100;
end $$;
revoke all on function public.fr_admin_users(text), public.fr_admin_audit() from public, anon, authenticated;
grant execute on function public.fr_admin_users(text), public.fr_admin_audit() to authenticated;
commit;
