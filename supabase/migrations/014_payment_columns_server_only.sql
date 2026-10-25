-- Only the server (service role) can write payment columns.
create unique index if not exists transactions_payment_ref_key
  on public.transactions (payment_ref)
  where payment_ref is not null;

revoke insert, update on public.transactions from authenticated;
grant insert (listing_id, buyer_id, seller_id, status)
  on public.transactions to authenticated;
grant update (status, completed_at)
  on public.transactions to authenticated;