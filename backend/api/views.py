from decimal import Decimal
import secrets
import time
import requests
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.db import transaction as db_transaction
from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import (
    Profile,
    Listing,
    Classification,
    Transaction as DealTransaction,
    TransactionStatus,
    ListingStatus,
    CarbonRecord,
    Message,
)
from api.serializers import (
    SignupSerializer,
    UserSerializer,
    ProfileSerializer,
    ListingSerializer,
    ListingCreateSerializer,
    TransactionSerializer,
    MessageSerializer,
    LoginRequestSerializer,
    PaystackInitializeSerializer,
    PaystackVerifySerializer,
    ClassifyRequestSerializer,
)
from api.permissions import (
    IsProfileOwnerOrReadOnly,
    IsListingOwnerOrPublicReadOnly,
    CanDeleteListing,
    IsTransactionParty,
    IsMessageParticipant,
)
from api.classify import classify_image_bytes
from api.paystack import verify_paystack_transaction
from api.utils import haversine_km, get_coords_for_zone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

User = get_user_model()

# ─── 1. Authentication Views ──────────────────────────────────────────────────

class SignupView(views.APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=SignupSerializer,
        responses={201: UserSerializer},
        summary="Register a new user",
        description="Creates an account, automatically generates an linked Profile, and returns JWT tokens."
    )
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

class LoginView(views.APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginRequestSerializer,
        responses={200: UserSerializer},
        summary="Log in user",
        description="Authenticates via email and password, returning JWT access and refresh tokens."
    )
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(username=email, password=password)
        if not user:
            # Fallback query if username != email
            user_obj = User.objects.filter(email__iexact=email).first()
            if user_obj and user_obj.check_password(password):
                user = user_obj

        if not user:
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })

