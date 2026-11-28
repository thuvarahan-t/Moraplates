-- Keep authorship filters away from the Data API's exposed schemas.
create schema app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

create function app_private.account_content_visible(target_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from auth.users u where u.id = target_user_id and u.banned_until > now()
  ) or (select public.is_admin())
$$;

-- Missing resources keep their existing not-found and foreign-key behavior.
-- Legacy catalog entries without a creator remain visible.
create function app_private.canteen_content_visible(target text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.canteens c
    where c.id = target and not app_private.account_content_visible(c.created_by)
  )
$$;

create function app_private.food_content_visible(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.foods f
    where f.id = target and (
      not app_private.account_content_visible(f.created_by)
      or not app_private.canteen_content_visible(f.canteen_id)
    )
  )
$$;

create function app_private.post_content_visible(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.posts p
    where p.id = target and not app_private.account_content_visible(p.user_id)
  )
$$;

revoke all on function app_private.account_content_visible(uuid), app_private.canteen_content_visible(text),
  app_private.food_content_visible(uuid), app_private.post_content_visible(uuid) from public, anon, authenticated;
grant execute on function app_private.account_content_visible(uuid), app_private.canteen_content_visible(text),
  app_private.food_content_visible(uuid), app_private.post_content_visible(uuid) to anon, authenticated, service_role;

create policy "visible account profiles" on public.profiles as restrictive
  for select to anon, authenticated using (app_private.account_content_visible(id));

create policy "visible account posts" on public.posts as restrictive
  for select to anon, authenticated using (app_private.account_content_visible(user_id));

create policy "visible account comments" on public.comments as restrictive
  for select to anon, authenticated using (
    app_private.account_content_visible(user_id) and app_private.post_content_visible(post_id)
  );

create policy "visible account likes" on public.likes as restrictive
  for select to anon, authenticated using (
    app_private.account_content_visible(user_id) and app_private.post_content_visible(post_id)
  );

create policy "visible account canteens" on public.canteens as restrictive
  for select to anon, authenticated using (app_private.account_content_visible(created_by));

create policy "visible account foods" on public.foods as restrictive
  for select to anon, authenticated using (
    app_private.account_content_visible(created_by) and app_private.canteen_content_visible(canteen_id)
  );

create policy "visible account canteen photos" on public.canteen_photos as restrictive
  for select to anon, authenticated using (
    app_private.account_content_visible(user_id) and app_private.canteen_content_visible(canteen_id)
  );

create policy "visible account follows" on public.profile_follows as restrictive
  for select to authenticated using (
    app_private.account_content_visible(follower_id) and app_private.account_content_visible(followed_id)
  );

create policy "visible account notifications" on public.notifications as restrictive
  for select to authenticated using (
    app_private.account_content_visible(actor_id) and app_private.post_content_visible(post_id)
  );

create policy "visible post history" on public.post_views as restrictive
  for select to authenticated using (app_private.post_content_visible(post_id));

create policy "visible canteen pins" on public.canteen_pins as restrictive
  for select to authenticated using (app_private.canteen_content_visible(canteen_id));

-- Refuse new interactions with targets that cannot be read. Existing vote rows
-- are still writable so students can switch away from a newly hidden canteen.
create policy "like a visible post" on public.likes as restrictive for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id));

create policy "comment on a visible post" on public.comments as restrictive for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id));

create policy "record a visible post view" on public.post_views as restrictive for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id));

create policy "follow a visible profile" on public.profile_follows as restrictive for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = followed_id));

create policy "post about visible food" on public.posts as restrictive for insert to authenticated
  with check (exists (select 1 from public.foods f where f.id = food_id));

create policy "add food to a visible canteen" on public.foods as restrictive for insert to authenticated
  with check (exists (select 1 from public.canteens c where c.id = canteen_id));

create policy "add a photo to a visible canteen" on public.canteen_photos as restrictive for insert to authenticated
  with check (exists (select 1 from public.canteens c where c.id = canteen_id));

create policy "vote for a visible canteen" on public.votes as restrictive for insert to authenticated
  with check (exists (select 1 from public.canteens c where c.id = canteen_id));

