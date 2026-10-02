/**
 * Listings API – create and fetch seller listings.
 * Uses VITE_SCAN_API_URL and auth token from auth.js.
 */

import { getAuthToken } from "../utils/auth";
import { getApiBaseUrl } from "../utils/apiConfig";
import { getFriendlyMessage } from "../utils/errorMessages";
import { LISTING_PUBLISHED, LISTING_UPDATED } from "../utils/successMessages";

function authHeaders() {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function authHeadersNoContentType() {
  const token = getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const header = parts[0];
  const base64 = parts[1];
  const match = /data:(.*);base64/.exec(header);
  const mime = match && match[1] ? match[1] : "application/octet-stream";
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Fetch current user's listings (my-listings).
 * GET /api/v1/listings/my-listings
 * 200 Listings retrieved successfully: {
 *   listings: Array<{
 *     id: string (uuid),
 *     title: string,
 *     description: string,
 *     materialType: string,
 *     quantity: number,
 *     unit: string,
 *     price: number,
 *     currency: string,
 *     imageUrl: string,
 *     latitude: number,
 *     longitude: number,
 *     location: string,
 *     status: string,
 *     notes: string,
 *     co2Saved: number,
 *     recyclability: number,
 *     detectedItems: string[],
 *     totalWeight: number,
 *     carbonFootprint: number,
 *     state: string,
 *     seller: { id, name, email, phoneNumber, username },
 *     createdAt: string (ISO),
 *     updatedAt: string (ISO)
 *   }>,
 *   count: number
 * }
 * 401: { error: string, details?: [{ field, message }] }
 * @returns {Promise<{ listings: Array<object>, count: number }>}
 * @throws {Error} on 401 (unauthorized), 4xx/5xx; err.details set when present
 */
export async function getListings() {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/listings/my-listings`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const raw = data.message || data.error || (details[0]?.message) || "";
    const msg = getFriendlyMessage(res.status, raw);
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  const list = Array.isArray(data.listings) ? data.listings : [];
  const count = typeof data.count === "number" ? data.count : list.length;
  return { listings: list, count };
}

/**
 * Fetch marketplace listings (all active listings for buyers).
 * GET /api/v1/listings — may return all active if backend supports it; otherwise use getListings (my-listings) or fallback.
 * @returns {Promise<{ listings: Array<object>, count: number }>}
 */
export async function getMarketplaceListings() {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/listings`;
  const res = await fetch(url, { method: "GET", headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { listings: [], count: 0 };
  }
  const list = Array.isArray(data.listings) ? data.listings : [];
  const count = typeof data.count === "number" ? data.count : list.length;
  return { listings: list, count };
}

/**
 * Fetch marketplace listings filtered by state (buyer view).
 * GET /api/v1/marketplace?state=lagos
 * @param {string} [state] - Optional state filter (e.g. "lagos", "abuja")
 * @returns {Promise<{ listings: Array<object>, count: number }>}
 * @throws {Error} on 400 validation error or other 4xx/5xx; err.details, err.status set when present
 */
export async function getMarketplaceListingsByState(state) {
  const base = getApiBaseUrl();
  const q = new URLSearchParams();
  if (state != null && String(state).trim()) {
    q.set("state", String(state).trim());
  }
  const url = `${base}/api/v1/marketplace${q.toString() ? `?${q.toString()}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: authHeaders() });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const msg = data.error || data.message || (details[0]?.message) || `Marketplace listings failed (${res.status})`;
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  const list = Array.isArray(data.listings) ? data.listings : [];
  const count = typeof data.count === "number" ? data.count : list.length;
  return { listings: list, count };
}

/**
 * Fetch listings feed ranked by material match, proximity, and recency.
 * GET /api/v1/listings/feed
 * 200: { listings: Array, scores?: Array<{ listingId, score }>, count: number }
 * 400: Validation error (error, details)
 * @param {object} params - { latitude?: number, longitude?: number, radius?: number, materialType?: string, minPrice?: number, maxPrice?: number, limit?: number, offset?: number }
 * @returns {Promise<{ listings: Array<object>, scores?: Array<object>, count: number }>}
 */
export async function getListingsFeed(params = {}) {
  const base = getApiBaseUrl();
  const q = new URLSearchParams();
  if (params.latitude != null && Number.isFinite(params.latitude)) q.set("latitude", String(params.latitude));
  if (params.longitude != null && Number.isFinite(params.longitude)) q.set("longitude", String(params.longitude));
  if (params.radius != null && Number.isFinite(params.radius)) q.set("radius", String(params.radius));
  if (params.materialType != null && String(params.materialType).trim()) q.set("materialType", String(params.materialType).trim());
  if (params.minPrice != null && Number.isFinite(params.minPrice)) q.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null && Number.isFinite(params.maxPrice)) q.set("maxPrice", String(params.maxPrice));
  if (params.limit != null && Number.isFinite(params.limit)) q.set("limit", String(params.limit));
  if (params.offset != null && Number.isFinite(params.offset)) q.set("offset", String(params.offset));
  const url = `${base}/api/v1/listings/feed${q.toString() ? `?${q.toString()}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const msg = data.error || data.message || (details[0]?.message) || `Feed failed (${res.status})`;
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }
  const list = Array.isArray(data.listings) ? data.listings : [];
  const count = typeof data.count === "number" ? data.count : list.length;
  const scores = Array.isArray(data.scores) ? data.scores : undefined;
  return { listings: list, scores, count };
}