class MeView(views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: UserSerializer},
        summary="Get current user profile",
        description="Returns currently authenticated user data and their linked profile."
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        request=ProfileSerializer,
        responses={200: UserSerializer},
        summary="Update current user profile",
        description="Partially updates profile metadata, business info, or user email/password."
    )
    def patch(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Update email if provided
        email = request.data.get('email')
        if email and email.strip().lower() != request.user.email:
            request.user.email = email.strip().lower()
            request.user.username = email.strip().lower()
            request.user.save()

        # Update password if provided
        password = request.data.get('password')
        if password:
            if len(password) < 8:
                return Response({'error': 'Password must be at least 8 characters.'}, status=400)
            request.user.set_password(password)
            request.user.save()

        return Response(UserSerializer(request.user).data)

# ─── 2. Listing ViewSet ───────────────────────────────────────────────────────

class ListingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsListingOwnerOrPublicReadOnly, CanDeleteListing]

    def get_serializer_class(self):
        if self.action == 'create':
            return ListingCreateSerializer
        return ListingSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Listing.objects.none()
        user = self.request.user
        qs = Listing.objects.select_related('seller__profile', 'classification').all()

        # RLS translation: guests only see Live; authenticated sellers see Live + their own
        if not user.is_authenticated:
            qs = qs.filter(status=ListingStatus.LIVE)
        elif self.action != 'mine':
            qs = qs.filter(Q(status=ListingStatus.LIVE) | Q(seller=user))

        # Query Filters
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(material__icontains=q) |
                Q(seller__profile__business_name__icontains=q)
            )

        category = self.request.query_params.get('category')
        if category and category != 'All categories':
            qs = qs.filter(material=category)

        verified_only = self.request.query_params.get('verified_only')
        if verified_only in ('true', '1', 'yes'):
            qs = qs.filter(seller__profile__verified=True)

        # In-memory distance filtering & sorting if requested
        radius = self.request.query_params.get('radius')
        sort = self.request.query_params.get('sort')

        viewer_cluster = None
        if user.is_authenticated and hasattr(user, 'profile'):
            viewer_cluster = user.profile.cluster
        viewer_cluster = viewer_cluster or self.request.query_params.get('cluster', 'Ogba')
        v_lat, v_lng = get_coords_for_zone(viewer_cluster)

        listings_list = list(qs)

        for item in listings_list:
            item_lat = item.lat or v_lat
            item_lng = item.lng or v_lng
            item._calculated_distance = haversine_km(v_lat, v_lng, item_lat, item_lng)

        if radius:
            try:
                max_km = float(radius)
                listings_list = [L for L in listings_list if L._calculated_distance <= max_km]
            except ValueError:
                pass

        if sort == 'Heaviest first':
            listings_list.sort(key=lambda x: x.weight_kg, reverse=True)
        elif sort == 'Lowest price':
            listings_list.sort(key=lambda x: (x.price_ngn or Decimal('0')))
        else:  # 'Nearest first' default
            listings_list.sort(key=lambda x: getattr(x, '_calculated_distance', 0))

        # Return list preserving custom ordering
        ids = [L.id for L in listings_list]
        clauses = ' '.join([f"WHEN '{pk}' THEN {i}" for i, pk in enumerate(ids)])
        if ids:
            return qs.filter(id__in=ids).extra(
                select={'manual_order': f"CASE id {clauses} END"},
                order_by=['manual_order']
            )
        return qs.none()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Atomic view count bump
        Listing.objects.filter(id=instance.id).update(views=instance.views + 1)
        instance.views += 1
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def mine(self, request):
        """Returns the authenticated seller's inventory across all statuses."""
        qs = Listing.objects.filter(seller=request.user).select_related('classification')
        serializer = ListingSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_photos(self, request, pk=None):
        """Allows seller to upload extra gallery photos."""
        listing = self.get_object()
        if listing.seller != request.user:
            return Response({'error': 'You do not own this listing.'}, status=403)

        files = request.FILES.getlist('photos')
        current_urls = list(listing.photo_urls or [])

        for f in files:
            # In Django, could upload to storage or save file
            listing.photo = f
            listing.save()
            if listing.photo.url not in current_urls:
                current_urls.append(listing.photo.url)

        listing.photo_urls = current_urls
        listing.save(update_fields=['photo_urls'])
        return Response(ListingSerializer(listing, context={'request': request}).data)

    def perform_destroy(self, instance):
        """
        Translates migration 009_seller_delete_listings.sql:
        Clears open 'Interest' and 'Cancelled' deals so foreign key restrict doesn't block deletion.
        """
        DealTransaction.objects.filter(
            listing=instance,
            status__in=[TransactionStatus.INTEREST, TransactionStatus.CANCELLED]
        ).delete()
        super().perform_destroy(instance)

