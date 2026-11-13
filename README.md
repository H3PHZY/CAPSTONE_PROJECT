# EcoLoop

EcoLoop is an industrial-waste marketplace for manufacturers in Lagos. Sellers publish surplus material, buyers search nearby listings and message sellers, and completed exchanges record estimated carbon savings.

## Stack

- Frontend: Next.js 16, React 19, TypeScript
- API and authentication: Django REST Framework with JWT
- Database: PostgreSQL in production (SQLite is supported for local development)
- Media: Cloudinary in production
- Payments: Paystack; payment references, price checks, and fulfillment are verified by Django
- Classification: Hugging Face through the Django API
- Maps: Google Maps geocoding and map embeds

## Local setup

### Django API

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Set `SECRET_KEY`, `HF_TOKEN`, and Paystack keys in `backend/.env` as needed. Local development uses SQLite and filesystem media storage unless PostgreSQL or Cloudinary settings are provided. API documentation is at `http://127.0.0.1:8000/api/docs/`.

Optional: run `python manage.py seed_demo_data --password "<demo-password>"` to create two demo accounts and sample listings. The command does not overwrite existing demo account passwords. Create an administrator with `python manage.py createsuperuser`.

### Next.js frontend

In another terminal:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_DJANGO_API_URL=http://127.0.0.1:8000/api` in `.env.local`. Google Maps geocoding uses the server-only `GOOGLE_MAPS_API_KEY`; map embeds may use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Restrict the server key to Geocoding API and the browser key to your website referrers. If geocoding is unavailable, listing publishing falls back to coordinates for the selected zone. Set `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` for the checkout UI.

## Production deployment

### Django on Render

The root `render.yaml` defines the Django web service, static collection, database migration during the build, and Gunicorn start command. It does not create a database.

1. Connect the repository to Render and deploy the Blueprint. It creates a **Free** web service only; it does not provision a database.
2. Set `DATABASE_URL` to the Internal URL of your existing PostgreSQL database. The blueprint prompts for this value; it will not create or replace a database.
3. Set `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `FRONTEND_URL` to the exact HTTPS Vercel origin (for example `https://your-app.vercel.app`).
4. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
5. Configure Hugging Face, Paystack, and production SMTP values in the Render environment. Never put private credentials in `NEXT_PUBLIC_*` variables.
6. Confirm the API responds at `/api/health/` and `/api/docs/`; migrations run at the end of the Render build command.

Production mode requires a non-development Django secret and Cloudinary credentials. Render serves collected static assets with WhiteNoise; uploaded images and raw attachments use Cloudinary media storage. Configure `PAYMENT_HOLD_MINUTES` (default 30). In production, set `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `FRONTEND_URL` to the same single HTTPS Vercel origin. The Free web service can sleep while idle; allow time for it to wake before testing or a demo.

To verify persistent Cloudinary image and PDF storage from an environment with credentials and representative local files:

```powershell
cd backend
python manage.py test_cloudinary_upload --image .\path\to\sample.jpg --pdf .\path\to\sample.pdf
```

The command uploads both files, prints their HTTPS URLs, and checks that both URLs return a successful HTTP response. It leaves the test uploads in Cloudinary.

### Next.js on Vercel

1. Import the repository into Vercel and set the project root to the repository root.
2. Add `NEXT_PUBLIC_DJANGO_API_URL=https://<your-render-service>.onrender.com/api`.
3. Add `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` and the Google Maps keys required by the deployed UI/geocoding route.
4. Add the exact Vercel origin to the Django `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` settings in Render.
5. Redeploy after changing environment variables.

Use the same Django API base URL on every deployment; it must end in `/api` with no trailing slash.

## API surfaces

- `POST /api/auth/signup/`, `POST /api/auth/login/`, `POST /api/auth/refresh/`, `GET/PATCH /api/auth/me/`
- `POST /api/auth/password-reset/` and `/api/auth/password-reset/confirm/`
- `GET/POST /api/listings/`, `GET/PATCH/DELETE /api/listings/{id}/`, `GET /api/listings/mine/`
- `GET /api/messages/inbox/`, `GET /api/messages/thread/`, `POST /api/messages/`
- `GET /api/transactions/`, `POST /api/transactions/mark_agreed/`, `POST /api/transactions/mark_completed/`
- `GET/POST /api/disputes/` (paid-deal disputes; admin staff resolve them)
- `POST /api/media/upload/`, `POST /api/classify/`
- `POST /api/pay/initialize/`, `POST /api/pay/verify/`, `POST /api/pay/webhook/`
- `GET /api/health/`
- `GET /api/impact/`

Messaging uses short polling (5 seconds while the Messages page is open; 7 seconds for notifications) instead of a realtime database connection.

## Validation commands

```powershell
npx tsc --noEmit
npm run lint
npm run test -- --run
npm run build
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
coverage run --source=api manage.py test
coverage report
python manage.py check --deploy
```

`check --deploy` requires production environment variables, including a strong `SECRET_KEY`, host name, HTTPS frontend origin, and Cloudinary credentials.

## Database backups

Use the PostgreSQL client tools with the database URL in an environment variable; do not put credentials in command history:

```powershell
$env:PGURI = "postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pg_dump --format=custom --no-owner --file=ecoloop-backup.dump $env:PGURI
pg_restore --clean --if-exists --no-owner --dbname=$env:PGURI .\ecoloop-backup.dump
```

The free Render PostgreSQL database expires 30 days after creation. Download and verify backups regularly, and migrate to a persistent database before the expiry date.

## Media field audit

| Field | Frontend usage | Cleanup decision |
|---|---|---|
| `Listing.photo` | Not used for normal listing creation; the gallery-upload API action stores extra photos here, and serializers expose its URL. | Retain while the gallery action and old uploads depend on it. |
| `Listing.photo_url` | Used for the listing cover and as the single-photo fallback. | Retain; it is part of the current API contract and existing listings. |
| `Listing.photo_urls` | Used for listing galleries. | Retain; removing it would lose gallery behavior and historical URLs. |
| `Profile.avatar` | Not uploaded directly by the current UI; the API/model can still return it as a legacy fallback. | Retain until stored image files are migrated and the fallback is versioned out. |
| `Profile.avatar_url` | Written by the profile UI and used to display the profile avatar. | Retain; it is the active profile-avatar field. |
| `Message.image_url` | Written by the messaging UI for uploaded attachments and displayed in chat. | Retain; it is the active message attachment URL. |
| `Message.attachment` | Not written by the current UI; read as a legacy fallback for existing uploads. | Retain until existing attachment data is migrated and the fallback is versioned out. |

No field can be safely removed without a data migration and a coordinated API change; `photo`, `avatar`, and `attachment` still serve upload or backward-compatibility paths.

## Project structure

```text
app/                    Next.js routes and geocoding proxy
backend/                Django project, API, PostgreSQL models, migrations
components/             Frontend UI
lib/                    Django API clients, auth, and domain mappers
render.yaml             Render Free web-service Blueprint (uses an existing database)
public/assets/          Static assets
docs/                   Screenshots and designs
```

## Designs

- Home: [designs/home_page.png](designs/home_page.png)
- Marketplace: [designs/market_place.png](designs/market_place.png)
- Quick listing: [designs/quick_listing.png](designs/quick_listing.png)
