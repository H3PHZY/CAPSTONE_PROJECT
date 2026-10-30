-- Serialize reservations per listing and keep payment confirmation server-issued.

alter table public.transactions
  add column if not exists pending_payment_ref text,
  add column if not exists pending_payment_expires_at timestamptz;

create unique index if not exists transactions_listing_buyer_seller_key
  on public.transactions (listing_id, buyer_id, seller_id);

create unique index if not exists transactions_pending_payment_ref_key
  on public.transactions (pending_payment_ref)
  where pending_payment_ref is not null;

create or replace function public.guard_deal_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.deal_price_ngn is distinct from old.deal_price_ngn then
    if auth.uid() is not null and auth.uid() <> old.seller_id then
      raise exception 'Only the seller can set the deal price';
    end if;
    if old.paid_at is not null then
      raise exception 'Cannot change price after payment';
    end if;
    if old.pending_payment_ref is not null
      and old.pending_payment_expires_at > now() then
      raise exception 'Cannot change price while payment is in progress';
    end if;
    if old.status = 'Completed' or new.status = 'Completed' then
      raise exception 'Cannot change price on a completed deal';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_transaction_inventory_and_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  effective_price numeric;
begin
  if tg_op = 'INSERT' and new.status = 'Completed' then
    raise exception 'An exchange must be reserved before it can be completed';
  end if;

  if new.status = 'Reserved'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select * into listing_row
      from public.listings
      where id = new.listing_id
      for update;

    if not found or listing_row.seller_id <> new.seller_id then
      raise exception 'Listing not found for this seller';
    end if;
    if listing_row.status = 'Sold' then
      raise exception 'This listing is already sold';
    end if;
    if auth.uid() is not null and auth.uid() <> new.seller_id then
      raise exception 'Only the seller can reserve this listing';
    end if;
    if exists (
      select 1
      from public.transactions t
      where t.listing_id = new.listing_id
        and t.buyer_id <> new.buyer_id
        and t.status in ('Reserved', 'Completed')
        and t.id <> new.id
    ) then
      raise exception 'This listing is already reserved for another buyer';
    end if;
  end if;

  if new.status = 'Completed'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if tg_op = 'INSERT' or old.status <> 'Reserved' then
      raise exception 'Reserve this buyer before completing the exchange';
    end if;

    select coalesce(new.deal_price_ngn, l.price_ngn)
      into effective_price
      from public.listings l
      where l.id = new.listing_id;

    if coalesce(effective_price, 0) <= 0 or new.paid_at is null then
      raise exception 'Set a price and confirm payment before completing the exchange';
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_guard_inventory_and_completion
  on public.transactions;
create trigger transactions_guard_inventory_and_completion
  before insert or update of status on public.transactions
  for each row
  execute function public.guard_transaction_inventory_and_completion();

