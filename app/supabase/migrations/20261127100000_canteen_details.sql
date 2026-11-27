-- Minute-level schedules supplement the original whole-hour columns for older clients.
alter table public.canteens
  add column opens_minute smallint,
  add column closes_minute smallint,
  add column primary_photo_id uuid,
  add constraint canteens_minute_schedule_check check (
    (opens_minute is null and closes_minute is null) or
    (opens_minute is not null and closes_minute is not null
      and opens_minute >= 0 and closes_minute <= 1440 and opens_minute < closes_minute)
  );

alter table public.canteen_photos add constraint canteen_photos_canteen_id_photo_id_key unique (canteen_id, id);
alter table public.canteens add constraint canteens_primary_photo_fkey
  foreign key (id, primary_photo_id) references public.canteen_photos (canteen_id, id)
  on delete set null (primary_photo_id);

create or replace function public.admin_save(kind text, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target text := nullif(p->>'id', '');
  opening smallint;
  closing smallint;
  affected integer;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if kind = 'canteens' then
    opening := (p->>'opens_minute')::smallint;
    closing := (p->>'closes_minute')::smallint;
    if target is null then
      insert into public.canteens(name, location, lat, lng, opens_at, closes_at, opens_minute, closes_minute, known_for, colour)
      values (btrim(p->>'name'), btrim(p->>'location'), nullif(p->>'lat', '')::double precision,
        nullif(p->>'lng', '')::double precision, coalesce(opening / 60, (p->>'opens_at')::smallint),
        coalesce((closing + 59) / 60, (p->>'closes_at')::smallint), opening, closing,
        nullif(p->>'known_for', ''), coalesce(nullif(p->>'colour', ''), '#E8492F'));
      return;
    end if;
    update public.canteens set name = btrim(p->>'name'), location = btrim(p->>'location'),
      lat = nullif(p->>'lat', '')::double precision, lng = nullif(p->>'lng', '')::double precision,
      opens_at = coalesce(opening / 60, (p->>'opens_at')::smallint),
      closes_at = coalesce((closing + 59) / 60, (p->>'closes_at')::smallint),
      opens_minute = opening, closes_minute = closing, known_for = nullif(p->>'known_for', ''),
      colour = coalesce(nullif(p->>'colour', ''), '#E8492F'),
      primary_photo_id = case when p ? 'primary_photo_id' then nullif(p->>'primary_photo_id', '')::uuid else primary_photo_id end
    where id = target;
  elsif kind = 'foods' then
    if target is null then
      insert into public.foods(canteen_id, name, price) values(p->>'canteen_id', btrim(p->>'name'), (p->>'price')::integer);
      return;
    end if;
    update public.foods set name = btrim(p->>'name'), price = (p->>'price')::integer where id = target::uuid;
  elsif kind = 'posts' then
    update public.posts set caption = coalesce(p->>'caption', ''), rating = (p->>'rating')::public.rating where id = target::uuid;
  elsif kind = 'comments' then
    update public.comments set body = btrim(p->>'body') where id = target::uuid;
  elsif kind = 'profiles' then
    update public.profiles set full_name = btrim(p->>'full_name'), faculty = nullif(p->>'faculty', ''), batch = nullif(p->>'batch', '') where id = target::uuid;
  else raise exception 'Resource cannot be edited';
  end if;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Record not found'; end if;
end
$$;

create or replace view public.canteen_standings as
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
left join (select canteen_id, count(*) as votes from public.votes where week_start = public.vote_week() group by canteen_id) v
  on v.canteen_id = c.id
left join public.canteen_photos cover on cover.canteen_id = c.id and cover.id = c.primary_photo_id
left join public.profiles author on author.id = cover.user_id
left join public.canteen_open_reports o on o.canteen_id = c.id
left join lateral (
  select max(r.expires_at) filter (where r.expires_at > now()) as reported_closed_until,
    max(r.expires_at) filter (where r.expires_at =
      (date_trunc('day', r.reported_at at time zone 'Asia/Colombo') + interval '1 day') at time zone 'Asia/Colombo'
    ) as reported_closed_today_until,
    max(r.reported_at) as latest_report_at
  from public.canteen_closure_reports r
  where r.canteen_id = c.id and (o.reported_at is null or r.reported_at > o.reported_at)
) closed on true;
