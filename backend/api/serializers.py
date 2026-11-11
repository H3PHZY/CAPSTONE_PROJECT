from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from api.models import (
    Profile,
    Listing,
    Classification,
    Transaction as DealTransaction,
    TransactionStatus,
    ListingStatus,
    CarbonRecord,
    Message,
    MaterialCategory,
)
from api.utils import haversine_km, calculate_co2_kg, get_coords_for_zone

User = get_user_model()

# ─── Auth & Profile Serializers ──────────────────────────────────────────────

class ProfileSerializer(serializers.ModelSerializer):
    display_avatar_url = serializers.ReadOnlyField()

    class Meta:
        model = Profile
        fields = [
            'business_name',
            'phone',
            'cluster',
            'zone',
            'sells',
            'buys',
            'carbon_impact',
            'research_consent',
            'verified',
            'avatar',
            'avatar_url',
            'display_avatar_url',
            'lat',
            'lng',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['verified', 'created_at', 'updated_at']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'profile']

class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    business_name = serializers.CharField(required=False, allow_blank=True, default='')
    cluster = serializers.CharField(required=False, default='Ogba')
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    sells = serializers.BooleanField(required=False, default=False)
    buys = serializers.BooleanField(required=False, default=False)
    carbon_impact = serializers.BooleanField(required=False, default=False)
    research_consent = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        email = validated_data['email']
        password = validated_data['password']

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password
            )
            profile = user.profile
            profile.business_name = validated_data.get('business_name', '')
            profile.cluster = validated_data.get('cluster', 'Ogba')
            profile.phone = validated_data.get('phone', '')
            profile.sells = validated_data.get('sells', False)
            profile.buys = validated_data.get('buys', False)
            profile.carbon_impact = validated_data.get('carbon_impact', False)
            profile.research_consent = validated_data.get('research_consent', False)
            profile.save()

        return user

# ─── Classification Serializer ───────────────────────────────────────────────

class ClassificationSerializer(serializers.ModelSerializer):
    confidence_pct = serializers.SerializerMethodField()

    class Meta:
        model = Classification
        fields = [
            'id',
            'predicted_material',
            'confidence',
            'confidence_pct',
            'overridden',
            'final_material',
            'model_id',
            'raw_labels',
            'created_at',
        ]

    def get_confidence_pct(self, obj) -> int:
        return int(round(float(obj.confidence) * 100))

# ─── Listing Serializers ─────────────────────────────────────────────────────

class ListingSerializer(serializers.ModelSerializer):
    seller_id = serializers.CharField(source='seller.id', read_only=True)
    seller_name = serializers.SerializerMethodField()
    seller_cluster = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    primary_photo_url = serializers.ReadOnlyField()
    all_photos = serializers.ReadOnlyField()
    distance = serializers.SerializerMethodField()
    co2_saved = serializers.SerializerMethodField()
    conf = serializers.SerializerMethodField()
    classification = ClassificationSerializer(read_only=True)

    class Meta:
        model = Listing
        fields = [
            'id',
            'seller_id',
            'seller_name',
            'seller_cluster',
            'verified',
            'title',
            'material',
            'weight_kg',
            'price_ngn',
            'status',
            'photo',
            'photo_url',
            'primary_photo_url',
            'photo_urls',
            'all_photos',
            'zone',
            'lat',
            'lng',
            'views',
            'distance',
            'co2_saved',
            'conf',
            'classification',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'views', 'created_at', 'updated_at']

    def get_seller_name(self, obj) -> str:
        profile = getattr(obj.seller, 'profile', None)
        return (profile.business_name if profile and profile.business_name else obj.seller.email) or "EcoLoop Seller"

    def get_seller_cluster(self, obj) -> str:
        profile = getattr(obj.seller, 'profile', None)
        return (profile.cluster if profile else obj.zone) or "Ogba"

    def get_verified(self, obj) -> bool:
        profile = getattr(obj.seller, 'profile', None)
        return bool(profile.verified if profile else False)

    def get_conf(self, obj) -> int:
        cls = getattr(obj, 'classification', None)
        if cls:
            return int(round(float(cls.confidence) * 100))
        return 80

    def get_co2_saved(self, obj) -> int:
        return int(calculate_co2_kg(obj.weight_kg, obj.material))

    def get_distance(self, obj) -> float:
        request = self.context.get('request')
        viewer_cluster = None
        if request and request.user.is_authenticated and hasattr(request.user, 'profile'):
            viewer_cluster = request.user.profile.cluster
        if not viewer_cluster and request:
            viewer_cluster = request.query_params.get('cluster')

        viewer_lat, viewer_lon = get_coords_for_zone(viewer_cluster or 'Ogba')
        listing_lat = obj.lat or viewer_lat
        listing_lon = obj.lng or viewer_lon

        return haversine_km(viewer_lat, viewer_lon, listing_lat, listing_lon)

