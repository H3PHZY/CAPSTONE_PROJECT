import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import { getListings, updateListingStatus } from "../services/listingsApi";
import { getFriendlyMessage } from "../utils/errorMessages";
import { getListingImageUrl } from "../utils/apiConfig";
import { includeListingUnlessNonDraftZeroPrice } from "../utils/listingVisibility";
import { getFullNameAndInitials } from "../utils/userDisplay";
import AvatarMenu from "../components/AvatarMenu";
import GlobalSearchBar from "../components/GlobalSearchBar";

const IconGrid9 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5" rx="0.5"/><rect x="10" y="3" width="5" height="5" rx="0.5"/><rect x="17" y="3" width="4" height="5" rx="0.5"/><rect x="3" y="10" width="5" height="5" rx="0.5"/><rect x="10" y="10" width="5" height="5" rx="0.5"/><rect x="17" y="10" width="4" height="5" rx="0.5"/><rect x="3" y="17" width="5" height="4" rx="0.5"/><rect x="10" y="17" width="5" height="4" rx="0.5"/><rect x="17" y="17" width="4" height="4" rx="0.5"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
);
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconPencil = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
const IconRecycle = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><path d="M2 12h20"/></svg>
);
const IconDollar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconDiamond = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"/></svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconLeaf = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
);
const IconPlusSquare = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);

const CO2_KG_PER_TON = 500;

function normalizeListing(row) {
  const priceNum = Number(row.price);
  const priceStr = Number.isFinite(priceNum) ? priceNum.toLocaleString() : (row.price ?? "—");
  const created = row.createdAt
    ? new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : (row.created ?? "—");
  const currency = row.currency || "";
  const priceUnit = currency ? `/${currency}` : (row.unit ? ` / ${row.unit}` : " / Ton");
  return {
    id: row.id ?? row._id,
    name: row.title ?? row.name ?? "—",
    sku: row.sku ?? row.skuCode ?? (row.id ? `#${String(row.id).slice(0, 8)}` : "—"),
    category: row.materialType ?? row.category ?? "—",
    quantity: String(row.quantity ?? row.totalWeight ?? "—"),
    unit: row.unit ?? "Tons",
    price: priceStr,
    priceUnit,
    status: (row.status ?? "ACTIVE").toUpperCase(),
    created,
    thumb: getListingImageUrl(row, ""),
  };
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusForDropdown(apiStatus) {
  const s = String(apiStatus || "").toUpperCase();
  if (s === "PUBLISHED") return "ACTIVE";
  if (s === "DRAFT") return "PENDING";
  if (["ACTIVE", "COMPLETED", "PENDING", "CANCELLED"].includes(s)) return s;
  return "ACTIVE";
}

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "Plastic", label: "Plastic" },
  { value: "Metal", label: "Metal" },
  { value: "Paper", label: "Paper" },
  { value: "Glass", label: "Glass" },
];

function matchCategory(rowCategory, selectedCategory) {
  if (!selectedCategory) return true;
  const row = (rowCategory || "").toLowerCase();
  const sel = selectedCategory.toLowerCase();
  if (row === sel) return true;
  if (row.startsWith(sel) || sel.startsWith(row)) return true;
  if (row.includes("plastic") && sel === "plastic") return true;
  if (row.includes("metal") && sel === "metal") return true;
  if (row.includes("paper") && sel === "paper") return true;
  if (row.includes("glass") && sel === "glass") return true;
  return false;
}

function filterListings(list, query, categoryFilter) {
  const q = (query || "").trim().toLowerCase();
  let out = list;
  if (q) {
    out = out.filter(
      (row) =>
        (row.name && row.name.toLowerCase().includes(q)) ||
        (row.sku && row.sku.toLowerCase().includes(q)) ||
        (row.category && row.category.toLowerCase().includes(q)) ||
        (row.quantity && String(row.quantity).toLowerCase().includes(q)) ||
        (row.status && row.status.toLowerCase().includes(q))
    );
  }
  if (categoryFilter) {
    out = out.filter((row) => matchCategory(row.category, categoryFilter));
  }
  return out;
}

