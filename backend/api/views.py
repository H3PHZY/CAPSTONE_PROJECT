from decimal import Decimal
from pathlib import PurePath
import hashlib
import hmac
import json
import secrets
import uuid
import requests
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction as db_transaction
from django.db.models import Q, Sum, Count, Case, When, IntegerField
from datetime import timedelta
from django.core.files.storage import default_storage, storages
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import mixins, viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
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
    Dispute,
    DisputeStatus,
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
    PaystackInitializeResponseSerializer,
    PaystackVerifySerializer,
    PaystackVerifyResponseSerializer,
    ClassifyRequestSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    DetailResponseSerializer,
    MediaUploadResponseSerializer,
    DisputeSerializer,
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


def expire_stale_payment_holds(now=None):
    now = now or timezone.now()
    expired_before = now - timedelta(minutes=settings.PAYMENT_HOLD_MINUTES)
    with db_transaction.atomic():
        expired = list(
            DealTransaction.objects.select_for_update()
            .filter(
                status=TransactionStatus.RESERVED,
                payment_ref__isnull=False,
                paid_at__isnull=True,
                updated_at__lt=expired_before,
            )
            .select_related('listing')
        )
        for txn in expired:
            txn.status = TransactionStatus.INTEREST
            txn.payment_ref = None
            txn.save(update_fields=['status', 'payment_ref', 'updated_at'])
            listing = Listing.objects.select_for_update().get(pk=txn.listing_id)
            if (
                listing.status == ListingStatus.RESERVED
                and not DealTransaction.objects.filter(
                    listing_id=listing.pk,
                    status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED],
                ).exists()
            ):
                Listing.objects.filter(pk=listing.pk).update(
                    status=ListingStatus.LIVE,
                    updated_at=now,
                )


# ─── 1. Authentication Views ──────────────────────────────────────────────────

class SignupView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'signup'

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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

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


