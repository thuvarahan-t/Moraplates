create table public.canteen_pins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  canteen_id text not null references public.canteens(id) on delete cascade,
  pinned_at timestamptz not null default clock_timestamp(),
  primary key (user_id, canteen_id)
);

alter table public.canteen_pins enable row level security;
revoke all on public.canteen_pins from anon, authenticated;
grant select on public.canteen_pins to authenticated;
create policy "Read own canteen pins" on public.canteen_pins
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.set_canteen_pin(target_canteen text, pinned boolean)
returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null or not public.is_student() then
    raise exception 'Only signed-in @uom.lk accounts can pin canteens' using errcode = '42501';
  end if;

  -- Serialize edits to the same user's pins so concurrent requests cannot exceed the limit.
  perform 1 from public.profiles where id = viewer for update;
  if not found then
    raise exception 'Student profile not found' using errcode = '42501';
  end if;

  if pinned then
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
    select canteen_id from public.canteen_pins where user_id = viewer order by pinned_at, canteen_id
  );
end;
$$;

revoke all on function public.set_canteen_pin(text, boolean) from public, anon, authenticated;
grant execute on function public.set_canteen_pin(text, boolean) to authenticated;
