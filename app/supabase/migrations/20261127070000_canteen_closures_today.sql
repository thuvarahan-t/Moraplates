-- Preserve the original 60-minute expiry for reports that are already recorded.
alter table public.canteen_closure_reports add column expires_at timestamptz;
update public.canteen_closure_reports set expires_at = reported_at + interval '60 minutes';
alter table public.canteen_closure_reports
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '60 minutes');

create or replace function public.report_canteen_closed(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;
  insert into public.canteen_closure_reports as r (canteen_id, user_id)
  values (canteen, auth.uid())
  on conflict (canteen_id, user_id) do update
    set reported_at = excluded.reported_at, expires_at = excluded.expires_at
    where r.expires_at <= now();
end
$$;

create function public.report_canteen_closed_today(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  midnight timestamptz :=
    (date_trunc('day', now() at time zone 'Asia/Colombo') + interval '1 day') at time zone 'Asia/Colombo';
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;
  insert into public.canteen_closure_reports as r (canteen_id, user_id, expires_at)
  values (canteen, auth.uid(), midnight)
  on conflict (canteen_id, user_id) do update
    set reported_at = excluded.reported_at, expires_at = excluded.expires_at
    where r.expires_at <> excluded.expires_at;
end
$$;

revoke all on function public.report_canteen_closed_today(text) from public, anon;
grant execute on function public.report_canteen_closed_today(text) to authenticated;

create or replace view public.canteen_standings as
select c.id, c.name, c.location, c.lat, c.lng, c.opens_at, c.closes_at, c.known_for, c.colour, c.photo_path,
  coalesce(v.votes, 0)::int as votes_this_week,
  (select max(r.expires_at) from public.canteen_closure_reports r
    where r.canteen_id = c.id and r.expires_at > now()) as reported_closed_until
from public.canteens c
left join (select canteen_id, count(*) as votes from public.votes where week_start = public.vote_week() group by canteen_id) v
  on v.canteen_id = c.id;