class ListingCreateSerializer(serializers.ModelSerializer):
    predicted_material = serializers.ChoiceField(choices=MaterialCategory.choices, required=False)
    confidence = serializers.DecimalField(max_digits=5, decimal_places=4, required=False, default=Decimal('0.85'))
    overridden = serializers.BooleanField(required=False, default=False)
    model_id = serializers.CharField(required=False, default='hf-endpoint', allow_blank=True)
    raw_labels = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = Listing
        fields = [
            'id',
            'title',
            'material',
            'weight_kg',
            'price_ngn',
            'status',
            'photo',
            'photo_url',
            'photo_urls',
            'zone',
            'predicted_material',
            'confidence',
            'overridden',
            'model_id',
            'raw_labels',
        ]

    def create(self, validated_data):
        pred_mat = validated_data.pop('predicted_material', validated_data.get('material'))
        conf = validated_data.pop('confidence', Decimal('0.85'))
        overridden = validated_data.pop('overridden', False)
        model_id = validated_data.pop('model_id', 'hf-endpoint')
        raw_labels = validated_data.pop('raw_labels', None)

        request = self.context.get('request')
        validated_data['seller'] = request.user
        validated_data['status'] = ListingStatus.LIVE

        with transaction.atomic():
            listing = Listing.objects.create(**validated_data)
            Classification.objects.create(
                listing=listing,
                predicted_material=pred_mat,
                confidence=conf,
                overridden=overridden,
                final_material=listing.material,
                model_id=model_id,
                raw_labels=raw_labels,
            )

        return listing

# ─── Transaction Serializers ─────────────────────────────────────────────────

class TransactionSerializer(serializers.ModelSerializer):
    listing_id = serializers.CharField(source='listing.id', read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    listing_material = serializers.CharField(source='listing.material', read_only=True)
    listing_weight = serializers.DecimalField(source='listing.weight_kg', max_digits=12, decimal_places=2, read_only=True)
    listing_price = serializers.DecimalField(source='listing.price_ngn', max_digits=14, decimal_places=2, read_only=True)
    counterparty_name = serializers.SerializerMethodField()
    counterparty_id = serializers.SerializerMethodField()
    co2e_kg = serializers.SerializerMethodField()

    class Meta:
        model = DealTransaction
        fields = [
            'id',
            'listing_id',
            'listing_title',
            'listing_material',
            'listing_weight',
            'listing_price',
            'buyer_id',
            'seller_id',
            'counterparty_name',
            'counterparty_id',
            'status',
            'payment_ref',
            'paid_at',
            'completed_at',
            'co2e_kg',
            'created_at',
            'updated_at',
        ]

    def get_counterparty_id(self, obj) -> str:
        request = self.context.get('request')
        if request and request.user.id == obj.buyer_id:
            return str(obj.seller_id)
        return str(obj.buyer_id)

    def get_counterparty_name(self, obj) -> str:
        request = self.context.get('request')
        target_user = obj.seller if request and request.user.id == obj.buyer_id else obj.buyer
        profile = getattr(target_user, 'profile', None)
        return (profile.business_name if profile and profile.business_name else target_user.email) or "EcoLoop User"

    def get_co2e_kg(self, obj) -> int | None:
        rec = getattr(obj, 'carbon_record', None)
        return int(rec.co2e_kg) if rec else None

# ─── Message Serializers ─────────────────────────────────────────────────────

class MessageSerializer(serializers.ModelSerializer):
    me = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    sender_avatar_url = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    reply_text = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'listing',
            'sender',
            'recipient',
            'body',
            'reply_to',
            'reply_text',
            'image_url',
            'attachment',
            'attachment_name',
            'attachment_mime',
            'created_at',
            'me',
            'sender_name',
            'sender_avatar_url',
            'time',
        ]
        read_only_fields = ['id', 'sender', 'created_at']

    def get_me(self, obj) -> bool:
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)

    def get_sender_name(self, obj) -> str:
        profile = getattr(obj.sender, 'profile', None)
        return (profile.business_name if profile and profile.business_name else obj.sender.email) or "User"

    def get_sender_avatar_url(self, obj) -> str | None:
        profile = getattr(obj.sender, 'profile', None)
        return profile.display_avatar_url if profile else None

    def get_time(self, obj) -> str:
        return obj.created_at.strftime('%H:%M')

    def get_reply_text(self, obj) -> str | None:
        return obj.reply_to.body if obj.reply_to else None

# ─── Carbon Record Serializer ────────────────────────────────────────────────

class CarbonRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarbonRecord
        fields = '__all__'


# ─── Request / Utility Serializers ──────────────────────────────────────────

class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, help_text="Registered user email")
    password = serializers.CharField(required=True, write_only=True)


class PaystackInitializeSerializer(serializers.Serializer):
    listingId = serializers.UUIDField(required=True, help_text="ID of the listing being purchased")


class PaystackVerifySerializer(serializers.Serializer):
    reference = serializers.CharField(required=True, help_text="Paystack transaction reference")
    listingId = serializers.UUIDField(required=True, help_text="ID of the purchased listing")


class ClassifyRequestSerializer(serializers.Serializer):
    image = serializers.ImageField(required=False, help_text="Waste material image file")
    imageUrl = serializers.URLField(required=False, help_text="URL to waste material image")


