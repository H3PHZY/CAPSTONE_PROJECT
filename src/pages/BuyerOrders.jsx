import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AvatarMenu from "../components/AvatarMenu";
import BuyerSidebar from "../components/BuyerSidebar";
import { getMyTransactions } from "../services/transactionsApi";
import { getFriendlyMessage } from "../utils/errorMessages";
import { computeBuyerProgressLevel } from "../utils/buyerProgress";

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconChecklist = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
);

function parseQuantityToKg(qty) {
  if (qty == null || qty === "") return 0;
  if (typeof qty === "number") return qty;
  const s = String(qty).toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  if (s.includes("ton")) return num * 1000;
  if (s.includes("kg")) return num;
  return num;
}

function formatQuantity(kg) {
  const n = Number(kg) || 0;
  return `${Math.round(n)} kg`;
}

function normalizeStatus(status) {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "COMPLETED") return "Completed";
  if (s === "CANCELLED") return "Cancelled";
  return "Pending";
}

function formatDate(dateInput) {
  const d = new Date(dateInput || Date.now());
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function currencySymbol(code) {
  const c = String(code || "").toUpperCase();
  if (c === "NGN" || c === "NAIRA") return "₦";
  if (c === "USD" || c === "DOLLAR") return "$";
  if (c === "GBP" || c === "POUND" || c === "POUNDS") return "£";
  return "₦";
}

function formatMoney(value, symbol = "₦") {
  const n = Number(value) || 0;
  if (n <= 0) return "—";
  return symbol + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function transactionToOrderRow(t) {
  const qtyKg = parseQuantityToKg(t?.quantity);
  const symbol = currencySymbol(t?.currency ?? t?.listing?.currency);
  const total = Number(t?.totalAmount ?? t?.totalPrice ?? t?.amount ?? t?.price ?? 0) || 0;
  const fallbackUnitPrice = Number(t?.listing?.price ?? 0) || 0;
  const priceValue = total > 0 ? total : fallbackUnitPrice;
  return {
    id: String(t?.id ?? `${t?.listingId ?? "tx"}_${t?.createdAt ?? Date.now()}`),
    materialName: t?.listing?.title || t?.listing?.materialType || "Material",
    buyerName: typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer",
    quantityOrdered: formatQuantity(qtyKg),
    priceText: formatMoney(priceValue, symbol),
    orderDate: formatDate(t?.createdAt),
    status: normalizeStatus(t?.status),
  };
}
const RECENT_ORDERS_KEY = "ecoloop_recent_orders";

export default function BuyerOrders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("All Orders");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" ? window.localStorage?.getItem("ecoloop_token") : null;
    setLoading(true);
    setError("");
    if (!token) {
      setTransactions([]);
      setLoading(false);
      return () => { cancelled = true; };
    }

    getMyTransactions()
      .then(({ transactions: list }) => {
        if (!cancelled) setTransactions(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err && typeof err.status === "number" ? err.status : null;
        const raw = err instanceof Error ? err.message : "Failed to load orders.";
        setError(getFriendlyMessage(status, raw, "orders"));
        setTransactions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const orderRows = useMemo(() => {
    const mappedApi = Array.isArray(transactions) ? transactions.map(transactionToOrderRow) : [];
    let recentRows = [];
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) recentRows = parsed;
      } catch (_) {
        recentRows = [];
      }
    }
    const seen = new Set(mappedApi.map((r) => r.id));
    const uniqueRecent = recentRows.filter((r) => r?.id && !seen.has(r.id));
    return [...uniqueRecent, ...mappedApi];
  }, [transactions]);

  const visibleRows = useMemo(() => {
    const rowsByTab = activeTab === "All Orders" ? orderRows : orderRows.filter((r) => r.status === activeTab.replace(" Orders", ""));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rowsByTab;
    return rowsByTab.filter((r) =>
      r.materialName.toLowerCase().includes(q) ||
      r.buyerName.toLowerCase().includes(q) ||
      String(r.id).toLowerCase().includes(q)
    );
  }, [activeTab, orderRows, searchQuery]);

  const progressLevel = useMemo(() => {
    const completedKg = (Array.isArray(transactions) ? transactions : [])
      .filter((t) => String(t?.status || "").toUpperCase() === "COMPLETED")
      .reduce((sum, t) => sum + parseQuantityToKg(t?.quantity), 0);
    return computeBuyerProgressLevel(completedKg / 1000);
  }, [transactions]);

  return (
    <div className="buyer-layout">
      <BuyerSidebar
        active="orders"
        progress={{
          loading,
          tierNum: progressLevel.tierNum,
          tierName: progressLevel.tierName,
          fillPct: progressLevel.fillPct,
        }}
      />

      <div className="buyer-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb buyer-dashboard-topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/buyer/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Orders</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer"}</span>
            </div>
            <AvatarMenu accountPath="/buyer/account" variant="seller-topbar" />
          </div>
        </header>

        <div className="buyer-orders-page">
          <h1 className="orders-page-title">Orders</h1>
          <p className="orders-page-desc">View and manage orders from buyers across the EcoLoop network.</p>

          {error && <div className="register-form-errors" role="alert">{error}</div>}

          <section className="orders-shell">
            <div className="orders-controls">
              <div className="orders-search-wrap">
                <IconSearch />
                <input
                  type="search"
                  className="orders-search-input"
                  placeholder="Search by material, buyer, or order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="orders-tabs">
                {["All Orders", "Pending", "Completed", "Cancelled"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`orders-tab-btn ${activeTab === tab ? "orders-tab-btn-active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>MATERIAL NAME</th>
                    <th>BUYER NAME</th>
                    <th>QUANTITY ORDERED</th>
                    <th>PRICE</th>
                    <th>ORDER DATE</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="orders-table-empty">Loading...</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={7} className="orders-table-empty">No orders found.</td></tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr key={row.id}>
                        <td className="orders-cell-name">{row.materialName}</td>
                        <td>{row.buyerName}</td>
                        <td>{row.quantityOrdered}</td>
                        <td>{row.priceText}</td>
                        <td>{row.orderDate}</td>
                        <td>
                          <span className={`orders-status-pill orders-status-${row.status.toLowerCase()}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <div className="orders-actions">
                            <button type="button" className="orders-action-btn" aria-label="View order">
                              <IconEye />
                            </button>
                            <button type="button" className="orders-action-btn" aria-label="Review checklist">
                              <IconChecklist />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="orders-footer">
              <span>Showing 1 to {Math.max(visibleRows.length, 1)} of {visibleRows.length} orders</span>
              <div className="orders-pagination">
                <button type="button" className="orders-page-btn orders-page-btn-active">1</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
