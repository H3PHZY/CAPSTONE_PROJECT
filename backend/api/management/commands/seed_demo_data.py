from decimal import Decimal
from datetime import date
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
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
from api.utils import calculate_co2_kg, CO2_FACTORS

User = get_user_model()

class Command(BaseCommand):
    help = "Seeds repeatable EcoLoop demo data for two users and sample listings."

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            help='Password assigned only to demo users newly created by this command.',
        )

    def handle(self, *args, **options):
        password = options.get('password')
        existing_demo_users = User.objects.filter(
            username__in=["seller@ecoloop.ng", "buyer@ecoloop.ng"]
        ).count()
        if not password and existing_demo_users < 2:
            raise CommandError('Pass --password to set credentials for newly created demo users.')
        self.stdout.write("Seeding EcoLoop demo data...")

        # 1. Create Demo Users & Profiles
        seller, seller_created = User.objects.get_or_create(
            username="seller@ecoloop.ng",
            defaults={"email": "seller@ecoloop.ng"},
        )
        if seller_created:
            seller.set_password(password)
            seller.save(update_fields=['password'])
        p1 = seller.profile
        p1.date_of_birth = p1.date_of_birth or date(1990, 1, 1)
        p1.business_name = "Rehoboth Metalworks Ltd"
        p1.phone = "+234 803 111 2233"
        p1.cluster = "Ogba"
        p1.zone = "Ogba Industrial Estate"
        p1.sells = True
        p1.buys = False
        p1.carbon_impact = True
        p1.research_consent = True
        p1.save()

        buyer, buyer_created = User.objects.get_or_create(
            username="buyer@ecoloop.ng",
            defaults={"email": "buyer@ecoloop.ng"},
        )
        if buyer_created:
            buyer.set_password(password)
            buyer.save(update_fields=['password'])
        p2 = buyer.profile
        p2.date_of_birth = p2.date_of_birth or date(1990, 1, 1)
        p2.business_name = "Loop Recyclers Lagos"
        p2.phone = "+234 802 444 5566"
        p2.cluster = "Ikeja"
        p2.zone = "Ikeja Industrial Estate"
        p2.sells = False
        p2.buys = True
        p2.carbon_impact = True
        p2.research_consent = True
        p2.save()

        # 2. Seed Sample Listings
        listings_data = [
            {
                "seller": seller,
                "title": "Aluminium sheet offcuts, 1.5–3mm",
                "material": MaterialCategory.METAL,
                "weight_kg": Decimal("180.00"),
                "price_ngn": Decimal("52000.00"),
                "status": ListingStatus.LIVE,
                "photo_url": "/assets/listings/metal-1.jpeg",
                "photo_urls": ["/assets/listings/metal-1.jpeg", "/assets/listings/metal-2.jpeg"],
                "zone": "Ogba Industrial Estate",
                "confidence": Decimal("0.94"),
            },
            {
                "seller": seller,
                "title": "Clean HDPE plastic drums, 220L blue",
                "material": MaterialCategory.PLASTIC,
                "weight_kg": Decimal("96.00"),
                "price_ngn": Decimal("31500.00"),
                "status": ListingStatus.LIVE,
                "photo_url": "/assets/listings/plastic-1.jpeg",
                "photo_urls": ["/assets/listings/plastic-1.jpeg", "/assets/listings/plastic-2.jpeg"],
                "zone": "Ogba Industrial Estate",
                "confidence": Decimal("0.89"),
            },
            {
                "seller": seller,
                "title": "Pallet timber & softwood battens",
                "material": MaterialCategory.BIODEGRADABLE,
                "weight_kg": Decimal("240.00"),
                "price_ngn": Decimal("18000.00"),
                "status": ListingStatus.LIVE,
                "photo_url": "/assets/listings/wood-1.jpeg",
                "photo_urls": ["/assets/listings/wood-1.jpeg", "/assets/listings/wood-2.jpeg"],
                "zone": "Isolo",
                "confidence": Decimal("0.91"),
            },
            {
                "seller": seller,
                "title": "Industrial conveyor rubber scrap & belts",
                "material": MaterialCategory.RUBBER,
                "weight_kg": Decimal("120.00"),
                "price_ngn": Decimal("28000.00"),
                "status": ListingStatus.LIVE,
                "photo_url": "/assets/listings/bio-1.jpeg",
                "photo_urls": ["/assets/listings/bio-1.jpeg"],
                "zone": "Isolo",
                "confidence": Decimal("0.82"),
            },
            {
                "seller": seller,
                "title": "Clear broken container glass cullet",
                "material": MaterialCategory.GLASS,
                "weight_kg": Decimal("350.00"),
                "price_ngn": Decimal("22000.00"),
                "status": ListingStatus.LIVE,
                "photo_url": "/assets/listings/glass-1.jpeg",
                "photo_urls": ["/assets/listings/glass-1.jpeg"],
                "zone": "Ogba Industrial Estate",
                "confidence": Decimal("0.95"),
            },
        ]

        created_listings = []
        for l_data in listings_data:
            conf = l_data.pop("confidence")
            listing, _ = Listing.objects.get_or_create(
                title=l_data["title"],
                seller=l_data["seller"],
                defaults=l_data
            )
            Classification.objects.get_or_create(
                listing=listing,
                defaults={
                    "predicted_material": listing.material,
                    "confidence": conf,
                    "overridden": False,
                    "final_material": listing.material,
                    "model_id": "google/vit-base-patch16-224 (ImageNet → EcoLoop map)",
                }
            )
            created_listings.append(listing)

        # 3. Seed Transactions
        l1 = created_listings[0]
        t1, _ = Transaction.objects.get_or_create(
            listing=l1,
            buyer=buyer,
            seller=seller,
            defaults={
                "status": TransactionStatus.COMPLETED,
                "completed_at": timezone.now(),
                "paid_at": timezone.now(),
                "payment_ref": "DEMO-PAYMENT-ALUMINIUM-01",
                "amount_ngn": l1.price_ngn,
                "currency": "NGN",
            }
        )
        if t1.paid_at is None:
            t1.paid_at = timezone.now()
            t1.payment_ref = t1.payment_ref or "DEMO-PAYMENT-ALUMINIUM-01"
        if t1.completed_at is None:
            t1.completed_at = timezone.now()
        if t1.amount_ngn is None:
            t1.amount_ngn = l1.price_ngn
        t1.save(update_fields=['paid_at', 'payment_ref', 'amount_ngn', 'updated_at'])
        if not hasattr(t1, "carbon_record"):
            co2 = calculate_co2_kg(l1.weight_kg, l1.material)
            CarbonRecord.objects.create(
                transaction=t1,
                material=l1.material,
                weight_kg=l1.weight_kg,
                co2e_kg=co2,
                factor_kg_per_kg=CO2_FACTORS.get(l1.material, Decimal("1.0")),
                notes="LCA estimate vs virgin material (EcoLoop pilot)"
            )

        # 4. Seed Messages
        Message.objects.get_or_create(
            listing=l1,
            sender=buyer,
            recipient=seller,
            body="Good afternoon. I saw your aluminium offcuts listing — is the full 180 kg still available?"
        )
        Message.objects.get_or_create(
            listing=l1,
            sender=seller,
            recipient=buyer,
            body="Yes, all 180 kg is available. Mixed gauge, mostly 1.5–3 mm sheet, dry and free of paint."
        )

        self.stdout.write(self.style.SUCCESS("EcoLoop demo data successfully seeded!"))
        self.stdout.write("Demo users: seller@ecoloop.ng and buyer@ecoloop.ng")
        self.stdout.write("Use the password passed to --password for users created by this run.")
