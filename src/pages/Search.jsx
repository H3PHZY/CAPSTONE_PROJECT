import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import AvatarMenu from "../components/AvatarMenu";
import { getListings } from "../services/listingsApi";
import { getMyTransactions } from "../services/transactionsApi";
import { getConversationsForProducer } from "../utils/contactMessages";
import GlobalSearchBar from "../components/GlobalSearchBar";
import { includeListingUnlessNonDraftZeroPrice } from "../utils/listingVisibility";

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
const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

function matchQuery(text, q) {
  if (!q || !text) return false;
  return String(text).toLowerCase().includes(q.toLowerCase());
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get("q") || "").trim();

  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sellerName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Industrial Recycle Co.") : "Industrial Recycle Co.";
  const fullName = sellerName;

  useEffect(() => {
    if (!q) {
      setListings([]);
      setTransactions([]);
      setConversations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError("");
    setLoading(true);

    Promise.all([
      getListings()
        .then((r) => {
          if (cancelled) return [];
          const raw = Array.isArray(r.listings) ? r.listings : [];
          return raw
            .filter((l) => {
              const s = String(l.status || "").toUpperCase();
              return s === "PUBLISHED" || s === "DRAFT" || s === "ACTIVE";
            })
            .filter(includeListingUnlessNonDraftZeroPrice);
        })
        .catch(() => (cancelled ? [] : [])),
      getMyTransactions("seller").then((r) => (cancelled ? [] : (r.transactions || []))).catch(() => (cancelled ? [] : [])),
    ]).then(([listingsList, transactionsList]) => {
      if (cancelled) return;
      setListings(Array.isArray(listingsList) ? listingsList : []);
      setTransactions(Array.isArray(transactionsList) ? transactionsList : []);
      setConversations(getConversationsForProducer(sellerName));
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setError(err?.message || "Search failed");
        setListings([]);
        setTransactions([]);
        setConversations(getConversationsForProducer(sellerName));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [q, sellerName]);

  const listingResults = useMemo(() => {
    if (!q) return [];
    const qLower = q.toLowerCase();
    return listings.filter((l) => {
      const title = l.title ?? l.name ?? l.materialType ?? "";
      const material = l.materialType ?? l.title ?? "";
      return matchQuery(title, q) || matchQuery(material, q) || matchQuery(String(l.id), q);
    });
  }, [listings, q]);

  const transactionResults = useMemo(() => {
    if (!q) return [];
    return transactions.filter((t) => {
      const buyerName = t.buyer?.name ?? t.buyerName ?? t.buyer?.fullName ?? "";
      const material = t.listing?.title ?? t.listing?.materialType ?? t.materialType ?? "";
      return matchQuery(buyerName, q) || matchQuery(material, q) || matchQuery(String(t.id), q);
    });
  }, [transactions, q]);

  const messageResults = useMemo(() => {
    if (!q) return [];
    return conversations.filter((c) => {
      const buyer = c.buyerName ?? "";
      const title = c.listingTitle ?? "";
      return matchQuery(buyer, q) || matchQuery(title, q);
    });
  }, [conversations, q]);

  const totalResults = listingResults.length + transactionResults.length + messageResults.length;

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
          <Link to="/seller/listings" className="producer-nav-item">
            <IconList /> <span>Listings</span>
          </Link>
          <Link to="/seller/transactions" className="producer-nav-item">
            <IconArrows /> <span>Transactions</span>
          </Link>
          <Link to="/seller/messages" className="producer-nav-item">
            <IconMessage /> <span>Messages</span>
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
            <span className="breadcrumb-current">Search</span>
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
              <span className="seller-topbar-user-role">Producer Account</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="seller-transactions-main" style={{ padding: "1.5rem 2rem" }}>
          <h1 className="seller-transactions-title" style={{ marginBottom: "0.5rem" }}>Search</h1>
          {!q ? (
            <p className="search-placeholder-text">Enter a term in the search bar to find listings, transactions, and messages.</p>
          ) : (
            <>
              <p className="search-results-heading" aria-live="polite">
                Results for &quot;{q}&quot;{loading ? "…" : ` (${totalResults} found)`}
              </p>
              {error && <div className="seller-transactions-error" role="alert">{error}</div>}
              {loading ? (
                <p className="search-loading">Loading…</p>
              ) : (
                <div className="search-results-sections">
                  {listingResults.length > 0 && (
                    <section className="search-results-section" aria-label="Listings">
                      <h2 className="search-section-title">
                        <IconList /> Listings
                      </h2>
                      <ul className="search-results-list">
                        {listingResults.map((l) => {
                          const title = l.title ?? l.name ?? l.materialType ?? "Listing";
                          return (
                            <li key={l.id}>
                              <Link to="/seller/listings" className="search-result-link">
                                {title}
                                {l.id && <span className="search-result-meta">ID: {String(l.id).slice(0, 8)}</span>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                  {transactionResults.length > 0 && (
                    <section className="search-results-section" aria-label="Transactions">
                      <h2 className="search-section-title">
                        <IconArrows /> Transactions
                      </h2>
                      <ul className="search-results-list">
                        {transactionResults.map((t) => {
                          const buyerName = t.buyer?.name ?? t.buyerName ?? t.buyer?.fullName ?? "Buyer";
                          const material = t.listing?.title ?? t.listing?.materialType ?? t.materialType ?? "Material";
                          return (
                            <li key={t.id}>
                              <Link to="/seller/transactions" className="search-result-link">
                                {buyerName} · {material}
                                <span className="search-result-meta">{String(t.status || "—")}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                  {messageResults.length > 0 && (
                    <section className="search-results-section" aria-label="Messages">
                      <h2 className="search-section-title">
                        <IconMessage /> Messages
                      </h2>
                      <ul className="search-results-list">
                        {messageResults.map((c) => (
                          <li key={c.id}>
                            <Link to="/seller/messages" state={{ openConversationId: c.id }} className="search-result-link">
                              {c.buyerName ?? "Buyer"} · {c.listingTitle ?? "Conversation"}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {!loading && totalResults === 0 && (
                    <p className="search-no-results">No results found for &quot;{q}&quot;. Try a different term.</p>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
