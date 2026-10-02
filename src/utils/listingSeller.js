/**
 * Seller display name from a listing object as returned by the backend.
 * Supports top-level sellerName and nested seller.name (and common fallbacks).
 */
export function getListingSellerDisplayName(listing, fallback = "Seller") {
  if (!listing || typeof listing !== "object") return fallback;
  const top = listing.sellerName;
  if (top != null && String(top).trim()) return String(top).trim();
  const s = listing.seller;
  if (s && typeof s === "object") {
    const n = s.name ?? s.fullName ?? s.username;
    if (n != null && String(n).trim()) return String(n).trim();
  }
  return fallback;
}
