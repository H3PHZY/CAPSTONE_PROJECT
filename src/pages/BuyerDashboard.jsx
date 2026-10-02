import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AvatarMenu from "../components/AvatarMenu";
import BuyerSidebar from "../components/BuyerSidebar";
import { getMyTransactions } from "../services/transactionsApi";
import { getMarketplaceListings, getListingsFeed } from "../services/listingsApi";
import { getCo2Savings } from "../utils/environmentalImpact";
import { getListingImageUrl } from "../utils/apiConfig";
import { saveBuyerSearch, getBuyerPreferredTerms, scoreRecommendation } from "../utils/buyerBehavior";
import { computeBuyerProgressLevel } from "../utils/buyerProgress";
import { getListingSellerDisplayName } from "../utils/listingSeller";
import { includeListingUnlessNonDraftZeroPrice } from "../utils/listingVisibility";

const IconBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
const IconOrder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconDoc = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
);
const IconDollar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconGlobe = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);
const IconLeaf = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconMapPin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

function Stars({ value }) {
  const v = Math.min(5, Math.max(0, value));
  const full = Math.floor(v);
  const half = v % 1 >= 0.5;
  return (
    <span className="buyer-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full || (i === full + 1 && half) ? "filled" : ""}><IconStar /></span>
      ))}
      <span className="buyer-stars-num">{value}</span>
    </span>
  );
}

/** Parse quantity from pickups/transactions: string (e.g. "1200 kg", "2.4 Tons") or number (kg). */
function quantityToTons(qtyStr) {
  if (qtyStr == null || qtyStr === "") return 0;
  if (typeof qtyStr === "number" && Number.isFinite(qtyStr)) return qtyStr / 1000;
  if (typeof qtyStr !== "string") return 0;
  const s = qtyStr.trim().toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  if (s.includes("ton")) return num;
  if (s.includes("kg")) return num / 1000;
  return num;
}

/** Map API transaction to pickup-like shape for pulse: { quantity } (quantity as string "X kg" or number kg). */
function completedTransactionsToPickups(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  return list
    .filter((t) => String(t?.status || "").toUpperCase() === "COMPLETED")
    .map((t) => {
      const q = t.quantity;
      if (typeof q === "number" && Number.isFinite(q)) return { quantity: `${q} kg` };
      if (typeof q === "string" && q.trim()) return { quantity: q.trim() };
      return { quantity: "0 kg" };
    });
}

const CO2_KG_PER_TON = 500;
const PULSE_BARS_DEFAULT = [0, 0, 0, 0, 0, 0, 0];

function getPulseBarsFromPickups(pickups) {
  const list = Array.isArray(pickups) ? pickups : [];
  const withTons = list.map((p) => ({ ...p, quantityNum: quantityToTons(p && p.quantity) }));
  const total = withTons.reduce((sum, p) => sum + (p.quantityNum || 0), 0);
  if (total <= 0 || !Number.isFinite(total)) return PULSE_BARS_DEFAULT;
  const bars = withTons.slice(0, 7).map((p) => ((p.quantityNum || 0) / total) * 100);
  while (bars.length < 7) bars.push(0);
  return bars.slice(0, 7);
}

function computeBuyerPulseMetrics(pickups) {
  const list = Array.isArray(pickups) ? pickups : [];
  const totalTons = list.reduce((sum, p) => sum + quantityToTons(p && p.quantity), 0);
  const co2SavedKg = Number(totalTons) * CO2_KG_PER_TON;
  const greenScore = totalTons <= 0 ? 0 : Math.min(100, Math.max(0, Math.round(40 + Math.min(totalTons, 10) * 5 + Math.min(co2SavedKg / 1000, 5) * 4)));
  return { totalTons: Number(totalTons) || 0, co2SavedKg: Number(co2SavedKg) || 0, greenScore };
}

/**
 * Spending analytics from completed transactions: total savings vs virgin, avg cost reduction %, materials sourced (tons).
 */
