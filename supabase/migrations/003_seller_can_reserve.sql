-- Let the seller reserve a listing for a buyer.
-- The original insert policy only allowed the buyer to open a row, so
-- "Reserve for this buyer" failed when no transaction existed yet.

create policy "Sellers can reserve their listing"
  on public.transactions for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and buyer_id <> auth.uid()
    and status in ('Interest', 'Reserved')
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );
