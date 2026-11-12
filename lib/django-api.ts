import { API, apiFetch, handleError } from "@/lib/django-auth";
import type {
  ListingStatus,
  MaterialCategory,
  TransactionStatus,
} from "@/lib/models";

export type DjangoListing = {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_cluster: string;
  verified: boolean;
  title: string;
  material: MaterialCategory;
  weight_kg: string | number;
  price_ngn: string | number | null;
  status: ListingStatus;
  photo: string | null;
  photo_url: string | null;
  primary_photo_url: string | null;
  photo_urls: string[];
  all_photos: string[];
  zone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  views: number;
  distance: number;
  conf: number;
  created_at: string;
  updated_at: string;
  classification?: {
    confidence: string | number;
    final_material: MaterialCategory;
    predicted_material: MaterialCategory;
    overridden: boolean;
  } | null;
};

export type DjangoTransaction = {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_material: MaterialCategory;
  listing_weight: string | number;
  amount_ngn: string | number | null;
  currency: string;
  buyer_id: string;
  seller_id: string;
  counterparty_name: string;
  counterparty_id: string;
  status: TransactionStatus;
  payment_ref: string | null;
  paid_at: string | null;
  completed_at: string | null;
  co2e_kg: string | number | null;
  created_at: string;
};

export type DjangoDispute = {
  id: string;
  transaction_id: string;
  raised_by_id: string;
  reason: string;
  status: "Open" | "Resolved" | "Refunded";
  resolution_note: string;
  created_at: string;
  updated_at: string;
};

export type DjangoMessage = {
  id: string;
  listing: string;
  sender: string;
  recipient: string;
  body: string;
  reply_to: string | null;
  reply_text: string | null;
  image_url: string | null;
  attachment: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  created_at: string;
  me: boolean;
  sender_name: string;
  sender_avatar_url: string | null;
  time: string;
};

export async function djangoRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) return handleError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function uploadDjangoMedia(
  file: File,
  category: "listing-photo" | "profile-avatar" | "message-attachment"
): Promise<{ path: string; url: string }> {
  const body = new FormData();
  body.set("file", file);
  body.set("category", category);
  return djangoRequest("/media/upload/", {
    method: "POST",
    body,
  });
}

async function djangoList<T>(path: string): Promise<T[]> {
  const first = await djangoRequest<unknown>(path);
  if (Array.isArray(first)) return first as T[];
  if (!first || typeof first !== "object" || !("results" in first)) {
    throw new Error("The API returned an unexpected list response");
  }

  const firstPage = first as { results: unknown; next?: string | null };
  if (!Array.isArray(firstPage.results)) {
    throw new Error("The API returned an unexpected paginated response");
  }
  const results = [...firstPage.results] as T[];
  const apiBase = new URL(API);
  const apiPath = apiBase.pathname.replace(/\/$/, "");
  const seen = new Set<string>();
  let next = firstPage.next ?? null;

  while (next) {
    const url = new URL(next, apiBase);
    if (
      url.origin !== apiBase.origin ||
      !url.pathname.startsWith(`${apiPath}/`)
    ) {
      throw new Error("The API returned an invalid pagination URL");
    }
    const pagePath = `${url.pathname.slice(apiPath.length)}${url.search}`;
    if (seen.has(pagePath)) {
      throw new Error("The API returned a repeated pagination URL");
    }
    seen.add(pagePath);

    const page = await djangoRequest<unknown>(pagePath);
    if (
      !page ||
      typeof page !== "object" ||
      !("results" in page) ||
      !Array.isArray((page as { results?: unknown }).results)
    ) {
      throw new Error("The API returned an unexpected paginated response");
    }
    const pageData = page as { results: T[]; next?: string | null };
    results.push(...pageData.results);
    next = pageData.next ?? null;
  }

  return results;
}

