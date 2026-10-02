import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import hdpePlasticImg from "../assets/inventory/hdpe-plastic.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import { getListings, updateListingStatus } from "../services/listingsApi";
import { getFriendlyMessage } from "../utils/errorMessages";
import { getListingImageUrl } from "../utils/apiConfig";
import { includeListingUnlessNonDraftZeroPrice } from "../utils/listingVisibility";
import AvatarMenu from "../components/AvatarMenu";
import GlobalSearchBar from "../components/GlobalSearchBar";
const CO2_KG_PER_TON = 500;

const INVENTORY_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "PENDING", label: "PENDING" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

function statusKeyFromApi(apiStatus) {
  const s = String(apiStatus || "").toUpperCase();
  if (s === "PUBLISHED") return "ACTIVE";
  if (s === "DRAFT") return "PENDING";
  if (["ACTIVE", "COMPLETED", "PENDING", "CANCELLED"].includes(s)) return s;
  return "ACTIVE";
}

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Producer") : "Producer";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "P").toUpperCase();
  return { fullName, initials };
}

const IconGrid9 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5" rx="0.5"/><rect x="10" y="3" width="5" height="5" rx="0.5"/><rect x="17" y="3" width="4" height="5" rx="0.5"/><rect x="3" y="10" width="5" height="5" rx="0.5"/><rect x="10" y="10" width="5" height="5" rx="0.5"/><rect x="17" y="10" width="4" height="5" rx="0.5"/><rect x="3" y="17" width="5" height="4" rx="0.5"/><rect x="10" y="17" width="5" height="4" rx="0.5"/><rect x="17" y="17" width="4" height="4" rx="0.5"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
);
const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconCO2 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M12 12v10"/></svg>
);
const IconEllipsisV = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);
function listingToCard(listing, img) {
  const apiStatus = String(listing.status || "").toUpperCase();
  const isDraft = apiStatus === "DRAFT";
  const statusKey = isDraft ? "DRAFT" : statusKeyFromApi(listing.status);

  const title = listing.title || listing.name || "—";
  const quantity = listing.quantity ?? listing.totalWeight ?? listing.weight;
  const weightStr = typeof quantity === "number" ? `${quantity} kg` : (quantity || "—");
  const priceNum = Number(listing.price) ?? 0;
  const priceStr = priceNum >= 1000 ? (priceNum / 1000).toFixed(0) + "K" : String(priceNum);
  const location = listing.location ?? listing.state ?? "—";
  const listed = listing.createdAt || listing.listedAt || listing.listed;
  const listedStr = listed ? new Date(listed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const views = listing.views ?? listing.viewCount ?? 0;
  const tons = Number(listing.quantity) || (listing.totalWeight ? listing.totalWeight / 1000 : 0) || 0;
  const co2Kg = Math.round(tons * CO2_KG_PER_TON);
  const co2Str = co2Kg >= 1000 ? `${(co2Kg / 1000).toFixed(1)} Tons CO₂` : `${co2Kg} kg CO₂`;

  return {
    id: listing.id,
    name: title,
    statusKey,
    weight: weightStr,
    price: priceStr,
    location,
    listed: listedStr,
    views,
    co2: co2Str,
    img: getListingImageUrl(listing, img),
    isDraft,
  };
}

export default function Inventory() {
  const { fullName, initials } = getFullNameAndInitials();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const handleInventoryStatusChange = (listingId, newStatus) => {
    if (!listingId || !newStatus) return;
    setStatusUpdatingId(listingId);
    updateListingStatus(listingId, newStatus)
      .then((res) => {
        const updated = res.listing;
        setListings((prev) =>
          prev
            .map((l) =>
              String(l.id) === String(listingId)
                ? { ...l, ...(updated && typeof updated === "object" ? updated : {}), status: newStatus }
                : l
            )
            .filter(includeListingUnlessNonDraftZeroPrice)
        );
      })
      .catch(() => {})
      .finally(() => setStatusUpdatingId(null));
  };

  useEffect(() => {
    try {
      localStorage.removeItem("ecoloop_inventory_drafts");
    } catch (_) {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" && window.localStorage && window.localStorage.getItem("ecoloop_token");
    if (!token) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getListings()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.listings) ? res.listings : [];
        setListings(raw);
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err && typeof err.status === "number" ? err.status : null;
          const raw = err instanceof Error ? err.message : "Failed to load listings";
          setError(getFriendlyMessage(status, raw, "listings"));
          setListings([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onListingStatusSynced = (e) => {
      const { listingId, status, listing } = e.detail || {};
      if (!listingId || !status) return;
      setListings((prev) =>
        prev
          .map((l) =>
            String(l.id) === String(listingId)
              ? {
                  ...l,
                  ...(listing && typeof listing === "object" ? listing : {}),
                  status: String(listing?.status || status).toUpperCase(),
                }
              : l
          )
          .filter(includeListingUnlessNonDraftZeroPrice)
      );
    };
    window.addEventListener("ecoloop-listing-status-updated", onListingStatusSynced);
    return () => window.removeEventListener("ecoloop-listing-status-updated", onListingStatusSynced);
  }, []);

  let publishedCards = [];
  let allItems = [];
  try {
    publishedCards = listings.filter(includeListingUnlessNonDraftZeroPrice).map((l) => listingToCard(l, hdpePlasticImg));
    allItems = publishedCards;
  } catch (e) {
    console.error("Inventory card mapping error", e);
  }

  const filteredByTab = allItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "drafts") return item.isDraft;
    if (activeTab === "active") return !item.isDraft && item.statusKey === "ACTIVE";
    if (activeTab === "pending") return !item.isDraft && item.statusKey === "PENDING";
    if (activeTab === "completed") return !item.isDraft && item.statusKey === "COMPLETED";
    return true;
  });

  const runSearch = () => setAppliedSearch(searchQuery.trim());
  const searchLower = appliedSearch.toLowerCase();
  const filteredItems = searchLower
    ? filteredByTab.filter((item) => item.name.toLowerCase().includes(searchLower) || (item.location && item.location.toLowerCase().includes(searchLower)))
    : filteredByTab;

  const tabCounts = {
    all: allItems.length,
    active: allItems.filter((i) => !i.isDraft && i.statusKey === "ACTIVE").length,
    drafts: allItems.filter((i) => i.isDraft).length,
    pending: allItems.filter((i) => !i.isDraft && i.statusKey === "PENDING").length,
    completed: allItems.filter((i) => !i.isDraft && i.statusKey === "COMPLETED").length,
  };

  return (
    <div className="seller-layout producer-dashboard-layout">
      <aside className="producer-sidebar inventory-sidebar">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="producer-sidebar-logo">
          <img src={ecoLoopLogo} alt="Eco loop" />
        </Link>
        <nav className="producer-sidebar-nav">
          <Link to="/seller/dashboard" className="producer-nav-item">
            <IconGrid9 /> <span>Dashboard</span>
          </Link>
          <Link to="/seller/inventory" className="producer-nav-item producer-nav-item-active">
            <IconBox /> <span>Inventory</span>
          </Link>
          <Link to="/seller/listings" className="producer-nav-item">
            <IconList /> <span>Listings</span>
          </Link>
          <Link to="/seller/transactions" className="producer-nav-item">
            <IconArrows /> <span>Transactions</span>
          </Link>
          <Link to="/seller/account" className="producer-nav-item">
            <IconGear /> <span>Account Settings</span>
          </Link>
        </nav>
      </aside>

      <div className="seller-main-wrap">
        <header className="seller-topbar producer-dashboard-topbar seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Inventory</span>
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" className="inventory-avatar" />
          </div>
        </header>

        <main className="inventory-content">
          <h1 className="inventory-title">Inventory</h1>
          <p className="inventory-subtitle">Track and manage your listed materials, saved items, and completed sales.</p>

          <div className="inventory-toolbar">
            <div className="inventory-search-wrap">
              <IconSearch />
              <input
                type="search"
                className="inventory-search-input"
                placeholder="Search by material or location..."
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              />
            </div>
            <button
              type="button"
              className="inventory-search-btn"
              onClick={runSearch}
              aria-label="Search"
            >
              Search
            </button>
          </div>

          {error && (
            <div className="register-form-errors" role="alert" style={{ marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className="inventory-tabs">
            <button
              type="button"
              className={`inventory-tab ${activeTab === "all" ? "inventory-tab-active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Items
              <span className={`inventory-tab-badge ${activeTab === "all" ? "inventory-tab-badge-active" : ""}`}>{tabCounts.all}</span>
            </button>
            <button
              type="button"
              className={`inventory-tab ${activeTab === "active" ? "inventory-tab-active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active Listings
              <span className={`inventory-tab-badge ${activeTab === "active" ? "inventory-tab-badge-active" : ""}`}>{tabCounts.active}</span>
            </button>
            <button
              type="button"
              className={`inventory-tab ${activeTab === "drafts" ? "inventory-tab-active" : ""}`}
              onClick={() => setActiveTab("drafts")}
            >
              Saved Drafts
              <span className={`inventory-tab-badge ${activeTab === "drafts" ? "inventory-tab-badge-active" : ""}`}>{tabCounts.drafts}</span>
            </button>
            <button
              type="button"
              className={`inventory-tab ${activeTab === "pending" ? "inventory-tab-active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending Sales
              <span className={`inventory-tab-badge ${activeTab === "pending" ? "inventory-tab-badge-active" : ""}`}>{tabCounts.pending}</span>
            </button>
            <button
              type="button"
              className={`inventory-tab ${activeTab === "completed" ? "inventory-tab-active" : ""}`}
              onClick={() => setActiveTab("completed")}
            >
              Completed
              <span className={`inventory-tab-badge ${activeTab === "completed" ? "inventory-tab-badge-active" : ""}`}>{tabCounts.completed}</span>
            </button>
          </div>

          <div className="inventory-list-area" aria-live="polite">
            {loading ? (
              <p className="inventory-subtitle">Loading inventory…</p>
            ) : filteredItems.length === 0 ? (
              <p className="inventory-subtitle">No items match this filter. Publish listings from Create Listing, or open drafts saved on the server from Listings.</p>
            ) : (
              <div className="inventory-grid">
                {filteredItems.map((item) => (
                  <article key={item.id} className="inventory-card">
                    <div className="inventory-card-image-wrap">
                      <img src={item.img} alt={item.name} className="inventory-card-image" />
                      {item.isDraft ? (
                        <span className="inventory-card-status inventory-card-status-draft">Draft</span>
                      ) : (
                        <select
                          className={`inventory-card-status-select inventory-card-status inventory-card-status-key-${(item.statusKey || "ACTIVE").toLowerCase()}`}
                          value={item.statusKey || "ACTIVE"}
                          onChange={(e) => handleInventoryStatusChange(item.id, e.target.value)}
                          disabled={statusUpdatingId === item.id}
                          aria-label="Listing status"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {INVENTORY_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="inventory-card-body">
                      <div className="inventory-card-header">
                        <h3 className="inventory-card-name">{item.name}</h3>
                        <button type="button" className="inventory-card-menu" aria-label="Options"><IconEllipsisV /></button>
                      </div>
                      <div className="inventory-card-weight">{item.weight}</div>
                      <div className="inventory-card-price">₦{item.price}</div>
                      <div className="inventory-card-meta">
                        <span className="inventory-card-meta-item"><IconMapPin /> {item.location}</span>
                        <span className="inventory-card-meta-item"><IconCalendar /> {item.isDraft ? "Saved" : "Listed"} {item.listed}</span>
                        <span className="inventory-card-meta-item"><IconEye /> {item.views} views</span>
                        <span className="inventory-card-meta-item"><IconCO2 /> {item.co2}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