/**
 * Get a single listing by ID.
 * GET /api/v1/listings/{id}
 * Path: id * (string UUID) – Listing ID, e.g. 123e4567-e89b-12d3-a456-426614174000
 * 200: Listing retrieved successfully – { listing: { id, title, description, materialType, quantity, unit, price, currency, imageUrl, location, status, state, seller, createdAt, updatedAt, ... } }
 * 404: Listing not found – { error: "Listing not found" } (err.status === 404)
 * @param {string} id - Listing ID (UUID)
 * @returns {Promise<{ listing: object }>}
 * @throws {Error} on 404 (listing not found), 4xx/5xx; err.details, err.status set when present
 */
export async function getListingById(id) {
  const base = getApiBaseUrl();
  if (!id) {
    throw new Error("Listing ID is required");
  }

  const url = `${base}/api/v1/listings/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const raw = data.message || data.error || (details[0]?.message) || "";
    const msg = getFriendlyMessage(res.status, raw, "listing");
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  return { listing: data.listing ?? data };
}

/**
 * Update listing status.
 * PATCH /api/v1/listings/{id}/status
 * Path: id * (string UUID) – Listing ID
 * Body (application/json): { "status": "COMPLETED" } or other status value
 * 200: { message, listing }
 * 400: { error, details } validation error
 * 401: { error, details } Unauthorized
 * 403: { error, details } Forbidden (SELLER role required)
 * @param {string} id - Listing ID (UUID)
 * @param {string} status - New status (e.g. "COMPLETED", "ACTIVE", "DRAFT")
 * @returns {Promise<{ message: string, listing: object }>}
 * @throws {Error} on 400/401/403/4xx/5xx; err.details, err.status set when present
 */
export async function updateListingStatus(id, status) {
  const base = getApiBaseUrl();
  if (!id) {
    throw new Error("Listing ID is required");
  }

  const url = `${base}/api/v1/listings/${encodeURIComponent(id)}/status`;
  const body = { status: String(status ?? "").trim() };
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const firstMessage = details[0]?.message || data.message || data.error || `Update status failed (${res.status})`;
    const msg = data.error && details.length > 0
      ? `${data.error}: ${details.map((d) => d.message).join("; ")}`
      : firstMessage;
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  const listingPayload =
    data.listing && typeof data.listing === "object"
      ? data.listing
      : data && typeof data === "object" && data.id
        ? data
        : null;
  const listingId = String((listingPayload && listingPayload.id) || id);
  const nextStatus = String(
    (listingPayload && listingPayload.status) || body.status || ""
  ).toUpperCase();
  if (typeof window !== "undefined" && listingId && nextStatus) {
    try {
      window.dispatchEvent(
        new CustomEvent("ecoloop-listing-status-updated", {
          detail: {
            listingId,
            status: nextStatus,
            listing: listingPayload,
          },
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  return {
    message: LISTING_UPDATED,
    listing: data.listing ?? data,
  };
}

/**
 * Create a new listing.
 * POST /api/v1/listings
 * @param {object} payload - { title, materialType, quantity, unit, price, priceUnit?, notes?, image?, allowNegotiation? }
 * @returns {Promise<{ listing: object, message?: string }>}
 * @throws {Error} with .details for validation errors
 */
export async function createListing(payload) {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/listings`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const firstMessage = details[0]?.message || data.message || data.error || `Create listing failed (${res.status})`;
    const msg = data.error && details.length > 0
      ? `${data.error}: ${details.map((d) => d.message).join("; ")}`
      : firstMessage;
    const err = new Error(msg);
    err.details = details;
    throw err;
  }

  return data;
}

