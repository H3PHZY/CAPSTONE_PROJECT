from rest_framework import permissions
from api.models import ListingStatus

class IsProfileOwnerOrReadOnly(permissions.BasePermission):
    """
    Profiles are publicly readable; only the owner may update them.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user

class IsListingOwnerOrPublicReadOnly(permissions.BasePermission):
    """
    Live listings are public; sellers can view their own private listings.
    Only the owner may update an open draft or live listing.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            if obj.status == ListingStatus.LIVE:
                return True
            return request.user.is_authenticated and obj.seller == request.user
        return (
            request.user.is_authenticated
            and obj.seller == request.user
            and obj.status in (ListingStatus.DRAFT, ListingStatus.LIVE)
        )

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
    Only the buyer or seller involved in a transaction may access it.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return request.user == obj.buyer or request.user == obj.seller

class IsMessageParticipant(permissions.BasePermission):
    """
    Only a message's sender or recipient may access it.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return request.user == obj.sender or request.user == obj.recipient
