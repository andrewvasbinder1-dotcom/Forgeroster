begin;
create or replace function public.fr_claim_bug_mail()
returns table(id uuid,title text,category text,severity text,description text,steps text,expected text,actual text,diagnostics jsonb,created_at timestamptz)
language sql security definer set search_path = ''
as $$
  with expired as (
    update forge_private.email_outbox e set state = 'failed'
    where e.state = 'pending' and e.last_attempt is not null and e.last_attempt < now() - interval '5 minutes'
      and (e.attempts >= 5 or exists (
        select 1 from public.bug_reports b where b.id=e.report_id and b.created_at < now() - interval '23 hours'
      ))
  ), candidate as (
    select e.report_id from forge_private.email_outbox e join public.bug_reports b on b.id=e.report_id
    where e.state='pending' and e.attempts < 5
      and (e.last_attempt is null or (e.last_attempt < now() - interval '5 minutes' and b.created_at >= now() - interval '23 hours'))
    order by b.created_at limit 1 for update of e skip locked
  ), claimed as (
    update forge_private.email_outbox e set attempts=attempts+1,last_attempt=now()
    from candidate c where e.report_id=c.report_id returning e.report_id
  )
  select b.id,b.title,b.category,b.severity,b.description,b.steps,b.expected,b.actual,b.diagnostics,b.created_at
  from claimed c join public.bug_reports b on b.id=c.report_id
$$;

create or replace function public.fr_finish_bug_mail(report uuid,outcome text)
returns void language sql security definer set search_path = ''
as $$
  update forge_private.email_outbox set state=outcome,
    delivered_at=case when outcome='sent' then now() else null end
  where report_id=report and state='pending' and outcome in ('sent','failed')
$$;
revoke all on function public.fr_claim_bug_mail(), public.fr_finish_bug_mail(uuid,text) from public, anon, authenticated;
grant execute on function public.fr_claim_bug_mail(), public.fr_finish_bug_mail(uuid,text) to service_role;
commit;
