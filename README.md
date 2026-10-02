# EcoLoop

AI-powered industrial waste redistribution marketplace for SME manufacturers in the Ogba–Ikeja industrial cluster (Lagos). Capstone prototype migrated from `EcoLoop.dc.html` to **Next.js App Router**.

## Step 0 — Locked architecture

| Layer | Choice | Notes |
|--------|--------|--------|
| Frontend | Next.js 16 + React 19 + TypeScript | Existing app; keep App Router (not Vite rebuild) |
| Styling | Tailwind CSS 4 + IBM Plex Sans/Mono | Current `app/globals.css` design system |
| Database | Supabase Postgres | Replaces self-hosted Postgres |
| Auth | Supabase Auth (JWT) | Replaces localStorage demo auth |
| Photos | Supabase Storage (`listing-photos`) | Replaces Cloudinary from the proposal |
| AI classify | Hugging Face Inference Endpoint | Your hosted model URL + `HF_TOKEN` in `.env.local` |
| Carbon math | App LCA factors (`lib/carbon.ts`) | Written to `carbon_records` on completed deals |
| Hosting (target) | Vercel (frontend) + Supabase (backend) | HF later when ready |

```
Next.js (UI)
    ├── Supabase Auth + Postgres + Storage
    └── Classify route → Hugging Face model (Step 5, deferred)
            └── material + confidence → listings / classifications
```

**In scope (MVP):** auth, profiles, listings, HF classify + override, marketplace filters, messages, transactions, carbon impact, research opt-in.

**Out of scope (post-MVP):** in-app payments / PSP checkout, logistics partners, smart pricing, eco-chatbot, training a custom YOLOv8 from scratch.

**Proposal delta:** original write-up said Express + Cloudinary + YOLOv8/FastAPI. EcoLoop MVP uses Supabase + HF classifier instead; document that in the dissertation as an architecture refinement.

## Frontend stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 (`@import "tailwindcss"` in `app/globals.css`)
- IBM Plex Sans / Mono via `next/font/google`

## Structure

```
app/                  # App Router pages + layout + globals.css
components/           # UI by area (home, dashboard, marketplace, …)
lib/                  # types, demo data, carbon helpers, DB types
supabase/migrations/  # SQL schema for Supabase
public/assets/        # EcoLoop mark/logo for /assets/…
```

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Backend Step 1 — Supabase schema

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → New query.
3. Paste and run `supabase/migrations/001_initial_schema.sql`.
4. Confirm tables under **Table Editor**: `profiles`, `listings`, `classifications`, `transactions`, `carbon_records`, `messages`.
5. Confirm Storage bucket `listing-photos` exists.
6. Copy Project URL + anon key into `.env.local` (see `.env.example`).

## Backend Step 3 — Listing photos

- Bucket: `listing-photos` (created by the schema migration)
- Helper: `lib/listing-photos.ts`
- UI: `/listings/new` uploads to `{userId}/{uuid}.ext` and shows the stored photo

## Backend Step 4 — Listings CRUD

- Helper: `lib/listings.ts` (create, fetch live, fetch mine, map rows)
- Publish on `/listings/new` inserts `listings` + `classifications`
- `/marketplace` and `/marketplace/[id]` read Live rows from Supabase
- `/listings/mine` shows the signed-in seller's rows
- Marketplace and home show **live Supabase listings only** (no demo inventory)
- Run `010_public_live_listings.sql` so guests can browse Live lots without signing in

## Backend Step 5 — Hugging Face classify

1. Set in `.env.local`:

```env
HF_TOKEN=hf_...
HF_MODEL_ID=yangy50/garbage-classification
```

2. Restart `npm run dev`. Upload a photo on `/listings/new`.

3. **How classify works on free serverless:** [yangy50](https://huggingface.co/yangy50/garbage-classification) and CLIP often have **no Inference Provider**. EcoLoop tries yangy50 first, then falls back to **[google/vit-base-patch16-224](https://huggingface.co/google/vit-base-patch16-224)** (warm on `hf-inference`) and maps ImageNet labels (e.g. `beer bottle` → Glass, `water bottle` → Plastic) into EcoLoop categories. Sellers can always override.

4. **Optional `HF_ENDPOINT_URL`:** Deploy → Inference Endpoints for yangy50 if you want the specialist model later.

Confidence under 60% is flagged for review.
## Backend Step 6 — Messages

- Helper: `lib/messages.ts`
- `/messages` loads real threads from Supabase
- **Initiate contact** on marketplace/detail opens `/messages?listing=<id>`
- Buyers message sellers; replies persist in `messages`
- Attachments (images, PDF, Word/Excel, TXT/CSV) open in an in-app lightbox with **Download** — run `011_message_attachments.sql` first
- New inbound messages show a bottom toast preview when you are on another page — run `012_messages_realtime.sql` (or enable Realtime for `messages` in the Dashboard)
- On `/messages`, the inbox list and open thread refresh live when either side sends a message
- Profile photos: upload a company picture on `/profile` (run `013_profile_avatars.sql`) — shows in the header and chats

## Backend Step 7 — Transactions + carbon

1. Run `supabase/migrations/002_transaction_listing_sync.sql` in the SQL Editor (syncs listing → Reserved/Sold).
2. Run `supabase/migrations/003_seller_can_reserve.sql` so the **seller** can insert a Reserved transaction (buyers can still open Interest).
3. Run `supabase/migrations/004_chat_replies_and_pay.sql` so chat can store replies and file attachments.
4. After reserve, parties share bank details / payment proof in **Messages** (no in-app checkout). Either side can **Reply** and attach a photo or PDF (for example a receipt), then **Mark completed**.
5. Dashboard impact snapshot and `/impact` (if opted in) read real CO₂e from completed exchanges.
6. My listings pipeline shows Interest / Reserved / Completed from `transactions`.
7. Run `supabase/migrations/007_pilot_verify_complete_profiles.sql` so existing accounts with a business name + phone show as **Verified** on marketplace cards. New signups / profile saves set this automatically.
8. Run `supabase/migrations/008_listing_photo_urls.sql` so sellers can attach extra product photos on **My listings → Manage**.

Helper: `lib/transactions.ts`

## Manage a listing

- **My listings** → **Manage** opens `/listings/[id]/manage`
- Edit title, weight, price, zone, and status
- Add up to 6 product photos (cover + gallery); they appear on the marketplace detail page
- **Delete this listing** removes Draft/Live lots (run `009_seller_delete_listings.sql` first). Reserved/Sold stay for history.


## Auth — forgot password

- Login modal: **Forgot password?** sends a Supabase reset email
- Reset page: /reset-password (set new password after opening the email link)
- In Supabase → **Authentication → URL Configuration**, add redirect URL:
  - http://localhost:3000/reset-password
  - your production URL + /reset-password

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