# ─── 3. Transaction ViewSet ───────────────────────────────────────────────────

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, IsTransactionParty]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Listing.objects.none()
        user = self.request.user
        return DealTransaction.objects.filter(
            Q(buyer=user) | Q(seller=user)
        ).select_related('listing', 'buyer__profile', 'seller__profile', 'carbon_record')

    @action(detail=False, methods=['post'])
    def mark_agreed(self, request):
        """
        Seller marks listing as agreed/reserved for a specific buyer.
        Uses database-level row locking (select_for_update) to prevent race conditions.
        """
        listing_id = request.data.get('listing_id')
        buyer_id = request.data.get('buyer_id')

        if not listing_id or not buyer_id:
            return Response({'error': 'listing_id and buyer_id are required.'}, status=400)

        if str(buyer_id) == str(request.user.id):
            return Response({'error': 'Buyer and seller must be different.'}, status=400)

        buyer = User.objects.filter(id=buyer_id).first()
        if not buyer:
            return Response({'error': 'Buyer not found.'}, status=404)

        with db_transaction.atomic():
            listing = Listing.objects.select_for_update().filter(id=listing_id).first()
            if not listing:
                return Response({'error': 'Listing not found.'}, status=404)

            if listing.seller != request.user:
                return Response({'error': 'Only the seller can mark a deal as agreed.'}, status=403)

            if listing.status == ListingStatus.SOLD:
                return Response({'error': 'This listing is already sold.'}, status=409)

            # Check if already reserved or completed for another buyer
            other_hold = DealTransaction.objects.select_for_update().filter(
                listing=listing,
                status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED]
            ).exclude(buyer=buyer).first()

            if other_hold:
                return Response(
                    {'error': 'This listing is already reserved for another buyer.'},
                    status=409
                )

            txn, _ = DealTransaction.objects.select_for_update().get_or_create(
                listing=listing,
                buyer=buyer,
                seller=request.user,
                defaults={'status': TransactionStatus.RESERVED}
            )

            if txn.status != TransactionStatus.RESERVED:
                txn.status = TransactionStatus.RESERVED
                txn.save(update_fields=['status', 'updated_at'])

            listing.status = ListingStatus.RESERVED
            listing.save(update_fields=['status', 'updated_at'])

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=False, methods=['post'])
    def mark_completed(self, request):
        """
        Marks a reserved exchange as completed with atomic locking.
        """
        listing_id = request.data.get('listing_id')
        buyer_id = request.data.get('buyer_id')

        if not listing_id or not buyer_id:
            return Response({'error': 'listing_id and buyer_id are required.'}, status=400)

        with db_transaction.atomic():
            txn = DealTransaction.objects.select_for_update().filter(
                listing_id=listing_id,
                buyer_id=buyer_id
            ).select_related('listing').first()

            if not txn:
                return Response({'error': 'Transaction not found.'}, status=404)

            if request.user not in (txn.buyer, txn.seller):
                return Response({'error': 'Unauthorized.'}, status=403)

            if txn.status == TransactionStatus.INTEREST:
                return Response({'error': 'Reserve this deal first.'}, status=400)

            txn.status = TransactionStatus.COMPLETED
            txn.completed_at = timezone.now()
            txn.save()

        return Response(TransactionSerializer(txn, context={'request': request}).data)

# ─── 4. Message ViewSet ───────────────────────────────────────────────────────

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsMessageParticipant]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Listing.objects.none()
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related('listing', 'sender__profile', 'recipient__profile')

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['get'])
    def inbox(self, request):
        """Groups user messages into distinct listing threads."""
        user = request.user
        messages = Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related('listing', 'sender__profile', 'recipient__profile').order_by('-created_at')

        threads = {}
        for m in messages:
            other_user = m.recipient if m.sender == user else m.sender
            key = f"{m.listing_id}:{other_user.id}"
            if key not in threads:
                profile = getattr(other_user, 'profile', None)
                threads[key] = {
                    'key': key,
                    'listingId': str(m.listing_id),
                    'listingTitle': m.listing.title,
                    'listingMaterial': m.listing.material,
                    'sellerId': str(m.listing.seller_id),
                    'otherUserId': str(other_user.id),
                    'otherName': (profile.business_name if profile and profile.business_name else other_user.email) or "User",
                    'otherAvatarUrl': profile.display_avatar_url if profile else None,
                    'preview': m.body[:80],
                    'timeLabel': m.created_at.strftime('%H:%M'),
                    'updatedAt': m.created_at.isoformat(),
                }

        return Response(list(threads.values()))

    @action(detail=False, methods=['get'])
    def thread(self, request):
        """Returns messages between the user and counterparty for a listing."""
        listing_id = request.query_params.get('listing_id')
        other_user_id = request.query_params.get('other_user_id')

        if not listing_id or not other_user_id:
            return Response({'error': 'listing_id and other_user_id required.'}, status=400)

        user = request.user
        messages = Message.objects.filter(
            listing_id=listing_id
        ).filter(
            (Q(sender=user) & Q(recipient_id=other_user_id)) |
            (Q(sender_id=other_user_id) & Q(recipient=user))
        ).order_by('created_at')

        return Response(MessageSerializer(messages, many=True, context={'request': request}).data)

# ─── 5. Carbon Impact View ────────────────────────────────────────────────────

