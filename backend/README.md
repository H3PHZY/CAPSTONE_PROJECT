# EcoLoop Django REST API

This Django REST API powers the **EcoLoop** industrial waste redistribution marketplace. It manages the marketplace schema, business logic, authorization rules, and integrations such as Hugging Face AI and Paystack.

---

## 1. Backend Architecture

| Area | Django component | Location |
|---|---|---|---|
| Models | Profiles, listings, classifications, transactions, carbon records, and messages | [`api/models.py`](api/models.py) |
| Authorization | Django REST Framework permissions | [`api/permissions.py`](api/permissions.py) |
| Business events | Django model signals | [`api/signals.py`](api/signals.py) |
| API endpoints | Authentication, listings, transactions, messages, media, classification, and payments | [`api/views.py`](api/views.py) |
| Media storage | Django storage backend; Cloudinary in production | [`ecoloop/settings.py`](ecoloop/settings.py) |

---

## 2. API Endpoints

### Authentication & Profiles
* `POST /api/auth/signup/` — Register new user + business profile. Returns JWT access & refresh tokens.
* `POST /api/auth/login/` — Authenticate with email and password.
* `POST /api/auth/refresh/` — Obtain fresh access token using refresh token.
* `GET /api/auth/me/` — Fetch current user profile, cluster, and verification badge status.
* `PATCH /api/auth/me/` — Update profile metadata, avatar, email, or password.
* `POST /api/auth/password-reset/` and `POST /api/auth/password-reset/confirm/` — Request and complete a password reset.

### Marketplace & Listings
* `GET /api/listings/` — Browse listings (Public). Supports filtering:
  * `?q=aluminium` (keyword search)
  * `?category=Metal` (material filter)
  * `?radius=10` (radial distance in km via Haversine formula)
  * `?lat={latitude}&lng={longitude}` (search origin; otherwise uses the signed-in user's saved location)
  * `?verified_only=true` (verified sellers only)
  * `?sort=Nearest first|Heaviest first|Lowest price`
* `POST /api/listings/` — Create new live listing + classification record atomically.
* `GET /api/listings/{id}/` — View listing details (automatically bumps view count).
* `PATCH /api/listings/{id}/` — Update owned listing.
* `DELETE /api/listings/{id}/` — Delete open Draft/Live listing (clears open interest first).
* `GET /api/listings/mine/` — Seller workspace view of all owned listings.
* `POST /api/listings/{id}/add_photos/` — Upload extra product gallery photos.
* Listing create/update accepts an address and coordinates. Public listings expose an approximate zone location; exact address and coordinates are restricted to the owner.
* `POST /api/media/upload/` â€” Upload a listing photo, message attachment, or profile avatar through Django's configured storage backend.

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
* `POST /api/pay/initialize/` â€” Lock an available listing and return its database price in kobo plus a server-generated payment reference.
* `POST /api/pay/verify/` — Verify Paystack reference, check kobo amount, and mark listing as Sold.
* `GET /api/schema/`, `/api/docs/`, and `/api/redoc/` — OpenAPI schema and interactive documentation.

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
   Copy-Item .env.example .env
   # Set the required database and API credentials in .env
   ```

5. **Apply database migrations**:
   ```bash
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
   NEXT_PUBLIC_DJANGO_API_URL=http://127.0.0.1:8000/api
   ```
2. The frontend auth context manages JWT access and refresh tokens and adds bearer authorization to protected requests. API calls use `NEXT_PUBLIC_DJANGO_API_URL` as the API root.
3. Messages and notification badges poll the Django API at short intervals; no Supabase realtime connection is required.

For production deployment, configure Django environment variables and deploy the frontend separately. See the repository's [deployment guide](../README.md#production-deployment) for Render and Vercel setup, Cloudinary media credentials, and CORS/CSRF origins.
