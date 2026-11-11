import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils import timezone
from api.models import (
    Profile,
    Listing,
    ListingStatus,
    Transaction,
    TransactionStatus,
    CarbonRecord,
    Message,
)
from api.utils import calculate_co2_kg, CO2_FACTORS

logger = logging.getLogger(__name__)

# ─── 1. User -> Profile Auto Creation ────────────────────────────────────────

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def handle_new_user(sender, instance, created, **kwargs):
    """
    Replaces Supabase handle_new_user() trigger (migration 001).
    Ensures every user has an associated Profile.
    """
    if created:
        Profile.objects.get_or_create(user=instance)

# ─── 2. Transaction -> Listing Status Synchronization ─────────────────────────

@receiver(post_save, sender=Transaction)
def apply_transaction_listing_status(sender, instance, created, **kwargs):
    """
    Replaces Supabase apply_transaction_listing_status() trigger (migration 002).
    Keeps listing status synced when deal transitions to Reserved or Completed.
    Also creates CarbonRecord on completion.
    """
    listing = instance.listing
    now = timezone.now()

    if instance.status == TransactionStatus.RESERVED:
        if listing.status in (ListingStatus.LIVE, ListingStatus.DRAFT, ListingStatus.RESERVED):
            if listing.status != ListingStatus.RESERVED:
                listing.status = ListingStatus.RESERVED
                listing.save(update_fields=['status', 'updated_at'])

    elif instance.status == TransactionStatus.COMPLETED:
        if listing.status != ListingStatus.SOLD:
            listing.status = ListingStatus.SOLD
            listing.save(update_fields=['status', 'updated_at'])

        if not instance.completed_at:
            instance.completed_at = now
            Transaction.objects.filter(id=instance.id).update(completed_at=now)

        # Create or update CarbonRecord
        if not hasattr(instance, 'carbon_record'):
            material = listing.material
            weight_kg = listing.weight_kg
            co2e_kg = calculate_co2_kg(weight_kg, material)
            factor = CO2_FACTORS.get(material, 1.0)
            CarbonRecord.objects.create(
                transaction=instance,
                material=material,
                weight_kg=weight_kg,
                co2e_kg=co2e_kg,
                factor_kg_per_kg=factor,
                notes="LCA estimate vs virgin material (EcoLoop pilot)"
            )

# ─── 3. Message -> Auto Interest Transaction ─────────────────────────────────

@receiver(post_save, sender=Message)
def create_interest_on_first_message(sender, instance, created, **kwargs):
    """
    Replaces lib/messages.ts afterSend() logic.
    When an interested buyer messages the seller of a listing,
    automatically open a Transaction in 'Interest' status if none exists.
    """
    if not created:
        return

    listing = instance.listing
    buyer = instance.sender
    seller = instance.recipient

    # Only when message is from a potential buyer to the listing's actual seller
    if buyer != listing.seller and seller == listing.seller:
        Transaction.objects.get_or_create(
            listing=listing,
            buyer=buyer,
            seller=seller,
            defaults={'status': TransactionStatus.INTEREST}
        )

