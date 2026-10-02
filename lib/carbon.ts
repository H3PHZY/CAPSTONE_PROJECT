import type { Listing, MaterialCategory } from "./types";

/** LCA-based kg CO₂e per kg of recovered material vs virgin extraction */
export const CO2: Record<MaterialCategory, number> = {
  Metal: 4.2,
  Plastic: 1.9,
  Glass: 0.6,
  Biodegradable: 0.9,
  Rubber: 2.4,
};

export function co2Of(
  listing: Pick<Listing, "weight" | "material"> | { weight: number; material: MaterialCategory }
): number {
  return Math.round(listing.weight * (CO2[listing.material] ?? 1));
}

export function co2FromWeight(weight: number, material: MaterialCategory): number {
  return Math.round(weight * (CO2[material] ?? 1));
}
