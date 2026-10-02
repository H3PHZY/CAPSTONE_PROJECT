/**
 * Buyer progress level from materials sourced (tons).
 * Tiers: Bronze → Silver → Gold → Platinum.
 * Bar = progress through current tier (0–100%).
 */

const PROGRESS_TIERS = [
  { name: "Bronze", minTons: 0, maxTons: 1 },
  { name: "Silver", minTons: 1, maxTons: 3 },
  { name: "Gold", minTons: 3, maxTons: 8 },
  { name: "Platinum", minTons: 8, maxTons: Infinity },
];

export function computeBuyerProgressLevel(materialsSourcedTons) {
  const tons = Number(materialsSourcedTons) || 0;
  const tierIndex = PROGRESS_TIERS.findIndex((t) => tons < t.maxTons);
  const tier = PROGRESS_TIERS[Math.min(Math.max(tierIndex, 0), PROGRESS_TIERS.length - 1)];
  const tierNum = PROGRESS_TIERS.indexOf(tier) + 1;
  const range = tier.maxTons === Infinity ? 5 : tier.maxTons - tier.minTons;
  const progressInTier = range > 0 ? Math.min(1, (tons - tier.minTons) / range) : 0;
  const fillPct = Math.min(100, Math.max(0, Math.round(progressInTier * 100)));
  return { tierName: tier.name, tierNum, fillPct };
}

