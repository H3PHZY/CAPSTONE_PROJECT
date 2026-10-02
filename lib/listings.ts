import { supabase } from "@/lib/supabase";
import type { ClassificationRow, ListingRow, MaterialCategory, ProfileRow } from "@/lib/database.types";
import type { Listing, ListingStatus, MyListing } from "@/lib/types";

const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  Ogba: { lat: 6.6325, lng: 3.337 },
  "Ogba Industrial Estate": { lat: 6.6325, lng: 3.337 },
  Ikeja: { lat: 6.6018, lng: 3.3515 },
  "Ikeja Industrial Estate": { lat: 6.6018, lng: 3.3515 },
  Isolo: { lat: 6.535, lng: 3.322 },
  Apapa: { lat: 6.4474, lng: 3.359 },
};

const VIEWER_DEFAULT = ZONE_COORDS.Ogba;

type ListingJoin = ListingRow & {
  seller?: Pick<ProfileRow, "business_name" | "verified" | "cluster"> | null;
  classifications?:
    | Pick<ClassificationRow, "confidence" | "final_material" | "overridden">
    | Pick<ClassificationRow, "confidence" | "final_material" | "overridden">[]
    | null;
};

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parsePriceNgn(raw: string): number | null {
  const n = parseFloat(String(raw).replace(/,/g, "").replace(/₦/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function formatPriceNgn(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-NG");
}

function coordsFor(listing: Pick<ListingRow, "lat" | "lng" | "zone">) {
  if (listing.lat != null && listing.lng != null) {
    return { lat: listing.lat, lng: listing.lng };
  }
  const zone = listing.zone ?? "";
  return ZONE_COORDS[zone] ?? VIEWER_DEFAULT;
}

function classificationOf(row: ListingJoin) {
  const raw = row.classifications;
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

/** Cover first, then extras — de-duplicated, empty strings dropped. */
export function listingPhotoGallery(row: Pick<ListingRow, "photo_url" | "photo_urls">): string[] {
  const extras = Array.isArray(row.photo_urls) ? row.photo_urls : [];
  const all = [row.photo_url, ...extras].filter(
    (u): u is string => Boolean(u && String(u).trim())
  );
  return [...new Set(all)];
}

export function mapListingRow(
  row: ListingJoin,
  viewer = VIEWER_DEFAULT
): Listing {
  const cls = classificationOf(row);
  const distance = Math.round(haversineKm(viewer, coordsFor(row)) * 10) / 10;
  const photoUrls = listingPhotoGallery(row);
  const photoUrl = photoUrls[0] ?? row.photo_url;

  return {
    id: row.id,
    title: row.title,
    material: (cls?.final_material ?? row.material) as MaterialCategory,
    weight: Number(row.weight_kg),
    price: formatPriceNgn(row.price_ngn),
    distance,
    seller: row.seller?.business_name || "EcoLoop seller",
    verified: Boolean(row.seller?.verified),
    conf: Math.round(Number(cls?.confidence ?? 0.8) * 100),
    zone: row.zone || row.seller?.cluster || "Ogba",
    photo: photoUrl || "photo pending",
    photoUrl,
    photoUrls,
    status: row.status,
    views: row.views,
    createdAt: row.created_at,
  };
}

export function toMyListing(row: ListingRow): MyListing {
  const created = new Date(row.created_at);
  const date = created.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const photoUrls = listingPhotoGallery(row);
  return {
    id: row.id,
    title: row.title,
    ref: `ECL-${row.id.slice(0, 8).toUpperCase()}`,
    date,
    material: row.material,
    weight: Number(row.weight_kg),
    price: formatPriceNgn(row.price_ngn),
    status: row.status as ListingStatus,
    views: row.views,
    photoUrl: photoUrls[0] ?? row.photo_url,
    photoUrls,
  };
}

const LISTING_SELECT = `
  *,
  seller:profiles!seller_id (
    business_name,
    verified,
    cluster
  ),
  classifications (
    confidence,
    final_material,
    overridden
  )
`;

export async function fetchLiveListings(viewerCluster?: string | null) {
  const viewer =
    (viewerCluster && ZONE_COORDS[viewerCluster]) || VIEWER_DEFAULT;

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "Live")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ListingJoin[]).map((row) => mapListingRow(row, viewer));
}

export async function fetchListingById(id: string, viewerCluster?: string | null) {
  const viewer =
    (viewerCluster && ZONE_COORDS[viewerCluster]) || VIEWER_DEFAULT;

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapListingRow(data as ListingJoin, viewer);
}

export async function fetchMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ListingRow[]).map(toMyListing);
}