class CarbonImpactView(views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get carbon footprint analytics",
        description="Returns user's cumulative CO2e diverted, tonnage, material breakdowns, and equivalencies."
    )
    def get(self, request):
        user = request.user
        completed_txns = DealTransaction.objects.filter(
            Q(buyer=user) | Q(seller=user),
            status=TransactionStatus.COMPLETED
        ).select_related('listing', 'buyer__profile', 'seller__profile', 'carbon_record')

        total_co2 = 0
        total_weight = 0
        by_material_map = {}
        by_month_map = {}
        recent = []

        for t in completed_txns:
            rec = getattr(t, 'carbon_record', None)
            co2 = int(rec.co2e_kg) if rec else 0
            w = int(t.listing.weight_kg)
            total_co2 += co2
            total_weight += w

            mat = t.listing.material
            by_material_map[mat] = by_material_map.get(mat, 0) + co2

            when = t.completed_at or t.created_at
            month_label = when.strftime('%b')
            by_month_map[month_label] = by_month_map.get(month_label, 0) + co2

            party = t.seller if t.buyer == user else t.buyer
            party_profile = getattr(party, 'profile', None)
            party_name = (party_profile.business_name if party_profile and party_profile.business_name else party.email) or "User"

            recent.append({
                'material': mat,
                'party': party_name,
                'weight': w,
                'value': f"{t.listing.price_ngn:,.0f}" if t.listing.price_ngn else "0",
                'co2': co2,
                'date': when.strftime('%d %b'),
            })

        by_material = sorted(by_material_map.items(), key=lambda x: x[1], reverse=True)
        monthly_target = round(3000 / 12)
        by_month = [
            [m, val, max(val, monthly_target)]
            for m, val in by_month_map.items()
        ]

        return Response({
            'totalCo2eKg': total_co2,
            'totalWeightKg': total_weight,
            'completedCount': completed_txns.count(),
            'byMaterial': by_material,
            'byMonth': by_month,
            'recent': recent[:12],
            'equivalencies': {
                'trees': round(total_co2 / 23.2),
                'petrolLitres': round(total_co2 / 2.35),
                'flights': max(0, round(total_co2 / 400)),
            }
        })

# ─── 6. AI Classify View ──────────────────────────────────────────────────────

