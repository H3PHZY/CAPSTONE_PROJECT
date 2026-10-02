/**
 * Producer level (tier) based on total revenue in Naira.
 * Tiers: Bronze < ₦1M, Silver ₦1M–₦5M, Gold ₦5M–₦20M, Platinum ≥ ₦20M.
 * Progress bar = progress within current tier toward next tier (0–100%).
 */

const TIERS = [
  { id: 1, name: "Bronze", min: 0, max: 1_000_000 },
  { id: 2, name: "Silver", min: 1_000_000, max: 5_000_000 },
  { id: 3, name: "Gold", min: 5_000_000, max: 20_000_000 },
  { id: 4, name: "Platinum", min: 20_000_000, max: Infinity },
];

const USD_TO_NGN = 1500;

/**
 * @param {number} revenueNaira - Total revenue in Naira (from listings/transactions)
 * @returns {{ tier: number, tierLabel: string, progressPercent: number }}
 */
export function getProducerLevel(revenueNaira) {
  const n = Number(revenueNaira) || 0;
  const tierIndex = TIERS.findIndex((t) => n < t.max);
  const tier = tierIndex >= 0 ? TIERS[tierIndex] : TIERS[TIERS.length - 1];
  const nextTier = TIERS[tierIndex + 1];
  let progressPercent = 100;
  if (nextTier && tier.max !== Infinity) {
    const range = nextTier.min - tier.min;
    const progress = n - tier.min;
    progressPercent = Math.min(100, Math.max(0, (progress / range) * 100));
  }
  return {
    tier: tier.id,
    tierLabel: `Tier ${tier.id}: ${tier.name}`,
    progressPercent: Math.round(progressPercent * 10) / 10,
  };
}

/**
 * Sum revenue in Naira from API listing objects (price + currency).
 * @param {Array<{ price?: number, currency?: string }>} apiListings
 * @returns {number}
 */
export function totalRevenueNairaFromListings(apiListings) {
  return (apiListings || []).reduce((sum, row) => {
    const price = Number(row.price) ?? 0;
    const currency = (row.currency || "").toUpperCase();
    const naira = currency === "NGN" || currency === "NAIRA" ? price : price * USD_TO_NGN;
    return sum + naira;
  }, 0);
}

/**
 * @param {Array<object>} apiListings - Raw listings from API (my-listings)
 * @returns {{ tier: number, tierLabel: string, progressPercent: number }}
 */
export function getProducerLevelFromListings(apiListings) {
  return getProducerLevel(totalRevenueNairaFromListings(apiListings));
}
