-- Add Rubber to EcoLoop material categories (quick listing + AI mapping + carbon).

alter type public.material_category add value if not exists 'Rubber';
