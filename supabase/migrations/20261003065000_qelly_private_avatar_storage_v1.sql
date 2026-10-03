-- Wave CU: private, user-owned QELLY profile pictures.
-- Foundation only: the profile page must not advertise uploads before
-- authenticated upload/download/remove routes and real-user RLS tests ship.
-- Uploaded MT5 reports are deliberately NOT persisted in this bucket.

begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'qelly-private-avatars','qelly-private-avatars',false,
  2097152,array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=2097152,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

alter table storage.objects enable row level security;

-- Only <current auth.uid()>/avatar.jpg|png|webp, never arbitrary directories.
-- Storage API sets owner_id from the authenticated uploader; do not trust
-- client-supplied user metadata or a caller-supplied account identifier.
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