create or replace function public.reserve_listing_for_buyer(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  transaction_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_seller_id then
    raise exception 'Only the seller can reserve a buyer for this listing';
  end if;
  if p_buyer_id = p_seller_id then
    raise exception 'Buyer and seller must be different users';
  end if;

  select * into listing_row
    from public.listings
    where id = p_listing_id
    for update;

  if not found or listing_row.seller_id <> p_seller_id then
    raise exception 'Listing not found';
  end if;
  if listing_row.status = 'Sold' then
    raise exception 'This listing is already sold';
  end if;
  if exists (
    select 1
    from public.transactions t
    where t.listing_id = p_listing_id
      and t.buyer_id <> p_buyer_id
      and t.status in ('Reserved', 'Completed')
  ) then
    raise exception 'This listing is already reserved for another buyer. Complete or cancel that deal first.';
  end if;

  insert into public.transactions as existing_txn (
    listing_id,
    buyer_id,
    seller_id,
    status,
    deal_price_ngn
  )
  values (
    p_listing_id,
    p_buyer_id,
    p_seller_id,
    'Reserved',
    listing_row.price_ngn
  )
  on conflict (listing_id, buyer_id, seller_id)
  do update set
    status = 'Reserved',
    deal_price_ngn = coalesce(
      existing_txn.deal_price_ngn,
      excluded.deal_price_ngn
    )
  where existing_txn.status not in ('Completed', 'Cancelled')
  returning id into transaction_id;

  if transaction_id is null then
    raise exception 'This exchange is already completed or was cancelled';
  end if;
end;
$$;

revoke all on function public.reserve_listing_for_buyer(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.reserve_listing_for_buyer(uuid, uuid, uuid)
  to authenticated;

create or replace function public.issue_payment_reference(
  p_transaction_id uuid,
  p_buyer_id uuid,
  p_reference text,
  p_expires_at timestamptz
)
returns table (payment_reference text, amount_kobo bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_id uuid;
  listing_row public.listings%rowtype;
  deal_row public.transactions%rowtype;
  effective_price numeric;
begin
  select t.listing_id into listing_id
    from public.transactions t
    where t.id = p_transaction_id
      and t.buyer_id = p_buyer_id;
  if not found then
    raise exception 'Deal not found for this buyer';
  end if;

  select * into listing_row
    from public.listings l
    where l.id = listing_id
    for update;
  select * into deal_row
    from public.transactions t
    where t.id = p_transaction_id
    for update;

  if deal_row.buyer_id <> p_buyer_id then
    raise exception 'Only the buyer can pay';
  end if;
  if deal_row.status <> 'Reserved' then
    raise exception 'This deal is not reserved';
  end if;
  if deal_row.paid_at is not null then
    raise exception 'This deal is already paid';
  end if;
  if not found or listing_row.id is null then
    raise exception 'Listing not found';
  end if;

  effective_price := coalesce(deal_row.deal_price_ngn, listing_row.price_ngn);
  if coalesce(effective_price, 0) <= 0 then
    raise exception 'Set a price for this exchange before payment';
  end if;
  if round(effective_price * 100) <= 0
    or round(effective_price * 100) > 9007199254740991 then
    raise exception 'The agreed price is outside the payment limit';
  end if;

  if p_reference !~ (
    '^ECO-' ||
    upper(substr(replace(listing_id::text, '-', ''), 1, 8)) ||
    '-[0-9]{13}-[A-F0-9]{16}$'
  ) then
    raise exception 'Invalid server payment reference';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '31 minutes' then
    raise exception 'Invalid payment reference expiration';
  end if;

  if deal_row.pending_payment_ref is not null
    and deal_row.pending_payment_expires_at > now() then
    return query
      select deal_row.pending_payment_ref,
        round(effective_price * 100)::bigint;
    return;
  end if;

  update public.transactions
    set deal_price_ngn = coalesce(deal_price_ngn, effective_price),
        pending_payment_ref = p_reference,
        pending_payment_expires_at = p_expires_at
    where id = p_transaction_id;

  return query select p_reference, round(effective_price * 100)::bigint;
end;
$$;

revoke all on function public.issue_payment_reference(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_payment_reference(uuid, uuid, text, timestamptz)
  to service_role;

create or replace function public.confirm_paystack_payment(
  p_transaction_id uuid,
  p_buyer_id uuid,
  p_reference text,
  p_amount_kobo bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_id uuid;
  listing_row public.listings%rowtype;
  deal_row public.transactions%rowtype;
  effective_price numeric;
begin
  select t.listing_id into listing_id
    from public.transactions t
    where t.id = p_transaction_id
      and t.buyer_id = p_buyer_id;
  if not found then
    raise exception 'Deal not found for this buyer';
  end if;

  select * into listing_row
    from public.listings l
    where l.id = listing_id
    for update;
  select * into deal_row
    from public.transactions t
    where t.id = p_transaction_id
    for update;

  if not found or listing_row.id is null then
    raise exception 'Listing not found';
  end if;
  if deal_row.buyer_id <> p_buyer_id then
    raise exception 'Only the buyer can pay';
  end if;
  if deal_row.status <> 'Reserved' then
    raise exception 'This deal is not reserved';
  end if;
  if deal_row.paid_at is not null then
    raise exception 'This deal is already paid';
  end if;
  if deal_row.pending_payment_ref is distinct from p_reference
    or deal_row.pending_payment_expires_at is null
    or deal_row.pending_payment_expires_at <= now() then
    raise exception 'Payment reference is invalid or expired';
  end if;

  effective_price := coalesce(deal_row.deal_price_ngn, listing_row.price_ngn);
  if coalesce(effective_price, 0) <= 0
    or round(effective_price * 100) <> p_amount_kobo then
    raise exception 'Payment amount does not match the current agreed price';
  end if;
  if round(effective_price * 100) > 9007199254740991 then
    raise exception 'The agreed price is outside the payment limit';
  end if;

  update public.transactions
    set payment_ref = p_reference,
        paid_at = now(),
        pending_payment_ref = null,
        pending_payment_expires_at = null
    where id = p_transaction_id;
end;
$$;

revoke all on function public.confirm_paystack_payment(uuid, uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.confirm_paystack_payment(uuid, uuid, text, bigint)
  to service_role;
