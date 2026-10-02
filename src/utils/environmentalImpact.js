/**
 * Environmental impact calculations for create-listing review.
 * CO₂: ~500 kg CO₂ equivalent saved per ton of material recycled (industry estimate).
 * Recyclability: percentage by material type (typical recyclability rates).
 */

const CO2_KG_PER_TON_MATERIAL = 500;
const STORAGE_KEYS = {
  quantity: "ecoloop_create_listing_quantity",
  unit: "ecoloop_create_listing_unit",
  materialType: "ecoloop_create_listing_material_type",
  description: "ecoloop_create_listing_description",
  listingState: "ecoloop_create_listing_state",
  location: "ecoloop_create_listing_location",
  currency: "ecoloop_create_listing_currency",
  notes: "ecoloop_create_listing_notes",
};

/** Default quantity in tons if not set */
const DEFAULT_QUANTITY_TONS = 5;

/**
 * Get quantity in tons from sessionStorage (set by Material Details or Input Details step).
 * @returns {number} Quantity in tons
 */
export function getQuantityTonsFromStorage() {
  if (typeof sessionStorage === "undefined") return DEFAULT_QUANTITY_TONS;
  const raw = sessionStorage.getItem(STORAGE_KEYS.quantity);
  const unit = (sessionStorage.getItem(STORAGE_KEYS.unit) || "tons").toLowerCase();
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
  if (num <= 0) return DEFAULT_QUANTITY_TONS;
  if (unit === "pcs") return 0;
  if (unit.includes("kg")) return num / 1000;
  return num;
}

/**
 * Whether the user has set a quantity in storage (non-empty and > 0).
 * @returns {boolean}
 */
export function hasQuantityInStorage() {
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(STORAGE_KEYS.quantity);
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
  return raw != null && String(raw).trim() !== "" && num > 0;
}

/**
 * Get material type string from sessionStorage (set by Material Details or Scan).
 * @returns {string}
 */
export function getMaterialTypeFromStorage() {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(STORAGE_KEYS.materialType) || "";
}

/**
 * CO₂ savings: kg CO₂ equivalent saved = quantity (tons) * 500.
 * @param {number} quantityTons - Quantity in tons
 * @returns {{ valueKg: number, display: string }} valueKg and a display string (e.g. "1.2 Tons" or "450 kg")
 */
export function getCo2Savings(quantityTons) {
  const tons = Number(quantityTons) || 0;
  const valueKg = tons * CO2_KG_PER_TON_MATERIAL;
  const valueTons = valueKg / 1000;
  const display = valueTons >= 0.1 ? `${valueTons.toFixed(1)} Tons` : `${Math.round(valueKg)} kg`;
  return { valueKg, display };
}

/**
 * Recyclability percentage by material type (keyword match).
 * @param {string} materialType - Material type string (e.g. "Polyethylene (PE)", "Aluminum")
 * @returns {number} Percentage 0–100
 */
export function getRecyclabilityPercent(materialType) {
  const s = String(materialType || "").toLowerCase();
  if (!s) return 85;
  if (s.includes("aluminum") || s.includes("aluminium") || s.includes("metal") || s.includes("copper") || s.includes("steel")) return 92;
  if (s.includes("paper") || s.includes("cardboard") || s.includes("occ")) return 88;
  if (s.includes("glass")) return 90;
  if (s.includes("pet") || s.includes("hdpe") || s.includes("pe ") || s.includes("polyethylene") || s.includes("plastic")) return 85;
  if (s.includes("mixed") || s.includes("general")) return 75;
  return 85;
}

export { STORAGE_KEYS };
