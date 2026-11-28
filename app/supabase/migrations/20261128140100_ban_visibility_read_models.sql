-- Keep reopening attribution so the latest visible report can still be found
-- when another reporter is banned. Historical rows did not record a reporter.
alter table public.canteen_open_reports
  add column reported_by uuid references public.profiles(id) on delete cascade,
  drop constraint canteen_open_reports_pkey,
  add constraint canteen_open_reports_reporter_key unique nulls not distinct (canteen_id, reported_by);

create function app_private.canteen_latest_visible_reopen(target_canteen text) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select max(o.reported_at)
  from public.canteen_open_reports o
  where o.canteen_id = target_canteen
    and app_private.canteen_content_visible(target_canteen)
    and app_private.account_content_visible(o.reported_by)
$$;
revoke all on function app_private.canteen_latest_visible_reopen(text) from public, anon, authenticated;
grant execute on function app_private.canteen_latest_visible_reopen(text) to anon, authenticated, service_role;

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
  perform 1 from public.canteens where id = canteen and app_private.account_content_visible(created_by) for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  last_reopen := app_private.canteen_latest_visible_reopen(canteen);
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

  perform 1 from public.canteens where id = canteen and app_private.account_content_visible(created_by) for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  last_reopen := app_private.canteen_latest_visible_reopen(canteen);
  report_time := greatest(clock_timestamp(), last_reopen + interval '1 microsecond');
  midnight := (date_trunc('day', (report_time at time zone 'Asia/Colombo')) + interval '1 day') at time zone 'Asia/Colombo';

  insert into public.canteen_closure_reports as r (canteen_id, user_id, reported_at, expires_at)
  values (canteen, auth.uid(), report_time, midnight)
  on conflict (canteen_id, user_id) do update
    set reported_at = excluded.reported_at, expires_at = excluded.expires_at
    where r.expires_at <> excluded.expires_at or r.reported_at <= last_reopen;
end
$$;