function computeSpendingMetrics(completedTransactions) {
  const list = Array.isArray(completedTransactions) ? completedTransactions : [];
  let totalSpend = 0;
  let totalVirginValue = 0;
  let materialsSourcedTons = 0;
  const virginMultiplier = 1.38; // ~28% savings: recycled price = virgin * 0.72
  for (const t of list) {
    const price = Number(t.listing?.price ?? t.price ?? 0);
    const qty = Number(t.quantity ?? 0);
    const amount = Number(t.totalAmount ?? t.amount ?? (qty > 0 && price > 0 ? qty * price : price));
    if (amount > 0) {
      totalSpend += amount;
      totalVirginValue += amount * virginMultiplier;
    }
    materialsSourcedTons += quantityToTons(t.quantity);
  }
  const totalSavings = Math.max(0, totalVirginValue - totalSpend);
  const avgCostReductionPct = totalVirginValue > 0 ? Math.round((totalSavings / totalVirginValue) * 100) : 0;
  return { totalSavings, totalSpend, avgCostReductionPct, materialsSourcedTons };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Monthly spending and savings from completed transactions for the last 7 months.
 * Uses transaction completedAt/updatedAt/createdAt for month; amounts match spending metrics.
 * @returns {{ monthLabels: string[], spendingByMonth: number[], savingsByMonth: number[], hasData: boolean }}
 */
function computeMonthlyTrends(completedTransactions) {
  const list = Array.isArray(completedTransactions) ? completedTransactions : [];
  const now = new Date();
  const months = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] });
  }
  const spendingByMonth = months.map(() => 0);
  const savingsByMonth = months.map(() => 0);
  const virginMultiplier = 1.38;
  for (const t of list) {
    const dateStr = t.completedAt ?? t.updatedAt ?? t.createdAt;
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) continue;
    const price = Number(t.listing?.price ?? t.price ?? 0);
    const qty = Number(t.quantity ?? 0);
    const amount = Number(t.totalAmount ?? t.amount ?? (qty > 0 && price > 0 ? qty * price : price));
    if (amount <= 0) continue;
    let idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx < 0) idx = months.length - 1;
    spendingByMonth[idx] += amount;
    savingsByMonth[idx] += Math.max(0, amount * virginMultiplier - amount);
  }
  const hasData = spendingByMonth.some((v) => v > 0);
  return { monthLabels: months.map((m) => m.label), spendingByMonth, savingsByMonth, hasData };
}

/** Build SVG polyline points from values (0..1 normalized), viewBox width 400, height 120. */
function valuesToPolyline(values, height = 100) {
  if (!values.length) return "0,120 400,120";
  const max = Math.max(...values, 1);
  const w = 400 / (values.length - 1 || 1);
  return values
    .map((v, i) => `${i * w},${120 - (v / max) * height}`)
    .join(" ");
}

/** Map API transaction to table row (material, quantity, seller, location, status). */
function transactionToTableRow(t) {
  const qty = t.quantity;
  const qtyNum = typeof qty === "number" ? qty : parseFloat(String(qty).replace(/[^0-9.]/g, "")) || 0;
  const quantityStr = qtyNum >= 1000 ? `${(qtyNum / 1000).toFixed(1)} Tons` : `${Math.round(qtyNum)} kg`;
  const s = String(t?.status || "").toUpperCase();
  const status = s === "COMPLETED" ? "Completed" : (s === "ACCEPTED" || s === "IN_TRANSIT" || s === "AWAITING_DELIVERY" || s === "SHIPPED" ? "Awaiting Delivery" : "Pending");
  return {
    material: t.listing?.title || t.listing?.materialType || "—",
    quantity: quantityStr,
    seller: t.seller?.name || t.listing?.sellerName || "Seller",
    location: t.listing?.location || t.listing?.state || "—",
    status,
    rating: t.listing?.rating ?? 4,
  };
}

/** Previous price (e.g. virgin or earlier listing) vs current price — % shown on card. */
function getPriceDiffTag(previousPrice, currentPrice) {
  const prev = Number(previousPrice);
  const curr = Number(currentPrice);
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return "0%";
  if (pct > 0) return `${pct}% MORE`;
  return `${Math.abs(pct)}% LESS`;
}

