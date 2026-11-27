-- Private seen-post history and temporary community closure reports.
create table public.post_views (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_views_post_idx on public.post_views(post_id);
alter table public.post_views enable row level security;
grant select, insert on public.post_views to authenticated;
create policy "read own seen plates" on public.post_views for select to authenticated using (user_id = (select auth.uid()));
create policy "record own seen plates" on public.post_views for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_student()));

create table public.canteen_closure_reports (
  canteen_id text not null references public.canteens on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  reported_at timestamptz not null default now(),
  primary key (canteen_id, user_id)
);
alter table public.canteen_closure_reports enable row level security;
-- No public direct writes or access to reporter identities.
create function public.report_canteen_closed(canteen text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_student() then
    raise exception 'Sign in with your university account' using errcode = '42501';
  end if;
  insert into public.canteen_closure_reports(canteen_id,user_id) values(canteen,auth.uid())
  on conflict (canteen_id,user_id) do update set reported_at = now()
    where public.canteen_closure_reports.reported_at <= now() - interval '60 minutes';
end
$$;
create function public.withdraw_canteen_closed(canteen text) returns void
language sql security definer set search_path = '' as $$
  delete from public.canteen_closure_reports where canteen_id = canteen and user_id = auth.uid()
$$;
revoke all on function public.report_canteen_closed(text), public.withdraw_canteen_closed(text) from public;
grant execute on function public.report_canteen_closed(text), public.withdraw_canteen_closed(text) to authenticated;
create or replace view public.canteen_standings as
select c.id, c.name, c.location, c.lat, c.lng, c.opens_at, c.closes_at, c.known_for, c.colour, c.photo_path,
  coalesce(v.votes,0)::int as votes_this_week,
  (select max(r.reported_at) + interval '60 minutes' from public.canteen_closure_reports r
    where r.canteen_id = c.id and r.reported_at > now() - interval '60 minutes') as reported_closed_until
from public.canteens c
left join (select canteen_id,count(*) as votes from public.votes where week_start=public.vote_week() group by canteen_id) v on v.canteen_id=c.id;
grant select on public.canteen_standings to anon,authenticated;

-- Optional location is deliberately a campus/canteen pin, not a private live GPS trace.
