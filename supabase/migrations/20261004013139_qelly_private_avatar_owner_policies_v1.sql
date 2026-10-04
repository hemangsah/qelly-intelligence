-- Applied through the authenticated migration connector on 2026-10-04.
-- The private 2 MiB JPEG/PNG/WebP bucket was created through the Storage API
-- dashboard. Storage RLS is already enabled; do not alter Storage ownership.
begin;
create policy qelly_private_avatar_own_read
on storage.objects for select to authenticated
using (
  bucket_id='qelly-private-avatars'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=1
  and storage.filename(name) ~ '^avatar\.(jpg|png|webp)$'
);

create policy qelly_private_avatar_own_create
on storage.objects for insert to authenticated
with check (
  bucket_id='qelly-private-avatars'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=1
  and storage.filename(name) ~ '^avatar\.(jpg|png|webp)$'
);

-- Replacing an avatar requires an existing SELECT policy, plus both USING
-- and WITH CHECK so changing owner, bucket or path cannot cross boundaries.
create policy qelly_private_avatar_own_update
on storage.objects for update to authenticated
using (
  bucket_id='qelly-private-avatars'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=1
  and storage.filename(name) ~ '^avatar\.(jpg|png|webp)$'
)
with check (
  bucket_id='qelly-private-avatars'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=1
  and storage.filename(name) ~ '^avatar\.(jpg|png|webp)$'
);

create policy qelly_private_avatar_own_delete
on storage.objects for delete to authenticated
using (
  bucket_id='qelly-private-avatars'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=1
  and storage.filename(name) ~ '^avatar\.(jpg|png|webp)$'
);
commit;
