// lib/django-auth.ts
// API base URL helper + authenticated fetch utility + token management
// for the EcoLoop Django REST backend.

export const API = process.env.NEXT_PUBLIC_DJANGO_API_URL ?? 'http://127.0.0.1:8000/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('eco_access');
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('eco_access', access);
  localStorage.setItem('eco_refresh', refresh);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('eco_access');
  localStorage.removeItem('eco_refresh');
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Don't force application/json when uploading FormData
  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  }
  return fetch(`${API}${path}`, { ...init, headers });
}

/** Unwrap a paginated Django response — falls back to raw data if not paginated. */
export function unwrapResults<T>(data: unknown): T[] {
  if (data && typeof data === 'object' && 'results' in data) {
    return (data as { results: T[] }).results;
  }
  if (Array.isArray(data)) return data as T[];
  return [];
}

/** Handle a non-ok response: clear tokens on 401, always throw. */
export async function handleError(res: Response): Promise<never> {
  if (res.status === 401) {
    clearTokens();
    throw new Error('Session expired, please log in again');
  }
  let err: Record<string, unknown> = {};
  try {
    err = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore JSON parse failure
  }
  throw new Error(
    (err.detail as string) || (err.error as string) || JSON.stringify(err) || `HTTP ${res.status}`
  );
}
