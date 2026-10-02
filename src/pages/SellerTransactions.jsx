import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import AvatarMenu from "../components/AvatarMenu";
import GlobalSearchBar from "../components/GlobalSearchBar";
import { useToast } from "../contexts/ToastContext";
import { getFriendlyMessage } from "../utils/errorMessages";
import { getMyTransactions, updateTransactionStatus } from "../services/transactionsApi";

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
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconFilter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);
const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconReceipt = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h12v20l-2-1-2 1-2-1-2 1-2-1-2 1V2z"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></svg>
);

function formatMoney(value, currency = "₦") {
  const n = Number(value) || 0;
  return currency + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseQuantityToTons(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    // Heuristic: small numbers are tons, large numbers are kg.
    return v <= 50 ? v : v / 1000;
  }
  const s = String(v).toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  if (s.includes("ton")) return num;
  if (s.includes("kg")) return num / 1000;
  return num <= 50 ? num : num / 1000;
}

function formatTons(tons) {
  const t = Number(tons) || 0;
  return `${t.toFixed(1)} Tons`;
}

function formatDateShort(isoLike) {
  try {
    const d = isoLike ? new Date(isoLike) : new Date();
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function normalizeStatus(status) {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "ACCEPTED") return "ACCEPTED";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "REJECTED") return "REJECTED";
  return "PENDING";
}

