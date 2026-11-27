alter table public.comments
  add column parent_id uuid,
  add constraint comments_post_id_id_key unique (post_id, id),
  add constraint comments_parent_same_post_fk foreign key (post_id, parent_id)
    references public.comments (post_id, id) on delete set null (parent_id);

create index comments_parent_idx on public.comments (post_id, parent_id) where parent_id is not null;
create index comments_user_idx on public.comments (user_id);

-- A reply must point at a comment already in the thread, including during a bulk insert.
create function public.require_existing_comment_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments where id = new.parent_id and post_id = new.post_id
  ) then
    raise exception 'The comment you replied to is no longer available' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger require_existing_comment_parent
before insert on public.comments for each row execute function public.require_existing_comment_parent();

create table public.profile_follows (
  follower_id uuid not null default auth.uid() references public.profiles on delete cascade,
  followed_id uuid not null references public.profiles on delete cascade,
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index profile_follows_followed_idx on public.profile_follows (followed_id);
alter table public.profile_follows enable row level security;
revoke all on public.profile_follows from anon, authenticated;
grant select, delete on public.profile_follows to authenticated;
grant insert (followed_id) on public.profile_follows to authenticated;

create policy "read own follows" on public.profile_follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy "students follow profiles" on public.profile_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and (select public.is_student()));
create policy "students remove own follows" on public.profile_follows for delete to authenticated
  using (follower_id = (select auth.uid()) and (select public.is_student()));

-- Expose profile totals without exposing other students' individual follow records.
create function public.profile_follow_summary(target uuid)
returns table (followers bigint, following bigint, viewer_follows boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.profile_follows f where f.followed_id = target),
    (select count(*) from public.profile_follows f where f.follower_id = target),
    exists (select 1 from public.profile_follows f where f.follower_id = (select auth.uid()) and f.followed_id = target)
$$;

revoke all on function public.profile_follow_summary(uuid) from public;
grant execute on function public.profile_follow_summary(uuid) to anon, authenticated;
