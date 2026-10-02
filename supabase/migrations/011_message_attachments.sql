-- EcoLoop Step 11: chat attachments (images, PDF, docs) + metadata
-- Apply in Supabase Dashboard → SQL Editor

alter table public.messages
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text;

comment on column public.messages.image_url is
  'Public URL for chat attachment (image, PDF, or document)';
comment on column public.messages.attachment_name is
  'Original file name for download label';
comment on column public.messages.attachment_mime is
  'MIME type of the attachment';

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload message attachments" on storage.objects;
create policy "Authenticated users can upload message attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Message attachments are publicly readable" on storage.objects;
create policy "Message attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'message-attachments');

drop policy if exists "Owners can update own message attachments" on storage.objects;
create policy "Owners can update own message attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can delete own message attachments" on storage.objects;
create policy "Owners can delete own message attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