function statusLabel(status) {
  const s = normalizeStatus(status);
  if (s === "PENDING") return "Pending";
  if (s === "ACCEPTED") return "Accepted";
  if (s === "COMPLETED") return "Completed";
  if (s === "REJECTED") return "Rejected";
  return s;
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(text) {
  const s = String(text ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Generate and download a receipt (HTML) for a completed transaction row. */
function downloadReceipt(row) {
  const dateStr = formatDateShort(row.date);
  const priceStr = formatMoney(row.price, "₦");
  const quantityStr = formatTons(row.tons);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Receipt - ${escapeHtml(row.material)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:1.5rem;color:#1f2937;} h1{font-size:1.25rem;margin:0 0 1rem;} .row{margin:0.5rem 0;} .label{color:#6b7280;} strong{color:#1f2937;}</style></head>
<body>
<h1>EcoLoop – Transaction Receipt</h1>
<div class="row"><span class="label">Transaction ID:</span> <strong>${escapeHtml(String(row.id))}</strong></div>
<div class="row"><span class="label">Date:</span> <strong>${escapeHtml(dateStr)}</strong></div>
<div class="row"><span class="label">Buyer:</span> <strong>${escapeHtml(row.buyerName)}</strong></div>
<div class="row"><span class="label">Material:</span> <strong>${escapeHtml(row.material)}</strong></div>
<div class="row"><span class="label">Quantity:</span> <strong>${escapeHtml(quantityStr)}</strong></div>
<div class="row"><span class="label">Amount:</span> <strong>${escapeHtml(priceStr)}</strong></div>
<div class="row"><span class="label">Status:</span> <strong>${escapeHtml(statusLabel(row.status))}</strong></div>
<p style="margin-top:2rem;font-size:0.85rem;color:#6b7280;">Thank you for using EcoLoop. You can print this page or save as PDF.</p>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EcoLoop-Receipt-${String(row.id).replace(/[^a-zA-Z0-9-_]/g, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 5;

export default function SellerTransactions() {
  const showToast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [viewing, setViewing] = useState(null);

  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Industrial Recycle Co.") : "Industrial Recycle Co.";

  useEffect(() => {
    let cancelled = false;
    let pollId = null;

    const fetchTxs = async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setError("");
          setLoading(true);
        }
        const { transactions: list, count } = await getMyTransactions("seller");
        if (cancelled) return;
        const txs = Array.isArray(list) ? list : [];
        setTransactions(txs);
        setTotalCount(typeof count === "number" ? count : txs.length);
      } catch (err) {
        if (cancelled) return;
        const status = err && typeof err.status === "number" ? err.status : null;
        const raw = err instanceof Error ? err.message : "Failed to load transactions";
        setError(getFriendlyMessage(status, raw, "transactions"));
        setTransactions([]);
        setTotalCount(0);
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    fetchTxs({ silent: false });

    // Keep the list fresh so new buyer orders appear as Pending.
    pollId = window.setInterval(() => {
      if (document?.hidden) return;
      fetchTxs({ silent: true });
    }, 15000);

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  const rows = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : [];
    return list.map((t) => {
      const buyerName = t.buyer?.name || t.buyerName || t.buyer?.fullName || "Buyer";
      const material = t.listing?.title || t.listing?.materialType || t.materialType || "Material";
      const tons = parseQuantityToTons(t.quantity ?? t.listing?.quantity ?? t.listing?.weight ?? t.weight);
      const price = Number(t.totalAmount ?? t.amount ?? t.price ?? t.listing?.price ?? 0) || 0;
      const status = normalizeStatus(t.status);
      const date = t.completedAt ?? t.updatedAt ?? t.createdAt ?? t.date;
      return {
        id: t.id,
        raw: t,
        buyerName,
        material,
        tons,
        price,
        status,
        date,
      };
    });
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let out = rows;
    if (statusFilter !== "ALL") out = out.filter((r) => r.status === statusFilter);
    if (q) {
      out = out.filter((r) =>
        r.buyerName.toLowerCase().includes(q) ||
        r.material.toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, searchQuery, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = filtered.length ? Math.min(filtered.length, safePage * PAGE_SIZE) : 0;

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    return filtered
      .filter((r) => {
        const d = r.date ? new Date(r.date) : null;
        if (!d || isNaN(d.getTime())) return false;
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && (r.status === "ACCEPTED" || r.status === "COMPLETED");
      })
      .reduce((sum, r) => sum + r.price, 0);
  }, [filtered]);

  const successRate = useMemo(() => {
    const denom = filtered.filter((r) => r.status !== "REJECTED").length || 0;
    const num = filtered.filter((r) => r.status === "COMPLETED").length || 0;
    return denom > 0 ? Math.round((num / denom) * 100) : 0;
  }, [filtered]);

  const sustainabilityTons = useMemo(() => {
    return filtered.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + (r.tons || 0), 0);
  }, [filtered]);

  const avgAcceptanceDays = useMemo(() => {
    const acceptedOrCompleted = rows.filter((r) => r.status === "ACCEPTED" || r.status === "COMPLETED");
    const diffs = acceptedOrCompleted.map((r) => {
      const t = r.raw;
      const start = t.createdAt ? new Date(t.createdAt) : null;
      const end = (t.updatedAt || t.completedAt) ? new Date(t.updatedAt || t.completedAt) : null;
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const days = (end - start) / 86400000;
      return days > 0 ? days : null;
    }).filter((d) => typeof d === "number");
    if (!diffs.length) return null;
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.round(avg * 10) / 10;
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const handleExport = () => {
    const header = ["Buyer Name", "Material Name", "Quantity (Tons)", "Offered Price", "Status", "Date"];
    const lines = [
      header.join(","),
      ...filtered.map((r) => [
        csvEscape(r.buyerName),
        csvEscape(r.material),
        csvEscape(r.tons.toFixed(1)),
        csvEscape(r.price.toFixed(2)),
        csvEscape(statusLabel(r.status)),
        csvEscape(formatDateShort(r.date)),
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ecoloop-transactions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Exported transactions.");
  };

  const handleUpdateStatus = async (row, nextStatus) => {
    try {
      await updateTransactionStatus(row.id, nextStatus);
      setTransactions((prev) => prev.map((t) => String(t.id) === String(row.id) ? { ...t, status: nextStatus } : t));
      showToast(`Transaction marked ${statusLabel(nextStatus)}.`);
    } catch (err) {
      const status = err && typeof err.status === "number" ? err.status : null;
      const raw = err instanceof Error ? err.message : "Update failed";
      showToast(getFriendlyMessage(status, raw, "transactions"));
    }
  };

  const handleAccept = (row) => {
    if (window.confirm("Accept this transaction from " + (row.buyerName || "the buyer") + "?")) {
      handleUpdateStatus(row, "ACCEPTED");
    }
  };

  const handleMarkCompleted = (row) => {
    if (window.confirm("Mark this transaction as completed? This will finalize the sale.")) {
      handleUpdateStatus(row, "COMPLETED");
    }
  };

  const handleReject = (row) => {
    if (window.confirm("Reject this transaction? The buyer will be notified. This cannot be undone.")) {
      handleUpdateStatus(row, "REJECTED");
    }
  };

  const handleReceipt = (row) => {
    downloadReceipt(row);
    showToast("Receipt downloaded.");
  };

  return (
    <div className="seller-layout producer-dashboard-layout seller-transactions-layout">
      <aside className="producer-sidebar">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="producer-sidebar-logo">
          <img src={ecoLoopLogo} alt="Eco loop" />
        </Link>
        <nav className="producer-sidebar-nav">
          <Link to="/seller/dashboard" className="producer-nav-item">
            <IconGrid9 /> <span>Dashboard</span>
          </Link>
          <Link to="/seller/inventory" className="producer-nav-item">
            <IconBox /> <span>Inventory</span>
          </Link>
          <Link to="/seller/listings" className="producer-nav-item">
            <IconList /> <span>Listings</span>
          </Link>
          <Link to="/seller/transactions" className="producer-nav-item producer-nav-item-active">
            <IconArrows /> <span>Transactions</span>
          </Link>
          <Link to="/seller/account" className="producer-nav-item">
            <IconGear /> <span>Account Settings</span>
          </Link>
        </nav>

        <div className="seller-transactions-impact">
          <div className="seller-transactions-impact-label">SUSTAINABILITY IMPACT</div>
          <div className="seller-transactions-impact-value">
            {sustainabilityTons.toFixed(1)} <span className="seller-transactions-impact-unit">Tons</span>
          </div>
        </div>
      </aside>

      <div className="seller-main-wrap">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Transactions</span>
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="seller-transactions-main">
          <div className="seller-transactions-header">
            <h1 className="seller-transactions-title">Transactions</h1>
            <button type="button" className="seller-transactions-export" onClick={handleExport}>
              <IconDownload /> Export Records
            </button>
          </div>

          <div className="seller-transactions-toolbar">
            <div className="seller-transactions-filter">
              <IconFilter />
              <input
                type="search"
                className="seller-transactions-filter-input"
                placeholder="Filter by buyer or material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="seller-transactions-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="seller-transactions-card">
            {error && <div className="seller-transactions-error" role="alert">{error}</div>}
            <table className="seller-transactions-table">
              <thead>
                <tr>
                  <th>BUYER NAME</th>
                  <th>MATERIAL NAME</th>
                  <th>QUANTITY</th>
                  <th>OFFERED PRICE</th>
                  <th>STATUS</th>
                  <th>DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="seller-transactions-empty">Loading…</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} className="seller-transactions-empty">No transactions match your filters.</td></tr>
                ) : (
                  paged.map((r) => (
                    <tr key={r.id}>
                      <td className="seller-transactions-buyer">
                        <div className="seller-transactions-buyer-avatar" aria-hidden="true">
                          {r.buyerName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span>{r.buyerName}</span>
                      </td>
                      <td>{r.material}</td>
                      <td>{formatTons(r.tons)}</td>
                      <td className="seller-transactions-money">{formatMoney(r.price, "₦")}</td>
                      <td>
                        <span className={`seller-transactions-status-pill seller-transactions-status-${r.status.toLowerCase()}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td>{formatDateShort(r.date)}</td>
                      <td className="seller-transactions-actions">
                        <button type="button" className="seller-transactions-action" aria-label="View" onClick={() => setViewing(r)}>
                          <IconEye />
                        </button>
                        {r.status === "COMPLETED" ? (
                          <button type="button" className="seller-transactions-action" aria-label="Download receipt" onClick={() => handleReceipt(r)}>
                            <IconReceipt />
                          </button>
                        ) : r.status === "REJECTED" ? null : (
                          <>
                            {r.status === "PENDING" && (
                              <button
                                type="button"
                                className="seller-transactions-action seller-transactions-action-ok"
                                aria-label="Accept transaction"
                                onClick={() => handleAccept(r)}
                              >
                                <IconCheck />
                              </button>
                            )}
                            {r.status === "ACCEPTED" && (
                              <button
                                type="button"
                                className="seller-transactions-action seller-transactions-action-ok"
                                aria-label="Mark as completed"
                                onClick={() => handleMarkCompleted(r)}
                              >
                                <IconCheck />
                              </button>
                            )}
                            <button
                              type="button"
                              className="seller-transactions-action seller-transactions-action-bad"
                              aria-label="Reject transaction"
                              onClick={() => handleReject(r)}
                            >
                              <IconX />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="seller-transactions-footer">
              <div className="seller-transactions-summary">
                Showing {showingFrom} to {showingTo} of {Math.max(totalCount, filtered.length)} transactions
              </div>
              <div className="seller-transactions-pagination" role="navigation" aria-label="Pagination">
                {[...Array(pageCount)].slice(0, 3).map((_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`seller-transactions-page ${safePage === n ? "active" : ""}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="seller-transactions-metrics">
            <div className="seller-transactions-metric">
              <div className="seller-transactions-metric-label">AVERAGE ACCEPTANCE</div>
              <div className="seller-transactions-metric-value">{avgAcceptanceDays == null ? "—" : `${avgAcceptanceDays} Days`}</div>
            </div>
            <div className="seller-transactions-metric">
              <div className="seller-transactions-metric-label">REVENUE (MONTH)</div>
              <div className="seller-transactions-metric-value">{formatMoney(monthlyRevenue, "₦")}</div>
            </div>
            <div className="seller-transactions-metric">
              <div className="seller-transactions-metric-label">SUCCESS RATE</div>
              <div className="seller-transactions-metric-value">{successRate}%</div>
            </div>
          </div>
        </main>
      </div>

      {viewing && (
        <div className="contact-seller-overlay" role="dialog" aria-modal="true" aria-labelledby="tx-view-title">
          <div className="contact-seller-modal">
            <h2 id="tx-view-title" className="contact-seller-title">Transaction details</h2>
            <p className="contact-seller-subtitle">
              <strong>{viewing.buyerName}</strong> • {viewing.material}
            </p>
            <div className="seller-transactions-modal-grid">
              <div><strong>Status:</strong> {statusLabel(viewing.status)}</div>
              <div><strong>Quantity:</strong> {formatTons(viewing.tons)}</div>
              <div><strong>Offered price:</strong> {formatMoney(viewing.price, "₦")}</div>
              <div><strong>Date:</strong> {formatDateShort(viewing.date)}</div>
              <div><strong>ID:</strong> {String(viewing.id)}</div>
            </div>
            <div className="contact-seller-actions">
              {viewing.status === "COMPLETED" && (
                <button type="button" className="seller-transactions-export" style={{ marginRight: "0.5rem" }} onClick={() => { handleReceipt(viewing); }}>
                  <IconReceipt /> Download receipt
                </button>
              )}
              <button type="button" className="contact-seller-close" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

