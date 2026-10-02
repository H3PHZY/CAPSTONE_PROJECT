-- EcoLoop Step 10: public browse of Live listings (no demo inventory)
-- Apply in Supabase Dashboard → SQL Editor
-- Lets guests see real Live listings + seller names without signing in.

drop policy if exists "Authenticated users can read listings" on public.listings;

create policy "Live listings are readable; sellers see own"
  on public.listings for select
  using (status = 'Live' or seller_id = auth.uid());

drop policy if exists "Classifications readable with listing" on public.classifications;

create policy "Classifications readable with listing"
  on public.classifications for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.status = 'Live' or l.seller_id = auth.uid())
    )
  );

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);
