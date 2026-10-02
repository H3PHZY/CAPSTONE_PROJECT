/**
 * User display name and initials from auth storage.
 * Source: localStorage ecoloop_fullName, or getAuthUser()?.name, fallback "User".
 */

import { getAuthUser } from "./auth";

const FALLBACK_NAME = "User";

/**
 * @returns {string} Display name for the current user
 */
export function getDisplayName() {
  if (typeof window === "undefined") return FALLBACK_NAME;
  const user = getAuthUser();
  if (user && user.name && String(user.name).trim()) return String(user.name).trim();
  const fromStorage = localStorage.getItem("ecoloop_fullName");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  return FALLBACK_NAME;
}

/**
 * @param {string} [fullName] - If omitted, uses getDisplayName()
 * @returns {string} One or two uppercase letters (e.g. "JD", "U")
 */
export function getInitials(fullName) {
  const name = (fullName ?? getDisplayName()).trim();
  if (!name) return (FALLBACK_NAME[0] || "U").toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] || "U").toUpperCase();
}

/**
 * @returns {{ fullName: string, initials: string }}
 */
export function getFullNameAndInitials() {
  const fullName = getDisplayName();
  return { fullName, initials: getInitials(fullName) };
}
