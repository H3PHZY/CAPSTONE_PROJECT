/**
 * Buyer behavior tracking for "Recommended for You":
 * materials frequently searched, clicked, and purchased.
 * Stored in localStorage (keyed per user/session).
 */

const STORAGE_KEY = "ecoloop_buyer_behavior";
const MAX_SEARCHES = 50;
const MAX_CLICKS = 50;
const MIN_TERM_LENGTH = 2;
const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "your", "you", "all", "are", "can", "has", "have", "this", "that", "its", "our"]);

function getStorage() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const data = raw ? JSON.parse(raw) : {};
    return {
      searches: Array.isArray(data.searches) ? data.searches : [],
      clicked: Array.isArray(data.clicked) ? data.clicked : [],
    };
  } catch {
    return { searches: [], clicked: [] };
  }
}

function setStorage(data) {
  try {
    if (typeof window !== "undefined") {
      const out = { ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Record a search query (e.g. from Marketplace or Buyer Dashboard).
 * Call with trimmed query when user searches (debounced).
 * @param {string} query
 */
export function saveBuyerSearch(query) {
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < MIN_TERM_LENGTH) return;
  const { searches, clicked } = getStorage();
  const next = [q, ...searches.filter((s) => s !== q)].slice(0, MAX_SEARCHES);
  setStorage({ searches: next, clicked });
}

/**
 * Record a listing click / contact (user showed interest in this listing).
 * @param {{ id?: string, title?: string, materialType?: string, category?: string }} item
 */
export function saveBuyerListingClick(item) {
  if (!item || typeof item !== "object") return;
  const { searches, clicked } = getStorage();
  const entry = {
    id: item.id,
    title: item.title || "",
    materialType: item.materialType || "",
    category: item.category || "",
  };
  const next = [entry, ...clicked.filter((c) => String(c?.id) !== String(entry.id))].slice(0, MAX_CLICKS);
  setStorage({ searches, clicked: next });
}

/**
 * Extract keywords from a string (lowercase, min length, no stop words).
 * @param {string} s
 * @returns {string[]}
 */
function extractKeywords(s) {
  if (!s || typeof s !== "string") return [];
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TERM_LENGTH && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

/**
 * Get preferred material/keyword terms from searches, clicked listings, and completed purchases.
 * Used to rank or filter "Recommended for You" items.
 * @param {Array<{ listing?: { title?: string, materialType?: string, name?: string } }>} completedTransactions - from getMyTransactions, with listing populated
 * @returns {string[]} Unique lowercase keywords (searches + from clicked + from purchased)
 */
export function getBuyerPreferredTerms(completedTransactions) {
  const { searches, clicked } = getStorage();
  const terms = new Set();

  searches.forEach((q) => extractKeywords(q).forEach((t) => terms.add(t)));
  clicked.forEach((c) => {
    [c.title, c.materialType, c.category].forEach((s) => extractKeywords(String(s)).forEach((t) => terms.add(t)));
  });
  const list = Array.isArray(completedTransactions) ? completedTransactions : [];
  list.forEach((t) => {
    const listing = t.listing || t;
    const title = listing.title || listing.name || "";
    const materialType = listing.materialType || "";
    extractKeywords(title).forEach((k) => terms.add(k));
    extractKeywords(materialType).forEach((k) => terms.add(k));
  });

  return [...terms];
}

/**
 * Score a recommendation item by how many preferred terms it matches (title, seller, etc.).
 * Higher = better match.
 * @param {{ title?: string, [key: string]: unknown }} item - e.g. RECOMMENDED item with title, seller, etc.
 * @param {string[]} preferredTerms
 * @returns {number}
 */
export function scoreRecommendation(item, preferredTerms) {
  if (!preferredTerms.length) return 0;
  const text = [item.title, item.seller, item.location, item.co2].filter(Boolean).join(" ").toLowerCase();
  let score = 0;
  preferredTerms.forEach((term) => {
    if (text.includes(term.toLowerCase())) score += 1;
  });
  return score;
}
