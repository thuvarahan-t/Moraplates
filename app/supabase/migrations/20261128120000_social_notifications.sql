create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles on delete cascade,
  actor_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  post_id uuid references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (actor_id <> recipient_id),
  check ((kind = 'follow' and post_id is null) or (kind = 'like' and post_id is not null)),
  constraint notifications_event_key unique nulls not distinct (recipient_id, actor_id, kind, post_id)
);

create index notifications_inbox_idx on public.notifications (recipient_id, id desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id) where post_id is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
revoke all on sequence public.notifications_id_seq from public, anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;

create policy "read received notifications" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy "mark received notifications read" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()) and read_at is null)
  with check (recipient_id = (select auth.uid()) and read_at is not null);

-- Keep a single event after an unfollow or unlike so a repeated toggle cannot spam the inbox.
create function public.notify_profile_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind)
    values (new.followed_id, new.follower_id, 'follow')
    on conflict on constraint notifications_event_key do nothing;
  return new;
end
$$;

create function public.notify_post_like() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, post_id)
    select p.user_id, new.user_id, 'like', new.post_id
    from public.posts p
    where p.id = new.post_id and p.user_id <> new.user_id
    on conflict on constraint notifications_event_key do nothing;
  return new;
end
$$;

revoke all on function public.notify_profile_follow(), public.notify_post_like()
  from public, anon, authenticated;

create trigger notify_profile_follow after insert on public.profile_follows
  for each row execute function public.notify_profile_follow();

create trigger notify_post_like after insert on public.likes
  for each row execute function public.notify_post_like();

-- Send only a signal. The client refetches the inbox through recipient RLS.
create function public.broadcast_notification_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
begin
  for recipient in select distinct recipient_id from changed_notifications loop
    begin
      perform realtime.send('{}'::jsonb, 'changed', 'notifications:' || recipient::text, true);
    exception when others then
      raise log 'Could not send notification refresh signal: %', SQLSTATE;
    end;
  end loop;
  return null;
end
$$;

revoke all on function public.broadcast_notification_changes() from public, anon, authenticated;

-- The inbox works without Realtime on a local database. Supabase supplies the
-- protected messages table and helper functions on projects with Realtime.
do $$
begin
  if exists (select 1 from pg_class where oid = to_regclass('realtime.messages') and relrowsecurity)
     and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null
     and to_regprocedure('realtime.topic()') is not null then
    create policy "receive own notification signals" on realtime.messages
      for select to authenticated
      using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and topic = 'notifications:' || (select auth.uid())::text
      );

    create trigger broadcast_notifications_insert after insert on public.notifications
      referencing new table as changed_notifications
      for each statement execute function public.broadcast_notification_changes();

    create trigger broadcast_notifications_update after update on public.notifications
      referencing new table as changed_notifications
      for each statement execute function public.broadcast_notification_changes();

    create trigger broadcast_notifications_delete after delete on public.notifications
      referencing old table as changed_notifications
      for each statement execute function public.broadcast_notification_changes();
  end if;
end
$$;
