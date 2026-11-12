import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _
from api.utils import is_pilot_verified, get_coords_for_zone

# ─── Enumerations / Choices ──────────────────────────────────────────────────

class MaterialCategory(models.TextChoices):
    PLASTIC = 'Plastic', _('Plastic')
    GLASS = 'Glass', _('Glass')
    METAL = 'Metal', _('Metal')
    BIODEGRADABLE = 'Biodegradable', _('Biodegradable')
    RUBBER = 'Rubber', _('Rubber')

class ListingStatus(models.TextChoices):
    DRAFT = 'Draft', _('Draft')
    LIVE = 'Live', _('Live')
    RESERVED = 'Reserved', _('Reserved')
    SOLD = 'Sold', _('Sold')

class TransactionStatus(models.TextChoices):
    INTEREST = 'Interest', _('Interest')
    RESERVED = 'Reserved', _('Reserved')
    COMPLETED = 'Completed', _('Completed')
    CANCELLED = 'Cancelled', _('Cancelled')

# ─── 1. Profile Model ─────────────────────────────────────────────────────────

class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        primary_key=True
    )
    business_name = models.CharField(max_length=255, default='', blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    cluster = models.CharField(max_length=100, default='Ogba')
    zone = models.CharField(max_length=100, null=True, blank=True)
    address = models.CharField(max_length=500, default='', blank=True)
    sells = models.BooleanField(default=False)
    buys = models.BooleanField(default=False)
    carbon_impact = models.BooleanField(default=False)
    research_consent = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='profile_avatars/', null=True, blank=True)
    avatar_url = models.URLField(max_length=1000, null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['cluster'], name='profile_cluster_idx'),
        ]

    def __str__(self):
        return self.business_name or self.user.email or str(self.user.id)

    @property
    def display_avatar_url(self) -> str | None:
        if self.avatar:
            return self.avatar.url
        return self.avatar_url or None

    def save(self, *args, **kwargs):
        # Auto-compute pilot trust verification
        self.verified = is_pilot_verified(
            self.business_name,
            self.phone,
            self.sells,
            self.buys
        )
        if self.lat is None or self.lng is None:
            zone_key = self.zone or self.cluster
            lat, lng = get_coords_for_zone(zone_key)
            self.lat = lat
            self.lng = lng
        super().save(*args, **kwargs)

# ─── 2. Listing Model ─────────────────────────────────────────────────────────

class Listing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listings'
    )
    title = models.CharField(max_length=255)
    material = models.CharField(max_length=30, choices=MaterialCategory.choices)
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    price_ngn = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ListingStatus.choices,
        default=ListingStatus.DRAFT
    )
    photo = models.ImageField(upload_to='listing_photos/', null=True, blank=True)
    photo_url = models.URLField(max_length=1000, null=True, blank=True)
    photo_urls = models.JSONField(default=list, blank=True)
    zone = models.CharField(max_length=100, default='Ogba')
    address = models.CharField(max_length=500, default='', blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['seller'], name='listing_seller_idx'),
            models.Index(fields=['status'], name='listing_status_idx'),
            models.Index(fields=['material'], name='listing_material_idx'),
            models.Index(fields=['status', 'material'], name='listing_live_mat_idx'),
        ]

    def __str__(self):
        return f"{self.title} ({self.material}, {self.weight_kg}kg)"

    @property
    def primary_photo_url(self) -> str | None:
        if self.photo:
            return self.photo.url
        if self.photo_url:
            return self.photo_url
        if self.photo_urls and len(self.photo_urls) > 0:
            return self.photo_urls[0]
        return None

    @property
    def all_photos(self) -> list[str]:
        urls = []
        if self.photo:
            urls.append(self.photo.url)
        elif self.photo_url:
            urls.append(self.photo_url)
        if isinstance(self.photo_urls, list):
            for u in self.photo_urls:
                if u and u not in urls:
                    urls.append(u)
        return urls

    def save(self, *args, **kwargs):
        if self.lat is None or self.lng is None:
            lat, lng = get_coords_for_zone(self.zone)
            self.lat = lat
            self.lng = lng
        super().save(*args, **kwargs)

# ─── 3. Classification Model ──────────────────────────────────────────────────

class Classification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.OneToOneField(
        Listing,
        on_delete=models.CASCADE,
        related_name='classification'
    )
    predicted_material = models.CharField(max_length=30, choices=MaterialCategory.choices)
    confidence = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    overridden = models.BooleanField(default=False)
    final_material = models.CharField(max_length=30, choices=MaterialCategory.choices)
    model_id = models.CharField(max_length=255, null=True, blank=True)
    raw_labels = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Classification for {self.listing.title} -> {self.final_material} ({self.confidence * 100:.1f}%)"

# ─── 4. Transaction Model ─────────────────────────────────────────────────────

class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        Listing,
        on_delete=models.RESTRICT,
        related_name='transactions'
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='buyer_transactions'
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='seller_transactions'
    )
    status = models.CharField(
        max_length=20,
        choices=TransactionStatus.choices,
        default=TransactionStatus.INTEREST
    )
    payment_ref = models.CharField(max_length=255, null=True, blank=True, unique=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=~models.Q(buyer=models.F('seller')),
                name='buyer_differs_from_seller'
            ),
            models.UniqueConstraint(
                fields=['listing', 'buyer', 'seller'],
                name='unique_listing_parties'
            )
        ]
        indexes = [
            models.Index(fields=['listing'], name='txn_listing_idx'),
            models.Index(fields=['buyer'], name='txn_buyer_idx'),
            models.Index(fields=['seller'], name='txn_seller_idx'),
            models.Index(fields=['status'], name='txn_status_idx'),
        ]

    def __str__(self):
        return f"Txn ({self.status}): {self.listing.title} [Buyer: {self.buyer.id}, Seller: {self.seller.id}]"

# ─── 5. CarbonRecord Model ────────────────────────────────────────────────────

class CarbonRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name='carbon_record'
    )
    material = models.CharField(max_length=30, choices=MaterialCategory.choices)
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    co2e_kg = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.0'))]
    )
    factor_kg_per_kg = models.DecimalField(max_digits=8, decimal_places=4)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['transaction'], name='carbon_txn_idx'),
        ]

    def __str__(self):
        return f"{self.co2e_kg} kg CO2e saved ({self.material}, {self.weight_kg}kg)"

# ─── 6. Message Model ─────────────────────────────────────────────────────────

class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages'
    )
    body = models.TextField()
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies'
    )
    image_url = models.CharField(max_length=1000, null=True, blank=True)
    attachment = models.FileField(upload_to='message_attachments/', null=True, blank=True)
    attachment_name = models.CharField(max_length=255, null=True, blank=True)
    attachment_mime = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(
                check=~models.Q(sender=models.F('recipient')),
                name='sender_differs_from_recipient'
            )
        ]
        indexes = [
            models.Index(fields=['listing', 'created_at'], name='msg_listing_created_idx'),
            models.Index(fields=['recipient', '-created_at'], name='msg_recipient_created_idx'),
        ]

    def __str__(self):
        return f"Msg from {self.sender.id} to {self.recipient.id}: {self.body[:30]}"