export type CreateListingInput = {
  sellerId: string;
  title: string;
  material: MaterialCategory;
  weightKg: number;
  priceNgn: number | null;
  photoUrl: string;
  zone: string;
  predictedMaterial: MaterialCategory;
  confidence: number;
  overridden: boolean;
  modelId?: string;
};

export async function createLiveListing(input: CreateListingInput) {
  const zoneCoords = ZONE_COORDS[input.zone] ?? VIEWER_DEFAULT;

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      seller_id: input.sellerId,
      title: input.title.trim(),
      material: input.material,
      weight_kg: input.weightKg,
      price_ngn: input.priceNgn,
      status: "Live",
      photo_url: input.photoUrl,
      zone: input.zone,
      lat: zoneCoords.lat,
      lng: zoneCoords.lng,
    })
    .select("*")
    .single();

  if (error) throw error;

  const { error: classError } = await supabase.from("classifications").insert({
    listing_id: listing.id,
    predicted_material: input.predictedMaterial,
    confidence: input.confidence,
    overridden: input.overridden,
    final_material: input.material,
    model_id: input.modelId || "hf-endpoint",
  });

  if (classError) throw classError;
  return listing as ListingRow;
}

export async function fetchOwnedListing(listingId: string, sellerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) throw error;
  return (data as ListingRow | null) ?? null;
}

export type UpdateListingInput = {
  title: string;
  weightKg: number;
  priceNgn: number | null;
  status: ListingStatus;
  photoUrl: string | null;
  photoUrls: string[];
  zone?: string;
};

export async function updateOwnedListing(
  listingId: string,
  sellerId: string,
  input: UpdateListingInput
) {
  const cover = input.photoUrl?.trim() || null;
  const extras = input.photoUrls
    .map((u) => u.trim())
    .filter((u) => u && u !== cover);

  const patch: Partial<ListingRow> = {
    title: input.title.trim(),
    weight_kg: input.weightKg,
    price_ngn: input.priceNgn,
    status: input.status,
    photo_url: cover,
    photo_urls: extras,
  };
  if (input.zone) {
    const zoneCoords = ZONE_COORDS[input.zone] ?? VIEWER_DEFAULT;
    patch.zone = input.zone;
    patch.lat = zoneCoords.lat;
    patch.lng = zoneCoords.lng;
  }

  const { data, error } = await supabase
    .from("listings")
    .update(patch)
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ListingRow;
}

/** Removes a Draft/Live listing owned by the seller. Clears open Interest first. */
export async function deleteOwnedListing(listingId: string, sellerId: string) {
  const row = await fetchOwnedListing(listingId, sellerId);
  if (!row) throw new Error("Listing not found, or you are not the seller.");

  if (row.status === "Reserved" || row.status === "Sold") {
    throw new Error(
      "Reserved or sold listings can’t be deleted (exchange history). Set status to Live or Draft only if the deal is cancelled, or leave it for records."
    );
  }

  // Clear open interest so listings FK (on delete restrict) does not block.
  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("listing_id", listingId)
    .eq("seller_id", sellerId)
    .in("status", ["Interest", "Cancelled"]);

  if (txError) throw txError;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .in("status", ["Draft", "Live"]);

  if (error) {
    if (/policy|permission|row-level/i.test(error.message)) {
      throw new Error(
        "Run supabase/migrations/009_seller_delete_listings.sql in the Supabase SQL Editor, then try again."
      );
    }
    if (/foreign key|restrict/i.test(error.message)) {
      throw new Error(
        "This listing still has a reserved or completed exchange, so it can’t be deleted."
      );
    }
    throw error;
  }
}

export async function bumpListingViews(id: string, current: number) {
  await supabase.from("listings").update({ views: current + 1 }).eq("id", id);
}
