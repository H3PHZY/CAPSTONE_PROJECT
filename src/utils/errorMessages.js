/**
 * User-friendly error messages for API and validation errors.
 * Use these so users see clear, polite messages and know what to do next.
 */

/** Message when a resource is not found (404) */
export const NOT_FOUND =
  "We couldn't find what you're looking for. It may have been removed or the link might be outdated. Try going back or opening the page again from the main menu.";

/** Message when the server has a problem (500) */
export const SERVER_ERROR =
  "Something went wrong on our side. We're on it—please try again in a moment. If it keeps happening, try again later or contact support.";

/** Message for invalid or invalidated input (400 Bad Request / 422 validation) */
export const INVALID_INPUT =
  "Some of the information doesn't look right. Please check the fields marked in red and try again. If you're stuck, make sure required fields are filled and formats (e.g. email) are correct.";

/** Same as INVALID_INPUT; use for 400 Bad Request specifically if you want a named constant */
export const BAD_REQUEST = INVALID_INPUT;

/**
 * Get a user-friendly message for a given HTTP status or raw message.
 * @param {number} [status] - HTTP status (e.g. 404, 500)
 * @param {string} [rawMessage] - Original API/error message
 * @param {string} [context] - Optional context, e.g. "listing", "login"
 * @returns {string} Message safe to show to users
 */
export function getFriendlyMessage(status, rawMessage = "", context = "") {
  const s = Number(status);
  const msg = String(rawMessage || "").toLowerCase();

  if (s === 404) return NOT_FOUND;
  if (s === 500 || msg.includes("500") || msg.includes("internal server error")) return SERVER_ERROR;
  if (s === 400 || s === 422 || msg.includes("invalid") || msg.includes("validation") || msg.includes("bad request")) {
    if (context === "listing" && (msg.includes("image missing") || msg.includes("image is required"))) {
      return "Please add a photo of the material and try again.";
    }
    return INVALID_INPUT;
  }

  if (msg.includes("not found")) return NOT_FOUND;
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "We couldn't reach the server. Check your internet connection and try again.";
  }
  if (msg.includes("api url") || msg.includes("vite_") || msg.includes("not configured")) {
    return "The app isn't connected to the server yet. If you're setting things up, add the server URL to your .env file and restart. Otherwise, try again later.";
  }
  if (s === 401 || msg.includes("401") || msg.includes("unauthorized")) {
    if (context === "login") {
      return "The email or password isn't correct. Please try again or use Forgot Password.";
    }
    return "Your session may have expired. Please sign in again.";
  }
  if (msg.includes("403") || msg.includes("forbidden")) {
    return "You don't have permission to do that. If you think this is a mistake, try signing in again or contact support.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "The request took too long. Please check your connection and try again.";
  }
  if (msg.includes("valid session") || msg.includes("did not return")) {
    return rawMessage && rawMessage.length < 200 ? rawMessage : "The server did not return a valid session. Please try again or contact support.";
  }
  if (msg.includes("cors") || msg.includes("access-control") || msg.includes("could not read the response") || msg.includes("allow your frontend origin")) {
    return rawMessage && rawMessage.length < 500 ? rawMessage : SERVER_ERROR;
  }
  if (s === 502) {
    if (context === "listing") {
      return "Image analysis didn't complete. Please try again or create the listing with details entered manually.";
    }
    return SERVER_ERROR;
  }
  if (context === "email" || context === "password") {
    return INVALID_INPUT;
  }
  return "Something went wrong. Please try again.";
}
