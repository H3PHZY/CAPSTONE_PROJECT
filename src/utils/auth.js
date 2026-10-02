/**
 * Client-side auth storage helpers.
 * Backend auth: token and user from register/login API.
 * Legacy: ecoloop_users for local-only (bcrypt) flow.
 */

const TOKEN_KEY = "ecoloop_token";
const USER_KEY = "ecoloop_user";

/**
 * Normalize role so stored user always has userType "buyer" | "seller".
 * Uses user.role or user.userType from API; defaults to "seller" if missing.
 */
function normalizeUserType(user) {
  const raw = (user?.userType ?? user?.role ?? "").toString().toLowerCase();
  return raw === "buyer" ? "buyer" : "seller";
}

function normalizeDisplayName(user) {
  const candidate =
    user?.name ??
    user?.fullName ??
    user?.full_name ??
    user?.username ??
    "";
  const s = String(candidate || "").trim();
  return s || "";
}

/** Store auth after successful register or login (backend API). Ensures user has userType for role-based redirects. */
export function setAuthSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) {
    const userType = normalizeUserType(user);
    const displayName = normalizeDisplayName(user);
    const normalized = { ...user, name: displayName || user?.name, userType, role: userType };
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
    if (displayName) localStorage.setItem("ecoloop_fullName", displayName);
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

/** Clear auth session (logout). Removes token and user from storage. */
export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof localStorage !== "undefined" && localStorage.getItem("ecoloop_fullName")) {
    localStorage.removeItem("ecoloop_fullName");
  }
}

/** Get stored JWT token for Authorization header. */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Get stored user object from API (name, email, role, id, etc.). */
export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Update stored user profile (name, email, phone). Merges into existing ecoloop_user and updates ecoloop_fullName.
 * Use after user edits profile in Account Settings (client-side only; no API call).
 * @param {{ name?: string, email?: string, phone?: string }} updates
 */
export function updateStoredUserProfile(updates) {
  if (typeof localStorage === "undefined") return;
  const user = getAuthUser();
  if (!user) return;
  const next = { ...user };
  if (updates.name !== undefined) {
    next.name = String(updates.name).trim() || next.name;
    if (next.name) localStorage.setItem("ecoloop_fullName", next.name);
  }
  if (updates.email !== undefined) next.email = String(updates.email).trim() || next.email;
  if (updates.phone !== undefined) next.phone = String(updates.phone).trim();
  localStorage.setItem(USER_KEY, JSON.stringify(next));
}

const STORAGE_KEY = "ecoloop_users";

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

/** Normalize email for storage and lookup (lowercase). */
export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Store a registered user. Overwrites existing entry for the same email.
 * @param {string} email
 * @param {{ passwordHash: string, fullName: string, userType: 'buyer'|'seller' }} user
 */
export function storeUser(email, user) {
  const key = normalizeEmail(email);
  if (!key) return;
  const users = getStoredUsers();
  users[key] = {
    passwordHash: user.passwordHash,
    fullName: (user.fullName || "").trim(),
    userType: user.userType === "buyer" ? "buyer" : "seller",
  };
  setStoredUsers(users);
}

/**
 * Get stored user by email, or null if not found.
 * @param {string} email
 * @returns {{ passwordHash: string, fullName: string, userType: 'buyer'|'seller' } | null}
 */
export function getStoredUser(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const users = getStoredUsers();
  return users[key] || null;
}
