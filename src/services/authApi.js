/**
 * Auth API – frontend client for register/login with backend.
 * Base URL from VITE_SCAN_API_URL (same backend as scan).
 */

import { getFriendlyMessage } from "../utils/errorMessages";
import { getApiBaseUrl } from "../utils/apiConfig";

/**
 * Register a new user via backend.
 * Request body: name, email, phoneNumber (required), password, confirmPassword, userType, username, termsAccepted.
 * @param {{ name: string, email: string, phone: string, password: string, confirmPassword: string, role: 'buyer'|'seller', username: string, termsAccepted: boolean }} payload
 * @returns {Promise<object>} API response
 * @throws {Error} on validation or server error
 */
export async function registerUser(payload) {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/auth/register`;
  const userType = payload.role === "buyer" ? "buyer" : "seller";
  const body = {
    name: (payload.name || "").trim(),
    email: (payload.email || "").trim().toLowerCase(),
    phoneNumber: (payload.phone != null && payload.phone !== "") ? String(payload.phone).trim() : "",
    password: payload.password,
    confirmPassword: payload.confirmPassword,
    userType,
    username: (payload.username || "").trim().toLowerCase().replace(/\s+/g, ""),
    termsAccepted: Boolean(payload.termsAccepted),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const raw = details[0]?.message || data.message || data.error || "";
    const msg = getFriendlyMessage(res.status, raw);
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  return data;
}

/**
 * Login via backend.
 * Backend contract (so Network tab shows correct status):
 * - Correct credentials: respond 200 with { token, user, message }. CORS must allow frontend origin so the response is readable.
 * - Wrong credentials: respond 401 (not 200) with e.g. { error: "Invalid email or password" }. Then failed attempts show as 401 in Network tab.
 * @param {{ email: string, password: string }} payload
 * @returns {Promise<{ message: string, user: object, token: string }>}
 * @throws {Error} on 4xx/5xx or when 200 response has no token/user
 */
export async function loginUser(payload) {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/auth/login`;
  const body = {
    email: (payload.email || "").trim().toLowerCase(),
    password: payload.password,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = {};
  let rawText = "";
  const isOpaque = res.type === "opaque";
  try {
    rawText = await res.text();
    if (rawText && rawText.trim()) {
      const cleaned = rawText.trim().replace(/^\uFEFF/, "");
      data = JSON.parse(cleaned);
    }
  } catch {
    data = {};
  }

  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details : [];
    const raw = details[0]?.message || data.message || data.error || "";
    const msg = getFriendlyMessage(res.status, raw);
    const err = new Error(msg);
    err.details = details;
    err.status = res.status;
    throw err;
  }

  const token =
    data.token ??
    data.accessToken ??
    data.jwt ??
    data.Token ??
    data.access_token ??
    data.data?.token ??
    data.data?.accessToken ??
    data.result?.token ??
    data.body?.token ??
    data.payload?.token ??
    data.response?.token;
  let user =
    data.user ??
    data.User ??
    data.data?.user ??
    data.data?.User ??
    data.data?.userProfile ??
    data.result?.user ??
    data.body?.user ??
    data.payload?.user ??
    data.response?.user;
  if (user && Array.isArray(user)) user = user[0];
  if (typeof user === "object" && user !== null && !user.email && user.data) user = user.data;
  const tokenFinal = token || (typeof user === "object" && user && (user.token || user.accessToken));

  if (!tokenFinal || !user || typeof user !== "object") {
    const keys = typeof data === "object" && data !== null ? Object.keys(data) : [];
    const isEmpty = keys.length === 0 && !rawText.trim();
    const isCorsBlock = isOpaque || isEmpty;
    const msg = isCorsBlock
      ? "Login got 200 but the app could not read the response (CORS). Your backend must allow your frontend origin: add Access-Control-Allow-Origin with your frontend URL (e.g. https://your-app.onrender.com or http://localhost:5173)."
      : "The server did not return a valid session. Please try again or contact support.";
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }

  return { ...data, token: tokenFinal, user };
}
