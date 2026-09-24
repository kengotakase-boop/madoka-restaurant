-- PREPARATION ONLY: not applied by the application, build, or tests.
-- Review the target project and existing policies before an approved manual run.
-- No dish schema change, no existing bucket overwrite, no public access.
begin;

-- A policy is ineffective without RLS. Do not change shared Storage settings.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'storage.objects'::regclass and relrowsecurity
  ) then
    raise exception 'storage.objects RLS is not enabled; stop and review existing Storage configuration';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'madoka-restaurant-images',
  'madoka-restaurant-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

-- Refuse incompatible existing settings rather than silently overwriting them.
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'madoka-restaurant-images'
      and name = 'madoka-restaurant-images'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
      and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'Existing madoka-restaurant-images bucket configuration differs; review it manually';
  end if;
end $$;

-- No permissive policy is granted to browser roles. RESTRICTIVE also prevents
-- unrelated broad permissive policies from exposing this dedicated bucket.
-- Other buckets keep their existing policy behavior (the predicate is true).
-- The server-only service_role bypasses RLS; application endpoints are its boundary.
-- Repeat runs accept only the exact expected policy. Never replace an existing
-- policy with a different definition just because its name matches.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'madoka_images_server_only'
  ) then
    if not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'madoka_images_server_only'
        and permissive = 'RESTRICTIVE' and cmd = 'ALL'
        and roles @> array['anon', 'authenticated']::name[]
        and roles <@ array['anon', 'authenticated']::name[]
        and qual = '(bucket_id <> ''madoka-restaurant-images''::text)'
        and with_check = '(bucket_id <> ''madoka-restaurant-images''::text)'
    ) then
      raise exception 'Existing madoka_images_server_only policy differs; review it manually';
    end if;
  else
    create policy "madoka_images_server_only"
    on storage.objects
    as restrictive
    for all
    to anon, authenticated
    using (bucket_id <> 'madoka-restaurant-images')
    with check (bucket_id <> 'madoka-restaurant-images');
  end if;
end $$;

commit;
