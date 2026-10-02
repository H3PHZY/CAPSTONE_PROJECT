/**
 * Scan API – frontend client for the material scan (AI/YOLO) backend.
 *
 * Backend contract:
 * - POST {baseUrl}/api/scan
 * - Request body (JSON): { "image": "<data URL string>" }  (e.g. data:image/jpeg;base64,...)
 * - Response (JSON): {
 *     "materialType": string,
 *     "subtype": string,
 *     "confidence": number,   // 0–100
 *     "recycled": boolean,
 *     // Optional AI-generated market price range (per unit, e.g. per ton):
 *     "priceMin"?: number, "priceMax"?: number,
 *     // or "minPrice", "maxPrice", "suggestedPriceLow", "suggestedPriceHigh", "market_price_min", "market_price_max"
 *     "demandNote"?: string
 *   }
 */

import { getFriendlyMessage } from "../utils/errorMessages";
import { getApiBaseUrl } from "../utils/apiConfig";
import { getAuthToken } from "../utils/auth";

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function toNumber(val) {
  if (val == null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeScanResponse(data) {
  const priceMin = toNumber(
    data?.priceMin ?? data?.minPrice ?? data?.suggestedPriceLow ?? data?.market_price_min
  );
  const priceMax = toNumber(
    data?.priceMax ?? data?.maxPrice ?? data?.suggestedPriceHigh ?? data?.market_price_max
  );
  return {
    materialType: data?.materialType ?? "Unknown",
    subtype: data?.subtype ?? "—",
    confidence: typeof data?.confidence === "number" ? data.confidence : 0,
    recycled: Boolean(data?.recycled),
    priceMin,
    priceMax,
    demandNote: typeof data?.demandNote === "string" ? data.demandNote : undefined,
  };
}

/**
 * Call the backend to scan a material image.
 * Tries /api/v1/scan first (same prefix as auth/listings), then /api/scan.
 * Supports both JSON data-url and multipart/form-data (binary) depending on backend implementation.
 * @param {string|File|Blob} imageDataUrl - Data URL string or File/Blob
 * @returns {Promise<{ materialType: string, subtype: string, confidence: number, recycled: boolean, priceMin?: number, priceMax?: number, demandNote?: string }>}
 * @throws {Error} on network or server error
 */
export async function scanMaterialImage(imageDataUrl) {
  const base = getApiBaseUrl();
  const pathsToTry = ["/api/v1/scan", "/api/scan"];
  let lastError = null;

  for (const path of pathsToTry) {
    try {
      const url = `${base}${path}`;
      const token = getAuthToken();

      // 1) Try multipart/form-data (common for image scan endpoints).
      if (
        (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) ||
        imageDataUrl instanceof Blob ||
        imageDataUrl instanceof File
      ) {
        const form = new FormData();
        if (typeof imageDataUrl === "string") {
          const blob = await dataUrlToBlob(imageDataUrl);
          form.append("image", blob, "image.jpg");
        } else {
          form.append("image", imageDataUrl);
        }

        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(url, { method: "POST", headers, body: form });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return normalizeScanResponse(data);
        }
        // If multipart isn't supported, fall back to JSON attempt below.
      }

      // 2) Try JSON data-url (legacy contract).
      if (typeof imageDataUrl !== "string") {
        lastError = new Error("Invalid image");
        continue;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!res.ok) {
        const text = await res.text();
        const raw = text || (res.status === 422 || res.status === 400 ? "Invalid image" : "");
        lastError = new Error(getFriendlyMessage(res.status, raw));
        lastError.status = res.status;
        continue;
      }

      const data = await res.json().catch(() => ({}));
      return normalizeScanResponse(data);
    } catch (err) {
      lastError = err;
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        lastError = new Error("Network error: cannot reach scan API. Check CORS, backend is running, and VITE_SCAN_API_URL is correct.");
      }
    }
  }

  throw lastError || new Error("Scan failed");
}
