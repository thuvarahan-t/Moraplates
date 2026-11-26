-- Storage deletes (and upserts) need a SELECT policy on the object too.
-- Public URLs already work without this; it only lets students manage files in their own folder.
create policy "read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
