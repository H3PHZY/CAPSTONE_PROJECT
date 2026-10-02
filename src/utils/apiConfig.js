/**
 * Backend API base URL. Used by auth, listings, transactions, scan.
 * Set VITE_SCAN_API_URL in .env (no trailing slash). Not exposed to Git.
 */
const API_BASE_URL = import.meta.env.VITE_SCAN_API_URL ?? "https://ecoloop-backend-1rqo.onrender.com";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

/**
 * Resolve listing image URL from API response (camelCase or snake_case).
 * If the value is a relative path (e.g. /uploads/...), prepends API base URL so images load.
 * @param {object} listing - Listing/row from API (may have imageUrl, image, image_url, thumb)
 * @param {string} [fallback] - Fallback URL when no image is present
 * @returns {string} Absolute image URL or fallback
 */
export function getListingImageUrl(listing, fallback = "") {
  const raw =
    (listing && (listing.imageUrl ?? listing.image ?? listing.image_url ?? listing.thumb)) || "";
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) return fallback || "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:"))
    return url;
  if (url.startsWith("/")) return `${API_BASE_URL.replace(/\/$/, "")}${url}`;
  return url;
}
