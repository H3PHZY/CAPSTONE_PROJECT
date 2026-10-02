import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import imgHDPE from "../assets/services/hdpe.png";
import { useToast } from "../contexts/ToastContext";
import { getMarketplaceListings } from "../services/listingsApi";
import { includeListingUnlessNonDraftZeroPrice } from "../utils/listingVisibility";
import { getListingSellerDisplayName } from "../utils/listingSeller";
import { getListingImageUrl } from "../utils/apiConfig";
import { createTransaction } from "../services/transactionsApi";
import { saveBuyerSearch, saveBuyerListingClick } from "../utils/buyerBehavior";
import { getAuthUser } from "../utils/auth";

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "User") : "User";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "U").toUpperCase();
  return { fullName, initials };
}

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const IconPlusSquare = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconShoppingBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
const IconChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);
const IconCart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconUserGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 12v2"/><path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);

function StarRating({ value }) {
  const full = Math.floor(value);
  const hasHalf = value % 1 >= 0.5;
  return (
    <span className="marketplace-stars" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={"marketplace-star " + (i <= full ? "filled" : i === full + 1 && hasHalf ? "half" : "")}>
          ★
        </span>
      ))}
      <span className="marketplace-rating-num">({value})</span>
    </span>
  );
}

const CO2_KG_PER_TON = 500;

