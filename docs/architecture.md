# EcoLoop architecture

## System architecture

```mermaid
flowchart LR
  Browser[Browser] --> Next[Next.js application on Vercel]
  Next -->|JWT API requests| Django[Django REST Framework on Render]
  Next -->|Geocoding proxy| Maps[Google Maps Geocoding API]
  Django --> DB[(PostgreSQL)]
  Django --> Media[Cloudinary]
  Django --> HF[Hugging Face inference]
  Django --> Paystack[Paystack API and webhook]
```

## Entity relationships

```mermaid
erDiagram
  USER ||--|| PROFILE : has
  USER ||--o{ LISTING : sells
  LISTING ||--o| CLASSIFICATION : classified_as
  LISTING ||--o{ TRANSACTION : traded_in
  USER ||--o{ TRANSACTION : buys
  USER ||--o{ TRANSACTION : sells
  TRANSACTION ||--o| CARBON_RECORD : records
  TRANSACTION ||--o{ DISPUTE : disputed_by
  USER ||--o{ DISPUTE : raises
  LISTING ||--o{ MESSAGE : discusses
  USER ||--o{ MESSAGE : sends
  USER ||--o{ MESSAGE : receives
```

## Payment sequence

```mermaid
sequenceDiagram
  actor Buyer
  participant Web as Next.js
  participant API as Django API
  participant DB as PostgreSQL
  participant Paystack
  Buyer->>Web: Start checkout
  Web->>API: POST /api/pay/initialize/
  API->>DB: Lock listing; expire old holds; save amount, currency, reference
  API-->>Web: Reference and amount in kobo
  Web->>Paystack: Initialize checkout
  Paystack-->>Web: Checkout result
  Web->>API: POST /api/pay/verify/
  API->>Paystack: Verify saved reference
  Paystack-->>API: Successful transaction details
  API->>API: Check reference, exact amount, NGN, and payment status
  API->>DB: Mark paid and completed; signal marks listing sold and creates carbon record
  API-->>Web: Verified payment
```

## Classification sequence

```mermaid
sequenceDiagram
  actor Seller
  participant Web as Next.js
  participant API as Django API
  participant Media as Cloudinary
  participant HF as Hugging Face
  Seller->>Web: Select listing image
  Web->>API: POST /api/media/upload/
  API->>Media: Store validated image
  Media-->>API: HTTPS image URL
  API-->>Web: Stored path and URL
  Web->>API: POST /api/classify/ with image URL
  API->>Media: Fetch image
  API->>HF: Classify prepared image
  HF-->>API: Image labels
  API-->>Web: Material, confidence, and alternatives
  Web-->>Seller: Confirm category or select manually
```

## Requirements and verification

| Kind | Requirement | Feature | Automated test or validation |
|---|---|---|---|
| Functional | Users can register, sign in, reset passwords, and retain sessions | JWT authentication and refresh | `test_signup_endpoint`, `test_login_endpoint`, `test_password_reset_request_and_confirmation`; frontend auth-context tests |
| Functional | Users may only access their own private records and listings they are permitted to see | Queryset scoping and object permissions | `test_user_cannot_access_another_users_private_listing_or_message`, `test_auth_me_only_exposes_and_updates_authenticated_users_profile` |
| Functional | Sellers may save private drafts and publish them later | Draft listing status and publish action | `test_draft_listings_are_private_until_owner_publishes` |
| Functional | A listing cannot have multiple active deals | Partial unique transaction constraint | `test_partial_unique_constraint_allows_only_one_active_listing_deal` |
| Functional | Payment must be verified before completion | Persisted reference, amount/currency checks, and payment-gated completion | Paystack verification and `test_manual_completion_requires_payment_and_succeeds_after_payment` |
| Functional | Abandoned payment holds expire | Lazy cleanup on initialization and list reads | `test_expired_payment_hold_is_released_during_listing_and_transaction_reads`, `test_expired_payment_hold_is_released_before_new_initialization`, `test_expired_payment_hold_is_released_before_mark_agreed` |
| Functional | Buyers can raise disputes on paid deals; admins resolve them | Dispute API and Django admin | `test_open_dispute_can_only_be_raised_by_buyer_on_paid_transaction`, `test_dispute_blocks_manual_status_changes` |
| Functional | Listing and profile locations have valid coordinates | Serializer validation and database constraints | `test_listing_location_requires_resolved_coordinates`, `test_profile_location_updates_require_coordinate_pair` |
| Functional | Uploaded images and PDFs persist in media storage | Cloudinary image/raw storage | `test_cloudinary_upload_command_checks_https_urls`; manual `test_cloudinary_upload` command with production credentials |
| Non-functional | Payment data cannot be altered through generic transaction writes | Read-only transaction viewset | `test_transaction_standard_writes_are_disabled_for_buyer_and_seller` |
| Non-functional | Input and stored values obey domain limits | Database check constraints and upload validation | `test_database_check_constraints_reject_invalid_values`, `test_media_upload_rejects_oversized_unsupported_and_fake_images` |
| Non-functional | Authentication/payment endpoints resist repeated requests | DRF scoped throttles | Django settings check; endpoint throttle integration tests |
| Non-functional | Production transport uses HTTPS security settings and exact frontend origins | Django deployment settings | `python manage.py check --deploy` with production environment variables |
| Non-functional | A sleeping API can be monitored without database access | `/api/health/` | `test_health_endpoint_does_not_require_authentication` |
| Non-functional | Backend and frontend changes are checked on each push and pull request | GitHub Actions | `.github/workflows/ci.yml` |