export default function ListingsManagement() {
  const location = useLocation();
  const highlightId = location.state?.highlightListingId;
  const { fullName } = getFullNameAndInitials();
  const [listings, setListings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const [viewIsEditMode, setViewIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const filteredListings = filterListings(listings, searchQuery, categoryFilter);
  const highlightedRowRef = useRef(null);
  const navigate = useNavigate();

  const handleStatusChange = (row, newStatus) => {
    const id = row.id;
    if (!id || !newStatus) return;
    setStatusUpdatingId(id);
    updateListingStatus(id, newStatus)
      .then((res) => {
        const updated = res.listing ? normalizeListing(res.listing) : { ...row, status: newStatus };
        setListings((prev) =>
          prev.map((r) => (String(r.id) === String(id) ? updated : r)).filter(includeListingUnlessNonDraftZeroPrice)
        );
        if (viewItem && String(viewItem.id) === String(id)) {
          setViewItem(includeListingUnlessNonDraftZeroPrice(updated) ? updated : null);
        }
      })
      .catch(() => {})
      .finally(() => setStatusUpdatingId(null));
  };

  const handleView = (row) => {
    setViewItem(row);
    setViewIsEditMode(false);
  };
  const handleEdit = (row) => {
    if (!["DRAFT", "PUBLISHED", "ACTIVE"].includes(row.status)) return;
    setViewItem(row);
    setViewIsEditMode(true);
  };
  const closeView = () => {
    setViewItem(null);
    setViewIsEditMode(false);
  };

  const performDelete = (row) => {
    if (!row) {
      setDeleteTarget(null);
      return;
    }
    const targetId = row.id;
    setListings((prev) => prev.filter((item) => String(item.id) !== String(targetId)));
    if (totalCount > 0) setTotalCount((c) => Math.max(0, c - 1));
    if (viewItem && String(viewItem.id) === String(targetId)) setViewItem(null);
    setDeleteTarget(null);
  };

  const handleDelete = (row) => {
    setDeleteTarget(row);
  };

  const handleDownload = () => {
    const headers = ["Item", "SKU", "Category", "Quantity", "Unit", "Price", "Price Unit", "Status", "Created"];
    const escapeCsv = (val) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filteredListings.map((row) =>
      [row.name, row.sku, row.category, row.quantity, row.unit, row.price, row.priceUnit, row.status, row.created].map(escapeCsv).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecoloop-listings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!highlightId || loading || !highlightedRowRef.current) return;
    highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, loading]);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" && window.localStorage && window.localStorage.getItem("ecoloop_token");
    if (!token) {
      setLoading(false);
      setListings([]);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    setError("");
    getListings()
      .then((res) => {
        if (cancelled) return;
        const raw = res.listings && Array.isArray(res.listings) ? res.listings : [];
        const normalized = raw.filter(includeListingUnlessNonDraftZeroPrice).map(normalizeListing);
        setListings(normalized);
        setTotalCount(normalized.length);
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err && typeof err.status === "number" ? err.status : null;
          const raw = err instanceof Error ? err.message : "Failed to load listings";
          setError(getFriendlyMessage(status, raw, "listings"));
          setListings([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onListingStatusSynced = (e) => {
      const { listingId, status, listing } = e.detail || {};
      if (!listingId || !status) return;
      const mergeRow = (r) => {
        if (!r || String(r.id) !== String(listingId)) return r;
        if (listing && typeof listing === "object") {
          return normalizeListing({ ...listing, id: listingId });
        }
        return { ...r, status: String(status).toUpperCase() };
      };
      setListings((prev) => prev.map(mergeRow).filter(includeListingUnlessNonDraftZeroPrice));
      setViewItem((v) => {
        if (!v) return v;
        const m = mergeRow(v);
        return includeListingUnlessNonDraftZeroPrice(m) ? m : null;
      });
    };
    window.addEventListener("ecoloop-listing-status-updated", onListingStatusSynced);
    return () => window.removeEventListener("ecoloop-listing-status-updated", onListingStatusSynced);
  }, []);

  return (
    <div className="seller-layout producer-dashboard-layout">
      <aside className="producer-sidebar">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="producer-sidebar-logo">
          <img src={ecoLoopLogo} alt="EcoLoop" />
        </Link>
        <nav className="producer-sidebar-nav">
          <Link to="/seller/dashboard" className="producer-nav-item">
            <IconGrid9 /> <span>Dashboard</span>
          </Link>
          <Link to="/seller/inventory" className="producer-nav-item">
            <IconBox /> <span>Inventory</span>
          </Link>
          <Link to="/seller/listings" className="producer-nav-item producer-nav-item-active">
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
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Listings</span>
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="seller-content">
          {error && (
            <div className="listings-error-banner" role="alert">
              {error}
            </div>
          )}
          <div className="listings-header">
            <div>
              <h1 className="listings-title">Manage Your Materials</h1>
              <p className="listings-desc">Track, edit, and monitor your active recycling inventory.</p>
            </div>
            <div className="producer-create-listing-dropdown">
              <button type="button" className="btn btn-primary listings-create-btn producer-create-listing-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Create listing options">
                <IconPlusSquare /> Create New Listing
              </button>
              <div className="producer-create-listing-menu" role="menu">
                <Link to="/seller/create-listing" className="producer-create-listing-option" role="menuitem" onClick={() => { try { sessionStorage.removeItem("ecoloop_create_listing_manual"); } catch (_) {} }}>
                  AI Scan
                </Link>
                <Link to="/seller/create-listing/material-details" className="producer-create-listing-option" role="menuitem" onClick={() => { try { sessionStorage.setItem("ecoloop_create_listing_manual", "true"); sessionStorage.removeItem("ecoloop_create_listing_upload"); sessionStorage.removeItem("ecoloop_create_listing_scan_result"); } catch (_) {} }}>
                  Manual Entry
                </Link>
              </div>
            </div>
          </div>

          <div className="listings-toolbar">
            <div className="listings-search-wrap">
              <IconSearch />
              <input
                type="search"
                placeholder="Search materials by name or SKU..."
                className="listings-search-input"
                aria-label="Search materials by name or SKU"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="listings-select"
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" className="listings-toolbar-btn" aria-label="Download list" onClick={handleDownload}>
              <IconDownload />
            </button>
          </div>

          <div className="listings-table-wrap">
            <table className="listings-table">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>CATEGORY</th>
                  <th>QUANTITY</th>
                  <th>PRICE</th>
                  <th>STATUS</th>
                  <th>CREATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="listings-loading-cell">Loading listings…</td>
                  </tr>
                ) : filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="listings-loading-cell">No listings match your search.</td>
                  </tr>
                ) : (
                  filteredListings.map((row) => (
                  <tr
                    key={row.id}
                    ref={String(row.id) === String(highlightId) ? highlightedRowRef : null}
                    data-listing-id={row.id}
                    className={String(row.id) === String(highlightId) ? "listings-table-row-highlight" : undefined}
                  >
                    <td>
                      <div className="listings-table-item">
                        <div className="listings-table-thumb-wrap">
                          <img src={row.thumb} alt="" className="listings-table-thumb" />
                          {String(row.status || "").toUpperCase() === "DRAFT" && (
                            <span className="listings-thumb-badge" aria-label="Draft listing">DRAFT</span>
                          )}
                        </div>
                        <div>
                          <div className="listings-table-name">{row.name}</div>
                          <div className="listings-table-sku">SKU: {row.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="listings-badge">{row.category}</span></td>
                    <td>{row.quantity} {row.unit}</td>
                    <td><span className="listings-price">₦{row.price} {row.priceUnit}</span></td>
                    <td>
                      {String(row.status || "").toUpperCase() === "DRAFT" ? null : (
                        <select
                          className={`listings-status-select listings-status listings-status-${(statusForDropdown(row.status) === "ACTIVE" ? "active" : statusForDropdown(row.status)).toLowerCase()}`}
                          value={statusForDropdown(row.status)}
                          onChange={(e) => handleStatusChange(row, e.target.value)}
                          disabled={statusUpdatingId === row.id}
                          aria-label="Listing status"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{row.created}</td>
                    <td>
                      <div className="listings-actions">
                        <button type="button" className="listings-action-btn" aria-label="View" onClick={() => handleView(row)} title="View listing"><IconEye /></button>
                        <button
                          type="button"
                          className={`listings-action-btn ${["DRAFT", "PUBLISHED", "ACTIVE"].includes(row.status) ? "" : "listings-action-btn-disabled"}`}
                          aria-label="Edit"
                          disabled={!["DRAFT", "PUBLISHED", "ACTIVE"].includes(row.status)}
                          title={["DRAFT", "PUBLISHED", "ACTIVE"].includes(row.status) ? "Edit listing" : "Edit only available for Draft and Published items"}
                          onClick={() => handleEdit(row)}
                        >
                          <IconPencil />
                        </button>
                        <button type="button" className="listings-action-btn" aria-label="Delete" onClick={() => handleDelete(row)} title="Remove from list"><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="listings-pagination">
            <p className="listings-pagination-summary">Showing 1 to {filteredListings.length} of {totalCount || listings.length} listings</p>
            <div className="listings-pagination-controls">
              <button type="button" className="listings-page-btn" aria-label="Previous">&lt;</button>
              <button type="button" className="listings-page-btn listings-page-btn-active">1</button>
              <button type="button" className="listings-page-btn">2</button>
              <button type="button" className="listings-page-btn">3</button>
              <button type="button" className="listings-page-btn" aria-label="Next">&gt;</button>
            </div>
          </div>

        </main>
      </div>

      {deleteTarget && (
        <div
          className="listings-view-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listings-delete-title"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="listings-view-card-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="listings-view-close"
              aria-label="Close delete confirmation"
              onClick={() => setDeleteTarget(null)}
            >
              <IconX />
            </button>
            <h2 id="listings-delete-title" className="listings-view-heading">Delete listing?</h2>
            <p className="listings-delete-message">
              Are you sure you want to remove "
              {deleteTarget.name ?? deleteTarget.title ?? "this item"}
              " from your listings? This action cannot be undone.
            </p>
            <div className="listings-delete-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => performDelete(deleteTarget)}
              >
                Delete listing
              </button>
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div
          className="listings-view-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listings-view-title"
          onClick={closeView}
        >
          <div className="listings-view-card-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="listings-view-close"
              aria-label="Close"
              onClick={closeView}
            >
              <IconX />
            </button>
            <h2 id="listings-view-title" className="listings-view-heading">{viewIsEditMode ? "Edit listing" : "Listing preview"}</h2>
            <div className="review-card review-listing-card listings-view-card">
              <div className="review-listing-image-wrap">
                <img src={viewItem.thumb} alt="" className="review-listing-image" />
              </div>
              <div className="review-listing-details">
                <h3 className="review-listing-name">{viewItem.name}</h3>
                <p className="review-listing-type">{viewItem.category || "—"} • Recyclable</p>
                <div className="review-listing-meta">
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">QUANTITY</span>
                    <span className="review-listing-meta-value">{viewItem.quantity} {viewItem.unit}</span>
                  </div>
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">PRICING</span>
                    <span className="review-listing-meta-value">₦{viewItem.price} {viewItem.priceUnit}</span>
                  </div>
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">STATUS</span>
                    <span className="review-listing-meta-value">{viewItem.status}</span>
                  </div>
                </div>
              </div>
            </div>
            <section className="review-section listings-view-section">
              <span className="review-section-title">
                <IconDoc className="review-section-icon" />
                ENVIRONMENTAL IMPACT
              </span>
              <div className="listings-view-impact">
                <span className="review-listing-meta-label">CO₂ SAVINGS (est.)</span>
                <span className="review-listing-meta-value">
                  {(() => {
                    const tons = Number(viewItem.quantity) || 0;
                    const kg = Math.round(tons * CO2_KG_PER_TON);
                    return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t CO₂` : `${kg} kg CO₂`;
                  })()}
                </span>
              </div>
            </section>
            {viewIsEditMode && (
              <div className="listings-view-actions">
                <button type="button" className="btn btn-secondary" onClick={closeView}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate("/seller/create-listing", { state: { editListing: viewItem } })}
                >
                  Edit listing
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