/** Format CO₂ display from getCo2Savings (same as create-listing / AI-generated). */
function co2DisplayString(quantityTons) {
  const { display } = getCo2Savings(quantityTons);
  return `${display} CO₂ saved`;
}

/**
 * Map API listing (seller-created) to recommended card. Uses listing fields + AI-generated CO2 (getCo2Savings).
 */
function listingToRecommendedCard(listing, defaultImg = "") {
  const weightKg = listing.weight ?? listing.quantity ?? listing.totalWeight ?? 0;
  const weightNum = typeof weightKg === "number" ? weightKg : (parseFloat(String(weightKg).replace(/[^0-9.]/g, "")) || 0);
  const quantityTons = weightNum >= 100 ? weightNum / 1000 : weightNum;
  const qtyStr = quantityTons >= 1 ? `${quantityTons.toFixed(1)} Tons` : `${Math.round(quantityTons * 1000)} kg`;
  const priceNum = Number(listing.price) ?? 0;
  const priceStr = priceNum > 0 ? `P${priceNum.toLocaleString()}` : "P—";
  const previousPrice = priceNum > 0 ? Math.round(priceNum * 1.25) : priceNum;
  const co2 = co2DisplayString(quantityTons);
  return {
    id: listing.id,
    title: listing.title || listing.name || "Listing",
    qty: qtyStr,
    price: priceStr,
    priceNum,
    previousPrice,
    seller: getListingSellerDisplayName(listing),
    rating: listing.rating ?? 4,
    location: listing.location || listing.state || "—",
    co2,
    img: getListingImageUrl(listing, defaultImg),
  };
}

const VIRGIN_BENCHMARK_BY_MATERIAL = {};

/** Normalize listing material type to comparison name (e.g. "HDPE", "Steel"). */
function normalizeMaterialName(materialType) {
  const s = String(materialType || "").toLowerCase();
  if (s.includes("hdpe") || s.includes("polyethylene") || (s.includes("plastic") && s.includes("pe"))) return "HDPE";
  if (s.includes("steel") || s.includes("iron")) return "Steel";
  if (s.includes("cardboard") || s.includes("paper") || s.includes("occ")) return "Cardboard";
  if (s.includes("aluminum") || s.includes("aluminium")) return "Aluminum";
  if (s.includes("glass")) return "Glass";
  if (s.includes("plastic") || s.includes("pet")) return "Plastic";
  if (s.includes("wood")) return "Wood";
  return materialType ? materialType.trim().split(/\s+/)[0] || "Other" : "Other";
}

/**
 * Build price comparison (recycled vs virgin P/kg) from completed transactions.
 * Recycled = actual paid price per kg; virgin = benchmark or estimated (recycled / 0.72).
 */
function computeComparisonFromTransactions(completedTransactions) {
  const list = Array.isArray(completedTransactions) ? completedTransactions : [];
  const byMaterial = {};
  for (const t of list) {
    const price = Number(t.listing?.price ?? t.price ?? 0);
    const qtyNum = Number(t.quantity ?? 0);
    const totalAmount = Number(t.totalAmount ?? t.amount ?? (qtyNum > 0 && price > 0 ? qtyNum * price : price));
    const quantityKg = quantityToTons(t.quantity) * 1000;
    if (quantityKg <= 0 || totalAmount <= 0) continue;
    const recycledPkg = totalAmount / quantityKg;
    const name = normalizeMaterialName(t.listing?.materialType ?? t.listing?.title ?? "");
    if (!byMaterial[name]) byMaterial[name] = { totalAmount: 0, quantityKg: 0 };
    byMaterial[name].totalAmount += totalAmount;
    byMaterial[name].quantityKg += quantityKg;
  }
  return Object.entries(byMaterial).map(([name, { totalAmount, quantityKg }]) => {
    const recycled = Math.round(totalAmount / quantityKg);
    const virginBench = VIRGIN_BENCHMARK_BY_MATERIAL[name.toLowerCase()];
    const virgin = virginBench != null ? virginBench : Math.round(recycled / 0.72);
    return { name, recycled, virgin };
  });
}

