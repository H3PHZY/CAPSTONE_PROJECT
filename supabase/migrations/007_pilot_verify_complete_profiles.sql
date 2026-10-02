-- EcoLoop Step 7: pilot trust — mark complete seller/buyer profiles as verified
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push)
-- Badge on marketplace cards reads profiles.verified via listings.seller join.

update public.profiles
set verified = true
where coalesce(trim(business_name), '') <> ''
  and phone is not null
  and trim(phone) <> ''
  and (sells or buys);
