/**
 * EcoLoop Django REST API Client
 * Drop-in helper to connect Next.js frontend to the Django backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_API_URL || "http://127.0.0.1:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ecoloop_access_token");
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("ecoloop_access_token", access);
  localStorage.setItem("ecoloop_refresh_token", refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("ecoloop_access_token");
  localStorage.removeItem("ecoloop_refresh_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || data?.detail || `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// ─── Authentication API ──────────────────────────────────────────────────────

export const djangoAuth = {
  async signup(payload: {
    email: string;
    password: string;
    businessName: string;
    cluster: string;
    phone: string;
    sells: boolean;
    buys: boolean;
    carbonImpact: boolean;
    researchConsent: boolean;
  }) {
    const res = await request<{ user: any; tokens: { access: string; refresh: string } }>(
      "/auth/signup/",
      {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          business_name: payload.businessName,
          cluster: payload.cluster,
          phone: payload.phone,
          sells: payload.sells,
          buys: payload.buys,
          carbon_impact: payload.carbonImpact,
          research_consent: payload.researchConsent,
        }),
      }
    );
    setTokens(res.tokens.access, res.tokens.refresh);
    return res;
  },

  async login(email: string, password: string) {
    const res = await request<{ user: any; tokens: { access: string; refresh: string } }>(
      "/auth/login/",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setTokens(res.tokens.access, res.tokens.refresh);
    return res;
  },

  async getMe() {
    return request<any>("/auth/me/");
  },

  async updateProfile(patch: any) {
    return request<any>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  logout() {
    clearTokens();
  },
};

// ─── Listings API ────────────────────────────────────────────────────────────

export const djangoListings = {
  async fetchLive(params?: { q?: string; category?: string; radius?: number; sort?: string }) {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.category) query.set("category", params.category);
    if (params?.radius) query.set("radius", String(params.radius));
    if (params?.sort) query.set("sort", params.sort);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<any[]>(`/listings/${qs}`);
  },

  async fetchById(id: string) {
    return request<any>(`/listings/${id}/`);
  },

  async fetchMine() {
    return request<any[]>("/listings/mine/");
  },

  async create(payload: any) {
    return request<any>("/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(id: string, patch: any) {
    return request<any>(`/listings/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async delete(id: string) {
    return request<void>(`/listings/${id}/`, {
      method: "DELETE",
    });
  },
};

// ─── Transactions API ────────────────────────────────────────────────────────

export const djangoTransactions = {
  async fetchMine() {
    return request<any[]>("/transactions/");
  },

  async markAgreed(listingId: string, buyerId: string) {
    return request<any>("/transactions/mark_agreed/", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, buyer_id: buyerId }),
    });
  },

  async markCompleted(listingId: string, buyerId: string) {
    return request<any>("/transactions/mark_completed/", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, buyer_id: buyerId }),
    });
  },

  async fetchCarbonImpact() {
    return request<any>("/impact/");
  },
};

// ─── Messages API ────────────────────────────────────────────────────────────

export const djangoMessages = {
  async fetchInbox() {
    return request<any[]>("/messages/inbox/");
  },

  async fetchThread(listingId: string, otherUserId: string) {
    return request<any[]>(`/messages/thread/?listing_id=${listingId}&other_user_id=${otherUserId}`);
  },

  async send(payload: { listing: string; recipient: string; body: string; replyTo?: string }) {
    return request<any>("/messages/", {
      method: "POST",
      body: JSON.stringify({
        listing: payload.listing,
        recipient: payload.recipient,
        body: payload.body,
        reply_to: payload.replyTo || null,
      }),
    });
  },
};

