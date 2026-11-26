-- Profile photos: each student can set their own picture; it shows on their posts,
-- comments, the leaderboard and their public profile.

alter table public.profiles add column avatar_path text;
grant update (avatar_path) on public.profiles to authenticated;

-- The picture must be a file in the student's own photo folder.
drop policy "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and public.owns_photo(avatar_path));

-- Same view plus avatar_path (new columns go last).
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
  pr.full_name,
  pr.avatar_path
from public.profiles pr;