class PasswordResetRequestView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(
        request=PasswordResetRequestSerializer,
        responses={200: DetailResponseSerializer},
        summary="Request a password reset",
    )
    def post(self, request):
        email = str(request.data.get('email', '')).strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
        if user:
            uid = urlsafe_base64_encode(str(user.pk).encode())
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            reset_url = f'{frontend_url}/reset-password?uid={uid}&token={token}'
            send_mail(
                'Reset your EcoLoop password',
                f'Use this link to reset your EcoLoop password: {reset_url}',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

        return Response({
            'detail': 'If an account exists for that email, a password reset link has been sent.'
        })


class PasswordResetConfirmView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(
        request=PasswordResetConfirmSerializer,
        responses={200: DetailResponseSerializer},
        summary="Confirm a password reset",
    )
    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        password = request.data.get('password')
        if not uid or not token or not password:
            return Response(
                {'error': 'uid, token, and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'This password reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password, user)
        except ValidationError as error:
            return Response({'error': ' '.join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successfully.'})


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
        expire_stale_payment_holds()
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
        if user.is_authenticated and hasattr(user, 'profile'):
            v_lat = user.profile.lat or v_lat
            v_lng = user.profile.lng or v_lng
        try:
            requested_lat = float(self.request.query_params.get('lat', ''))
            requested_lng = float(self.request.query_params.get('lng', ''))
            if -90 <= requested_lat <= 90 and -180 <= requested_lng <= 180:
                v_lat, v_lng = requested_lat, requested_lng
        except (TypeError, ValueError):
            pass

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
        if ids:
            ordering = Case(
                *[When(pk=pk, then=index) for index, pk in enumerate(ids)],
                output_field=IntegerField(),
            )
            return qs.filter(id__in=ids).order_by(ordering)
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
        expire_stale_payment_holds()
        qs = Listing.objects.filter(seller=request.user).select_related('classification')
        serializer = ListingSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def publish(self, request, pk=None):
        listing = self.get_object()
        if listing.seller_id != request.user.id:
            return Response({'error': 'You do not own this listing.'}, status=403)
        if listing.status != ListingStatus.DRAFT:
            return Response({'error': 'Only draft listings can be published.'}, status=400)
        listing.status = ListingStatus.LIVE
        listing.save(update_fields=['status', 'updated_at'])
        return Response(ListingSerializer(listing, context={'request': request}).data)

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

class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, IsTransactionParty]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return DealTransaction.objects.none()
        expire_stale_payment_holds()
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
            expire_stale_payment_holds()
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
                defaults={
                    'status': TransactionStatus.RESERVED,
                    'amount_ngn': listing.price_ngn,
                    'currency': 'NGN',
                }
            )

            if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                return Response({'error': 'An open dispute blocks deal status changes.'}, status=409)
            if txn.status != TransactionStatus.RESERVED:
                txn.status = TransactionStatus.RESERVED
                txn.amount_ngn = listing.price_ngn
                txn.currency = 'NGN'
                txn.save(update_fields=['status', 'amount_ngn', 'currency', 'updated_at'])

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
            if txn.paid_at is None:
                return Response({'error': 'Payment is required before completing this deal.'}, status=400)
            if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                return Response({'error': 'An open dispute blocks deal status changes.'}, status=409)
            if txn.status == TransactionStatus.COMPLETED:
                return Response(TransactionSerializer(txn, context={'request': request}).data)

            txn.status = TransactionStatus.COMPLETED
            txn.completed_at = timezone.now()
            txn.save()

        return Response(TransactionSerializer(txn, context={'request': request}).data)

# ─── 4. Message ViewSet ───────────────────────────────────────────────────────

class MessageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsMessageParticipant]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Message.objects.none()
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
                    'lastMessageId': str(m.id),
                    'lastSenderId': str(m.sender_id),
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


class DisputeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = DisputeSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Dispute.objects.none()
        return Dispute.objects.filter(
            Q(transaction__buyer=self.request.user)
            | Q(transaction__seller=self.request.user)
        ).select_related('transaction', 'raised_by')


class HealthView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({'status': 'ok'})


# ─── 5. Carbon Impact View ────────────────────────────────────────────────────

class CarbonImpactView(views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get carbon footprint analytics",
        description="Returns user's cumulative CO2e diverted, tonnage, material breakdowns, and equivalencies.",
        responses=OpenApiTypes.OBJECT,
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
        responses=OpenApiTypes.OBJECT,
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


class MediaUploadView(views.APIView):
    permission_classes = [IsAuthenticated]

    MAX_BYTES = {
        'listing-photo': 8 * 1024 * 1024,
        'profile-avatar': 5 * 1024 * 1024,
        'message-attachment': 12 * 1024 * 1024,
    }
    IMAGE_TYPES = {'jpg', 'jpeg', 'png', 'webp'}
    ATTACHMENT_TYPES = IMAGE_TYPES | {
        'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
    }

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses={201: MediaUploadResponseSerializer},
        summary='Upload user media',
        description='Uploads an authenticated user media file to the configured persistent storage.',
    )
    def post(self, request):
        uploaded = request.FILES.get('file')
        category = request.data.get('category')
        if category not in self.MAX_BYTES or uploaded is None:
            return Response(
                {'error': 'A file and supported category are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if uploaded.size > self.MAX_BYTES[category]:
            return Response(
                {'error': 'File exceeds the size limit for this upload.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        extension = PurePath(uploaded.name).suffix.lower().lstrip('.')
        allowed = self.IMAGE_TYPES if category != 'message-attachment' else self.ATTACHMENT_TYPES
        if extension not in allowed:
            return Response(
                {'error': 'Unsupported file type.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if category != 'message-attachment' or extension in self.IMAGE_TYPES:
            try:
                image = Image.open(uploaded)
                image.verify()
                uploaded.seek(0)
            except (UnidentifiedImageError, OSError, ValueError):
                return Response(
                    {'error': 'The uploaded file is not a valid image.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        path = f'{category}/{request.user.id}/{uuid.uuid4().hex}.{extension}'
        storage = (
            storages['raw_media']
            if category == 'message-attachment' and extension not in self.IMAGE_TYPES
            else default_storage
        )
        stored_path = storage.save(path, uploaded)
        url = request.build_absolute_uri(storage.url(stored_path))
        return Response({'path': stored_path, 'url': url}, status=status.HTTP_201_CREATED)

# ─── 7. Paystack Payment Views ────────────────────────────────────────────────

class PaystackInitializeView(views.APIView):
    """Reserve an available listing and persist its server-generated payment reference."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'pay'

    @extend_schema(
        request=PaystackInitializeSerializer,
        responses={200: PaystackInitializeResponseSerializer},
        summary="Initialize Paystack Transaction",
        description="Generates server-side secure reference (ECO-...) and returns authorized amount for checkout."
    )
    def post(self, request):
        serializer = PaystackInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        listing_id = serializer.validated_data['listingId']

        expire_stale_payment_holds()
        with db_transaction.atomic():
            listing = Listing.objects.select_for_update().filter(id=listing_id).first()
            if not listing:
                return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

            if listing.seller == request.user:
                return Response(
                    {'error': 'You cannot purchase your own listing.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if listing.status not in (ListingStatus.LIVE, ListingStatus.RESERVED):
                return Response(
                    {'error': 'This listing is not available for purchase.'},
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

            reference = f"ECO-{uuid.uuid4().hex.upper()}-{secrets.token_hex(16).upper()}"
            txn = DealTransaction.objects.select_for_update().filter(
                listing=listing,
                buyer=request.user,
                seller=listing.seller,
            ).first()
            if txn and txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                return Response(
                    {'error': 'An open dispute blocks payment initialization.'},
                    status=status.HTTP_409_CONFLICT
                )
            if txn and txn.status == TransactionStatus.COMPLETED:
                return Response(
                    {'error': 'This purchase has already been completed.'},
                    status=status.HTTP_409_CONFLICT
                )
            if txn:
                txn.status = TransactionStatus.RESERVED
                txn.payment_ref = reference
                txn.paid_at = None
                txn.completed_at = None
                txn.amount_ngn = listing.price_ngn
                txn.currency = 'NGN'
                txn.save(
                    update_fields=[
                        'status',
                        'payment_ref',
                        'paid_at',
                        'completed_at',
                        'amount_ngn',
                        'currency',
                        'updated_at',
                    ]
                )
            else:
                DealTransaction.objects.create(
                    listing=listing,
                    buyer=request.user,
                    seller=listing.seller,
                    status=TransactionStatus.RESERVED,
                    payment_ref=reference,
                    amount_ngn=listing.price_ngn,
                    currency='NGN',
                )

            amount_ngn = float(txn.amount_ngn if txn else listing.price_ngn)
            amount_kobo = int((txn.amount_ngn if txn else listing.price_ngn) * 100)

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
    """Verify a bound, unused Paystack payment before completing the reserved deal."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'pay'

    @extend_schema(
        request=PaystackVerifySerializer,
        responses={200: PaystackVerifyResponseSerializer},
        summary="Verify Paystack Transaction & Fulfill Lot",
        description="Verifies payment with Paystack, asserts amount matches database price, and updates listing to Sold atomically."
    )
    def post(self, request):
        serializer = PaystackVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ref = serializer.validated_data['reference']
        listing_id = serializer.validated_data['listingId']

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

            txn = DealTransaction.objects.select_for_update().filter(
                listing=listing,
                buyer=request.user,
                seller=listing.seller,
            ).first()
            if not txn or txn.status != TransactionStatus.RESERVED:
                return Response(
                    {'error': 'Initialize this purchase before verifying payment.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if txn.payment_ref != ref:
                return Response(
                    {'error': 'Payment reference does not match this purchase.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if DealTransaction.objects.filter(payment_ref=ref).exclude(pk=txn.pk).exists():
                return Response(
                    {'error': 'This payment reference was already used.'},
                    status=status.HTTP_409_CONFLICT
                )

            if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                return Response({'error': 'An open dispute blocks deal status changes.'}, status=409)

            expected_price_ngn = txn.amount_ngn
            if not expected_price_ngn or expected_price_ngn <= 0 or txn.currency != 'NGN':
                return Response({'error': 'This transaction has no valid NGN payment amount.'}, status=400)

            # Verify against the immutable amount snapshot stored at initialization.
            verify_paystack_transaction(ref, expected_price_ngn)

            txn.status = TransactionStatus.COMPLETED
            txn.paid_at = now
            txn.completed_at = now
            txn.save()

        return Response({
            'ok': True,
            'reference': ref,
            'listingId': str(listing.id),
            'amountNgn': float(expected_price_ngn),
            'message': 'Payment verified and listing marked as Sold.'
        })


class PaystackWebhookView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'pay'

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses=OpenApiTypes.OBJECT,
    )
    def post(self, request):
        secret = settings.PAYSTACK_SECRET_KEY
        signature = request.headers.get('x-paystack-signature', '')
        if not secret or not signature:
            return Response({'error': 'Invalid webhook signature.'}, status=400)
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            request.body,
            hashlib.sha512,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            return Response({'error': 'Invalid webhook signature.'}, status=400)

        try:
            event = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return Response({'error': 'Invalid webhook payload.'}, status=400)
        if not isinstance(event, dict) or event.get('event') != 'charge.success':
            return Response({'received': True, 'ignored': True})
        data = event.get('data')
        reference = data.get('reference') if isinstance(data, dict) else None
        if not isinstance(reference, str) or not reference.strip():
            return Response({'error': 'Webhook reference is required.'}, status=400)

        txn = DealTransaction.objects.filter(payment_ref=reference).select_related('listing').first()
        if txn is None:
            return Response({'error': 'Payment reference not found.'}, status=404)
        if txn.status == TransactionStatus.COMPLETED and txn.paid_at:
            return Response({'received': True, 'already_processed': True})
        if txn.status != TransactionStatus.RESERVED or not txn.amount_ngn:
            return Response({'error': 'No active payment exists for this reference.'}, status=409)

        verify_paystack_transaction(reference, txn.amount_ngn)
        with db_transaction.atomic():
            locked = DealTransaction.objects.select_for_update().get(pk=txn.pk)
            listing = Listing.objects.select_for_update().get(pk=locked.listing_id)
            if locked.status == TransactionStatus.COMPLETED and locked.paid_at:
                return Response({'received': True, 'already_processed': True})
            if locked.status != TransactionStatus.RESERVED or locked.payment_ref != reference:
                return Response({'error': 'Payment reference is no longer active.'}, status=409)
            if locked.disputes.filter(status=DisputeStatus.OPEN).exists():
                return Response({'error': 'An open dispute blocks payment completion.'}, status=409)
            now = timezone.now()
            locked.status = TransactionStatus.COMPLETED
            locked.paid_at = now
            locked.completed_at = now
            locked.save()
        return Response({'received': True, 'listingId': str(listing.pk)})