create or replace function public.report_canteen_open(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  last_reopen timestamptz;
  active_closure timestamptz;
  report_time timestamptz;
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;

  perform 1 from public.canteens where id = canteen and app_private.account_content_visible(created_by) for no key update;
  if not found then
    raise exception 'Canteen not found' using errcode = '23503';
  end if;
  last_reopen := app_private.canteen_latest_visible_reopen(canteen);
  report_time := clock_timestamp();
  select max(r.reported_at) into active_closure
  from public.canteen_closure_reports r
  where r.canteen_id = canteen and r.expires_at > report_time
    and (last_reopen is null or r.reported_at > last_reopen)
    and app_private.account_content_visible(r.user_id);
  if active_closure is null then
    return;
  end if;

  insert into public.canteen_open_reports (canteen_id, reported_by, reported_at)
  values (canteen, auth.uid(), greatest(report_time, active_closure))
  on conflict on constraint canteen_open_reports_reporter_key do update set reported_at = excluded.reported_at;
end
$$;

-- This view counts private votes and status reports as the owner, so it must
-- apply the same visibility rules explicitly. The food and profile stats views
-- already run as the caller and inherit table visibility policies.
create or replace view public.canteen_standings with (security_barrier = true) as
select c.id, c.name, c.location, c.lat, c.lng, c.opens_at, c.closes_at, c.known_for, c.colour, c.photo_path,
  coalesce(v.votes, 0)::int as votes_this_week,
  closed.reported_closed_until,
  case when closed.latest_report_at is null and o.reported_at + interval '60 minutes' > now()
    then o.reported_at + interval '60 minutes' end as reported_open_until,
  closed.reported_closed_today_until,
  greatest(closed.latest_report_at, o.reported_at) as last_reported_at,
  case when closed.latest_report_at is not null then 'closed' when o.reported_at is not null then 'open' end as last_reported_status,
  c.opens_minute, c.closes_minute,
  cover.id as primary_photo_id, cover.photo_path as primary_photo_path,
  cover.user_id as primary_photo_user_id, author.full_name as primary_photo_author
from public.canteens c
left join (
  select canteen_id, count(*) as votes
  from public.votes
  where week_start = public.vote_week() and app_private.account_content_visible(user_id)
  group by canteen_id
) v on v.canteen_id = c.id
left join public.canteen_photos cover on cover.canteen_id = c.id and cover.id = c.primary_photo_id
  and app_private.account_content_visible(cover.user_id)
left join public.profiles author on author.id = cover.user_id
left join lateral (select app_private.canteen_latest_visible_reopen(c.id) as reported_at) o on true
left join lateral (
  select max(r.expires_at) filter (where r.expires_at > now()) as reported_closed_until,
    max(r.expires_at) filter (where r.expires_at =
      (date_trunc('day', r.reported_at at time zone 'Asia/Colombo') + interval '1 day') at time zone 'Asia/Colombo'
    ) as reported_closed_today_until,
    max(r.reported_at) as latest_report_at
  from public.canteen_closure_reports r
  where r.canteen_id = c.id and (o.reported_at is null or r.reported_at > o.reported_at)
    and app_private.account_content_visible(r.user_id)
) closed on true
where app_private.account_content_visible(c.created_by);

create or replace function public.profile_follow_summary(target uuid)
returns table (followers bigint, following bigint, viewer_follows boolean)
language sql stable security definer set search_path = '' as $$
  select case when account.visible then (
    select count(*) from public.profile_follows f where f.followed_id = target
      and app_private.account_content_visible(f.follower_id)
  ) else 0 end,
  case when account.visible then (
    select count(*) from public.profile_follows f where f.follower_id = target
      and app_private.account_content_visible(f.followed_id)
  ) else 0 end,
  account.visible and (select public.account_access_status()) = 'active'
    and exists (select 1 from public.profile_follows f where f.follower_id = (select auth.uid()) and f.followed_id = target)
  from (select app_private.account_content_visible(target) as visible) account
$$;

create or replace function public.profile_follow_list(target uuid, direction text, after_id uuid default null, page_size integer default 25)
returns table (id uuid, full_name text, faculty text, batch text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.faculty, p.batch, p.avatar_path
  from (
    select f.follower_id as member_id
    from public.profile_follows f
    where direction = 'followers' and f.followed_id = target
      and (after_id is null or f.follower_id > after_id)
    union all
    select f.followed_id as member_id
    from public.profile_follows f
    where direction = 'following' and f.follower_id = target
      and (after_id is null or f.followed_id > after_id)
  ) members
  join public.profiles p on p.id = members.member_id
  where app_private.account_content_visible(target) and app_private.account_content_visible(p.id)
  order by p.id
  limit least(greatest(coalesce(page_size, 25), 0), 51)
$$;

-- Apply row visibility before limiting the page so hidden users do not leave gaps.
create or replace function public.post_liker_list(target uuid, after_id uuid default null, page_size integer default 25)
returns table (id uuid, full_name text, faculty text, batch text, avatar_path text)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.full_name, p.faculty, p.batch, p.avatar_path
  from public.likes l
  join public.profiles p on p.id = l.user_id
  where l.post_id = target and (after_id is null or p.id > after_id)
  order by p.id
  limit least(greatest(coalesce(page_size, 25), 0), 51)
$$;

create or replace function public.set_canteen_pin(target_canteen text, pinned boolean) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null or not public.is_student() then
    raise exception 'Only signed-in @uom.lk accounts can pin canteens' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = viewer for update;
  if not found then
    raise exception 'Student profile not found' using errcode = '42501';
  end if;

  if pinned then
    if not app_private.canteen_content_visible(target_canteen) then
      raise exception 'Canteen not found' using errcode = '23503';
    end if;
    if not exists (select from public.canteen_pins where user_id = viewer and canteen_id = target_canteen) then
      if (select count(*) from public.canteen_pins where user_id = viewer) >= 3 then
        raise exception 'You can pin up to 3 canteens. Unpin one first.';
      end if;
      insert into public.canteen_pins (user_id, canteen_id) values (viewer, target_canteen);
    end if;
  else
    delete from public.canteen_pins where user_id = viewer and canteen_id = target_canteen;
  end if;

  return array(
    select canteen_id from public.canteen_pins
    where user_id = viewer and app_private.canteen_content_visible(canteen_id)
    order by pinned_at, canteen_id
  );
end
$$;