export const djangoListings = {
  fetchLive(params?: {
    q?: string;
    category?: string;
    radius?: number;
    sort?: string;
    cluster?: string | null;
    lat?: number | null;
    lng?: number | null;
  }) {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.category) query.set("category", params.category);
    if (params?.radius != null) query.set("radius", String(params.radius));
    if (params?.sort) query.set("sort", params.sort);
    if (params?.cluster) query.set("cluster", params.cluster);
    if (params?.lat != null) query.set("lat", String(params.lat));
    if (params?.lng != null) query.set("lng", String(params.lng));
    const qs = query.toString() ? `?${query}` : "";
    return djangoList<DjangoListing>(`/listings/${qs}`);
  },

  fetchById(
    id: string,
    params?: { cluster?: string | null; lat?: number | null; lng?: number | null }
  ) {
    const query = new URLSearchParams();
    if (params?.cluster) query.set("cluster", params.cluster);
    if (params?.lat != null) query.set("lat", String(params.lat));
    if (params?.lng != null) query.set("lng", String(params.lng));
    const qs = query.toString() ? `?${query}` : "";
    return djangoRequest<DjangoListing>(
      `/listings/${encodeURIComponent(id)}/${qs}`
    );
  },

  fetchMine() {
    return djangoList<DjangoListing>("/listings/mine/");
  },

  create(payload: Record<string, unknown>) {
    return djangoRequest<DjangoListing>("/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(id: string, patch: Record<string, unknown>) {
    return djangoRequest<DjangoListing>(`/listings/${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  delete(id: string) {
    return djangoRequest<void>(`/listings/${encodeURIComponent(id)}/`, {
      method: "DELETE",
    });
  },

  publish(id: string) {
    return djangoRequest<DjangoListing>(
      `/listings/${encodeURIComponent(id)}/publish/`,
      { method: "POST" }
    );
  },
};

export const djangoTransactions = {
  fetchMine() {
    return djangoList<DjangoTransaction>("/transactions/");
  },

  markAgreed(listingId: string, buyerId: string) {
    return djangoRequest<DjangoTransaction>("/transactions/mark_agreed/", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, buyer_id: buyerId }),
    });
  },

  markCompleted(listingId: string, buyerId: string) {
    return djangoRequest<DjangoTransaction>("/transactions/mark_completed/", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, buyer_id: buyerId }),
    });
  },

  fetchCarbonImpact() {
    return djangoRequest<{
      totalCo2eKg: number;
      totalWeightKg: number;
      completedCount: number;
      byMaterial: [string, number][];
      byMonth: [string, number, number][];
      recent: {
        material: string;
        party: string;
        weight: number;
        value: string;
        co2: number;
        date: string;
      }[];
    }>("/impact/");
  },
};

export const djangoDisputes = {
  fetchMine() {
    return djangoList<DjangoDispute>("/disputes/");
  },

  create(payload: { transaction_id: string; reason: string }) {
    return djangoRequest<DjangoDispute>("/disputes/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const djangoMessages = {
  fetchInbox() {
    return djangoList<{
      key: string;
      listingId: string;
      listingTitle: string;
      listingMaterial: string;
      sellerId: string;
      otherUserId: string;
      otherName: string;
      otherAvatarUrl: string | null;
      preview: string;
      timeLabel: string;
      updatedAt: string;
      lastMessageId: string;
      lastSenderId: string;
    }>("/messages/inbox/");
  },

  fetchThread(listingId: string, otherUserId: string) {
    const query = new URLSearchParams({
      listing_id: listingId,
      other_user_id: otherUserId,
    });
    return djangoList<DjangoMessage>(`/messages/thread/?${query}`);
  },

  send(payload: {
    listing: string;
    recipient: string;
    body: string;
    replyTo?: string | null;
    imageUrl?: string | null;
    attachmentName?: string | null;
    attachmentMime?: string | null;
  }) {
    return djangoRequest<DjangoMessage>("/messages/", {
      method: "POST",
      body: JSON.stringify({
        listing: payload.listing,
        recipient: payload.recipient,
        body: payload.body,
        reply_to: payload.replyTo ?? null,
        image_url: payload.imageUrl ?? null,
        attachment_name: payload.attachmentName ?? null,
        attachment_mime: payload.attachmentMime ?? null,
      }),
    });
  },
};