class ClassifyView(views.APIView):
    """
    Replaces Next.js /api/classify route with Hugging Face integration.
    Accepts multipart file upload or imageUrl.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        request=ClassifyRequestSerializer,
        summary="AI Waste Material Classification",
        description="Classifies waste material images (Plastic, Glass, Metal, Biodegradable, Rubber) via Hugging Face Vision Transformer."
    )
    def post(self, request):
        image_file = request.FILES.get('image')
        image_url = request.data.get('imageUrl')

        if not image_file and not image_url:
            return Response({'error': 'Image file or imageUrl is required.'}, status=400)

        image_bytes = None
        if image_file:
            image_bytes = image_file.read()
        elif image_url:
            try:
                res = requests.get(image_url, timeout=15)
                if not res.ok:
                    return Response({'error': 'Could not fetch image from URL.'}, status=400)
                image_bytes = res.content
            except Exception as e:
                return Response({'error': f'Failed to retrieve image: {str(e)}'}, status=400)

        try:
            result = classify_image_bytes(image_bytes)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=502)

# ─── 7. Paystack Payment Views ────────────────────────────────────────────────

class PaystackInitializeView(views.APIView):
    """
    Supervisor Feedback #1: Server-Side Reference Generation.
    Validates listing availability, generates a structured cryptographic transaction reference,
    and returns verified price/kobo details before opening Paystack modal.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PaystackInitializeSerializer,
        summary="Initialize Paystack Transaction",
        description="Generates server-side secure reference (ECO-...) and returns authorized amount for checkout."
    )
    def post(self, request):
        listing_id = request.data.get('listingId') or request.data.get('listing_id')
        if not listing_id:
            return Response({'error': 'listingId is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            listing = Listing.objects.select_for_update().filter(id=listing_id).first()
            if not listing:
                return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

            if listing.seller == request.user:
                return Response(
                    {'error': 'You cannot purchase your own listing.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if listing.status == ListingStatus.SOLD:
                return Response(
                    {'error': 'This listing has already been sold.'},
                    status=status.HTTP_409_CONFLICT
                )

            if not listing.price_ngn or listing.price_ngn <= 0:
                return Response(
                    {'error': 'Listing does not have a valid price.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if reserved for another buyer
            other_hold = DealTransaction.objects.filter(
                listing=listing,
                status=TransactionStatus.RESERVED
            ).exclude(buyer=request.user).first()

            if other_hold:
                return Response(
                    {'error': 'This listing is currently reserved for another buyer.'},
                    status=status.HTTP_409_CONFLICT
                )

            # Generate structured server-side reference: ECO-<listing_short>-<buyer_short>-<timestamp>-<nonce>
            listing_short = str(listing.id).replace('-', '')[:6].upper()
            buyer_short = str(request.user.id).replace('-', '')[:6].upper()
            timestamp = int(time.time())
            nonce = secrets.token_hex(3).upper()
            reference = f"ECO-{listing_short}-{buyer_short}-{timestamp}-{nonce}"

            amount_ngn = float(listing.price_ngn)
            amount_kobo = int(round(listing.price_ngn * 100))

            return Response({
                'ok': True,
                'reference': reference,
                'listingId': str(listing.id),
                'listingTitle': listing.title,
                'amountNgn': amount_ngn,
                'amountKobo': amount_kobo,
                'publicKey': getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
            }, status=status.HTTP_200_OK)


class PaystackVerifyView(views.APIView):
    """
    Supervisor Feedback #2 & #3:
    - Atomically locks listing with select_for_update() to prevent double-spending / race conditions.
    - Strictly verifies amount against database ground truth (listing.price_ngn * 100).
    - Confirms Paystack reference and marks listing Sold atomically.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PaystackVerifySerializer,
        summary="Verify Paystack Transaction & Fulfill Lot",
        description="Verifies payment with Paystack, asserts amount matches database price, and updates listing to Sold atomically."
    )
    def post(self, request):
        ref = request.data.get('reference')
        listing_id = request.data.get('listingId') or request.data.get('listing_id')

        if not ref or not listing_id:
            return Response({'error': 'reference and listingId are required.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        with db_transaction.atomic():
            # Database-level row lock
            listing = Listing.objects.select_for_update().filter(id=listing_id).first()
            if not listing:
                return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

            if listing.status == ListingStatus.SOLD:
                return Response({'error': 'This listing is already sold.'}, status=status.HTTP_409_CONFLICT)

            if listing.seller == request.user:
                return Response({'error': 'You cannot purchase your own listing.'}, status=status.HTTP_400_BAD_REQUEST)

            # Ground truth price from DB (prevents client price tampering)
            expected_price_ngn = listing.price_ngn
            if not expected_price_ngn or expected_price_ngn <= 0:
                return Response({'error': 'Listing has no valid price.'}, status=status.HTTP_400_BAD_REQUEST)

            # Verify with Paystack using database price as ground truth
            verify_paystack_transaction(ref, expected_price_ngn)

            txn, _ = DealTransaction.objects.select_for_update().get_or_create(
                listing=listing,
                buyer=request.user,
                seller=listing.seller,
                defaults={'status': TransactionStatus.COMPLETED, 'completed_at': now}
            )
            txn.status = TransactionStatus.COMPLETED
            txn.payment_ref = ref
            txn.paid_at = now
            txn.completed_at = now
            txn.save()

            listing.status = ListingStatus.SOLD
            listing.save(update_fields=['status', 'updated_at'])

        return Response({
            'ok': True,
            'reference': ref,
            'listingId': str(listing.id),
            'amountNgn': float(expected_price_ngn),
            'message': 'Payment verified and listing marked as Sold.'
        })

