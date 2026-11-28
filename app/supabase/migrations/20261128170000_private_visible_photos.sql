-- Deploy the app image proxy before applying this migration to a running site.
-- Legacy public URLs then lose access without deleting or moving any objects.
update storage.buckets set public = false where id = 'photos';
