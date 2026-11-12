from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import Mock, patch
from api.models import (
    Listing,
    Classification,
    Transaction,
    CarbonRecord,
    Message,
    MaterialCategory,
    ListingStatus,
    TransactionStatus,
)
from api.utils import haversine_km, calculate_co2_kg, is_pilot_verified
from api.paystack import AmountMismatchError, PaymentVerificationError, verify_paystack_transaction

User = get_user_model()

class EcoLoopAPITestCase(TestCase):
    def setUp(self):
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

    def test_login_endpoint(self):
        """Test login with valid credentials."""
        response = self.client.post("/api/auth/login/", {
            "email": "seller@test.ng",
            "password": "testpassword123"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", response.data)

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
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("address", response.data)

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

        # 2. Mark completed
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
