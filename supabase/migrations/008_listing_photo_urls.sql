-- EcoLoop Step 8: multiple product photos per listing
-- photo_url remains the cover; photo_urls holds additional gallery images.
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push)

alter table public.listings
  add column if not exists photo_urls text[] not null default '{}';

comment on column public.listings.photo_urls is
  'Additional listing photos (cover stays in photo_url)';
