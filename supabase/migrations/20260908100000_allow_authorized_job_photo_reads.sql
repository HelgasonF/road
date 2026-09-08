create policy "Authorized users can read job photo objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'job-photos'
  and exists (
    select 1
    from public.job_photos photo
    where photo.storage_path = storage.objects.name
      and photo.uploaded_at is not null
  )
);

