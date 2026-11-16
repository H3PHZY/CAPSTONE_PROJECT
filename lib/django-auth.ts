// API base URL helper + authenticated fetch utility + token management
// for the EcoLoop Django REST backend.
import { retryOnceOnNetworkFailure } from "@/lib/network-retry";

export function getApiBaseUrl(
  configuredUrl: string | undefined,
  environment: string
) {
  if (!configuredUrl && environment === "production") {
    throw new Error(
      "NEXT_PUBLIC_DJANGO_API_URL must be set for production builds."
    );
  }
  return configuredUrl ?? "http://127.0.0.1:8000/api";
}

export const API = getApiBaseUrl(
  process.env.NEXT_PUBLIC_DJANGO_API_URL,
  process.env.NODE_ENV
);
export const API_WAKEUP_EVENT = "ecoloop:api-wakeup";
export const SESSION_EXPIRED_EVENT = "ecoloop:session-expired";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ecoloop_access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ecoloop_refresh_token");
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

let refreshInFlight: Promise<string | null> | null = null;
let wakeupRequestCount = 0;

function setApiWaking(active: boolean) {
  if (typeof window === "undefined") return;
  wakeupRequestCount = Math.max(0, wakeupRequestCount + (active ? 1 : -1));
  window.dispatchEvent(
    new CustomEvent(API_WAKEUP_EVENT, {
      detail: { active: wakeupRequestCount > 0 },
    })
  );
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
          clearTokens();
          return null;
        }

        const data = (await res.json()) as {
          access?: string;
          refresh?: string;
        };
        if (!data.access) {
          clearTokens();
          throw new Error("The refresh endpoint returned no access token");
        }
        setTokens(data.access, data.refresh ?? refresh);
        return data.access;
      } catch (error) {
        clearTokens();
        throw error;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function fetchWithToken(
  path: string,
  init: RequestInit | undefined,
  token: string | null
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  else headers.delete("Authorization");
  if (
    init?.body &&
    typeof FormData !== "undefined" &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  }
  return fetch(`${API}${path}`, { ...init, headers });
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const request = () => fetchWithToken(path, init, getToken());
  let first: Response;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    let retrying = false;
    try {
      first = await retryOnceOnNetworkFailure(
        request,
        () => {
          retrying = true;
          setApiWaking(true);
        }
      );
    } finally {
      if (retrying) setApiWaking(false);
    }
  } else {
    first = await request();
  }
  if (
    first.status !== 401 ||
    path === "/auth/refresh/" ||
    path === "/auth/login/" ||
    path === "/auth/signup/"
  ) return first;

  const token = await refreshAccessToken();
  if (!token) return first;
  return fetchWithToken(path, init, token);
}

export class DjangoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DjangoApiError";
  }
}

export async function handleError(
  res: Response,
  options: { clearSession?: boolean } = {}
): Promise<never> {
  const clearSession = options.clearSession ?? true;
  if (res.status === 401 && clearSession) {
    clearTokens();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const message =
    res.status === 401 && clearSession
      ? "Session expired, please log in again"
      : res.status === 503
        ? "EcoLoop is temporarily unavailable. The service may be waking up; please try again shortly."
      : getErrorMessage(data) || `Request failed (${res.status})`;
  throw new DjangoApiError(message, res.status);
}

function getErrorMessage(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  for (const key of ["detail", "error"]) {
    if (typeof record[key] === "string") return record[key];
  }
  const messages = Object.values(record).flatMap((value) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    return [];
  });
  return messages.length ? messages.join(" ") : null;
}
