# EcoLoop Django REST API

This Django REST API replaces the Supabase backend configuration for the **EcoLoop** industrial waste redistribution marketplace. It maintains all schema structures, constraints, business logic, authorization rules, and external integrations (Hugging Face AI & Paystack).

---

## 1. Supabase to Django Migration Mapping

| Supabase Feature | Supabase Origin | Django Component | Location |
|---|---|---|---|
| **Profiles Table** | `001_initial_schema.sql` | `Profile` model (1:1 with `User`) | [`backend/api/models.py`](api/models.py) |
| **Listings Table** | `001_initial_schema.sql`, `008_listing_photo_urls.sql` | `Listing` model with `photo_urls` gallery | [`backend/api/models.py`](api/models.py) |
| **Classifications Table** | `001_initial_schema.sql` | `Classification` model (1:1 with `Listing`) | [`backend/api/models.py`](api/models.py) |
| **Transactions Table** | `001_initial_schema.sql`, `004_chat_replies_and_pay.sql` | `Transaction` model with `payment_ref` | [`backend/api/models.py`](api/models.py) |
| **Carbon Records Table** | `001_initial_schema.sql` | `CarbonRecord` model (1:1 with `Transaction`) | [`backend/api/models.py`](api/models.py) |
| **Messages Table** | `001_initial_schema.sql`, `011_message_attachments.sql` | `Message` model with reply_to & attachments | [`backend/api/models.py`](api/models.py) |
| **User Trigger** (`handle_new_user`) | `001_initial_schema.sql` | `post_save` signal on User | [`backend/api/signals.py`](api/signals.py) |
| **Listing Status Trigger** (`apply_transaction_listing_status`) | `002_transaction_listing_sync.sql` | `post_save` signal on Transaction | [`backend/api/signals.py`](api/signals.py) |
| **Pilot Trust Verification** | `007_pilot_verify_complete_profiles.sql` | `is_pilot_verified()` helper in `Profile.save()` | [`backend/api/utils.py`](api/utils.py) |
| **Listing Deletion Policy** | `009_seller_delete_listings.sql` | `CanDeleteListing` permission + `perform_destroy` | [`backend/api/permissions.py`](api/permissions.py) |
| **Row Level Security (RLS)** | `001_initial_schema.sql`, `010_public_live_listings.sql` | Custom DRF Permissions | [`backend/api/permissions.py`](api/permissions.py) |
| **Storage Buckets** | `listing-photos`, `message-attachments`, `profile-avatars` | Django `ImageField` / `FileField` media storage | [`backend/media/`](media/) |
| **AI Classification Route** | `app/api/classify/route.ts` | `ClassifyView` (with Pillow downscaling & HF API) | [`backend/api/views.py`](api/views.py) |
| **Paystack Verify Route** | `app/api/pay/verify/route.ts` | `PaystackVerifyView` (with amount guard) | [`backend/api/views.py`](api/views.py) |

---

## 2. API Endpoints

### Authentication & Profiles
* `POST /api/auth/signup/` — Register new user + business profile. Returns JWT access & refresh tokens.
* `POST /api/auth/login/` — Authenticate with email and password.
* `POST /api/auth/refresh/` — Obtain fresh access token using refresh token.
* `GET /api/auth/me/` — Fetch current user profile, cluster, and verification badge status.
* `PATCH /api/auth/me/` — Update profile metadata, avatar, email, or password.

### Marketplace & Listings
* `GET /api/listings/` — Browse listings (Public). Supports filtering:
  * `?q=aluminium` (keyword search)
  * `?category=Metal` (material filter)
  * `?radius=10` (radial distance in km via Haversine formula)
  * `?verified_only=true` (verified sellers only)
  * `?sort=Nearest first|Heaviest first|Lowest price`
* `POST /api/listings/` — Create new live listing + classification record atomically.
* `GET /api/listings/{id}/` — View listing details (automatically bumps view count).
* `PATCH /api/listings/{id}/` — Update owned listing.
* `DELETE /api/listings/{id}/` — Delete open Draft/Live listing (clears open interest first).
* `GET /api/listings/mine/` — Seller workspace view of all owned listings.
* `POST /api/listings/{id}/add_photos/` — Upload extra product gallery photos.

### Transactions
* `GET /api/transactions/` — List user's transactions (buyer or seller).
* `POST /api/transactions/mark_agreed/` — Seller reserves a listing for a buyer.
* `POST /api/transactions/mark_completed/` — Mark deal complete & calculate LCA carbon offset.

### Messages & In-App Chat
* `GET /api/messages/inbox/` — Fetch conversation threads grouped by `listing:counterparty`.
* `GET /api/messages/thread/?listing_id={id}&other_user_id={id}` — Retrieve full message history.
* `POST /api/messages/` — Send message with optional file attachment or reply-to parent.

### Carbon Analytics & External Integrations
* `GET /api/impact/` — User's aggregated carbon savings, monthly trend, material breakdown, and tree/petrol/flight equivalencies.
* `POST /api/classify/` — Classify waste photo using Hugging Face (supports file upload or URL).
* `POST /api/pay/verify/` — Verify Paystack reference, check kobo amount, and mark listing as Sold.

---

## 3. Local Setup Instructions

### Prerequisites
* Python 3.11 or newer
* Node.js (for the frontend)

### Installation Steps

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # On Windows PowerShell:
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Add your HF_TOKEN and PAYSTACK_SECRET_KEY in .env
   ```

5. **Apply database migrations**:
   ```bash
   python manage.py makemigrations api
   python manage.py migrate
   ```

6. **Create an admin superuser**:
   ```bash
   python manage.py createsuperuser
   ```

7. **Run the development server**:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```

Open your browser to `http://127.0.0.1:8000/admin/` to inspect the Django Admin dashboard.

---

## 4. Frontend Integration

To connect the Next.js frontend to this Django API:
1. Update `.env.local` in the Next.js project:
   ```bash
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```
2. Store the JWT token in `localStorage` or httpOnly cookies upon login/signup.
3. Pass `Authorization: Bearer <access_token>` in API request headers.

