import type { ClassificationRow, ListingRow, MaterialCategory, ProfileRow } from "@/lib/models";
import { DjangoApiError } from "@/lib/django-auth";
import { djangoListings, type DjangoListing } from "@/lib/django-api";
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

export function getZoneCoordinates(zone: string) {
  return ZONE_COORDS[zone] ?? VIEWER_DEFAULT;
}

type ListingJoin = ListingRow & {
  distance?: number;
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
  return getZoneCoordinates(listing.zone ?? "");
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
  const coords = coordsFor(row);
  const distance =
    row.distance == null
      ? Math.round(haversineKm(viewer, coords) * 10) / 10
      : Math.round(row.distance * 10) / 10;
  const photoUrls = listingPhotoGallery(row);
  const photoUrl = photoUrls[0] ?? row.photo_url;

  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    material: (cls?.final_material ?? row.material) as MaterialCategory,
    weight: Number(row.weight_kg),
    price: formatPriceNgn(row.price_ngn),
    distance,
    seller: row.seller?.business_name || "EcoLoop seller",
    verified: Boolean(row.seller?.verified),
    conf: Math.round(Number(cls?.confidence ?? 0.8) * 100),
    zone: row.zone || row.seller?.cluster || "Ogba",
    address: row.address,
    lat: coords.lat,
    lng: coords.lng,
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

function fromDjangoListing(row: DjangoListing): ListingRow {
  return {
    id: row.id,
    seller_id: row.seller_id,
    title: row.title,
    material: row.material as MaterialCategory,
    weight_kg: Number(row.weight_kg),
    price_ngn: row.price_ngn == null ? null : Number(row.price_ngn),
    status: row.status as ListingStatus,
    photo_url: row.primary_photo_url ?? row.photo_url,
    photo_urls: row.all_photos?.length ? row.all_photos : row.photo_urls ?? [],
    zone: row.zone,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    views: row.views,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function fromDjangoListingJoin(row: DjangoListing): ListingJoin {
  return {
    ...fromDjangoListing(row),
    seller: {
      business_name: row.seller_name,
      verified: row.verified,
      cluster: row.seller_cluster,
    },
    classifications: row.classification
      ? {
          confidence: Number(row.classification.confidence),
          final_material: row.classification.final_material as MaterialCategory,
          overridden: row.classification.overridden,
        }
      : null,
    distance: row.distance,
  };
}

export async function fetchLiveListings(
  viewerCluster?: string | null,
  viewerLocation?: { lat: number | null; lng: number | null }
) {
  const viewer =
    viewerLocation?.lat != null && viewerLocation.lng != null
      ? { lat: viewerLocation.lat, lng: viewerLocation.lng }
      : (viewerCluster && ZONE_COORDS[viewerCluster]) || VIEWER_DEFAULT;
  const rows = await djangoListings.fetchLive({
    cluster: viewerCluster,
    lat: viewerLocation?.lat,
    lng: viewerLocation?.lng,
  });
  return rows
    .filter((row) => row.status === "Live")
    .map((row) => mapListingRow(fromDjangoListingJoin(row), viewer));
}

export async function fetchListingById(
  id: string,
  viewerCluster?: string | null,
  viewerLocation?: { lat: number | null; lng: number | null }
) {
  const viewer =
    viewerLocation?.lat != null && viewerLocation.lng != null
      ? { lat: viewerLocation.lat, lng: viewerLocation.lng }
      : (viewerCluster && ZONE_COORDS[viewerCluster]) || VIEWER_DEFAULT;
  try {
    const row = await djangoListings.fetchById(id, {
      cluster: viewerCluster,
      lat: viewerLocation?.lat,
      lng: viewerLocation?.lng,
    });
    return mapListingRow(fromDjangoListingJoin(row), viewer);
  } catch (error) {
    if (error instanceof DjangoApiError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchMyListings() {
  const rows = await djangoListings.fetchMine();
  return rows.map((row) => toMyListing(fromDjangoListing(row)));
}

export async function publishOwnedListing(listingId: string) {
  return djangoListings.publish(listingId);
}

export type CreateListingInput = {
  sellerId: string;
  title: string;
  material: MaterialCategory;
  weightKg: number;
  priceNgn: number | null;
  photoUrl: string;
  zone: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  predictedMaterial: MaterialCategory;
  confidence: number;
  overridden: boolean;
  modelId?: string;
  isDraft?: boolean;
};

export async function createLiveListing(input: CreateListingInput) {
  const created = await djangoListings.create({
    title: input.title.trim(),
    material: input.material,
    weight_kg: input.weightKg,
    price_ngn: input.priceNgn,
    photo_url: input.photoUrl,
    zone: input.zone,
    address: input.address ?? "",
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    predicted_material: input.predictedMaterial,
    confidence: input.confidence,
    overridden: input.overridden,
    model_id: input.modelId || "hf-endpoint",
    is_draft: input.isDraft ?? false,
  });
  const listing = await djangoListings.fetchById(created.id);
  return fromDjangoListing(listing);
}

export async function fetchOwnedListing(listingId: string, sellerId: string) {
  try {
    const row = await djangoListings.fetchById(listingId);
    if (row.seller_id !== sellerId) return null;
    return fromDjangoListing(row);
  } catch (error) {
    if (error instanceof DjangoApiError && error.status === 404) return null;
    throw error;
  }
}

export type UpdateListingInput = {
  title: string;
  weightKg: number;
  priceNgn: number | null;
  status: ListingStatus;
  photoUrl: string | null;
  photoUrls: string[];
  zone?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
};

export async function updateOwnedListing(
  listingId: string,
  input: UpdateListingInput
) {
  const cover = input.photoUrl?.trim() || null;
  const extras = input.photoUrls
    .map((u) => u.trim())
    .filter((u) => u && u !== cover);

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    weight_kg: input.weightKg,
    price_ngn: input.priceNgn,
    status: input.status,
    photo_url: cover,
    photo_urls: extras,
  };
  if (input.zone) {
    patch.zone = input.zone;
  }
  if (input.address !== undefined) patch.address = input.address;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;

  return fromDjangoListing(await djangoListings.update(listingId, patch));
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

  await djangoListings.delete(listingId);
}
