-- EcoLoop Step 13: company profile pictures
-- Apply in Supabase Dashboard → SQL Editor

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL for company / seller profile photo';

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload profile avatars" on storage.objects;
create policy "Authenticated users can upload profile avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile avatars are publicly readable" on storage.objects;
create policy "Profile avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

drop policy if exists "Owners can update own profile avatars" on storage.objects;
create policy "Owners can update own profile avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can delete own profile avatars" on storage.objects;
create policy "Owners can delete own profile avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
