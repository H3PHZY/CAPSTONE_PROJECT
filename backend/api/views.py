from decimal import Decimal
import hashlib
import hmac
import json
import secrets
import uuid
from pathlib import PurePath
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction as db_transaction
from django.db.models import F, Q, Sum, Count, Case, When, IntegerField, Window
from django.db.models.functions import RowNumber
from datetime import timedelta
from django.core.files.storage import default_storage, storages
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import mixins, serializers, viewsets, status, views
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

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
    PaymentAttempt,
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
from api.payments import (
    PaymentPayloadError,
    settle_payment_attempt,
    validate_paystack_success,
)
from api.safe_fetch import UnsafeImageUrl, fetch_public_image
from api.utils import haversine_km, get_coords_for_zone
from api.validators import validate_uploaded_image
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

User = get_user_model()


def expire_stale_payment_holds(now=None):
    now = now or timezone.now()
    with db_transaction.atomic():
        candidates = list(
            DealTransaction.objects.filter(
                status=TransactionStatus.RESERVED,
                payment_ref__isnull=False,
                paid_at__isnull=True,
                hold_expires_at__lte=now,
            ).order_by('listing_id', 'pk').values_list('pk', 'listing_id')
        )
        for txn_id, listing_id in candidates:
            listing = Listing.objects.select_for_update().filter(pk=listing_id).first()
            txn = DealTransaction.objects.select_for_update().filter(
                pk=txn_id,
                status=TransactionStatus.RESERVED,
                payment_ref__isnull=False,
                paid_at__isnull=True,
                hold_expires_at__lte=now,
            ).first()
            if not txn:
                continue
            PaymentAttempt.objects.filter(
                transaction=txn,
                reference=txn.payment_ref,
                status=PaymentAttempt.Status.INITIALIZED,
            ).update(status=PaymentAttempt.Status.EXPIRED)
            txn.status = TransactionStatus.INTEREST
            txn.hold_started_at = None
            txn.hold_expires_at = None
            txn.save(
                update_fields=[
                    'status',
                    'hold_started_at',
                    'hold_expires_at',
                    'updated_at',
                ]
            )
            if listing and listing.status == ListingStatus.RESERVED and not DealTransaction.objects.filter(
                listing_id=listing.pk,
                status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED],
            ).exists():
                Listing.objects.filter(pk=listing.pk).update(
                    status=ListingStatus.LIVE,
                    updated_at=now,
                )


