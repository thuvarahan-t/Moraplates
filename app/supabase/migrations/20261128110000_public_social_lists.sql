-- The profile-follows primary key covers the outgoing cursor.
create index profile_follows_followed_follower_idx
  on public.profile_follows (followed_id, follower_id);
drop index public.profile_follows_followed_idx;

-- Publish the two directions of a single profile's follow list using only
-- profile fields that are already public. Leave the underlying RLS untouched.
create function public.profile_follow_list(
  target uuid,
  direction text,
  after_id uuid default null,
  page_size integer default 25
)
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
    order by member_id
    limit least(greatest(coalesce(page_size, 25), 0), 51)
  ) members
  join public.profiles p on p.id = members.member_id
  order by p.id
$$;

revoke all on function public.profile_follow_list(uuid, text, uuid, integer) from public;
grant execute on function public.profile_follow_list(uuid, text, uuid, integer) to anon, authenticated;

-- Likes and profiles already have public read policies. Keep those policies
-- active when joining the two resources for a single post.
create function public.post_liker_list(
  target uuid,
  after_id uuid default null,
  page_size integer default 25
)
returns table (id uuid, full_name text, faculty text, batch text, avatar_path text)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.full_name, p.faculty, p.batch, p.avatar_path
  from (
    select l.user_id
    from public.likes l
    where l.post_id = target and (after_id is null or l.user_id > after_id)
    order by l.user_id
    limit least(greatest(coalesce(page_size, 25), 0), 51)
  ) likers
  join public.profiles p on p.id = likers.user_id
  order by p.id
$$;

revoke all on function public.post_liker_list(uuid, uuid, integer) from public;
grant execute on function public.post_liker_list(uuid, uuid, integer) to anon, authenticated;
