/**
 * Draft listings may still appear with zero price while being edited.
 * Non-draft listings with price <= 0 are hidden from Listings, Inventory, Marketplace, Search, and Producer Dashboard.
 * Accepts API listing objects, normalized rows (`price` as number or formatted string), or dashboard rows with `priceNum`.
 */
export function includeListingUnlessNonDraftZeroPrice(listing) {
  if (!listing || typeof listing !== "object") return false;
  const status = String(listing.status ?? "").toUpperCase();
  if (status === "DRAFT") return true;
  let p = Number(listing.price);
  if (!Number.isFinite(p) && listing.priceNum != null) {
    p = Number(listing.priceNum);
  }
  if (!Number.isFinite(p) && listing.price != null && listing.price !== "") {
    p = Number(String(listing.price).replace(/,/g, ""));
  }
  return Number.isFinite(p) && p > 0;
}
