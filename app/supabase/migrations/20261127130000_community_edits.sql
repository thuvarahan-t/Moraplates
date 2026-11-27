-- Students can correct shared menu details and update their own plates.
create function public.update_food(target_food uuid, new_name text, new_price integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;
  if new_name is null or char_length(btrim(new_name)) not between 1 and 40 then
    raise exception 'Enter a food name between 1 and 40 characters' using errcode = '22023';
  end if;
  if new_price is null or new_price not between 1 and 5000 then
    raise exception 'Enter a price between Rs 1 and Rs 5000' using errcode = '22023';
  end if;

  update public.foods
    set name = btrim(new_name), price = new_price
    where id = target_food;
  if not found then
    raise exception 'Food not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.edit_own_post(
  target_post uuid,
  target_canteen text,
  target_food uuid,
  target_rating public.rating,
  target_caption text,
  target_photo_path text default null
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  previous_path text;
begin
  if viewer is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;

  -- Serialize edits so a replacement can retire the actual preceding photo.
  select photo_path into previous_path
    from public.posts where id = target_post and user_id = viewer for update;
  if not found then
    raise exception 'Post not found or not yours' using errcode = '42501';
  end if;
  if target_photo_path is not null and not public.owns_photo(target_photo_path) then
    raise exception 'Use a photo uploaded by your account' using errcode = '42501';
  end if;

  -- The existing foreign key checks the food and canteen together.
  update public.posts
    set canteen_id = target_canteen,
        food_id = target_food,
        rating = target_rating,
        caption = coalesce(btrim(target_caption), ''),
        photo_path = coalesce(target_photo_path, previous_path)
    where id = target_post and user_id = viewer;

  if target_photo_path is null or target_photo_path = previous_path or not public.owns_photo(previous_path) then
    return null;
  end if;
  -- Only hand the client a file for cleanup if nothing still refers to it.
  if exists(select 1 from public.posts where photo_path = previous_path)
    or exists(select 1 from public.canteen_photos where photo_path = previous_path)
    or exists(select 1 from public.canteens where photo_path = previous_path)
    or exists(select 1 from public.foods where photo_path = previous_path)
    or exists(select 1 from public.profiles where avatar_path = previous_path) then
    return null;
  end if;
  return previous_path;
end;
$$;

revoke all on function public.update_food(uuid, text, integer),
  public.edit_own_post(uuid, text, uuid, public.rating, text, text) from public, anon, authenticated;
grant execute on function public.update_food(uuid, text, integer),
  public.edit_own_post(uuid, text, uuid, public.rating, text, text) to authenticated;
