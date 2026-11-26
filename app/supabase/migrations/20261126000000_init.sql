-- MoraPlates schema: profiles, canteens, foods, posts, comments, likes, votes, photo storage.
--
-- Product rules (agreed 2026-11-26):
--   * Anyone can read. Only signed-in @uom.lk accounts can write.
--   * Students can add canteens (with a map pin, hours and a photo) and foods (with a price).
--   * Every post needs a photo. The same food can be posted more than once a day.
--   * Weekly votes reset Monday 08:00 Asia/Colombo; one vote per student per week, changeable.
--   * Food ratings and "% Super" count all-time.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create type public.rating as enum ('super', 'okay', 'avoid');

-- True when the signed-in user's email is a University of Moratuwa address.
create function public.is_student() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@uom.lk'
$$;

-- The Monday 08:00 (Colombo time) that starts the voting week containing ts.
create function public.vote_week(ts timestamptz default now()) returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', (ts at time zone 'Asia/Colombo') - interval '8 hours')::date
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 1 and 60),
  faculty    text check (char_length(faculty) <= 60),
  batch      text check (char_length(batch) <= 20),
  created_at timestamptz not null default now()
);

create table public.canteens (
  id         text primary key default gen_random_uuid()::text check (id ~ '^[a-z0-9-]+$'),
  name       text not null check (char_length(btrim(name)) between 2 and 50),
  location   text not null check (char_length(btrim(location)) between 2 and 80),  -- "Near the IT faculty"
  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  opens_at   smallint not null check (opens_at between 0 and 23),
  closes_at  smallint not null check (closes_at between 1 and 24 and closes_at > opens_at),
  known_for  text check (char_length(known_for) <= 40),
  colour     text not null default '#E8492F' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create unique index canteens_name_key on public.canteens (lower(btrim(name)));

create table public.foods (
  id         uuid primary key default gen_random_uuid(),
  canteen_id text not null references public.canteens on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  price      integer not null check (price between 1 and 5000),
  photo_path text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (id, canteen_id)  -- target of the posts composite foreign key
);
create unique index foods_canteen_name_key on public.foods (canteen_id, lower(btrim(name)));

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  canteen_id text not null,
  food_id    uuid not null,
  rating     public.rating not null,
  caption    text not null default '' check (char_length(caption) <= 160),
  photo_path text not null,
  created_at timestamptz not null default now(),
  -- the food must belong to the canteen the post is tagged with
  foreign key (food_id, canteen_id) references public.foods (id, canteen_id) on delete cascade
);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_canteen_idx    on public.posts (canteen_id, created_at desc);
create index posts_food_idx       on public.posts (food_id);
create index posts_user_idx       on public.posts (user_id, created_at desc);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.likes (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.votes (
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  week_start date not null default public.vote_week(),
  canteen_id text not null references public.canteens on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
create index votes_week_canteen_idx on public.votes (week_start, canteen_id);

-- ---------------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 60)
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.canteens enable row level security;
alter table public.foods    enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;
alter table public.votes    enable row level security;

-- A student's own uploads live under "<their user id>/..." in the photos bucket.
create function public.owns_photo(path text) returns boolean
language sql stable set search_path = '' as $$
  select path is null or path like (auth.uid())::text || '/%'
$$;

create policy "profiles are public"   on public.profiles for select using (true);
create policy "update own profile"    on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "canteens are public"   on public.canteens for select using (true);
create policy "students add canteens" on public.canteens for insert to authenticated
  with check ((select public.is_student()) and created_by = (select auth.uid())
              and lat is not null and public.owns_photo(photo_path));

create policy "foods are public"      on public.foods for select using (true);
create policy "students add foods"    on public.foods for insert to authenticated
  with check ((select public.is_student()) and created_by = (select auth.uid()) and public.owns_photo(photo_path));

create policy "posts are public"      on public.posts for select using (true);
create policy "students post"         on public.posts for insert to authenticated
  with check ((select public.is_student()) and user_id = (select auth.uid()) and public.owns_photo(photo_path));
create policy "delete own posts"      on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "comments are public"   on public.comments for select using (true);
create policy "students comment"      on public.comments for insert to authenticated
  with check ((select public.is_student()) and user_id = (select auth.uid()));
create policy "delete own comments"   on public.comments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "likes are public"      on public.likes for select using (true);
create policy "students like"         on public.likes for insert to authenticated
  with check ((select public.is_student()) and user_id = (select auth.uid()));
create policy "unlike own"            on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Individual votes are private; totals come from canteen_standings below.
create policy "read own votes"        on public.votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "students vote this week" on public.votes for insert to authenticated
  with check ((select public.is_student()) and user_id = (select auth.uid()) and week_start = public.vote_week());
create policy "change vote this week" on public.votes for update to authenticated
  using (user_id = (select auth.uid()) and week_start = public.vote_week())
  with check (user_id = (select auth.uid()) and week_start = public.vote_week());
create policy "remove vote this week" on public.votes for delete to authenticated
  using (user_id = (select auth.uid()) and week_start = public.vote_week());

-- ---------------------------------------------------------------------------
-- Photo storage: public bucket, 5 MB images, students upload into their own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "students upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_student())
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------

-- Runs as the view owner on purpose: it must count every student's vote while
-- the votes table itself only shows a student their own row. It exposes totals only.
create view public.canteen_standings as
select c.id, c.name, c.location, c.lat, c.lng, c.opens_at, c.closes_at, c.known_for, c.colour, c.photo_path,
       coalesce(v.votes, 0)::int as votes_this_week
from public.canteens c
left join (
  select canteen_id, count(*) as votes
  from public.votes
  where week_start = public.vote_week()
  group by canteen_id
) v on v.canteen_id = c.id;

create view public.food_stats with (security_invoker = true) as
select f.id, f.canteen_id, f.name, f.price, f.photo_path, f.created_at,
       count(p.id) filter (where p.rating = 'super')::int as super_count,
       count(p.id) filter (where p.rating = 'okay')::int  as okay_count,
       count(p.id) filter (where p.rating = 'avoid')::int as avoid_count
from public.foods f
left join public.posts p on p.food_id = f.id
group by f.id;

-- Counts the badge rules in src/lib/badges.js are built on.
create view public.profile_stats with (security_invoker = true) as
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
  (select count(*) from public.foods f where f.created_by = pr.id)::int as foods_added
from public.profiles pr;

grant select on public.canteen_standings, public.food_stats, public.profile_stats to anon, authenticated;
