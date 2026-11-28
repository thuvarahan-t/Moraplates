create function app_private.photo_content_visible(photo_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-][a-z0-9_.-]{0,159}\.(jpe?g|png|webp)$' then
      app_private.account_content_visible(split_part($1, '/', 1)::uuid) and (
        exists (select 1 from public.profiles p where p.avatar_path = $1 and app_private.account_content_visible(p.id))
        or exists (select 1 from public.posts p where p.photo_path = $1 and app_private.post_content_visible(p.id))
        or exists (select 1 from public.canteens c where c.photo_path = $1 and app_private.canteen_content_visible(c.id))
        or exists (select 1 from public.foods f where f.photo_path = $1 and app_private.food_content_visible(f.id))
        or exists (
          select 1 from public.canteen_photos p where p.photo_path = $1
            and app_private.account_content_visible(p.user_id) and app_private.canteen_content_visible(p.canteen_id)
        )
      )
    else false
  end
$$;
revoke all on function app_private.photo_content_visible(text) from public, anon, authenticated;
grant execute on function app_private.photo_content_visible(text) to anon;

-- The app proxy uses anonymous permissions and checks live visibility before
-- fetching image bytes, even when Storage has a cached response for the path.
create function public.can_serve_photo(photo_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.photo_content_visible($1)
$$;
revoke all on function public.can_serve_photo(text) from public, anon, authenticated;
grant execute on function public.can_serve_photo(text) to anon;

-- Anonymous callers can fetch published images but cannot list or sign files.
create policy "download visible published photos" on storage.objects for select to anon
  using (
    bucket_id = 'photos'
    and storage.allow_any_operation(array[
      'object.get_authenticated', 'object.get_authenticated_info', 'object.head_authenticated_info'
    ])
    and app_private.photo_content_visible(name)
  );

-- Keep owner downloads and cleanup, while preventing signed links that would
-- continue serving a photo after its account becomes hidden.
create policy "require admin to sign photo URLs" on storage.objects as restrictive
  for select to authenticated using (
    bucket_id <> 'photos'
    or not storage.allow_any_operation(array['object.sign', 'object.sign_many'])
    or (select public.is_admin())
  );