def blacklist_user_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


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
        try:
            user = serializer.save()
        except IntegrityError:
            return Response(
                {'error': 'An account with this email already exists.'},
                status=status.HTTP_409_CONFLICT,
            )
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
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        password = serializer.validated_data['password']

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
        user = request.user
        email = request.data.get('email')
        password = request.data.get('password')
        current_password = request.data.get('current_password')
        changing_credentials = email is not None or password is not None

        if changing_credentials and (
            not isinstance(current_password, str)
            or not current_password
            or not user.check_password(current_password)
        ):
            return Response(
                {'error': 'A valid current_password is required to change account credentials.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_email = None
        if email is not None:
            if not isinstance(email, str):
                return Response({'error': 'A valid email address is required.'}, status=400)
            try:
                normalized_email = serializers.EmailField().run_validation(email).lower()
            except DRFValidationError as error:
                return Response({'error': error.detail}, status=400)
        if normalized_email and User.objects.filter(
            email__iexact=normalized_email,
        ).exclude(pk=user.pk).exists():
            return Response(
                {'error': 'An account with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if password:
            if not isinstance(password, str):
                return Response({'error': 'A valid password is required.'}, status=400)
            try:
                validate_password(password, user)
            except ValidationError as error:
                return Response(
                    {'error': ' '.join(error.messages)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        profile_data = request.data.copy()
        for field in ('email', 'password', 'current_password'):
            profile_data.pop(field, None)

        profile_serializer = ProfileSerializer(
            user.profile,
            data=profile_data,
            partial=True,
        )
        profile_serializer.is_valid(raise_exception=True)

        credentials_changed = changing_credentials
        try:
            with db_transaction.atomic():
                profile_serializer.save()
                update_fields = []
                if normalized_email and normalized_email != user.email:
                    user.email = normalized_email
                    user.username = normalized_email
                    update_fields.extend(['email', 'username'])
                if password:
                    user.set_password(password)
                    update_fields.append('password')
                if update_fields:
                    user.save(update_fields=update_fields)
                    blacklist_user_refresh_tokens(user)
        except IntegrityError:
            return Response(
                {'error': 'An account with this email already exists.'},
                status=status.HTTP_409_CONFLICT,
            )

        response_data = UserSerializer(user).data
        if credentials_changed:
            refresh = RefreshToken.for_user(user)
            response_data['tokens'] = {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        return Response(response_data)


class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={205: None}, summary='Logout')
    def post(self, request):
        blacklist_user_refresh_tokens(request.user)
        return Response(status=status.HTTP_205_RESET_CONTENT)


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
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

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
        blacklist_user_refresh_tokens(user)
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
            qs = qs.filter(
                Q(status=ListingStatus.LIVE)
                | Q(seller=user)
                | Q(status=ListingStatus.RESERVED, transactions__buyer=user)
            ).distinct()

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
        Listing.objects.filter(id=instance.id).update(views=F('views') + 1)
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
            if listing.status in (ListingStatus.RESERVED, ListingStatus.SOLD):
                return Response(
                    {'error': 'Reserved or sold listings cannot be edited.'},
                    status=status.HTTP_409_CONFLICT,
                )
            try:
                validate_uploaded_image(f)
            except DRFValidationError as error:
                return Response({'error': error.detail}, status=400)
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if PaymentAttempt.objects.filter(transaction__listing=instance).exists():
            return Response(
                {'error': 'Listings with payment history cannot be deleted.'},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        if serializer.instance.status in (ListingStatus.RESERVED, ListingStatus.SOLD):
            raise PermissionDenied('Reserved or sold listings cannot be edited.')
        serializer.save()

# ─── 3. Transaction ViewSet ───────────────────────────────────────────────────

class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, IsTransactionParty]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return DealTransaction.objects.none()
        expire_stale_payment_holds()
        user = self.request.user
        queryset = DealTransaction.objects.filter(Q(buyer=user) | Q(seller=user))
        filters = {}
        for field in ('listing_id', 'buyer_id', 'seller_id'):
            value = self.request.query_params.get(field)
            if value:
                try:
                    filters[field] = uuid.UUID(value) if field == 'listing_id' else int(value)
                except (TypeError, ValueError):
                    return queryset.none()
        return queryset.filter(**filters).select_related(
            'listing',
            'buyer__profile',
            'seller__profile',
            'carbon_record',
        )

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

        try:
            listing_id = uuid.UUID(str(listing_id))
            buyer_id = int(buyer_id)
        except (TypeError, ValueError, AttributeError):
            return Response({'error': 'listing_id and buyer_id must be valid IDs.'}, status=400)

        if str(buyer_id) == str(request.user.id):
            return Response({'error': 'Buyer and seller must be different.'}, status=400)

        buyer = User.objects.filter(id=buyer_id).first()
        if not buyer:
            return Response({'error': 'Buyer not found.'}, status=404)

        expire_stale_payment_holds()
        try:
            with db_transaction.atomic():
                listing = Listing.objects.select_for_update().filter(id=listing_id).first()
                if not listing:
                    return Response({'error': 'Listing not found.'}, status=404)

                if listing.seller != request.user:
                    return Response({'error': 'Only the seller can mark a deal as agreed.'}, status=403)
                if listing.status != ListingStatus.LIVE:
                    return Response(
                        {'error': 'Only live listings can be reserved.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if listing.price_ngn is None or listing.price_ngn <= 0:
                    return Response({'error': 'A valid listing price is required.'}, status=400)

                active_deal = DealTransaction.objects.select_for_update().filter(
                    listing=listing,
                    status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED],
                ).first()
                if active_deal:
                    return Response(
                        {'error': 'This listing is already reserved or sold.'},
                        status=status.HTTP_409_CONFLICT,
                    )

                txn, _ = DealTransaction.objects.select_for_update().get_or_create(
                    listing=listing,
                    buyer=buyer,
                    seller=request.user,
                    defaults={
                        'status': TransactionStatus.RESERVED,
                        'amount_ngn': listing.price_ngn,
                        'currency': 'NGN',
                    },
                )
                if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                    return Response({'error': 'An open dispute blocks deal status changes.'}, status=409)
                txn.status = TransactionStatus.RESERVED
                txn.amount_ngn = listing.price_ngn
                txn.currency = 'NGN'
                txn.hold_started_at = None
                txn.hold_expires_at = None
                txn.save(
                    update_fields=[
                        'status',
                        'amount_ngn',
                        'currency',
                        'hold_started_at',
                        'hold_expires_at',
                        'updated_at',
                    ]
                )
                listing.status = ListingStatus.RESERVED
                listing.save(update_fields=['status', 'updated_at'])
        except IntegrityError:
            return Response(
                {'error': 'This listing is already reserved or sold.'},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        txn = self.get_object()
        if txn.buyer_id != request.user.id:
            return Response({'error': 'Only the buyer can cancel checkout.'}, status=403)
        if txn.status != TransactionStatus.RESERVED or txn.paid_at is not None:
            return Response({'error': 'Only an unpaid reservation can be cancelled.'}, status=409)
        if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
            return Response({'error': 'An open dispute blocks deal status changes.'}, status=409)

        with db_transaction.atomic():
            Listing.objects.select_for_update().get(pk=txn.listing_id)
            txn = DealTransaction.objects.select_for_update().get(pk=txn.pk)
            if txn.status != TransactionStatus.RESERVED or txn.paid_at is not None:
                return Response({'error': 'Only an unpaid reservation can be cancelled.'}, status=409)
            PaymentAttempt.objects.filter(
                transaction=txn,
                reference=txn.payment_ref,
                status=PaymentAttempt.Status.INITIALIZED,
            ).update(status=PaymentAttempt.Status.CANCELLED)
            txn.status = TransactionStatus.INTEREST
            txn.hold_started_at = None
            txn.hold_expires_at = None
            txn.save(
                update_fields=[
                    'status',
                    'hold_started_at',
                    'hold_expires_at',
                    'updated_at',
                ]
            )
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

        try:
            listing_id = uuid.UUID(str(listing_id))
            buyer_id = int(buyer_id)
        except (TypeError, ValueError, AttributeError):
            return Response({'error': 'listing_id and buyer_id must be valid IDs.'}, status=400)

        txn_id = DealTransaction.objects.filter(
            listing_id=listing_id,
            buyer_id=buyer_id,
        ).values_list('pk', flat=True).first()
        if not txn_id:
            return Response({'error': 'Transaction not found.'}, status=404)

        with db_transaction.atomic():
            Listing.objects.select_for_update().filter(pk=listing_id).first()
            txn = DealTransaction.objects.select_for_update().filter(
                pk=txn_id,
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
        ).annotate(
            thread_other_id=Case(
                When(sender=user, then=F('recipient_id')),
                default=F('sender_id'),
                output_field=IntegerField(),
            ),
            thread_rank=Window(
                expression=RowNumber(),
                partition_by=[F('listing_id'), F('thread_other_id')],
                order_by=[F('created_at').desc(), F('pk').desc()],
            ),
        ).filter(
            thread_rank=1
        ).select_related(
            'listing',
            'sender__profile',
            'recipient__profile',
        ).order_by('-created_at')

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
                    'otherName': (profile.business_name if profile and profile.business_name else None) or "EcoLoop User",
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
            party_name = (
                party_profile.business_name
                if party_profile and party_profile.business_name
                else "EcoLoop User"
            )

            recent.append({
                'material': mat,
                'party': party_name,
                'weight': w,
                'value': f"{t.amount_ngn:,.0f}" if t.amount_ngn else "0",
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
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'classify'

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
            try:
                validate_uploaded_image(image_file)
            except DRFValidationError as error:
                return Response({'error': str(error)}, status=400)
            image_bytes = image_file.read()
        elif image_url:
            try:
                image_bytes = fetch_public_image(image_url)
            except UnsafeImageUrl as error:
                return Response({'error': str(error)}, status=400)

        try:
            result = classify_image_bytes(image_bytes)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=502)


class MediaUploadView(views.APIView):
    permission_classes = [IsAuthenticated]

    MAX_BYTES = {
        'listing-photo': 5 * 1024 * 1024,
        'profile-avatar': 5 * 1024 * 1024,
        'message-attachment': 12 * 1024 * 1024,
    }
    IMAGE_TYPES = {'jpg', 'jpeg', 'png', 'webp'}
    ATTACHMENT_TYPES = IMAGE_TYPES | {
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
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
                validate_uploaded_image(uploaded)
            except DRFValidationError as error:
                return Response(
                    {'error': str(error)},
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
        try:
            with db_transaction.atomic():
                listing = Listing.objects.select_for_update().filter(id=listing_id).first()
                if not listing:
                    return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
                if listing.seller_id == request.user.id:
                    return Response(
                        {'error': 'You cannot purchase your own listing.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if listing.status not in (ListingStatus.LIVE, ListingStatus.RESERVED):
                    return Response(
                        {'error': 'This listing is not available for purchase.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if listing.price_ngn is None or listing.price_ngn <= 0:
                    return Response(
                        {'error': 'Listing does not have a valid price.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                txn = DealTransaction.objects.select_for_update().filter(
                    listing=listing,
                    buyer=request.user,
                    seller=listing.seller,
                ).first()
                competing_deal = DealTransaction.objects.select_for_update().filter(
                    listing=listing,
                    status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED],
                ).exclude(pk=txn.pk if txn else None).first()
                if competing_deal:
                    return Response(
                        {'error': 'This listing is currently reserved for another buyer.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if listing.status == ListingStatus.RESERVED and (
                    not txn or txn.status != TransactionStatus.RESERVED
                ):
                    return Response(
                        {'error': 'This listing is currently reserved for another buyer.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if txn and txn.disputes.filter(status=DisputeStatus.OPEN).exists():
                    return Response(
                        {'error': 'An open dispute blocks payment initialization.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if txn and txn.status == TransactionStatus.COMPLETED:
                    return Response(
                        {'error': 'This purchase has already been completed.'},
                        status=status.HTTP_409_CONFLICT,
                    )

                now = timezone.now()
                if txn and txn.status == TransactionStatus.RESERVED and txn.payment_ref:
                    existing_attempt = PaymentAttempt.objects.filter(
                        transaction=txn,
                        reference=txn.payment_ref,
                        status=PaymentAttempt.Status.INITIALIZED,
                    ).first()
                    if (
                        existing_attempt
                        and txn.hold_expires_at
                        and txn.hold_expires_at > now
                        and existing_attempt.amount_ngn == listing.price_ngn
                    ):
                        return self._response(listing, txn, existing_attempt.reference)

                reference = f"ECO-{uuid.uuid4().hex.upper()}-{secrets.token_hex(16).upper()}"
                expires_at = now + timedelta(minutes=settings.PAYMENT_HOLD_MINUTES)
                if txn is None:
                    txn = DealTransaction.objects.create(
                        listing=listing,
                        buyer=request.user,
                        seller=listing.seller,
                        status=TransactionStatus.RESERVED,
                        payment_ref=reference,
                        amount_ngn=listing.price_ngn,
                        currency='NGN',
                        hold_started_at=now,
                        hold_expires_at=expires_at,
                    )
                else:
                    txn.status = TransactionStatus.RESERVED
                    txn.payment_ref = reference
                    txn.paid_at = None
                    txn.completed_at = None
                    txn.amount_ngn = listing.price_ngn
                    txn.currency = 'NGN'
                    txn.hold_started_at = now
                    txn.hold_expires_at = expires_at
                    txn.save(
                        update_fields=[
                            'status',
                            'payment_ref',
                            'paid_at',
                            'completed_at',
                            'amount_ngn',
                            'currency',
                            'hold_started_at',
                            'hold_expires_at',
                            'updated_at',
                        ]
                    )
                PaymentAttempt.objects.create(
                    transaction=txn,
                    reference=reference,
                    amount_ngn=listing.price_ngn,
                )
                listing.status = ListingStatus.RESERVED
                listing.save(update_fields=['status', 'updated_at'])
                return self._response(listing, txn, reference)
        except IntegrityError:
            return Response(
                {'error': 'This listing is currently reserved or sold.'},
                status=status.HTTP_409_CONFLICT,
            )

    def _response(self, listing, txn, reference):
        return Response({
            'ok': True,
            'reference': reference,
            'transactionId': str(txn.pk),
            'listingId': str(listing.id),
            'listingTitle': listing.title,
            'amountNgn': float(txn.amount_ngn),
            'amountKobo': int(txn.amount_ngn * 100),
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

        attempt = PaymentAttempt.objects.select_related(
            'transaction__listing',
            'transaction__buyer',
            'transaction__seller',
        ).filter(
            reference=ref,
            transaction__listing_id=listing_id,
            transaction__buyer=request.user,
        ).first()
        if attempt is None:
            return Response(
                {'error': 'Payment reference does not match this purchase.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if attempt.status == PaymentAttempt.Status.PAID:
            return Response({
                'ok': True,
                'reference': ref,
                'listingId': str(attempt.transaction.listing_id),
                'amountNgn': float(attempt.amount_ngn),
                'message': 'Payment was already verified.',
                'alreadyProcessed': True,
            })
        if attempt.status in (PaymentAttempt.Status.RECONCILIATION, PaymentAttempt.Status.REFUNDED):
            return Response(
                {'error': 'Payment requires refund reconciliation.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            verify_paystack_transaction(ref, attempt.amount_ngn)
            txn, result = settle_payment_attempt(attempt.pk, {
                'reference': ref,
                'amount': int(attempt.amount_ngn * 100),
                'currency': 'NGN',
                'status': 'success',
            })
        except PaymentPayloadError as error:
            return Response({'error': str(error)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        if result == 'reconciliation':
            return Response(
                {'error': 'Payment succeeded but the listing is no longer available; refund reconciliation is required.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({
            'ok': True,
            'reference': ref,
            'listingId': str(txn.listing_id),
            'amountNgn': float(attempt.amount_ngn),
            'message': 'Payment verified and listing marked as Sold.',
            'alreadyProcessed': result == 'already_processed',
        })


class PaystackWebhookView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'webhook'

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

        attempt = PaymentAttempt.objects.select_related('transaction').filter(
            reference=reference,
        ).first()
        if attempt is None:
            return Response({'received': True, 'ignored': True})
        if attempt.status == PaymentAttempt.Status.PAID:
            return Response({
                'received': True,
                'listingId': str(attempt.transaction.listing_id),
                'already_processed': True,
            })
        if attempt.status in (
            PaymentAttempt.Status.RECONCILIATION,
            PaymentAttempt.Status.REFUNDED,
        ):
            return Response({
                'received': True,
                'listingId': str(attempt.transaction.listing_id),
                'reconciliation_required': True,
            })
        try:
            if not isinstance(data, dict) or data.get('status') != 'success':
                return Response({'error': 'Webhook payment status is invalid.'}, status=400)
            validate_paystack_success(
                reference,
                attempt.amount_ngn,
                attempt.transaction.currency,
                data,
            )
            verify_paystack_transaction(reference, attempt.amount_ngn)
            txn, result = settle_payment_attempt(attempt.pk, data)
        except PaymentPayloadError as error:
            return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        if result == 'reconciliation':
            return Response({
                'received': True,
                'reconciliation_required': True,
                'listingId': str(txn.listing_id),
            })
        return Response({
            'received': True,
            'listingId': str(txn.listing_id),
            'already_processed': result == 'already_processed',
        })
