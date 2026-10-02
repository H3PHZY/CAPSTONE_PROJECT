-- Sync listing status when a transaction is reserved / completed.
-- Lets buyers mark agreed/complete without needing listing UPDATE RLS.

create or replace function public.apply_transaction_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Reserved' then
    update public.listings
      set status = 'Reserved'
      where id = new.listing_id
        and status in ('Live', 'Draft', 'Reserved');
  elsif new.status = 'Completed' then
    update public.listings
      set status = 'Sold'
      where id = new.listing_id;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_sync_listing on public.transactions;

create trigger transactions_sync_listing
  after insert or update of status on public.transactions
  for each row
  execute function public.apply_transaction_listing_status();
