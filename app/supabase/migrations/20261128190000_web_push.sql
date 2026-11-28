create extension if not exists supabase_vault with schema vault;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table app_private.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  session_id uuid not null references auth.sessions on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now()
);

create index web_push_subscriptions_user_idx on app_private.web_push_subscriptions (user_id);
create index web_push_subscriptions_session_idx on app_private.web_push_subscriptions (session_id);

create table app_private.web_push_jobs (
  id bigint generated always as identity primary key,
  notification_id bigint not null references public.notifications on delete cascade,
  subscription_id uuid not null references app_private.web_push_subscriptions on delete cascade,
  attempts integer not null default 0,
  ready_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create index web_push_jobs_ready_idx on app_private.web_push_jobs (ready_at);
create index web_push_jobs_subscription_idx on app_private.web_push_jobs (subscription_id);

alter table app_private.web_push_subscriptions enable row level security;
alter table app_private.web_push_jobs enable row level security;
revoke all on app_private.web_push_subscriptions, app_private.web_push_jobs from public, anon, authenticated;

create function public.web_push_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'moraplates_push_public_key'
    and decrypted_secret ~ '^[A-Za-z0-9_-]{87}$'
$$;

create function public.web_push_subscription_active(push_endpoint text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.web_push_subscriptions
    where endpoint = push_endpoint and user_id = auth.uid()
      and session_id = (auth.jwt()->>'session_id')::uuid
  )
$$;

create function public.web_push_register(push_endpoint text, push_p256dh text, push_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  session_key uuid := (auth.jwt()->>'session_id')::uuid;
begin
  if not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = session_key and u.id = account
      and (s.not_after is null or s.not_after > now())
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'Sign in to enable push notifications' using errcode = '42501';
  end if;

  if push_endpoint is null or length(push_endpoint) > 2048
    or push_endpoint !~ '^https://(fcm\.googleapis\.com/fcm/send/|updates\.push\.services\.mozilla\.com/wpush/v[0-9]+/|[a-z0-9-]+\.push\.apple\.com/|[a-z0-9.-]+\.notify\.windows\.com/)[-A-Za-z0-9_.~!$&()*+,;=:@/%?]+$'
    or push_p256dh is null or push_p256dh !~ '^B[A-Za-z0-9_-]{86}$'
    or push_auth is null or push_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'Unsupported push subscription' using errcode = '22023';
  end if;

  -- Lock this account so simultaneous sign-ups cannot exceed the device limit.
  perform 1 from public.profiles where id = account for no key update;
  if (select count(*) from app_private.web_push_subscriptions where user_id = account and endpoint <> push_endpoint) >= 10 then
    raise exception 'Push device limit reached' using errcode = '22023';
  end if;

  insert into app_private.web_push_subscriptions as existing (user_id, session_id, endpoint, p256dh, auth_secret)
  values (account, session_key, push_endpoint, push_p256dh, push_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, session_id = excluded.session_id
    where existing.p256dh = excluded.p256dh and existing.auth_secret = excluded.auth_secret;

  if not found then
    raise exception 'Push subscription could not be verified' using errcode = '42501';
  end if;
end
$$;

create function public.web_push_unregister(push_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from app_private.web_push_subscriptions
  where endpoint = push_endpoint and user_id = auth.uid()
    and session_id = (auth.jwt()->>'session_id')::uuid
$$;

revoke all on function public.web_push_public_key(), public.web_push_subscription_active(text),
  public.web_push_register(text, text, text), public.web_push_unregister(text) from public, anon, authenticated;
grant execute on function public.web_push_public_key(), public.web_push_subscription_active(text),
  public.web_push_register(text, text, text), public.web_push_unregister(text) to authenticated;

create function app_private.nudge_web_push() returns void
language plpgsql set search_path = '' as $$
declare
  dispatch_url text;
  dispatch_key text;
  sent_at text := floor(extract(epoch from clock_timestamp()))::bigint::text;
begin
  if not exists (select 1 from app_private.web_push_jobs where ready_at <= now()) then return; end if;

  select decrypted_secret into dispatch_url from vault.decrypted_secrets where name = 'moraplates_push_dispatch_url';
  select decrypted_secret into dispatch_key from vault.decrypted_secrets where name = 'moraplates_push_dispatch_secret';
  if dispatch_url is null or dispatch_key is null then return; end if;

  perform net.http_post(
    url := dispatch_url,
    -- pg_net queues request headers. Sign a short-lived request instead of placing a secret there.
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-moraplates-push-timestamp', sent_at,
      'x-moraplates-push-signature', encode(extensions.hmac('moraplates-notification-push-v1:' || sent_at, dispatch_key, 'sha256'), 'hex')
    ),
    timeout_milliseconds := 12000
  );
end
$$;

create function app_private.queue_web_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into app_private.web_push_jobs (notification_id, subscription_id)
  select n.id, s.id
  from push_notifications n
  join app_private.web_push_subscriptions s on s.user_id = n.recipient_id;

  if found then
    begin
      perform app_private.nudge_web_push();
    exception when others then
      raise log 'Could not wake push dispatcher: %', SQLSTATE;
    end;
  end if;
  return null;
end
$$;

revoke all on function app_private.nudge_web_push(), app_private.queue_web_push() from public, anon, authenticated;

create trigger queue_web_push after insert on public.notifications
  referencing new table as push_notifications
  for each statement execute function app_private.queue_web_push();

select cron.schedule(
  'moraplates-notification-push',
  '* * * * *',
  'select app_private.nudge_web_push();'
);

create function public.claim_web_push_deliveries()
returns table (
  job_id text, attempt integer, notification_id text, kind text,
  actor_id uuid, post_id uuid, comment_id uuid, endpoint text, p256dh text, auth_secret text
)
language plpgsql security definer set search_path = '' as $$
begin
  delete from app_private.web_push_jobs
  where ready_at <= now() and (attempts >= 3 or created_at <= now() - interval '15 minutes');

  return query with candidates as (
    select j.id
    from app_private.web_push_jobs j
    where j.ready_at <= now() and j.attempts < 3
    order by j.ready_at, j.id
    for update skip locked limit 25
  ), claimed as (
    update app_private.web_push_jobs j
    set attempts = j.attempts + 1, ready_at = now() + interval '1 minute' * (j.attempts + 1)
    from candidates c where j.id = c.id
    returning j.*
  )
  select j.id::text, j.attempts, n.id::text, n.kind, n.actor_id, n.post_id, n.comment_id,
    case when n.recipient_id = s.user_id
      and n.read_at is null
      and (session.not_after is null or session.not_after > now())
      and (recipient.banned_until is null or recipient.banned_until <= now())
      and (actor.banned_until is null or actor.banned_until <= now())
      and (owner.banned_until is null or owner.banned_until <= now())
      then s.endpoint end,
    s.p256dh, s.auth_secret
  from claimed j
  join public.notifications n on n.id = j.notification_id
  join app_private.web_push_subscriptions s on s.id = j.subscription_id
  join auth.sessions session on session.id = s.session_id
  join auth.users recipient on recipient.id = s.user_id
  join auth.users actor on actor.id = n.actor_id
  left join public.posts p on p.id = n.post_id
  left join auth.users owner on owner.id = p.user_id;
end
$$;

create function public.finish_web_push_delivery(push_job_id text, push_attempt integer, expired boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  push_subscription uuid;
begin
  delete from app_private.web_push_jobs
  where id = push_job_id::bigint and attempts = push_attempt
  returning subscription_id into push_subscription;

  if expired and push_subscription is not null then
    delete from app_private.web_push_subscriptions where id = push_subscription;
  end if;
end
$$;

revoke all on function public.claim_web_push_deliveries(), public.finish_web_push_delivery(text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_web_push_deliveries(), public.finish_web_push_delivery(text, integer, boolean) to service_role;
