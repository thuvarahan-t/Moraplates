-- Voting helpers (the server decides which week it is) and names on profile_stats.

-- The signed-in student's vote for the current week, or null.
create function public.my_vote() returns text
language sql stable set search_path = '' as $$
  select canteen_id from public.votes where user_id = auth.uid() and week_start = public.vote_week()
$$;

-- Vote for a canteen this week, replacing any earlier vote this week. RLS still applies.
create function public.cast_vote(canteen text) returns void
language sql set search_path = '' as $$
  insert into public.votes (canteen_id) values (canteen)
  on conflict (user_id, week_start) do update set canteen_id = excluded.canteen_id, updated_at = now()
$$;

create function public.remove_vote() returns void
language sql set search_path = '' as $$
  delete from public.votes where user_id = auth.uid() and week_start = public.vote_week()
$$;

grant execute on function public.my_vote(), public.cast_vote(text), public.remove_vote() to authenticated;

-- Same view as before plus full_name (new columns must go last for create or replace).
create or replace view public.profile_stats with (security_invoker = true) as
select pr.id as user_id,
  (select count(*) from public.posts p where p.user_id = pr.id)::int as plates,
  (select count(distinct p.canteen_id) from public.posts p where p.user_id = pr.id)::int as canteens_tried,
  (select count(*) from public.posts p join public.foods f on f.id = p.food_id
     where p.user_id = pr.id and f.name ilike '%kottu%')::int as kottu_plates,
  (select count(*) from public.posts p where p.user_id = pr.id and p.rating = 'super')::int as super_given,
  (select count(*) from public.posts p
     where p.user_id = pr.id and extract(hour from p.created_at at time zone 'Asia/Colombo') >= 21)::int as night_plates,
  (select count(*) from public.posts p
     where p.user_id = pr.id and extract(hour from p.created_at at time zone 'Asia/Colombo') < 8)::int as early_plates,
  (select count(*) from public.likes l join public.posts p on p.id = l.post_id where p.user_id = pr.id)::int as likes_received,
  (select count(*) from public.comments c where c.user_id = pr.id)::int as comments_made,
  (select count(*) from public.canteens c where c.created_by = pr.id)::int as canteens_added,
  (select count(*) from public.foods f where f.created_by = pr.id)::int as foods_added,
  pr.full_name
from public.profiles pr;
