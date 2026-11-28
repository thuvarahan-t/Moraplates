-- A trusted operator grants access by the verified Auth user UUID.
create table public.content_moderators (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.content_moderators enable row level security;
revoke all on public.content_moderators from public, anon, authenticated;
grant select, insert, delete on public.content_moderators to service_role;

create function public.is_content_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.content_moderators where user_id = auth.uid()
  )
$$;
revoke all on function public.is_content_moderator() from public, anon, authenticated;
grant execute on function public.is_content_moderator() to authenticated;

-- Moderation can remove a photo while keeping the post, but new posts still need a photo.
alter table public.posts alter column photo_path drop not null;
alter policy "students post" on public.posts with check (
  (select public.is_student()) and user_id = (select auth.uid())
  and photo_path is not null and public.owns_photo(photo_path)
);

create table public.moderated_photo_cleanup (
  object_id uuid primary key,
  path text not null,
  queued_at timestamptz not null default now()
);
alter table public.moderated_photo_cleanup enable row level security;
revoke all on public.moderated_photo_cleanup from public, anon, authenticated;

create function public.content_photo_is_referenced(path text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.posts where photo_path = path)
    or exists (select 1 from public.canteen_photos where photo_path = path)
    or exists (select 1 from public.canteens where photo_path = path)
    or exists (select 1 from public.foods where photo_path = path)
    or exists (select 1 from public.profiles where avatar_path = path)
$$;
revoke all on function public.content_photo_is_referenced(text) from public, anon, authenticated;

-- The Storage API can delete only objects queued by an authorized removal that
-- still have no surviving references. Matching the ID also protects reused paths.
create function public.may_remove_moderated_photo(object_id uuid, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_content_moderator() and exists (
    select 1 from public.moderated_photo_cleanup q
    where q.object_id = $1 and q.path = $2 and q.queued_at > now() - interval '1 day'
  ) and not public.content_photo_is_referenced($2)
$$;
revoke all on function public.may_remove_moderated_photo(uuid, text) from public, anon, authenticated;
grant execute on function public.may_remove_moderated_photo(uuid, text) to authenticated;

create policy "moderators read removed content photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.may_remove_moderated_photo(id, name));
create policy "moderators remove deleted content photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.may_remove_moderated_photo(id, name));

create function public.moderate_delete(kind text, p jsonb) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  target text := nullif(p->>'id', '');
  expected_path text := nullif(p->>'photo_path', '');
  paths text[] := array[]::text[];
begin
  if not public.is_content_moderator() then
    raise exception 'Content moderation access required' using errcode = '42501';
  end if;
  if target is null then
    raise exception 'Choose an item to delete' using errcode = '22023';
  end if;
  if kind in ('post_photos', 'canteen_covers', 'food_photos', 'profile_avatars') and expected_path is null then
    raise exception 'Choose a photo to delete' using errcode = '22023';
  end if;

  case kind
    when 'posts' then
      delete from public.posts where id = target::uuid returning array[photo_path] into paths;
    when 'post_photos' then
      update public.posts set photo_path = null where id = target::uuid and photo_path = expected_path;
      paths := array[expected_path];
    when 'comments' then
      delete from public.comments where id = target::uuid;
    when 'profile_avatars' then
      update public.profiles set avatar_path = null where id = target::uuid and avatar_path = expected_path;
      paths := array[expected_path];
    when 'canteen_photos' then
      delete from public.canteen_photos
      where id = target::uuid and (expected_path is null or photo_path = expected_path)
      returning array[photo_path] into paths;
    when 'canteen_covers' then
      update public.canteens set photo_path = null where id = target and photo_path = expected_path;
      paths := array[expected_path];
    when 'food_photos' then
      update public.foods set photo_path = null where id = target::uuid and photo_path = expected_path;
      paths := array[expected_path];
    when 'canteens' then
      -- Lock the rows whose photos we collect before the cascading delete.
      perform 1 from public.canteens where id = target for update;
      perform 1 from public.foods where canteen_id = target for update;
      perform 1 from public.posts where canteen_id = target for update;
      perform 1 from public.canteen_photos where canteen_id = target for update;
      select array_agg(photo_path) into paths
      from (
        select photo_path from public.posts where canteen_id = target
        union all select photo_path from public.canteen_photos where canteen_id = target
        union all select photo_path from public.foods where canteen_id = target
        union all select photo_path from public.canteens where id = target
      ) images;
      delete from public.canteens where id = target;
    when 'foods' then
      perform 1 from public.foods where id = target::uuid for update;
      perform 1 from public.posts where food_id = target::uuid for update;
      select array_agg(photo_path) into paths
      from (
        select photo_path from public.posts where food_id = target::uuid
        union all select photo_path from public.foods where id = target::uuid
      ) images;
      delete from public.foods where id = target::uuid;
    when 'canteen_status_reports' then
      -- The reporting functions acquire the same lock before changing reports.
      perform 1 from public.canteens where id = target for no key update;
      if not found then
        raise exception 'Canteen no longer exists' using errcode = 'P0002';
      end if;
      delete from public.canteen_closure_reports where canteen_id = target;
      delete from public.canteen_open_reports where canteen_id = target;
      return array[]::text[];
    else
      raise exception 'This item cannot be deleted using moderation' using errcode = '22023';
  end case;

  if not found then
    raise exception 'This item changed or was already removed' using errcode = 'P0002';
  end if;
  paths := array_remove(paths, null);
  if coalesce(cardinality(paths), 0) = 0 then
    return array[]::text[];
  end if;

  -- Serialize simultaneous removals of shared photo paths before checking whether
  -- this is the final reference. Acquire multiple locks in a consistent order.
  perform pg_advisory_xact_lock(lock_key)
  from (
    select distinct hashtextextended(path, 792140) as lock_key
    from unnest(paths) as removed(path)
  ) locks
  order by lock_key;

  delete from public.moderated_photo_cleanup where queued_at <= now() - interval '1 day';
  with queued as (
    insert into public.moderated_photo_cleanup as q (object_id, path)
    select o.id, o.name from storage.objects o
    where o.bucket_id = 'photos' and o.name = any(paths)
      and not public.content_photo_is_referenced(o.name)
    on conflict (object_id) do update set path = excluded.path, queued_at = now()
    returning q.path
  )
  select coalesce(array_agg(path), array[]::text[]) into paths from queued;
  return paths;
end;
$$;
revoke all on function public.moderate_delete(text, jsonb) from public, anon, authenticated;
grant execute on function public.moderate_delete(text, jsonb) to authenticated;

-- Keep the admin console's resource access and reuse the content deletion logic.
create or replace function public.admin_delete(kind text, p jsonb) returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  case kind
    when 'canteens', 'foods', 'posts', 'canteen_photos', 'comments' then
      return public.moderate_delete(kind, p);
    when 'votes' then
      delete from public.votes
      where user_id = (p->>'user_id')::uuid and week_start = (p->>'week_start')::date;
    when 'likes' then
      delete from public.likes
      where user_id = (p->>'user_id')::uuid and post_id = (p->>'post_id')::uuid;
    when 'canteen_closure_reports' then
      delete from public.canteen_closure_reports
      where user_id = (p->>'user_id')::uuid and canteen_id = p->>'canteen_id';
    else
      raise exception 'Resource cannot be deleted here' using errcode = '22023';
  end case;

  if not found then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;
  return array[]::text[];
end;
$$;
