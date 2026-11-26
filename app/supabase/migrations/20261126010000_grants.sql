-- Newer Supabase projects don't grant table access to the API roles by default.
-- Grants say which operations the API may attempt; the RLS policies in the init
-- migration still decide which rows each user can actually read or change.

grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.canteens, public.foods, public.posts,
                public.comments, public.likes
  to anon, authenticated;

grant update (full_name, faculty, batch) on public.profiles to authenticated;
grant insert on public.canteens, public.foods, public.posts, public.comments, public.likes to authenticated;
grant delete on public.posts, public.comments, public.likes to authenticated;
grant select, insert, update, delete on public.votes to authenticated;
