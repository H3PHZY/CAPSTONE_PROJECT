-- EcoLoop Step 1: initial schema (Supabase / PostgreSQL)
-- Apply in Supabase Dashboard → SQL Editor → New query → Run
-- Or: supabase db push (if using Supabase CLI)

-- ── Enums ───────────────────────────────────────────────────────────────────

create type public.material_category as enum (
  'Plastic',
  'Glass',
  'Metal',
  'Biodegradable',
  'Rubber'
);

create type public.listing_status as enum (
  'Draft',
  'Live',
  'Reserved',
  'Sold'
);

create type public.transaction_status as enum (
  'Interest',
  'Reserved',
  'Completed',
  'Cancelled'
);

-- ── Profiles (extends auth.users) ────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  phone text,
  cluster text not null default 'Ogba',
  zone text,
  sells boolean not null default false,
  buys boolean not null default false,
  carbon_impact boolean not null default false,
  research_consent boolean not null default false,
  verified boolean not null default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_cluster_idx on public.profiles (cluster);

-- ── Listings ─────────────────────────────────────────────────────────────────

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  material public.material_category not null,
  weight_kg numeric(12, 2) not null check (weight_kg > 0),
  price_ngn numeric(14, 2),
  status public.listing_status not null default 'Draft',
  photo_url text,
  zone text,
  lat double precision,
  lng double precision,
  views integer not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_seller_idx on public.listings (seller_id);
create index listings_status_idx on public.listings (status);
create index listings_material_idx on public.listings (material);
create index listings_live_material_idx on public.listings (material)
  where status = 'Live';

-- ── Classifications (AI + optional override) ─────────────────────────────────

create table public.classifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  predicted_material public.material_category not null,
  confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
  overridden boolean not null default false,
  final_material public.material_category not null,
  model_id text,
  raw_labels jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classifications_listing_idx on public.classifications (listing_id);

-- ── Transactions ─────────────────────────────────────────────────────────────

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  status public.transaction_status not null default 'Interest',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_parties_distinct check (buyer_id <> seller_id)
);

create index transactions_listing_idx on public.transactions (listing_id);
create index transactions_buyer_idx on public.transactions (buyer_id);
create index transactions_seller_idx on public.transactions (seller_id);
create index transactions_status_idx on public.transactions (status);

-- ── Carbon records (one per completed transaction) ───────────────────────────

create table public.carbon_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions (id) on delete cascade,
  material public.material_category not null,
  weight_kg numeric(12, 2) not null check (weight_kg > 0),
  co2e_kg numeric(14, 2) not null check (co2e_kg >= 0),
  factor_kg_per_kg numeric(8, 4) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index carbon_records_transaction_idx on public.carbon_records (transaction_id);

-- ── Messages ─────────────────────────────────────────────────────────────────

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  constraint messages_parties_distinct check (sender_id <> recipient_id)
);

create index messages_listing_idx on public.messages (listing_id, created_at);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);

-- ── updated_at helper ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create trigger classifications_set_updated_at
  before update on public.classifications
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ── Auto-create profile on signup ────────────────────────────────────────────
-- Extra fields (business, roles, carbon) are filled in Step 2 from the signup form.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    business_name,
    cluster,
    phone,
    sells,
    buys,
    carbon_impact,
    research_consent
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', ''),
    coalesce(new.raw_user_meta_data ->> 'cluster', 'Ogba'),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'sells')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'buys')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'carbon_impact')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'research_consent')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.classifications enable row level security;
alter table public.transactions enable row level security;
alter table public.carbon_records enable row level security;
alter table public.messages enable row level security;

-- Profiles
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Listings: anyone signed in can browse live; sellers manage own
create policy "Authenticated users can read listings"
  on public.listings for select
  to authenticated
  using (
    status = 'Live'
    or seller_id = auth.uid()
  );

create policy "Sellers can insert own listings"
  on public.listings for insert
  to authenticated
  with check (seller_id = auth.uid());

create policy "Sellers can update own listings"
  on public.listings for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Sellers can delete own draft listings"
  on public.listings for delete
  to authenticated
  using (seller_id = auth.uid() and status = 'Draft');

-- Classifications follow listing ownership
create policy "Classifications readable with listing"
  on public.classifications for select
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.status = 'Live' or l.seller_id = auth.uid())
    )
  );

create policy "Sellers can insert classification for own listing"
  on public.classifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    )
  );

create policy "Sellers can update classification for own listing"
  on public.classifications for update
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    )
  );

-- Transactions: parties only
create policy "Transaction parties can read"
  on public.transactions for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyers can open interest"
  on public.transactions for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
  );

create policy "Transaction parties can update status"
  on public.transactions for update
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

-- Carbon: visible to transaction parties (and later impact dashboard)
create policy "Carbon records readable by transaction parties"
  on public.carbon_records for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

create policy "Seller or buyer can insert carbon for their completed txn"
  on public.carbon_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and t.status = 'Completed'
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- Messages: sender or recipient
create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Users can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid());

-- ── Storage bucket for listing photos (Step 3 will wire uploads) ──────────────

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload listing photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view listing photos"
  on storage.objects for select
  to public
  using (bucket_id = 'listing-photos');

create policy "Owners can update own listing photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owners can delete own listing photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
