-- Fold Wood + Cardboard into Biodegradable for EcoLoop listings.

update public.listings
  set material = 'Biodegradable'
  where material in ('Wood', 'Cardboard');

update public.classifications
  set predicted_material = 'Biodegradable'
  where predicted_material in ('Wood', 'Cardboard');

update public.classifications
  set final_material = 'Biodegradable'
  where final_material in ('Wood', 'Cardboard');

update public.carbon_records
  set material = 'Biodegradable'
  where material in ('Wood', 'Cardboard');

-- Enum values Wood/Cardboard remain in Postgres (cannot easily drop) but are unused by the app.
