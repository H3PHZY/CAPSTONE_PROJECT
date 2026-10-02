-- EcoLoop Step 9: sellers can remove their own open listings
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push)
--
-- Draft/Live listings can be deleted. Interest/Cancelled rows are cleared first
-- so the listings FK (on delete restrict) does not block removal.
-- Reserved/Sold stay in place for exchange history.

drop policy if exists "Sellers can delete own draft listings" on public.listings;

create policy "Sellers can delete own open listings"
  on public.listings for delete
  to authenticated
  using (
    seller_id = auth.uid()
    and status in ('Draft', 'Live')
  );

drop policy if exists "Sellers can clear open interest on own listings" on public.transactions;

create policy "Sellers can clear open interest on own listings"
  on public.transactions for delete
  to authenticated
  using (
    seller_id = auth.uid()
    and status in ('Interest', 'Cancelled')
  );
