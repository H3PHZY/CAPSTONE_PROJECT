from rest_framework import permissions
from api.models import ListingStatus

class IsProfileOwnerOrReadOnly(permissions.BasePermission):
    """
    Translates Supabase profile policies:
    - Profiles are publicly readable.
    - Only the user can update their own profile.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user

class IsListingOwnerOrPublicReadOnly(permissions.BasePermission):
    """
    Translates Supabase listings policies:
    - Live listings are publicly readable by anyone (guests & authenticated).
    - Sellers can view their own draft/reserved/sold listings.
    - Only the listing owner can update or delete.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            if obj.status == ListingStatus.LIVE:
                return True
            return request.user.is_authenticated and obj.seller == request.user
        return request.user.is_authenticated and obj.seller == request.user

class CanDeleteListing(permissions.BasePermission):
    """
    Translates migration 009_seller_delete_listings.sql:
    - Sellers can only delete their own open listings in 'Draft' or 'Live' status.
    - Listings that are 'Reserved' or 'Sold' cannot be deleted to protect exchange history.
    """
    def has_object_permission(self, request, view, obj):
        if request.method != 'DELETE':
            return True
        if obj.seller != request.user:
            return False
        return obj.status in (ListingStatus.DRAFT, ListingStatus.LIVE)

class IsTransactionParty(permissions.BasePermission):
    """
    Translates Supabase transactions policies:
    - Only the buyer or the seller involved in the transaction can view or update it.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return request.user == obj.buyer or request.user == obj.seller

class IsMessageParticipant(permissions.BasePermission):
    """
    Translates Supabase messages policies:
    - Only sender or recipient can read or participate in messages.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return request.user == obj.sender or request.user == obj.recipient

