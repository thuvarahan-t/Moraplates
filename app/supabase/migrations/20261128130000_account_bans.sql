-- Supabase Auth reads banned_until on sign-in. A JWT issued before a ban remains
-- cryptographically valid, so protected data access also checks the live session.
create function public.account_access_status() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when u.banned_until > now() then 'banned'
      when exists (
        select 1 from auth.sessions s
        where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = u.id
      ) then 'active'
      else 'signed_out'
    end
    from auth.users u
    where u.id = (select auth.uid()) and u.deleted_at is null
  ), 'signed_out')
$$;
revoke all on function public.account_access_status() from public, anon, authenticated;
grant execute on function public.account_access_status() to authenticated;

create or replace function public.is_student() returns boolean
language sql stable set search_path = '' as $$
  select case when coalesce(auth.jwt() ->> 'email', '') ilike '%@uom.lk'
    then (select public.account_access_status()) = 'active'
    else false
  end
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.account_access_status()) = 'active'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
$$;

create or replace function public.is_content_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.account_access_status()) = 'active' and (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()))
    or exists (select 1 from public.content_moderators where user_id = (select auth.uid()))
  )
$$;

-- Also protect callers that do not go through the PostgREST pre-request hook.
do $$
declare name text;
begin
  foreach name in array array[
    'profiles', 'canteens', 'foods', 'posts', 'comments', 'likes', 'votes',
    'canteen_photos', 'post_views', 'profile_follows', 'canteen_pins', 'notifications'
  ] loop
    execute format(
      'create policy "active account required" on public.%I as restrictive to authenticated '
      'using ((select public.account_access_status()) = %L) '
      'with check ((select public.account_access_status()) = %L)', name, 'active', 'active'
    );
  end loop;
end
$$;

create policy "active account required for photos" on storage.objects as restrictive to authenticated
  using (bucket_id <> 'photos' or (select public.account_access_status()) = 'active')
  with check (bucket_id <> 'photos' or (select public.account_access_status()) = 'active');

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'receive own notification signals'
  ) then
    alter policy "receive own notification signals" on realtime.messages
      using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and topic = 'notifications:' || (select auth.uid())::text
        and (select public.account_access_status()) = 'active'
      );
  end if;
end
$$;

-- Existing Realtime subscribers can have cached permission checks. Emit no
-- notification signals for a banned recipient, even on an already-open socket.
create or replace function public.broadcast_notification_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  for recipient in
    select distinct c.recipient_id from changed_notifications c
    join auth.users u on u.id = c.recipient_id
    where u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  loop
    begin
      perform realtime.send('{}'::jsonb, 'changed', 'notifications:' || recipient::text, true);
    exception when others then
      raise log 'Could not send notification refresh signal: %', SQLSTATE;
    end;
  end loop;
  return null;
end
$$;

create or replace function public.withdraw_canteen_closed(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_student() then
    raise exception 'An active student account is required' using errcode = '42501';
  end if;
  delete from public.canteen_closure_reports where canteen_id = canteen and user_id = auth.uid();
end
$$;

create or replace function public.profile_follow_summary(target uuid)
returns table (followers bigint, following bigint, viewer_follows boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.profile_follows f where f.followed_id = target),
    (select count(*) from public.profile_follows f where f.follower_id = target),
    (select public.account_access_status()) = 'active'
      and exists (select 1 from public.profile_follows f where f.follower_id = (select auth.uid()) and f.followed_id = target)
$$;

-- Reject inactive JWTs before any PostgREST route except the session status RPC.
-- Anonymous public browsing and server-side service requests still use their own roles.
create function public.require_active_account() returns void
language plpgsql stable set search_path = '' as $$
declare status text;
begin
  if current_user <> 'authenticated' or current_setting('request.path', true) in (
    '/rpc/account_access_status', '/rest/v1/rpc/account_access_status'
  ) then
    return;
  end if;
  status := public.account_access_status();
  if status = 'banned' then
    raise exception 'This account is banned' using errcode = 'PT403';
  elsif status <> 'active' then
    raise exception 'This session is no longer valid' using errcode = 'PT401';
  end if;
end
$$;
revoke all on function public.require_active_account() from public, anon, authenticated;
grant execute on function public.require_active_account() to anon, authenticated, service_role;

do $$
begin
  -- Preserve a project-specific hook if the operator has already configured one.
  if not exists (
    select 1 from pg_catalog.pg_db_role_setting s, unnest(s.setconfig) as setting(value)
    where s.setrole = 'authenticator'::regrole and split_part(setting.value, '=', 1) = 'pgrst.db_pre_request'
      and (s.setdatabase = 0 or s.setdatabase = (select oid from pg_catalog.pg_database where datname = current_database()))
  ) then
    alter role authenticator set pgrst.db_pre_request = 'public.require_active_account';
  end if;
end
$$;
notify pgrst, 'reload config';

create function public.admin_list_accounts(search_term text default '', page_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare term text := left(lower(btrim(coalesce(search_term, ''))), 254);
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(rows) order by rows.id)
    from (
      select u.id, u.email, p.full_name, coalesce(u.banned_until > now(), false) as banned,
        a.user_id is not null as is_admin
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.admin_users a on a.user_id = u.id
      where u.deleted_at is null and (
        term = '' or u.id::text = term
          or strpos(lower(coalesce(u.email, '')), term) > 0
          or strpos(lower(coalesce(p.full_name, '')), term) > 0
      )
      order by u.id
      limit 51 offset greatest(coalesce(page_offset, 0), 0)
    ) rows
  ), '[]'::jsonb);
end
$$;

create function public.admin_get_account(target_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'id', u.id, 'email', u.email, 'full_name', p.full_name,
      'banned', coalesce(u.banned_until > now(), false), 'is_admin', a.user_id is not null
    )
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.admin_users a on a.user_id = u.id
    where u.id = target_user_id and u.deleted_at is null
  );
end
$$;

create function public.admin_set_account_ban(target_user_id uuid, banned boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare was_banned boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if target_user_id is null or banned is null then
    raise exception 'Choose an account and ban status' using errcode = '22023';
  end if;

  -- Auth serializes changes to the user on this row. Keep the ban and session
  -- revocation in one transaction so another request cannot observe half a ban.
  select coalesce(banned_until > now(), false) into was_banned
    from auth.users where id = target_user_id and deleted_at is null for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.admin_users where user_id = target_user_id) then
    raise exception 'Admin accounts cannot be banned here' using errcode = '42501';
  end if;

  -- Supabase Auth represents a long-lived ban with a finite timestamp.
  update auth.users set
    banned_until = case when banned then now() + interval '100 years' else null end,
    updated_at = now()
  where id = target_user_id;

  if banned or was_banned then
    -- Auth's foreign key removes refresh tokens. Clearing sessions on unban also
    -- covers any sign-in request that was in flight when the ban began.
    delete from auth.sessions where user_id = target_user_id;
  end if;
end
$$;

revoke all on function public.admin_list_accounts(text, integer), public.admin_get_account(uuid), public.admin_set_account_ban(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_list_accounts(text, integer), public.admin_get_account(uuid), public.admin_set_account_ban(uuid, boolean)
  to authenticated;
