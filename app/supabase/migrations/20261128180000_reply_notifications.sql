alter table public.notifications
  add column comment_id uuid,
  add column parent_comment_id uuid,
  drop constraint notifications_check1,
  drop constraint notifications_event_key,
  add constraint notifications_kind_target_check check (
    (kind = 'follow' and post_id is null and comment_id is null and parent_comment_id is null)
    or (kind = 'like' and post_id is not null and comment_id is null and parent_comment_id is null)
    or (kind = 'reply' and post_id is not null and comment_id is not null and parent_comment_id is not null)
  ),
  add constraint notifications_event_key
    unique nulls not distinct (recipient_id, actor_id, kind, post_id, comment_id),
  add constraint notifications_reply_comment_fk foreign key (post_id, comment_id)
    references public.comments (post_id, id) on delete cascade,
  add constraint notifications_parent_comment_fk foreign key (post_id, parent_comment_id)
    references public.comments (post_id, id) on delete cascade;

create index notifications_reply_comment_idx on public.notifications (post_id, comment_id) where comment_id is not null;
create index notifications_parent_comment_idx on public.notifications (post_id, parent_comment_id) where parent_comment_id is not null;

create function public.notify_comment_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id, parent_comment_id)
    select parent.user_id, new.user_id, 'reply', new.post_id, new.id, parent.id
    from public.comments parent
    where parent.post_id = new.post_id and parent.id = new.parent_id and parent.user_id <> new.user_id
    on conflict on constraint notifications_event_key do nothing;
  return new;
end
$$;

revoke all on function public.notify_comment_reply() from public, anon, authenticated;

create trigger notify_comment_reply after insert on public.comments
  for each row when (new.parent_id is not null) execute function public.notify_comment_reply();
