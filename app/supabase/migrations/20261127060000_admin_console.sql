-- Admin identities must be provisioned by a trusted database operator after verifying
-- the real account UUID. Neither user-editable metadata nor an email string grants admin.
create table public.admin_users (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create function public.admin_list(kind text, page_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ordering text; result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  ordering := case kind
    when 'canteens' then 'name,id' when 'foods' then 'name,id'
    when 'posts' then 'created_at desc,id' when 'comments' then 'created_at desc,id'
    when 'profiles' then 'full_name,id' when 'canteen_photos' then 'created_at desc,id'
    when 'votes' then 'week_start desc,user_id' when 'likes' then 'created_at desc,post_id,user_id'
    when 'canteen_closure_reports' then 'reported_at desc,canteen_id,user_id'
    else null end;
  if ordering is null then raise exception 'Invalid resource'; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from (select * from public.%I order by %s limit 50 offset $1) q',kind,ordering)
    into result using greatest(0,coalesce(page_offset,0));
  return result;
end
$$;

-- Explicit field allowlists avoid giving non-admin students broad UPDATE grants.
create function public.admin_save(kind text, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare target text := nullif(p->>'id',''); affected integer;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if kind='canteens' then
    if target is null then
      insert into public.canteens(name,location,lat,lng,opens_at,closes_at,known_for,colour)
        values(btrim(p->>'name'),btrim(p->>'location'),nullif(p->>'lat','')::double precision,nullif(p->>'lng','')::double precision,
        (p->>'opens_at')::smallint,(p->>'closes_at')::smallint,nullif(p->>'known_for',''),coalesce(nullif(p->>'colour',''),'#E8492F'));
      return;
    end if;
    update public.canteens set name=btrim(p->>'name'),location=btrim(p->>'location'),
      lat=nullif(p->>'lat','')::double precision,lng=nullif(p->>'lng','')::double precision,
      opens_at=(p->>'opens_at')::smallint,closes_at=(p->>'closes_at')::smallint,known_for=nullif(p->>'known_for',''),
      colour=coalesce(nullif(p->>'colour',''),'#E8492F') where id=target;
  elsif kind='foods' then
    if target is null then
      insert into public.foods(canteen_id,name,price) values(p->>'canteen_id',btrim(p->>'name'),(p->>'price')::integer);
      return;
    end if;
    update public.foods set name=btrim(p->>'name'),price=(p->>'price')::integer where id=target::uuid;
  elsif kind='posts' then
    update public.posts set caption=coalesce(p->>'caption',''),rating=(p->>'rating')::public.rating where id=target::uuid;
  elsif kind='comments' then
    update public.comments set body=btrim(p->>'body') where id=target::uuid;
  elsif kind='profiles' then
    update public.profiles set full_name=btrim(p->>'full_name'),faculty=nullif(p->>'faculty',''),batch=nullif(p->>'batch','') where id=target::uuid;
  else raise exception 'Resource cannot be edited';
  end if;
  get diagnostics affected = row_count;
  if affected=0 then raise exception 'Record not found'; end if;
end
$$;

-- Return now-unreferenced photo paths for Storage API cleanup after successful deletion.
create function public.admin_delete(kind text,p jsonb) returns text[]
language plpgsql security definer set search_path = '' as $$
declare paths text[] := array[]::text[]; target text := p->>'id'; affected integer;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if kind='canteens' then
    select coalesce(array_agg(distinct photo_path) filter(where photo_path is not null),array[]::text[]) into paths
    from (select photo_path from public.posts where canteen_id=target union all
          select photo_path from public.canteen_photos where canteen_id=target union all
          select photo_path from public.foods where canteen_id=target union all
          select photo_path from public.canteens where id=target) images;
    delete from public.canteens where id=target;
  elsif kind='foods' then
    select coalesce(array_agg(distinct photo_path) filter(where photo_path is not null),array[]::text[]) into paths
    from (select photo_path from public.posts where food_id=target::uuid union all
          select photo_path from public.foods where id=target::uuid) images;
    delete from public.foods where id=target::uuid;
  elsif kind='posts' then
    delete from public.posts where id=target::uuid returning array[photo_path] into paths;
  elsif kind='canteen_photos' then
    delete from public.canteen_photos where id=target::uuid returning array[photo_path] into paths;
  elsif kind='comments' then
    delete from public.comments where id=target::uuid;
  elsif kind='votes' then
    delete from public.votes where user_id=(p->>'user_id')::uuid and week_start=(p->>'week_start')::date;
  elsif kind='likes' then
    delete from public.likes where user_id=(p->>'user_id')::uuid and post_id=(p->>'post_id')::uuid;
  elsif kind='canteen_closure_reports' then
    delete from public.canteen_closure_reports where user_id=(p->>'user_id')::uuid and canteen_id=p->>'canteen_id';
  else raise exception 'Resource cannot be deleted here';
  end if;
  get diagnostics affected = row_count;
  if affected=0 then raise exception 'Record not found'; end if;
  return array(select distinct path from unnest(coalesce(paths,array[]::text[])) as u(path)
    where path is not null
    and not exists(select 1 from public.posts where photo_path=path)
    and not exists(select 1 from public.canteen_photos where photo_path=path)
    and not exists(select 1 from public.canteens where photo_path=path)
    and not exists(select 1 from public.foods where photo_path=path)
    and not exists(select 1 from public.profiles where avatar_path=path));
end
$$;

revoke all on function public.admin_list(text,integer),public.admin_save(text,jsonb),public.admin_delete(text,jsonb) from public;
grant execute on function public.admin_list(text,integer),public.admin_save(text,jsonb),public.admin_delete(text,jsonb) to authenticated;
create policy "admin read photo objects" on storage.objects for select to authenticated
  using (bucket_id='photos' and (select public.is_admin()));
create policy "admin remove photo objects" on storage.objects for delete to authenticated
  using (bucket_id='photos' and (select public.is_admin()));
