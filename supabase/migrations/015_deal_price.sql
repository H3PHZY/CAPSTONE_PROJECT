-- EcoLoop Step 15: seller can set a per-buyer asking price (partial lots)
-- Apply in Supabase Dashboard → SQL Editor

alter table public.transactions
  add column if not exists deal_price_ngn numeric(14, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_deal_price_positive'
  ) then
    alter table public.transactions
      add constraint transactions_deal_price_positive
      check (deal_price_ngn is null or deal_price_ngn > 0);
  end if;
end
$$;

create or replace function public.guard_deal_price()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.deal_price_ngn is distinct from old.deal_price_ngn then
    if auth.uid() is not null and auth.uid() <> old.seller_id then
      raise exception 'Only the seller can set the deal price';
    end if;
    if old.paid_at is not null then
      raise exception 'Cannot change price after payment';
    end if;
    if old.status = 'Completed' or new.status = 'Completed' then
      raise exception 'Cannot change price on a completed deal';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_deal_price on public.transactions;
create trigger transactions_guard_deal_price
  before update on public.transactions
  for each row execute function public.guard_deal_price();

grant insert (listing_id, buyer_id, seller_id, status, deal_price_ngn)
  on public.transactions to authenticated;

grant update (status, completed_at, deal_price_ngn)
  on public.transactions to authenticated;