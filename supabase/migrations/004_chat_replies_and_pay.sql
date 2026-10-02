-- Chat replies, payment receipts, and a demo payment reference on the deal.

alter table public.messages
  add column if not exists reply_to uuid references public.messages (id) on delete set null,
  add column if not exists image_url text;

alter table public.transactions
  add column if not exists payment_ref text,
  add column if not exists paid_at timestamptz;

create index if not exists messages_reply_idx on public.messages (reply_to);
