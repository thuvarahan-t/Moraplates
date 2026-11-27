-- Keep the latest reopening even after the open status has expired so older closures stay cleared.
create table public.canteen_open_reports (
  canteen_id text primary key references public.canteens on delete cascade,
  reported_at timestamptz not null
);
alter table public.canteen_open_reports enable row level security;
revoke all on public.canteen_open_reports from public, anon, authenticated;

create or replace function public.report_canteen_closed(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  last_reopen timestamptz;
  report_time timestamptz;
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;

  -- A close and a reopen for the same canteen must see each other in order.
  perform 1 from public.canteens where id = canteen for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  select o.reported_at into last_reopen from public.canteen_open_reports o where o.canteen_id = canteen;
  report_time := greatest(clock_timestamp(), last_reopen + interval '1 microsecond');

  insert into public.canteen_closure_reports as r (canteen_id, user_id, reported_at, expires_at)
  values (canteen, auth.uid(), report_time, report_time + interval '60 minutes')
  on conflict (canteen_id, user_id) do update
    set reported_at = excluded.reported_at, expires_at = excluded.expires_at
    where r.expires_at <= report_time or r.reported_at <= last_reopen;
end
$$;

create or replace function public.report_canteen_closed_today(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  last_reopen timestamptz;
  report_time timestamptz;
  midnight timestamptz;
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;

  perform 1 from public.canteens where id = canteen for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  select o.reported_at into last_reopen from public.canteen_open_reports o where o.canteen_id = canteen;
  report_time := greatest(clock_timestamp(), last_reopen + interval '1 microsecond');
  midnight := (date_trunc('day', report_time at time zone 'Asia/Colombo') + interval '1 day') at time zone 'Asia/Colombo';

  insert into public.canteen_closure_reports as r (canteen_id, user_id, reported_at, expires_at)
  values (canteen, auth.uid(), report_time, midnight)
  on conflict (canteen_id, user_id) do update
    set reported_at = excluded.reported_at, expires_at = excluded.expires_at
    where r.expires_at <> excluded.expires_at or r.reported_at <= last_reopen;
end
$$;

create function public.report_canteen_open(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  last_reopen timestamptz;
  active_closure timestamptz;
  report_time timestamptz;
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;

  perform 1 from public.canteens where id = canteen for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  select o.reported_at into last_reopen from public.canteen_open_reports o where o.canteen_id = canteen;
  report_time := clock_timestamp();
  select max(r.reported_at) into active_closure
  from public.canteen_closure_reports r
  where r.canteen_id = canteen and r.expires_at > report_time
    and (last_reopen is null or r.reported_at > last_reopen);
  if active_closure is null then
    return;
  end if;

  insert into public.canteen_open_reports (canteen_id, reported_at)
  values (canteen, greatest(report_time, active_closure))
  on conflict (canteen_id) do update set reported_at = excluded.reported_at;
end
$$;

revoke all on function public.report_canteen_open(text) from public, anon;
grant execute on function public.report_canteen_open(text) to authenticated;

create or replace view public.canteen_standings as
select c.id, c.name, c.location, c.lat, c.lng, c.opens_at, c.closes_at, c.known_for, c.colour, c.photo_path,
  coalesce(v.votes, 0)::int as votes_this_week,
  closed.reported_closed_until,
  case when closed.latest_report_at is null and o.reported_at + interval '60 minutes' > now()
    then o.reported_at + interval '60 minutes' end as reported_open_until
from public.canteens c
left join (select canteen_id, count(*) as votes from public.votes where week_start = public.vote_week() group by canteen_id) v
  on v.canteen_id = c.id
left join public.canteen_open_reports o on o.canteen_id = c.id
left join lateral (
  select max(r.expires_at) filter (where r.expires_at > now()) as reported_closed_until,
         max(r.reported_at) as latest_report_at
  from public.canteen_closure_reports r
  where r.canteen_id = c.id
    and (o.reported_at is null or r.reported_at > o.reported_at)
) closed on true;
