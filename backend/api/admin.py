from django.contrib import admin
from api.models import (
    Profile,
    Listing,
    Classification,
    Transaction,
    CarbonRecord,
    Message,
    Dispute,
)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'cluster', 'verified', 'sells', 'buys', 'carbon_impact', 'created_at')
    list_filter = ('cluster', 'verified', 'sells', 'buys', 'carbon_impact')
    search_fields = ('business_name', 'phone', 'user__email')

class ClassificationInline(admin.StackedInline):
    model = Classification
    extra = 0

@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('title', 'material', 'weight_kg', 'price_ngn', 'status', 'seller', 'views', 'created_at')
    list_filter = ('status', 'material', 'zone')
    search_fields = ('title', 'seller__email', 'seller__profile__business_name')
    inlines = [ClassificationInline]

@admin.register(Classification)
class ClassificationAdmin(admin.ModelAdmin):
    list_display = ('listing', 'final_material', 'predicted_material', 'confidence', 'overridden', 'model_id')
    list_filter = ('final_material', 'overridden')

class CarbonRecordInline(admin.StackedInline):
    model = CarbonRecord
    extra = 0

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('listing', 'status', 'buyer', 'seller', 'completed_at', 'created_at')
    list_filter = ('status',)
    search_fields = ('listing__title', 'buyer__email', 'seller__email')
    inlines = [CarbonRecordInline]

@admin.register(CarbonRecord)
class CarbonRecordAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'material', 'weight_kg', 'co2e_kg', 'factor_kg_per_kg', 'created_at')
    list_filter = ('material',)

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('listing', 'sender', 'recipient', 'body_preview', 'created_at')
    search_fields = ('body', 'sender__email', 'recipient__email', 'listing__title')

    def body_preview(self, obj):
        return obj.body[:40]
    body_preview.short_description = 'Body'

@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'raised_by', 'status', 'created_at', 'updated_at')
    list_filter = ('status',)
    search_fields = ('transaction__listing__title', 'raised_by__email', 'reason')
    readonly_fields = ('transaction', 'raised_by', 'reason', 'created_at')