function apiListingToMarketplaceCard(listing, defaultImg) {
  const id = listing.id;
  const title = listing.title || listing.name || "Listing";
  const materialType = String(listing.materialType || "").toLowerCase();
  let category = "plastics";
  if (materialType.includes("metal") || materialType.includes("aluminum") || materialType.includes("steel")) category = "metals";
  else if (materialType.includes("paper") || materialType.includes("cardboard")) category = "paper";
  const weightKg = listing.weight ?? listing.quantity ?? listing.totalWeight ?? 0;
  const quantityTons = typeof weightKg === "number" ? weightKg / 1000 : (parseFloat(String(weightKg).replace(/[^0-9.]/g, "")) || 0) / 1000;
  const quantityStr = quantityTons >= 1 ? `${quantityTons.toFixed(1)} Tons` : `${Math.round(quantityTons * 1000)} kg`;
  const co2Kg = Math.round(quantityTons * CO2_KG_PER_TON);
  const co2Str = co2Kg >= 1000 ? `${(co2Kg / 1000).toFixed(1)} Tons CO₂ saved` : `${co2Kg} kg CO₂ saved`;
  const priceNum = Number(listing.price) ?? 0;
  const priceStr = priceNum >= 1000 ? `₦${(priceNum / 1000).toFixed(0)}K` : `₦${priceNum}`;
  const seller = getListingSellerDisplayName(listing);
  const sellerPhone =
    listing.sellerPhone ??
    listing.sellerPhoneNumber ??
    listing.seller?.phoneNumber ??
    listing.seller?.phone ??
    listing.seller?.phone_number ??
    "";
  const location = listing.location ?? listing.state ?? "—";
  const listed = listing.createdAt || listing.listedAt || listing.listed;
  const listedStr = listed ? (() => {
    const d = new Date(listed);
    const now = new Date();
    const diffMs = now - d;
    const days = Math.floor(diffMs / 86400000);
    if (days >= 1) return `${days} day${days !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours >= 1) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const mins = Math.floor(diffMs / 60000);
    return mins < 1 ? "Just now" : `${mins} min${mins !== 1 ? "s" : ""} ago`;
  })() : "—";
  const grade = listing.grade || (materialType ? "Grade A" : "—");
  const condition = listing.condition || listing.state ? "Good" : "—";
  return {
    id,
    isApi: true,
    category,
    materialType: materialType || title,
    title,
    img: getListingImageUrl(listing, defaultImg),
    price: priceStr,
    co2: co2Str,
    quantity: quantityStr,
    grade,
    condition,
    seller,
    sellerPhone,
    rating: listing.rating ?? 5.0,
    location,
    distance: listing.distance ?? "—",
    listed: listedStr,
  };
}

const FILTERS = [
  { id: "all", label: "All Materials" },
  { id: "plastics", label: "Plastics" },
  { id: "metals", label: "Metals" },
  { id: "paper", label: "Paper & Cardboard" },
];

export default function Marketplace() {
  const navigate = useNavigate();
  const { fullName, initials } = getFullNameAndInitials();
  const user = getAuthUser();
  const userTypeRaw = (user?.userType ?? user?.role ?? "").toString().toLowerCase();
  const isBuyer = userTypeRaw === "buyer";
  const showToast = useToast();
  const [contactModal, setContactModal] = useState(null);
  const [orderModal, setOrderModal] = useState(null);
  const [orderQtyKg, setOrderQtyKg] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [apiListings, setApiListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const RECENT_ORDERS_KEY = "ecoloop_recent_orders";

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" && window.localStorage && window.localStorage.getItem("ecoloop_token");
    if (!token) {
      setApiListings([]);
      return;
    }
    setListingsLoading(true);
    getMarketplaceListings()
      .then((res) => {
        if (cancelled) return;
        const status = (s) => (s || "").toUpperCase();
        // Backend may mark visible listings as either PUBLISHED or ACTIVE.
        const list = (res.listings || []).filter((l) => {
          const s = status(l.status);
          if (!(s === "PUBLISHED" || s === "ACTIVE")) return false;
          return includeListingUnlessNonDraftZeroPrice(l);
        });
        setApiListings(list.map((l) => apiListingToMarketplaceCard(l, imgHDPE)));
      })
      .catch(() => {
        if (!cancelled) setApiListings([]);
      })
      .finally(() => { if (!cancelled) setListingsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => saveBuyerSearch(q), 800);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const allListings = apiListings;
  const filteredListings = allListings.filter((item) => {
    const matchCategory = activeFilterId === "all" || (item.category && item.category === activeFilterId);
    if (!matchCategory) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.seller && item.seller.toLowerCase().includes(q)) ||
      (item.grade && item.grade.toLowerCase().includes(q)) ||
      (item.condition && item.condition.toLowerCase().includes(q))
    );
  });

  const openContact = (item) => {
    saveBuyerListingClick({ id: item.id, title: item.title, materialType: item.materialType, category: item.category });
    setContactModal(item);
  };

  const closeContact = () => setContactModal(null);

  const copySellerPhone = () => {
    const phone = contactModal?.sellerPhone?.trim();
    if (!phone) return;
    try {
      navigator.clipboard.writeText(phone);
      showToast("Phone number copied to clipboard.");
    } catch {
      showToast("Could not copy. Please note the number manually.");
    }
  };

  const openOrder = (item) => {
    if (!isBuyer) return;
    if (!item?.isApi) {
      showToast("Ordering is available for live listings only.");
      return;
    }
    setOrderModal(item);
    setOrderQtyKg("");
  };

  const closeOrder = () => {
    setOrderModal(null);
    setOrderQtyKg("");
  };

  const handleCreateOrder = async () => {
    if (!orderModal) return;
    const qty = Number(orderQtyKg);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setOrdering(true);
    try {
      const tx = await createTransaction({ listingId: orderModal.id, quantity: qty });
      const orderForList = {
        id: String(tx?.transaction?.id || tx?.id || `temp-${Date.now()}`),
        materialName: orderModal.title || "Material",
        buyerName: typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer",
        quantityOrdered: `${Math.round(qty)} kg`,
        priceText: orderModal.price || "—",
        orderDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Pending",
      };
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          const next = [orderForList, ...(Array.isArray(parsed) ? parsed : [])].slice(0, 50);
          window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
        } catch (_) {}
      }
      showToast("Order created successfully.");
      closeOrder();
      navigate("/buyer/orders");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create order. Please try again.";
      showToast(msg);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="seller-layout marketplace-layout">
      <aside className="marketplace-sidebar">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="marketplace-sidebar-logo">
          <img src={ecoLoopLogo} alt="Eco loop" />
        </Link>
        <nav className="marketplace-sidebar-nav">
          {isBuyer ? (
            <>
              <Link to="/buyer/dashboard" className="marketplace-nav-item">
                <IconGrid /> <span>Dashboard</span>
              </Link>
              <Link to="/marketplace" className="marketplace-nav-item marketplace-nav-item-active">
                <IconShoppingBag /> <span>My Marketplace</span>
              </Link>
              <Link to="/buyer/orders" className="marketplace-nav-item">
                <IconCart /> <span>Orders</span>
              </Link>
              <Link to="/buyer/account" className="marketplace-nav-item">
                <IconUserGear /> <span>Account Settings</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/seller/dashboard" className="marketplace-nav-item">
                <IconGrid /> <span>Dashboard</span>
              </Link>
              <div className="marketplace-nav-dropdown">
                <span className="marketplace-nav-item marketplace-nav-dropdown-trigger">
                  <IconPlusSquare /> <span>Create Listing</span>
                </span>
                <div className="marketplace-nav-dropdown-menu">
                  <Link to="/seller/create-listing" className="marketplace-nav-dropdown-option" onClick={() => { try { sessionStorage.removeItem("ecoloop_create_listing_manual"); } catch (_) {} }}>AI Scan</Link>
                  <Link to="/seller/create-listing" className="marketplace-nav-dropdown-option" onClick={() => { try { sessionStorage.setItem("ecoloop_create_listing_manual", "true"); sessionStorage.removeItem("ecoloop_create_listing_scan_result"); } catch (_) {} }}>Manual Entry</Link>
                </div>
              </div>
              <Link to="/seller/inventory" className="marketplace-nav-item">
                <IconBox /> <span>Inventory</span>
              </Link>
              <Link to="/seller/transactions" className="marketplace-nav-item">
                <IconArrows /> <span>Transactions</span>
              </Link>
              <Link to="/seller/messages" className="marketplace-nav-item">
                <IconBell /> <span>Messages</span>
              </Link>
            </>
          )}
        </nav>
        {!isBuyer && (
          <div className="marketplace-sidebar-footer">
            <Link to="/seller/account" className="marketplace-nav-item">
              <IconUserGear /> <span>Account Settings</span>
            </Link>
          </div>
        )}
      </aside>

      <div className="marketplace-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span className="breadcrumb-current">Marketplace</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath={isBuyer ? "/buyer/account" : "/seller/account"} variant="seller-topbar" />
          </div>
        </header>

        <main className="marketplace-content">
          <h1 className="marketplace-title">Marketplace</h1>
          <p className="marketplace-desc">Discover available materials from nearby sellers</p>

          <div className="marketplace-search-row">
            <div className="marketplace-search-wrap">
              <IconSearch />
              <input
                type="search"
                placeholder="Search by material type or seller name..."
                className="marketplace-search-input"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="marketplace-filters">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={"marketplace-filter-pill " + (activeFilterId === f.id ? "marketplace-filter-pill-active" : "")}
                  onClick={() => setActiveFilterId(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="marketplace-count">Showing {filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""}</p>

          <div className="marketplace-grid">
            {filteredListings.map((item) => (
              <article
                key={item.id}
                className="marketplace-card"
                onClick={() => saveBuyerListingClick({ id: item.id, title: item.title, materialType: item.materialType, category: item.category })}
              >
                <div className="marketplace-card-image-wrap">
                  <img src={item.img} alt="" className="marketplace-card-image" />
                  <span className="marketplace-card-seller-badge">{item.seller}</span>
                  <span className="marketplace-card-price">{item.price}</span>
                  <div className="marketplace-card-bottom-left">
                    <span className="marketplace-card-quantity">{item.quantity}</span>
                    <span className="marketplace-card-co2">{item.co2}</span>
                  </div>
                </div>
                <div className="marketplace-card-body">
                  <h2 className="marketplace-card-title">{item.title}</h2>
                  <ul className="marketplace-card-details">
                    <li>Grade: {item.grade}</li>
                    <li>Condition: {item.condition}</li>
                  </ul>
                  <div className="marketplace-card-seller">
                    <span className="marketplace-card-seller-name">{item.seller}</span>
                    <StarRating value={item.rating} />
                    <span className="marketplace-card-location">
                      <IconMapPin /> {item.location} • {item.distance}
                    </span>
                    <span className="marketplace-card-listed">{item.listed}</span>
                  </div>
                  {isBuyer && (
                    <div className="marketplace-card-actions">
                      <button
                        type="button"
                        className="btn btn-secondary marketplace-card-btn"
                        onClick={(e) => { e.stopPropagation(); openOrder(item); }}
                      >
                        Place Order
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary marketplace-card-btn"
                        onClick={(e) => { e.stopPropagation(); openContact(item); }}
                      >
                        Contact Seller
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>

      {contactModal && (
        <div className="contact-seller-overlay" role="dialog" aria-modal="true" aria-labelledby="contact-seller-title">
          <div className="contact-seller-modal">
            <h2 id="contact-seller-title" className="contact-seller-title">
              Contact seller
            </h2>
            <p className="contact-seller-subtitle">
              <strong>{contactModal.seller}</strong> — &ldquo;{contactModal.title}&rdquo;
            </p>
            <div className="contact-seller-phone-wrap">
              <span className="contact-seller-phone-label">Phone number</span>
              <p className="contact-seller-phone-value">
                {contactModal.sellerPhone?.trim() || "Phone number not available"}
              </p>
              {contactModal.sellerPhone?.trim() && (
                <button type="button" className="btn btn-primary contact-seller-copy" onClick={copySellerPhone}>
                  Copy number
                </button>
              )}
            </div>
            <div className="contact-seller-actions">
              <button type="button" className="btn btn-secondary" onClick={closeContact}>
                Close
              </button>
            </div>
            <button type="button" className="contact-seller-close" aria-label="Close" onClick={closeContact}>
              ×
            </button>
          </div>
        </div>
      )}

      {orderModal && (
        <div className="contact-seller-overlay" role="dialog" aria-modal="true" aria-labelledby="order-title">
          <div className="contact-seller-modal">
            <h2 id="order-title" className="contact-seller-title">
              Place order
            </h2>
            <p className="contact-seller-subtitle">
              Order <strong>{orderModal.title}</strong> from <strong>{orderModal.seller}</strong>
            </p>
            <input
              className="contact-seller-textarea"
              style={{ minHeight: "auto", height: "auto" }}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Quantity (kg)"
              value={orderQtyKg}
              onChange={(e) => setOrderQtyKg(e.target.value)}
              aria-label="Quantity in kilograms"
            />
            <div className="contact-seller-actions">
              <button type="button" className="btn btn-secondary" onClick={closeOrder}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateOrder}
                disabled={ordering || !(Number(orderQtyKg) > 0)}
              >
                {ordering ? "Placing…" : "Confirm order"}
              </button>
            </div>
            <button type="button" className="contact-seller-close" aria-label="Close" onClick={closeOrder}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