function matchesSearch(query, ...values) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => String(v || "").toLowerCase().includes(q));
}

const TAB_OVERVIEW = "overview";
const TAB_PICKUP_ROUTE = "pickup-route";

export default function BuyerDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const [allTransactions, setAllTransactions] = useState([]);
  const [completedForPulse, setCompletedForPulse] = useState([]);
  const [completedTransactionsForRec, setCompletedTransactionsForRec] = useState([]);
  const [recommendedListingsFromApi, setRecommendedListingsFromApi] = useState([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseError, setPulseError] = useState(null);
  const [supplierFeed, setSupplierFeed] = useState({ count: 0, listings: [] });
  const [supplierFeedLoading, setSupplierFeedLoading] = useState(true);
  const [supplierFeedError, setSupplierFeedError] = useState(null);
  const [supplierRadius] = useState(50);

  useEffect(() => {
    let cancelled = false;
    const defaultLat = 6.5244;
    const defaultLng = 3.3792;
    const fetchFeed = (lat, lng) => {
      getListingsFeed({ latitude: lat, longitude: lng, radius: supplierRadius, limit: 50 })
        .then((res) => {
          if (!cancelled) setSupplierFeed({ count: res.count, listings: res.listings || [] });
        })
        .catch(() => {
          if (!cancelled) {
            setSupplierFeedError("Could not load nearby suppliers");
            setSupplierFeed({ count: 0, listings: [] });
          }
        })
        .finally(() => {
          if (!cancelled) setSupplierFeedLoading(false);
        });
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) fetchFeed(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (!cancelled) fetchFeed(defaultLat, defaultLng);
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      fetchFeed(defaultLat, defaultLng);
    }
    return () => { cancelled = true; };
  }, [supplierRadius]);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceListings()
      .then(({ listings }) => {
        if (cancelled) return;
        const active = (listings || [])
          .filter((l) => String(l.status || "").toUpperCase() === "PUBLISHED")
          .filter(includeListingUnlessNonDraftZeroPrice);
        setRecommendedListingsFromApi(active.map((l) => listingToRecommendedCard(l)));
      })
      .catch(() => {
        if (!cancelled) setRecommendedListingsFromApi([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPulseError(null);
    getMyTransactions()
      .then(({ transactions }) => {
        if (!cancelled) {
          const list = transactions || [];
          setAllTransactions(list);
          setCompletedForPulse(completedTransactionsToPickups(list));
          const completed = list.filter((t) => String(t?.status || "").toUpperCase() === "COMPLETED");
          setCompletedTransactionsForRec(completed);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPulseError(err?.message || "Could not load transactions");
          setAllTransactions([]);
          setCompletedForPulse([]);
          setCompletedTransactionsForRec([]);
        }
      })
      .finally(() => {
        if (!cancelled) setPulseLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => saveBuyerSearch(q), 800);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const preferredTerms = getBuyerPreferredTerms(completedTransactionsForRec);
  const recommendedBase = recommendedListingsFromApi;
  const overviewTableRows =
    allTransactions.length > 0
      ? allTransactions.map(transactionToTableRow)
      : [];
  const filteredOverviewItems = overviewTableRows.filter((row) =>
    matchesSearch(searchQuery, row.material, row.quantity, row.seller, row.location, row.status)
  );
  const pulseMetrics = computeBuyerPulseMetrics(completedForPulse);
  const pulseBars = getPulseBarsFromPickups(completedForPulse);
  const spendingMetrics = computeSpendingMetrics(completedTransactionsForRec);
  const filteredRecommended = recommendedBase
    .filter((item) =>
      matchesSearch(searchQuery, item.title, item.qty, item.price, item.seller, item.location, item.co2)
    )
    .slice()
    .sort((a, b) => scoreRecommendation(b, preferredTerms) - scoreRecommendation(a, preferredTerms));
  const comparisonFromTransactions = computeComparisonFromTransactions(completedTransactionsForRec);
  const comparisonBase = comparisonFromTransactions;
  const filteredComparison = comparisonBase.filter((m) =>
    matchesSearch(searchQuery, m.name)
  );
  const progressLevel = computeBuyerProgressLevel(spendingMetrics.materialsSourcedTons);
  const monthlyTrends = computeMonthlyTrends(completedTransactionsForRec);
  const spendingPoints = valuesToPolyline(monthlyTrends.spendingByMonth);
  const savingsPoints = valuesToPolyline(monthlyTrends.savingsByMonth);
  const activeOrdersCount = overviewTableRows.filter((r) => r.status === "Pending" || r.status === "Awaiting Delivery").length;

  return (
    <div className="buyer-layout">
      <BuyerSidebar
        active="dashboard"
        progress={{
          loading: pulseLoading,
          tierNum: progressLevel.tierNum,
          tierName: progressLevel.tierName,
          fillPct: progressLevel.fillPct,
        }}
      />

      <div className="buyer-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb buyer-dashboard-topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span className="breadcrumb-current">Dashboard</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="buyer-search-wrap buyer-search-in-topbar">
              <IconSearch />
              <input
                type="search"
                placeholder="Search listings, materials, or orders..."
                className="buyer-search-input"
                aria-label="Search"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery.trim() ? (
                <button
                  type="button"
                  className="buyer-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer"}</span>
            </div>
            <AvatarMenu accountPath="/buyer/account" variant="seller-topbar" />
          </div>
        </header>

        <div className="buyer-stats">
          <Link to="/buyer/orders" className="buyer-stat-card buyer-stat-card-link">
            <div className="buyer-stat-icon buyer-stat-icon-blue">
              <IconDoc />
            </div>
            <div className="buyer-stat-title">Active Orders</div>
            <div className="buyer-stat-value">{pulseLoading ? "—" : String(activeOrdersCount).padStart(2, "0")}</div>
            <div className="buyer-stat-meta">pending & in delivery</div>
          </Link>
          <Link to="/buyer/orders" className="buyer-stat-card buyer-stat-card-link">
            <div className="buyer-stat-icon buyer-stat-icon-green">
              <IconDollar />
            </div>
            <div className="buyer-stat-title">Total Spend</div>
            <div className="buyer-stat-value">{pulseLoading ? "—" : `₦${Math.round(spendingMetrics.totalSpend).toLocaleString()}`}</div>
          </Link>
          <Link to="/marketplace" className="buyer-stat-card buyer-stat-card-link">
            <div className="buyer-stat-icon buyer-stat-icon-purple">
              <IconGlobe />
            </div>
            <div className="buyer-stat-title">Materials Acquired</div>
            <div className="buyer-stat-value">
              {pulseLoading ? "—" : spendingMetrics.materialsSourcedTons.toFixed(1)}
            </div>
            <div className="buyer-stat-meta">tons</div>
          </Link>
          <div
            role="button"
            tabIndex={0}
            className="buyer-stat-card buyer-stat-card-clickable"
            onClick={() => document.getElementById("sustainability")?.scrollIntoView({ behavior: "smooth" })}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("sustainability")?.scrollIntoView({ behavior: "smooth" }); } }}
            aria-label="CO2 Impact. Jump to Sustainability Pulse"
          >
            <div className="buyer-stat-icon buyer-stat-icon-leaf">
              <IconLeaf />
            </div>
            <div className="buyer-stat-title">CO2 Impact</div>
            <div className="buyer-stat-value">
              {pulseLoading ? "—" : (pulseMetrics.co2SavedKg / 1000).toFixed(1)}
            </div>
            <div className="buyer-stat-meta">tons saved</div>
          </div>
        </div>

        <div className="buyer-tabs">
          <button
            type="button"
            className={"buyer-tab " + (activeTab === TAB_OVERVIEW ? "buyer-tab-active" : "buyer-tab-outline")}
            onClick={() => setActiveTab(TAB_OVERVIEW)}
          >
            Overview
          </button>
          <button
            type="button"
            className={"buyer-tab " + (activeTab === TAB_PICKUP_ROUTE ? "buyer-tab-active" : "buyer-tab-outline")}
            onClick={() => setActiveTab(TAB_PICKUP_ROUTE)}
          >
            <IconPlus /> Create Pickup Route
          </button>
        </div>

        {activeTab === TAB_OVERVIEW && (
        <>
        <h3 className="buyer-section-title">Quick Actions</h3>
        <div className="buyer-quick-actions">
          <Link to="/marketplace" className="buyer-quick-card">
            <IconBag className="buyer-quick-icon buyer-quick-icon-green" />
            <span>Browse Marketplace</span>
          </Link>
          <Link to="/buyer/orders" className="buyer-quick-card">
            <IconOrder className="buyer-quick-icon buyer-quick-icon-blue" />
            <span>My Orders</span>
          </Link>
          <Link to="/buyer/pickup-routes" className="buyer-quick-card">
            <IconMapPin className="buyer-quick-icon buyer-quick-icon-purple" />
            <span>Pickup Routes</span>
          </Link>
          <Link to="/buyer/saved-sellers" className="buyer-quick-card">
            <span className="buyer-quick-icon buyer-quick-icon-gold">★</span>
            <span>Saved Sellers</span>
          </Link>
        </div>

        <div className="buyer-two-col">
          <div className="buyer-pickups">
            <div className="buyer-pickups-header">
              <div>
                <h3 className="buyer-pickups-title">All Orders</h3>
                <p className="buyer-pickups-desc">Pending and completed pickups from your transactions.</p>
              </div>
              <Link to="/buyer/orders" className="buyer-pickups-link">View All Orders</Link>
            </div>
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>MATERIAL</th>
                    <th>QUANTITY</th>
                    <th>SELLER</th>
                    <th>LOCATION</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverviewItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="buyer-table-empty">
                        {searchQuery.trim() ? "No orders match your search." : pulseLoading ? "Loading…" : "No orders yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredOverviewItems.map((row, i) => (
                      <tr key={i}>
                        <td>{row.material}</td>
                        <td>{row.quantity}</td>
                        <td>
                          <span className="buyer-table-seller">{row.seller}</span>
                          <Stars value={row.rating} />
                        </td>
                        <td>{row.location}</td>
                        <td><span className={"buyer-table-status buyer-table-status-" + row.status.toLowerCase()}>{row.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="buyer-right-col">
            <div id="sustainability" className="buyer-pulse-card">
              <h4 className="buyer-pulse-title"><IconLeaf /> Sustainability Pulse</h4>
              {completedForPulse.length > 0 && (
                <p className="buyer-pulse-based-on">Based on {completedForPulse.length} completed transaction{completedForPulse.length !== 1 ? "s" : ""} with sellers</p>
              )}
              {pulseError && <p className="buyer-pulse-error" role="alert">{pulseError}</p>}
              <div className="buyer-pulse-value">
                {pulseLoading ? (
                  <span className="buyer-pulse-loading">Loading…</span>
                ) : (
                  <>
                    {pulseMetrics.co2SavedKg >= 1000
                      ? (pulseMetrics.co2SavedKg / 1000).toFixed(1) + " t"
                      : Math.round(pulseMetrics.co2SavedKg) + " kg"}
                    <span className="buyer-pulse-unit"> CO₂ saved</span>
                  </>
                )}
              </div>
              <div className="buyer-pulse-label">FROM PURCHASES</div>
              <div className="buyer-pulse-desc">
                {pulseLoading ? (
                  "—"
                ) : (
                  <>
                    {pulseMetrics.totalTons >= 1
                      ? pulseMetrics.totalTons.toFixed(1) + " tons"
                      : (pulseMetrics.totalTons * 1000).toFixed(0) + " kg"}{" "}
                    from landfill (items you bought)
                  </>
                )}
              </div>
              <div className="buyer-pulse-score-label">GREEN SCORE</div>
              <div className="buyer-pulse-score-value">{pulseMetrics.greenScore}</div>
              <div className="buyer-pulse-score-bar">
                <div className="buyer-pulse-score-fill" style={{ width: `${Math.min(100, Math.max(0, pulseMetrics.greenScore))}%` }} />
              </div>
              <div className="buyer-pulse-chart">
                <div className="buyer-pulse-chart-bars">
                  {(pulseBars || PULSE_BARS_DEFAULT).map((h, i) => (
                    <div key={i} className="buyer-pulse-chart-bar" style={{ height: `${Math.max(Number(h) || 0, 4)}%` }} title={`${(Number(h) || 0).toFixed(0)}%`} />
                  ))}
                </div>
                <div className="buyer-pulse-chart-labels">
                  <span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span>
                </div>
              </div>
            </div>
            <div className="buyer-supplier-card">
              <h4 className="buyer-supplier-title">Supplier Network</h4>
              <p className="buyer-supplier-desc">Listings ranked by proximity, material match, and recency.</p>
              <div className="buyer-supplier-map">
                {supplierFeedLoading ? (
                  <p className="buyer-table-empty">Loading nearby suppliers…</p>
                ) : supplierFeed.listings.length === 0 ? (
                  <p className="buyer-table-empty">No nearby suppliers yet.</p>
                ) : (
                  <ul className="buyer-supplier-list">
                    {supplierFeed.listings.slice(0, 5).map((s, i) => (
                      <li key={s?.id || i}>
                        {(s?.seller?.name || s?.sellerName || s?.title || "Supplier")} - {(s?.location || s?.state || "Location unavailable")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {supplierFeedError && <p className="buyer-supplier-error" role="alert">{supplierFeedError}</p>}
              <div className="buyer-supplier-meta">Proximity-based feed</div>
              <div className="buyer-supplier-count">
                {supplierFeedLoading ? "Loading…" : `${supplierFeed.count} listing${supplierFeed.count !== 1 ? "s" : ""} within ${supplierRadius} km`}
              </div>
            </div>
          </div>
        </div>

        <div className="buyer-recommended">
          <h3 className="buyer-section-title">Recommended for You</h3>
          <p className="buyer-section-desc">
            {preferredTerms.length > 0
              ? "Based on materials you’ve searched, clicked, and purchased."
              : "Based on your purchase history and preferences. Search, browse, and buy to see personalized picks."}
          </p>
          <div className="buyer-recommended-grid">
            {filteredRecommended.length === 0 ? (
              <p className="buyer-rec-empty">
                {searchQuery.trim() ? "No recommended items match your search." : "No recommendations yet."}
              </p>
            ) : (
              filteredRecommended.map((item, i) => {
                const priceTag = getPriceDiffTag(item.previousPrice, item.priceNum);
                return (
                <Link key={i} to="/marketplace" className="buyer-rec-card">
                  <div className="buyer-rec-image-wrap">
                    <img src={item.img} alt="" />
                    {priceTag != null && <span className="buyer-rec-tag">{priceTag}</span>}
                  </div>
                  <div className="buyer-rec-body">
                    <h4 className="buyer-rec-title">{item.title}</h4>
                    <div className="buyer-rec-qty-price">{item.qty} · {item.price}</div>
                    <div className="buyer-rec-seller">{item.seller} <Stars value={item.rating} /></div>
                    <div className="buyer-rec-location">{item.location}</div>
                    <div className="buyer-rec-co2">{item.co2}</div>
                  </div>
                </Link>
              ); })
            )}
          </div>
        </div>

        <div className="buyer-analytics">
          <h3 className="buyer-section-title">Spending Analytics</h3>
          <p className="buyer-section-desc">Track your costs and savings compared to virgin materials.</p>
          <div className="buyer-analytics-cards">
            <div className="buyer-analytics-card buyer-analytics-card-green">
              <IconDollar />
              <span>
                {pulseLoading ? "—" : `Total Savings P${Math.round(spendingMetrics.totalSavings).toLocaleString()}`}
              </span>
              <small>vs virgin materials</small>
            </div>
            <div className="buyer-analytics-card buyer-analytics-card-blue">
              <span className="buyer-analytics-pct">%</span>
              <span>
                {pulseLoading ? "—" : `Avg. Cost Reduction ${spendingMetrics.avgCostReductionPct}%`}
              </span>
              <small>across all materials</small>
            </div>
            <div className="buyer-analytics-card buyer-analytics-card-purple">
              <IconBox />
              <span>
                {pulseLoading ? "—" : `Materials Sourced ${spendingMetrics.materialsSourcedTons >= 1 ? spendingMetrics.materialsSourcedTons.toFixed(1) + " t" : (spendingMetrics.materialsSourcedTons * 1000).toFixed(0) + " kg"}`}
              </span>
              <small>from completed purchases</small>
            </div>
          </div>
          <div className="buyer-chart-card">
            <h4 className="buyer-chart-title">Monthly Spending Trends</h4>
            <p className="buyer-chart-desc">
              {monthlyTrends.hasData ? "Spending and savings from your completed purchases by month." : "Complete purchases to see spending and savings trends here."}
            </p>
            <div className="buyer-chart-trends">
              <svg viewBox="0 0 400 120" className="buyer-trend-svg" aria-label="Monthly spending and savings">
                <polyline points={spendingPoints} fill="none" stroke="var(--green-primary)" strokeWidth="2" />
                <polyline points={savingsPoints} fill="none" stroke="#3b82f6" strokeWidth="2" />
              </svg>
              <div className="buyer-chart-legend">
                <span className="buyer-legend-dot buyer-legend-green" /> Spending
                <span className="buyer-legend-dot buyer-legend-blue" /> Savings
              </div>
              <div className="buyer-chart-x-labels">
                {monthlyTrends.monthLabels.map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
            </div>
          </div>
            <div className="buyer-chart-card">
            <h4 className="buyer-chart-title">Price Comparison: Recycled vs Virgin Materials</h4>
            <div className="buyer-comparison">
              {filteredComparison.length === 0 ? (
                <p className="buyer-comparison-empty">
                  {searchQuery.trim() ? "No materials match your search." : pulseLoading ? "Loading…" : "No comparison data. Complete purchases to see recycled vs virgin prices by material."}
                </p>
              ) : (
                (() => {
                  const comparisonMax = Math.max(80, ...filteredComparison.flatMap((m) => [m.recycled, m.virgin]));
                  return filteredComparison.map((m, i) => (
                    <div key={i} className="buyer-comparison-row">
                      <span className="buyer-comparison-name">{m.name}</span>
                      <div className="buyer-comparison-bars">
                        <div className="buyer-comparison-bar-wrap">
                          <div className="buyer-comparison-bar buyer-comparison-recycled" style={{ width: `${(m.recycled / comparisonMax) * 100}%` }} />
                          <span className="buyer-comparison-val">{m.recycled} P/kg</span>
                        </div>
                        <div className="buyer-comparison-bar-wrap">
                          <div className="buyer-comparison-bar buyer-comparison-virgin" style={{ width: `${(m.virgin / comparisonMax) * 100}%` }} />
                          <span className="buyer-comparison-val">{m.virgin} P/kg</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
            <div className="buyer-comparison-legend">
              <span><span className="buyer-legend-dot buyer-legend-green" /> Recycled P/kg</span>
              <span><span className="buyer-legend-dot buyer-legend-gray" /> Virgin P/kg</span>
            </div>
          </div>
        </div>
        </>
        )}

        {activeTab === TAB_PICKUP_ROUTE && (
          <div className="buyer-tab-content buyer-pickup-route-placeholder">
            <h3 className="buyer-section-title">Create Pickup Route</h3>
            <p className="buyer-section-desc">Plan a route to collect materials from multiple sellers in one trip.</p>
            <Link to="/buyer/pickup-routes" className="btn btn-primary buyer-pickup-route-btn">
              <IconMapPin /> Open Pickup Routes
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
