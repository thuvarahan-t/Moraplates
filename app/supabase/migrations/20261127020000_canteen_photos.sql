-- Canteen photo gallery: students add photos on a canteen's page; they show as a
-- slideshow there and in the home banner, credited to whoever added them.
-- Only the person who added a photo can delete it.

create table public.canteen_photos (
  id         uuid primary key default gen_random_uuid(),
  canteen_id text not null references public.canteens on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  photo_path text not null,
  created_at timestamptz not null default now()
);
create index canteen_photos_canteen_idx on public.canteen_photos (canteen_id, created_at desc);

alter table public.canteen_photos enable row level security;

create policy "canteen photos are public" on public.canteen_photos for select using (true);
create policy "students add canteen photos" on public.canteen_photos for insert to authenticated
  with check ((select public.is_student()) and user_id = (select auth.uid()) and public.owns_photo(photo_path));
create policy "delete own canteen photos" on public.canteen_photos for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.canteen_photos to anon, authenticated;
grant insert, delete on public.canteen_photos to authenticated;