/**
 * Create a new listing (manual).
 * POST /api/v1/listings/manual
 * 201: Listing created successfully | 400: Validation error | 401: Unauthorized | 403: Forbidden
 * Expects multipart/form-data:
 * - image*: file (binary)
 * - title*: string
 * - description*: string
 * - materialType*: string
 * - quantity*: number
 * - unit: string
 * - price*: number
 * - currency*: string
 * - state*: string
 * - location?: string
 * - notes?: string
 * @param {object} payload - { image?: string (data URL) | Blob, title, description, materialType, quantity, unit, price, currency, state, location?, notes? }
 * @returns {Promise<object>} Created listing or response body
 * @throws {Error} with .details for validation errors (400)
 */
export async function createListingManual(payload) {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/listings/manual`;
  const form = new FormData();

  if (payload.image instanceof Blob) {
    form.append("image", payload.image, payload.imageName || "listing-image.png");
  } else if (typeof payload.image === "string" && payload.image.startsWith("data:")) {
    const blob = dataUrlToBlob(payload.image);
    if (blob) form.append("image", blob, payload.imageName || "listing-image.png");
  }

  form.append("title", String(payload.title ?? "").trim());
  form.append("description", String(payload.description ?? "").trim());
  form.append("materialType", String(payload.materialType ?? "").trim());
  if (payload.quantity != null) {
    form.append("quantity", String(Number(payload.quantity) || 0));
  }
  if (payload.unit != null) {
    form.append("unit", String(payload.unit ?? "").trim());
  }
  form.append("price", String(Number(payload.price) || 0));
  form.append("currency", String(payload.currency ?? "").trim());
  form.append("state", String(payload.state ?? "").trim());
  if (payload.location != null) {
    form.append("location", String(payload.location ?? "").trim());
  }
  if (payload.notes != null) {
    form.append("notes", String(payload.notes ?? "").trim());
  }

  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersNoContentType(),
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const firstMessage = details[0]?.message || data.message || data.error || `Create listing failed (${res.status})`;
    const msg = data.error && details.length > 0
      ? `${data.error}: ${details.map((d) => d.message).join("; ")}`
      : firstMessage;
    const err = new Error(msg);
    err.details = details;
    throw err;
  }

  return { ...data, message: LISTING_PUBLISHED };
}

/**
 * Analyze material image (scan-only; does not create a listing).
 * POST /api/v1/listings/ai with scanOnly=true (same path as create listing using AI Scan).
 * Responses: 200 with analysis (materialType, confidence, etc.) | 400 Image missing | 502 AI analysis failed
 * @param {string|File|Blob} imageDataUrl - Data URL string or File/Blob
 * @param {string} [materialType] - Optional material type to send as title (satisfies backend validation); fallback "Scanned Item"
 * @returns {Promise<{ materialType: string, subtype: string, confidence: number, recycled: boolean, priceMin?: number, priceMax?: number, demandNote?: string }>}
 */
export async function analyzeListingImage(imageDataUrl, materialType) {
  const base = getApiBaseUrl();
  const form = new FormData();

  if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    form.append("image", blob, "image.jpg");
  } else if (imageDataUrl instanceof File || imageDataUrl instanceof Blob) {
    form.append("image", imageDataUrl, imageDataUrl instanceof File ? imageDataUrl.name : "image.jpg");
  } else {
    throw new Error("Image missing");
  }

  form.append("scanOnly", "true");
  form.append("title", (materialType && String(materialType).trim()) || "Scanned Item");
  form.append("description", "");
  form.append("price", "0");
  form.append("currency", "NGN");
  form.append("state", "");
  form.append("location", "");
  form.append("notes", "");

  const url = `${base}/api/v1/listings/ai`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersNoContentType(),
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.message ||
      data.error ||
      (res.status === 400 ? "Image missing" : res.status === 502 ? "AI analysis failed" : `AI analysis failed (${res.status})`);
    const err = new Error(msg);
    err.details = Array.isArray(data.details) ? data.details : [];
    err.status = res.status;
    throw err;
  }

  const raw = data.listing ?? data.analysis ?? data;
  const toNum = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : undefined);
  // Backend AI endpoint returns "title" for the detected material; UI shows this as "Material Type"
  const detectedMaterialType = raw?.materialType ?? raw?.title ?? raw?.material_type ?? "Unknown";
  return {
    materialType: detectedMaterialType,
    subtype: raw?.subtype ?? raw?.sub_type ?? "—",
    confidence: typeof raw?.confidence === "number" ? raw.confidence : (toNum(raw?.confidence) ?? 0),
    recycled: Boolean(raw?.recycled),
    priceMin: toNum(raw?.priceMin ?? raw?.minPrice ?? raw?.price_min ?? raw?.suggestedPriceLow),
    priceMax: toNum(raw?.priceMax ?? raw?.maxPrice ?? raw?.price_max ?? raw?.suggestedPriceHigh),
    demandNote: typeof raw?.demandNote === "string" ? raw.demandNote : raw?.demand_note,
  };
}

/**
 * Create listing using AI Scan.
 * POST /api/v1/listings/ai (CREATE LISTING USING AI Scan)
 * Content-Type: multipart/form-data
 * Body: image * (binary), title * (string), description (string), price * (number), currency (string), state (string), location (string), notes (string), allowNegotiation (optional)
 * - quantity (number), unit (string), materialType (string) are also sent when provided.
 * Responses: 201 AI listing created successfully | 400 Image missing | 502 AI analysis failed (no links in response)
 * @param {object} payload - { image: File|Blob|string (data URL), title: string, description?: string, price: number, currency?: string, state?: string, location?: string, notes?: string, materialType?: string, quantity?: number, unit?: string, allowNegotiation?: boolean }
 * @returns {Promise<object>} Response body (listing/id optional)
 */
export async function createListingAi(payload) {
  const base = getApiBaseUrl();
  const form = new FormData();

  let imageValue = payload.image;
  if (imageValue instanceof File || imageValue instanceof Blob) {
    form.append("image", imageValue);
  } else if (typeof imageValue === "string" && imageValue.length > 0) {
    if (imageValue.startsWith("data:")) {
      const res = await fetch(imageValue);
      const blob = await res.blob();
      form.append("image", blob, "image.jpg");
    } else {
      form.append("image", imageValue);
    }
  } else {
    throw new Error("Image missing");
  }

  form.append("title", String(payload.title ?? "").trim());
  form.append("description", String(payload.description ?? "").trim());
  form.append("price", String(Number(payload.price) ?? 0));
  form.append("currency", String(payload.currency ?? "NGN").trim());
  form.append("state", String(payload.state ?? "Lagos").trim());
  form.append("location", String(payload.location ?? "").trim());
  form.append("notes", String(payload.notes ?? "").trim());
  if (payload.materialType != null) {
    form.append("materialType", String(payload.materialType ?? "").trim());
  }
  if (payload.quantity != null) {
    form.append("quantity", String(Number(payload.quantity) || 0));
  }
  if (payload.unit != null) {
    form.append("unit", String(payload.unit ?? "").trim());
  }
  if (payload.allowNegotiation === true) {
    form.append("allowNegotiation", "true");
  }

  const url = `${base}/api/v1/listings/ai`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersNoContentType(),
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.message ||
      data.error ||
      (res.status === 400 ? "Image missing" : res.status === 502 ? "AI analysis failed" : `AI listing failed (${res.status})`);
    const err = new Error(msg);
    err.details = Array.isArray(data.details) ? data.details : [];
    err.status = res.status;
    throw err;
  }

  // 201: backend returns no links; listing/id may be absent
  return { ...data, message: data.message || LISTING_PUBLISHED };
}
