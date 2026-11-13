import hashlib
import hmac
import json
from decimal import Decimal
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.db import IntegrityError, transaction as db_transaction
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import MagicMock, Mock, patch
from api.models import (
    Listing,
    Classification,
    Transaction,
    CarbonRecord,
    Message,
    MaterialCategory,
    Dispute,
    DisputeStatus,
    ListingStatus,
    TransactionStatus,
)
from api.utils import haversine_km, calculate_co2_kg, is_pilot_verified
from api.paystack import AmountMismatchError, PaymentVerificationError, verify_paystack_transaction
from api.views import expire_stale_payment_holds

User = get_user_model()

class EcoLoopAPITestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

        # Create Seller
        self.seller = User.objects.create_user(
            username="seller@test.ng",
            email="seller@test.ng",
            password="testpassword123"
        )
        self.seller_profile = self.seller.profile
        self.seller_profile.business_name = "Apex Metalworks Ltd"
        self.seller_profile.phone = "+234 800 123 4567"
        self.seller_profile.cluster = "Ogba"
        self.seller_profile.sells = True
        self.seller_profile.save()

        # Create Buyer
        self.buyer = User.objects.create_user(
            username="buyer@test.ng",
            email="buyer@test.ng",
            password="testpassword123"
        )
        self.buyer_profile = self.buyer.profile
        self.buyer_profile.business_name = "GreenWay Recyclers"
        self.buyer_profile.phone = "+234 800 987 6543"
        self.buyer_profile.cluster = "Ikeja"
        self.buyer_profile.buys = True
        self.buyer_profile.save()

    def post_paystack_webhook(self, event, secret, signature=None):
        body = json.dumps(event).encode("utf-8")
        signature = signature or hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha512,
        ).hexdigest()
        return self.client.post(
            "/api/pay/webhook/",
            body,
            content_type="application/json",
            HTTP_X_PAYSTACK_SIGNATURE=signature,
        )

    def test_pilot_trust_verification(self):
        """Test that profile with business name, phone, and buy/sell role gets verified."""
        self.assertTrue(self.seller.profile.verified)
        self.assertTrue(self.buyer.profile.verified)

        unverified = is_pilot_verified("", "+234...", True, False)
        self.assertFalse(unverified)

    def test_signup_endpoint(self):
        """Test signup creates user and profile with JWT tokens returned."""
        data = {
            "email": "newuser@test.ng",
            "password": "securepassword123",
            "date_of_birth": "1990-01-01",
            "business_name": "New SME Ltd",
            "phone": "+234 801 234 5678",
            "cluster": "Isolo",
            "sells": True,
            "buys": True,
            "carbon_impact": True,
            "research_consent": True,
        }
        response = self.client.post("/api/auth/signup/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])

        new_user = User.objects.get(email="newuser@test.ng")
        self.assertEqual(new_user.profile.business_name, "New SME Ltd")
        self.assertTrue(new_user.profile.verified)
        self.assertEqual(str(new_user.profile.date_of_birth), "1990-01-01")

    def test_signup_requires_adult_date_of_birth(self):
        payload = {
            "email": "younguser@test.ng",
            "password": "securepassword123",
            "date_of_birth": (timezone.localdate() - timedelta(days=365 * 17)).isoformat(),
        }
        response = self.client.post("/api/auth/signup/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_of_birth", response.data)

    def test_login_endpoint(self):
        """Test login with valid credentials."""
        response = self.client.post("/api/auth/login/", {
            "email": "seller@test.ng",
            "password": "testpassword123"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", response.data)

    def test_jwt_access_lifetime_is_one_hour_and_login_is_throttled(self):
        self.assertEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=60))
        cache.clear()
        for attempt in range(5):
            response = self.client.post(
                "/api/auth/login/",
                {"email": f"missing{attempt}@test.ng", "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.client.post(
            "/api/auth/login/",
            {"email": "last-attempt@test.ng", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_listing_creation_and_classification(self):
        """Test creating a listing auto-creates a Classification and marks it Live."""
        self.client.force_authenticate(user=self.seller)
        data = {
            "title": "Copper cable scrap",
            "material": "Metal",
            "weight_kg": "75.00",
            "price_ngn": "60000.00",
            "zone": "Ogba Industrial Estate",
            "predicted_material": "Metal",
            "confidence": "0.96",
            "overridden": False,
        }
        response = self.client.post("/api/listings/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        listing = Listing.objects.get(id=response.data["id"])
        self.assertEqual(listing.status, ListingStatus.LIVE)
        self.assertEqual(listing.classification.final_material, "Metal")
        self.assertEqual(listing.classification.confidence, Decimal("0.96"))

    def test_draft_listings_are_private_until_owner_publishes(self):
        self.client.force_authenticate(user=self.seller)
        response = self.client.post(
            "/api/listings/",
            {
                "title": "Private saved draft",
                "material": "Metal",
                "weight_kg": "5.00",
                "is_draft": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing_id = response.data["id"]
        self.assertEqual(response.data["status"], ListingStatus.DRAFT)

        self.client.force_authenticate(user=self.buyer)
        self.assertEqual(self.client.get(f"/api/listings/{listing_id}/").status_code, 404)
        self.assertNotIn(
            listing_id,
            [row["id"] for row in self.client.get("/api/listings/").data["results"]],
        )

        self.client.force_authenticate(user=self.seller)
        response = self.client.post(f"/api/listings/{listing_id}/publish/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ListingStatus.LIVE)
    def test_listing_location_requires_resolved_coordinates(self):
        self.client.force_authenticate(user=self.seller)
        payload = {
            "title": "Resolved-location scrap",
            "material": "Metal",
            "weight_kg": "25.00",
            "zone": "Ogba",
            "address": "12 Acme Road, Lagos, Nigeria",
            "predicted_material": "Metal",
            "lat": 6.61,
            "lng": 3.35,
        }

        response = self.client.post("/api/listings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(id=response.data["id"])
        self.assertEqual(listing.address, payload["address"])
        self.assertEqual(listing.lat, payload["lat"])
        self.assertEqual(listing.lng, payload["lng"])

        self.client.force_authenticate(user=self.buyer)
        search_response = self.client.get(
            "/api/listings/?lat=6.61&lng=3.35&radius=1"
        )
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(search_response.data["results"]), 1)
        self.assertAlmostEqual(search_response.data["results"][0]["distance"], 0, places=1)

        self.client.force_authenticate(user=self.seller)
        payload.pop("lat")
        payload.pop("lng")
        response = self.client.post("/api/listings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        fallback_listing = Listing.objects.get(id=response.data["id"])
        self.assertIsNotNone(fallback_listing.lat)
        self.assertIsNotNone(fallback_listing.lng)

    def test_profile_location_updates_require_coordinate_pair(self):
        self.client.force_authenticate(user=self.seller)
        response = self.client.patch(
            "/api/auth/me/",
            {"address": "12 Acme Road, Lagos, Nigeria", "lat": 6.61, "lng": 3.35},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller.profile.refresh_from_db()
        self.assertEqual(self.seller.profile.address, "12 Acme Road, Lagos, Nigeria")
        self.assertEqual(self.seller.profile.lat, 6.61)
        self.assertEqual(self.seller.profile.lng, 3.35)

        response = self.client.patch(
            "/api/auth/me/",
            {"lat": 6.62},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_listing_address_uses_zone_coordinates_without_geocoding(self):
        self.client.force_authenticate(user=self.seller)
        response = self.client.post(
            "/api/listings/",
            {
                "title": "Fallback location listing",
                "material": "Metal",
                "weight_kg": "5.00",
                "zone": "Ogba",
                "address": "Bafaj Crescent",
                "predicted_material": "Metal",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(pk=response.data["id"])
        self.assertIsNotNone(listing.lat)
        self.assertIsNotNone(listing.lng)

    def test_transaction_standard_writes_are_disabled_for_buyer_and_seller(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Read-only deal",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.INTEREST,
        )
        url = f"/api/transactions/{txn.pk}/"
        payload = {
            "status": TransactionStatus.COMPLETED,
            "payment_ref": "FAKE",
            "paid_at": timezone.now().isoformat(),
            "completed_at": timezone.now().isoformat(),
        }
        for user in (self.buyer, self.seller):
            self.client.force_authenticate(user=user)
            for method in ("patch", "put", "delete", "post"):
                with self.subTest(user=user, method=method):
                    response = getattr(self.client, method)(
                        url,
                        payload if method != "delete" else {},
                        format="json",
                    )
                    self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
                    txn.refresh_from_db()
                    self.assertEqual(txn.status, TransactionStatus.INTEREST)
                    self.assertIsNone(txn.payment_ref)
                    listing.refresh_from_db()
                    self.assertEqual(listing.status, ListingStatus.LIVE)

    def test_manual_completion_requires_payment_and_succeeds_after_payment(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Payment-gated deal",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            amount_ngn=Decimal("25000.00"),
            payment_ref="manual-completion-payment",
        )
        payload = {"listing_id": str(listing.pk), "buyer_id": str(self.buyer.pk)}
        self.client.force_authenticate(user=self.seller)
        response = self.client.post("/api/transactions/mark_completed/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        txn.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.RESERVED)
        self.assertEqual(listing.status, ListingStatus.RESERVED)

        txn.paid_at = timezone.now()
        txn.save(update_fields=["paid_at", "updated_at"])
        response = self.client.post("/api/transactions/mark_completed/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        listing.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.COMPLETED)
        self.assertEqual(listing.status, ListingStatus.SOLD)

    @override_settings(PAYMENT_HOLD_MINUTES=30)
    def test_expired_payment_hold_is_released_during_listing_and_transaction_reads(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Expired hold",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="old-reference",
            amount_ngn=Decimal("25000.00"),
        )
        old_time = timezone.now()
        Transaction.objects.filter(pk=txn.pk).update(updated_at=old_time)

        self.client.force_authenticate(user=self.buyer)
        with patch("api.views.timezone.now", return_value=old_time + timedelta(minutes=31)):
            response = self.client.get("/api/listings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        listing.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.INTEREST)
        self.assertIsNone(txn.payment_ref)
        self.assertEqual(listing.status, ListingStatus.LIVE)

        Transaction.objects.filter(pk=txn.pk).update(
            status=TransactionStatus.RESERVED,
            payment_ref="second-stale-reference",
            updated_at=old_time,
        )
        Listing.objects.filter(pk=listing.pk).update(status=ListingStatus.RESERVED)
        with patch("api.views.timezone.now", return_value=old_time + timedelta(minutes=31)):
            self.client.get("/api/transactions/")
        txn.refresh_from_db()
        listing.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.INTEREST)
        self.assertIsNone(txn.payment_ref)
        self.assertEqual(listing.status, ListingStatus.LIVE)

    @override_settings(PAYMENT_HOLD_MINUTES=30)
    def test_expired_payment_hold_is_released_before_new_initialization(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Reopen after checkout",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        old_buyer = User.objects.create_user(
            username="oldbuyer@test.ng",
            email="oldbuyer@test.ng",
            password="testpassword123",
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=old_buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="old-reference",
            amount_ngn=Decimal("25000.00"),
        )
        old_time = timezone.now()
        Transaction.objects.filter(pk=txn.pk).update(updated_at=old_time)

        self.client.force_authenticate(user=self.buyer)
        with patch("api.views.timezone.now", return_value=old_time + timedelta(minutes=31)):
            response = self.client.post(
                "/api/pay/initialize/",
                {"listingId": str(listing.pk)},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.INTEREST)
        self.assertNotEqual(txn.payment_ref, response.data["reference"])

    @override_settings(PAYMENT_HOLD_MINUTES=30)
    def test_expired_payment_hold_is_released_before_mark_agreed(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Reopen for manual agreement",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        old_buyer = User.objects.create_user(
            username="manualoldbuyer@test.ng",
            email="manualoldbuyer@test.ng",
            password="testpassword123",
        )
        old_txn = Transaction.objects.create(
            listing=listing,
            buyer=old_buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="manual-old-reference",
            amount_ngn=Decimal("25000.00"),
        )
        old_time = timezone.now()
        Transaction.objects.filter(pk=old_txn.pk).update(updated_at=old_time)

        self.client.force_authenticate(user=self.seller)
        with patch("api.views.timezone.now", return_value=old_time + timedelta(minutes=31)):
            response = self.client.post(
                "/api/transactions/mark_agreed/",
                {"listing_id": str(listing.pk), "buyer_id": str(self.buyer.pk)},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        old_txn.refresh_from_db()
        self.assertEqual(old_txn.status, TransactionStatus.INTEREST)
        self.assertEqual(
            Transaction.objects.get(listing=listing, buyer=self.buyer).status,
            TransactionStatus.RESERVED,
        )

    def test_listing_owner_cannot_edit_or_delete_reserved_or_sold_listing(self):
        for listing_status in (ListingStatus.RESERVED, ListingStatus.SOLD):
            listing = Listing.objects.create(
                seller=self.seller,
                title=f"{listing_status} listing",
                material=MaterialCategory.METAL,
                weight_kg=Decimal("10.00"),
                price_ngn=Decimal("25000.00"),
                status=listing_status,
            )
            self.client.force_authenticate(user=self.seller)
            url = f"/api/listings/{listing.pk}/"
            for method in ("patch", "put", "delete"):
                response = getattr(self.client, method)(
                    url,
                    {"weight_kg": "99.00", "price_ngn": "1.00", "material": "Glass"},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            listing.refresh_from_db()
            self.assertEqual(listing.weight_kg, Decimal("10.00"))
            self.assertEqual(listing.price_ngn, Decimal("25000.00"))
            self.assertEqual(listing.material, MaterialCategory.METAL)

    def test_user_cannot_access_another_users_private_listing_or_message(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Private seller draft",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            status=ListingStatus.DRAFT,
        )
        message = Message.objects.create(
            listing=listing,
            sender=self.seller,
            recipient=self.buyer,
            body="Private message",
        )
        outsider = User.objects.create_user(
            username="outsider@test.ng",
            email="outsider@test.ng",
            password="testpassword123",
        )
        self.client.force_authenticate(user=outsider)
        self.assertEqual(self.client.get(f"/api/listings/{listing.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/listings/{listing.pk}/", {"title": "x"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/listings/{listing.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/messages/{message.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/messages/{message.pk}/", {"body": "edited"}).status_code, 405)
        self.assertEqual(self.client.delete(f"/api/messages/{message.pk}/").status_code, 405)
        self.assertEqual(self.client.get("/api/transactions/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/transactions/").data["results"], [])

    def test_auth_me_only_exposes_and_updates_authenticated_users_profile(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.buyer.id)
        response = self.client.patch(
            "/api/auth/me/",
            {"business_name": "Changed buyer name"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller.profile.refresh_from_db()
        self.buyer.profile.refresh_from_db()
        self.assertEqual(self.seller.profile.business_name, "Apex Metalworks Ltd")
        self.assertEqual(self.buyer.profile.business_name, "Changed buyer name")

    def test_message_participants_cannot_mutate_sent_messages(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Message lock",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            status=ListingStatus.LIVE,
        )
        message = Message.objects.create(
            listing=listing,
            sender=self.buyer,
            recipient=self.seller,
            body="Original body",
        )
        for user in (self.buyer, self.seller):
            self.client.force_authenticate(user=user)
            url = f"/api/messages/{message.pk}/"
            for method in ("patch", "put", "delete"):
                response = getattr(self.client, method)(
                    url,
                    {"body": "changed"},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        message.refresh_from_db()
        self.assertEqual(message.body, "Original body")

    def test_open_dispute_can_only_be_raised_by_buyer_on_paid_transaction(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Dispute test",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("5.00"),
            price_ngn=Decimal("1000.00"),
            status=ListingStatus.SOLD,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.COMPLETED,
            payment_ref="dispute-payment",
            paid_at=timezone.now(),
            completed_at=timezone.now(),
            amount_ngn=Decimal("1000.00"),
        )
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post(
            "/api/disputes/",
            {"transaction_id": str(txn.pk), "reason": "Material not as described"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], DisputeStatus.OPEN)
        self.client.force_authenticate(user=self.seller)
        response = self.client.post(
            "/api/disputes/",
            {"transaction_id": str(txn.pk), "reason": "Seller cannot raise"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Dispute.objects.count(), 1)

    def test_dispute_blocks_manual_status_changes(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Disputed listing",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("5.00"),
            price_ngn=Decimal("1000.00"),
            status=ListingStatus.RESERVED,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="dispute-block-reference",
            paid_at=timezone.now(),
            amount_ngn=Decimal("1000.00"),
        )
        Dispute.objects.create(
            transaction=txn,
            raised_by=self.buyer,
            reason="Open dispute",
        )
        self.client.force_authenticate(user=self.seller)
        response = self.client.post(
            "/api/transactions/mark_agreed/",
            {"listing_id": str(listing.pk), "buyer_id": str(self.buyer.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        response = self.client.post(
            "/api/transactions/mark_completed/",
            {"listing_id": str(listing.pk), "buyer_id": str(self.buyer.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        reference = txn.payment_ref
        paid_at = txn.paid_at
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post(
            "/api/pay/initialize/",
            {"listingId": str(listing.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        txn.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.RESERVED)
        self.assertEqual(txn.payment_ref, reference)
        self.assertEqual(txn.paid_at, paid_at)

    def test_health_endpoint_does_not_require_authentication(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok"})

    def test_password_reset_request_and_confirmation(self):
        with patch("api.views.send_mail") as send_mail:
            response = self.client.post(
                "/api/auth/password-reset/",
                {"email": self.buyer.email},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        send_mail.assert_called_once()

        uid = urlsafe_base64_encode(str(self.buyer.pk).encode())
        token = default_token_generator.make_token(self.buyer)
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "password": "new-strong-password-123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.buyer.refresh_from_db()
        self.assertTrue(self.buyer.check_password("new-strong-password-123"))

    def test_classification_endpoint_returns_provider_fallback(self):
        fallback = {
            "material": "Biodegradable",
            "confidencePct": 45,
            "lowConfidence": True,
            "modelId": "manual-fallback",
        }
        remote_image = Mock(ok=True, content=b"image")
        with patch("api.views.requests.get", return_value=remote_image):
            with patch("api.views.classify_image_bytes", return_value=fallback):
                response = self.client.post(
                    "/api/classify/",
                    {"imageUrl": "https://media.example.test/photo.jpg"},
                    format="json",
                )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, fallback)

    def test_media_upload_rejects_oversized_unsupported_and_fake_images(self):
        self.client.force_authenticate(user=self.seller)
        oversized = SimpleUploadedFile("large.jpg", b"x" * (8 * 1024 * 1024 + 1), "image/jpeg")
        response = self.client.post(
            "/api/media/upload/",
            {"category": "listing-photo", "file": oversized},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        unsupported = SimpleUploadedFile("payload.exe", b"x", "application/octet-stream")
        response = self.client.post(
            "/api/media/upload/",
            {"category": "listing-photo", "file": unsupported},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        fake_image = SimpleUploadedFile("fake.png", b"not an image", "image/png")
        response = self.client.post(
            "/api/media/upload/",
            {"category": "listing-photo", "file": fake_image},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_seed_demo_command_is_idempotent_and_requires_explicit_password(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data")
        call_command("seed_demo_data", password="demo-password-test")
        user_count = User.objects.count()
        listing_count = Listing.objects.count()
        seller = User.objects.get(username="seller@ecoloop.ng")
        old_password_hash = seller.password

        call_command("seed_demo_data", password="ignored-on-existing-users")
        self.assertEqual(User.objects.count(), user_count)
        self.assertEqual(Listing.objects.count(), listing_count)
        seller.refresh_from_db()
        self.assertEqual(seller.password, old_password_hash)
        self.assertEqual(User.objects.filter(username__in=[
            "seller@ecoloop.ng", "buyer@ecoloop.ng"
        ]).count(), 2)

    def test_cloudinary_upload_command_checks_https_urls(self):
        with TemporaryDirectory() as temp_dir:
            image = Path(temp_dir) / "sample.jpg"
            pdf = Path(temp_dir) / "sample.pdf"
            image.write_bytes(b"sample image")
            pdf.write_bytes(b"sample pdf")
            storages_mock = MagicMock()
            image_storage = Mock()
            pdf_storage = Mock()
            image_storage.save.return_value = "image.jpg"
            image_storage.url.return_value = "https://res.cloudinary.com/demo/image.jpg"
            pdf_storage.save.return_value = "manual.pdf"
            pdf_storage.url.return_value = "https://res.cloudinary.com/demo/manual.pdf"
            storages_mock.__getitem__.side_effect = [image_storage, pdf_storage]
            with patch("api.management.commands.test_cloudinary_upload.storages", storages_mock):
                with patch(
                    "api.management.commands.test_cloudinary_upload.requests.get",
                    return_value=Mock(ok=True, status_code=200),
                ) as get:
                    call_command(
                        "test_cloudinary_upload",
                        image=str(image),
                        pdf=str(pdf),
                    )
            self.assertEqual(get.call_count, 2)

    def test_database_check_constraints_reject_invalid_values(self):
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            Listing.objects.create(
                seller=self.seller,
                title="Zero weight",
                material=MaterialCategory.METAL,
                weight_kg=Decimal("0"),
            )
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            Listing.objects.create(
                seller=self.seller,
                title="Negative price",
                material=MaterialCategory.METAL,
                weight_kg=Decimal("1"),
                price_ngn=Decimal("-1"),
            )

        listing = Listing.objects.create(
            seller=self.seller,
            title="Constraint base",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("1"),
        )
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            Classification.objects.create(
                listing=listing,
                predicted_material=MaterialCategory.METAL,
                confidence=Decimal("1.1"),
                final_material=MaterialCategory.METAL,
            )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.INTEREST,
        )
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            Transaction.objects.filter(pk=txn.pk).update(
                status=TransactionStatus.COMPLETED,
            )

    def test_partial_unique_constraint_allows_only_one_active_listing_deal(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Unique active deal",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("1"),
        )
        Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
        )
        second_buyer = User.objects.create_user(
            username="secondbuyer@test.ng",
            email="secondbuyer@test.ng",
            password="testpassword123",
        )
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            Transaction.objects.create(
                listing=listing,
                buyer=second_buyer,
                seller=self.seller,
                status=TransactionStatus.RESERVED,
            )

    def test_paystack_initialization_persists_reference_and_reserves_listing(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Payment test material",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        self.client.force_authenticate(user=self.buyer)

        response = self.client.post(
            "/api/pay/initialize/",
            {"listingId": str(listing.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        transaction = Transaction.objects.get(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
        )
        self.assertEqual(transaction.status, TransactionStatus.RESERVED)
        self.assertEqual(transaction.payment_ref, response.data["reference"])
        self.assertEqual(response.data["amountKobo"], 2_500_000)
        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.RESERVED)

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_payment")
    def test_paystack_verification_completes_only_initialized_payment_once(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Payment test material",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        self.client.force_authenticate(user=self.buyer)
        initialized = self.client.post(
            "/api/pay/initialize/",
            {"listingId": str(listing.id)},
            format="json",
        )
        reference = initialized.data["reference"]
        Listing.objects.filter(pk=listing.pk).update(price_ngn=Decimal("30000.00"))
        paystack_response = Mock(ok=True)
        paystack_response.json.return_value = {
            "status": True,
            "data": {
                "status": "success",
                "amount": 2_500_000,
                "currency": "NGN",
                "reference": reference,
            },
        }

        with patch("api.paystack.requests.get", return_value=paystack_response) as verify:
            response = self.client.post(
                "/api/pay/verify/",
                {"listingId": str(listing.id), "reference": reference},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        transaction = Transaction.objects.get(payment_ref=reference)
        self.assertEqual(transaction.status, TransactionStatus.COMPLETED)
        self.assertEqual(transaction.amount_ngn, Decimal("25000.00"))
        self.assertEqual(transaction.currency, "NGN")
        self.assertIsNotNone(transaction.paid_at)
        self.assertTrue(CarbonRecord.objects.filter(transaction=transaction).exists())
        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.SOLD)

        replay = self.client.post(
            "/api/pay/verify/",
            {"listingId": str(listing.id), "reference": reference},
            format="json",
        )
        self.assertEqual(replay.status_code, status.HTTP_409_CONFLICT)
        verify.assert_called_once()

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_payment")
    def test_paystack_verification_rejects_uninitialized_reference(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Payment test material",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
        )
        self.client.force_authenticate(user=self.buyer)
        with patch("api.paystack.requests.get") as verify:
            response = self.client.post(
                "/api/pay/verify/",
                {
                    "listingId": str(listing.id),
                    "reference": "ECO-UNISSUED-REFERENCE",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        verify.assert_not_called()

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_payment")
    def test_paystack_verification_requires_exact_ngn_amount_and_matching_reference(self):
        cases = [
            (2_499_999, "NGN", "ECO-TEST", AmountMismatchError),
            (2_500_001, "NGN", "ECO-TEST", AmountMismatchError),
            (2_500_000, "USD", "ECO-TEST", PaymentVerificationError),
            (2_500_000, "NGN", "ECO-OTHER", PaymentVerificationError),
        ]
        for amount, currency, returned_reference, error_type in cases:
            with self.subTest(amount=amount, currency=currency, reference=returned_reference):
                paystack_response = Mock(ok=True)
                paystack_response.json.return_value = {
                    "status": True,
                    "data": {
                        "status": "success",
                        "amount": amount,
                        "currency": currency,
                        "reference": returned_reference,
                    },
                }
                with patch("api.paystack.requests.get", return_value=paystack_response):
                    with self.assertRaises(error_type):
                        verify_paystack_transaction(
                            "ECO-TEST",
                            Decimal("25000.00"),
                        )

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_webhook")
    def test_paystack_webhook_valid_signature_fulfils_transaction_once(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Webhook payment",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.RESERVED,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="ECO-WEBHOOK-VALID",
            amount_ngn=Decimal("25000.00"),
            currency="NGN",
        )
        event = {
            "event": "charge.success",
            "data": {"reference": txn.payment_ref},
        }
        with patch("api.views.verify_paystack_transaction") as verify:
            response = self.post_paystack_webhook(event, "sk_test_webhook")

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data, {"received": True, "listingId": str(listing.pk)})
            txn.refresh_from_db()
            listing.refresh_from_db()
            self.assertEqual(txn.status, TransactionStatus.COMPLETED)
            self.assertIsNotNone(txn.paid_at)
            self.assertIsNotNone(txn.completed_at)
            self.assertEqual(listing.status, ListingStatus.SOLD)
            self.assertTrue(CarbonRecord.objects.filter(transaction=txn).exists())
            completed_at = txn.completed_at
            paid_at = txn.paid_at

            replay = self.post_paystack_webhook(event, "sk_test_webhook")

        self.assertEqual(replay.status_code, status.HTTP_200_OK)
        self.assertEqual(replay.data, {"received": True, "already_processed": True})
        txn.refresh_from_db()
        self.assertEqual(txn.completed_at, completed_at)
        self.assertEqual(txn.paid_at, paid_at)
        self.assertEqual(CarbonRecord.objects.filter(transaction=txn).count(), 1)
        verify.assert_called_once_with(txn.payment_ref, Decimal("25000.00"))

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_webhook")
    def test_paystack_webhook_rejects_invalid_signature_without_fulfilling(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Webhook invalid signature",
            material=MaterialCategory.METAL,
            weight_kg=Decimal("10.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.RESERVED,
        )
        txn = Transaction.objects.create(
            listing=listing,
            buyer=self.buyer,
            seller=self.seller,
            status=TransactionStatus.RESERVED,
            payment_ref="ECO-WEBHOOK-INVALID",
            amount_ngn=Decimal("25000.00"),
            currency="NGN",
        )
        event = {
            "event": "charge.success",
            "data": {"reference": txn.payment_ref},
        }
        with patch("api.views.verify_paystack_transaction") as verify:
            response = self.post_paystack_webhook(
                event,
                "sk_test_webhook",
                signature="invalid-signature",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        txn.refresh_from_db()
        listing.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatus.RESERVED)
        self.assertIsNone(txn.paid_at)
        self.assertEqual(listing.status, ListingStatus.RESERVED)
        self.assertFalse(CarbonRecord.objects.filter(transaction=txn).exists())
        verify.assert_not_called()

    def test_haversine_distance_calculation(self):
        """Test accurate Haversine distance between Ogba and Ikeja clusters."""
        # Ogba: (6.6325, 3.337), Ikeja: (6.6018, 3.3515)
        dist = haversine_km(6.6325, 3.337, 6.6018, 3.3515)
        self.assertAlmostEqual(dist, 3.8, delta=0.5)

    def test_deal_reservation_and_completion_trigger(self):
        """Test reserving deal and completing exchange auto-updates listing and creates carbon record."""
        listing = Listing.objects.create(
            seller=self.seller,
            title="HDPE drums",
            material=MaterialCategory.PLASTIC,
            weight_kg=Decimal("100.00"),
            price_ngn=Decimal("25000.00"),
            status=ListingStatus.LIVE,
            zone="Ogba"
        )

        self.client.force_authenticate(user=self.seller)
        # 1. Mark as agreed
        res = self.client.post("/api/transactions/mark_agreed/", {
            "listing_id": str(listing.id),
            "buyer_id": str(self.buyer.id)
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.RESERVED)

        # A manual reservation cannot be completed without a confirmed payment.
        res_comp = self.client.post("/api/transactions/mark_completed/", {
            "listing_id": str(listing.id),
            "buyer_id": str(self.buyer.id)
        }, format="json")
        self.assertEqual(res_comp.status_code, status.HTTP_400_BAD_REQUEST)

        txn = Transaction.objects.get(listing=listing, buyer=self.buyer)
        txn.payment_ref = "manual-completion-confirmed"
        txn.amount_ngn = listing.price_ngn
        txn.paid_at = timezone.now()
        txn.save(update_fields=["payment_ref", "amount_ngn", "paid_at", "updated_at"])
        res_comp = self.client.post("/api/transactions/mark_completed/", {
            "listing_id": str(listing.id),
            "buyer_id": str(self.buyer.id)
        }, format="json")
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.SOLD)

        # Carbon record should be automatically created: Plastic factor = 1.9 -> 190 kg CO2e
        txn = Transaction.objects.get(listing=listing)
        self.assertTrue(hasattr(txn, "carbon_record"))
        self.assertEqual(txn.carbon_record.co2e_kg, Decimal("190"))

    def test_message_auto_opens_interest_transaction(self):
        """Test that sending first message automatically opens an Interest transaction."""
        listing = Listing.objects.create(
            seller=self.seller,
            title="Pallet scrap",
            material=MaterialCategory.BIODEGRADABLE,
            weight_kg=Decimal("200.00"),
            price_ngn=Decimal("15000.00"),
            status=ListingStatus.LIVE,
        )

        self.client.force_authenticate(user=self.buyer)
        res = self.client.post("/api/messages/", {
            "listing": str(listing.id),
            "recipient": str(self.seller.id),
            "body": "Is this still available?"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        txn = Transaction.objects.filter(listing=listing, buyer=self.buyer).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.status, TransactionStatus.INTEREST)