create policy "change vote to a visible canteen" on public.votes as restrictive for update to authenticated
  with check (exists (select 1 from public.canteens c where c.id = canteen_id));

create or replace function public.my_vote() returns text
language sql stable set search_path = '' as $$
  select canteen_id from public.votes
  where user_id = auth.uid() and week_start = public.vote_week()
    and app_private.canteen_content_visible(canteen_id)
$$;

-- Guard existing security-definer mutation bodies without duplicating their
-- image cleanup, validation, and row locking.
alter function public.update_food(uuid, text, integer) set schema app_private;
alter function public.edit_own_post(uuid, text, uuid, public.rating, text, text) set schema app_private;
alter function public.moderate_delete(text, jsonb) set schema app_private;

revoke all on function app_private.update_food(uuid, text, integer),
  app_private.edit_own_post(uuid, text, uuid, public.rating, text, text),
  app_private.moderate_delete(text, jsonb) from public, anon, authenticated;

create function public.update_food(target_food uuid, new_name text, new_price integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.food_content_visible(target_food) then
    raise exception 'Food not found' using errcode = 'P0002';
  end if;
  perform app_private.update_food(target_food, new_name, new_price);
end
$$;

create function public.edit_own_post(
  target_post uuid, target_canteen text, target_food uuid, target_rating public.rating,
  target_caption text, target_photo_path text default null
)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.canteen_content_visible(target_canteen) or not app_private.food_content_visible(target_food) then
    raise exception 'Food not found' using errcode = 'P0002';
  end if;
  return app_private.edit_own_post(target_post, target_canteen, target_food, target_rating, target_caption, target_photo_path);
end
$$;

create function public.moderate_delete(kind text, p jsonb) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  target text := nullif(p->>'id', '');
  visible boolean;
begin
  if not public.is_content_moderator() then
    raise exception 'Content moderation access required' using errcode = '42501';
  end if;

  if target is not null and not public.is_admin() then
    visible := case
      when kind in ('posts', 'post_photos') then app_private.post_content_visible(target::uuid)
      when kind = 'profile_avatars' then app_private.account_content_visible(target::uuid)
      when kind in ('canteens', 'canteen_covers', 'canteen_status_reports') then app_private.canteen_content_visible(target)
      when kind in ('foods', 'food_photos') then app_private.food_content_visible(target::uuid)
      when kind = 'comments' then not exists (
        select 1 from public.comments c where c.id = target::uuid and (
          not app_private.account_content_visible(c.user_id) or not app_private.post_content_visible(c.post_id)
        )
      )
      when kind = 'canteen_photos' then not exists (
        select 1 from public.canteen_photos g where g.id = target::uuid and (
          not app_private.account_content_visible(g.user_id) or not app_private.canteen_content_visible(g.canteen_id)
        )
      )
      else true
    end;
    if not visible then raise exception 'This item changed or was already removed' using errcode = 'P0002'; end if;
  end if;

  return app_private.moderate_delete(kind, p);
end
$$;

revoke all on function public.update_food(uuid, text, integer),
  public.edit_own_post(uuid, text, uuid, public.rating, text, text), public.moderate_delete(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_food(uuid, text, integer),
  public.edit_own_post(uuid, text, uuid, public.rating, text, text), public.moderate_delete(text, jsonb)
  to authenticated;

-- Only an opaque revision is exposed. No account ID or ban reason is published.
create table app_private.content_visibility_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
insert into app_private.content_visibility_revision default values;
revoke all on app_private.content_visibility_revision from public, anon, authenticated;

create function app_private.advance_content_visibility_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update app_private.content_visibility_revision set revision = revision + 1 where singleton;
  return null;
end
$$;
revoke all on function app_private.advance_content_visibility_revision() from public, anon, authenticated;

create trigger refresh_content_visibility_on_ban after update of banned_until on auth.users
for each row when (old.banned_until is distinct from new.banned_until)
execute function app_private.advance_content_visibility_revision();

create function public.content_visibility_version() returns bigint
language sql stable security definer set search_path = '' as $$
  select revision from app_private.content_visibility_revision where singleton
$$;
revoke all on function public.content_visibility_version() from public, anon, authenticated;
grant execute on function public.content_visibility_version() to anon, authenticated;
