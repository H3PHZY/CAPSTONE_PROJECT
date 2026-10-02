import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";

const ALLOW_NEGOTIATION_KEY = "ecoloop_create_listing_allow_negotiation";
const PRICE_STORAGE_KEY = "ecoloop_create_listing_price";
const SCAN_RESULT_STORAGE_KEY = "ecoloop_create_listing_scan_result";
const CURRENCY_STORAGE_KEY = "ecoloop_create_listing_currency";

function getStoredScanResult() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCAN_RESULT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatPriceRange(priceMin, priceMax, currencySymbol) {
  const min = Number(priceMin);
  const max = Number(priceMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return `${currencySymbol}${Math.round(min).toLocaleString("en-NG")} – ${currencySymbol}${Math.round(max).toLocaleString("en-NG")}`;
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
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconSpark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z"/></svg>
);
const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
);
const IconChartTrend = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.15"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);
const IconChartBar = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const IconShield = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

const STEPS = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", completed: true },
  { num: 3, label: "Price", current: true },
  { num: 4, label: "Scan" },
  { num: 5, label: "Review" },
];

const STEPS_MANUAL = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", completed: true },
  { num: 3, label: "Price", current: true },
  { num: 4, label: "Review" },
];

const isManualMode = () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_manual") === "true";

export default function CreateListingSetPrice() {
  const navigate = useNavigate();
  const isManual = isManualMode();
  const steps = isManual ? STEPS_MANUAL : STEPS;
  useEffect(() => {
    if (!isManual) navigate("/seller/create-listing", { replace: true });
  }, [isManual, navigate]);
  const [allowNegotiation, setAllowNegotiation] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(ALLOW_NEGOTIATION_KEY) === "true";
  });
  const [price, setPrice] = useState(() => {
    if (typeof sessionStorage === "undefined") return "165000";
    return sessionStorage.getItem(PRICE_STORAGE_KEY) || "165000";
  });
  const [currency, setCurrency] = useState(() => {
    if (typeof sessionStorage === "undefined") return "NGN";
    return sessionStorage.getItem(CURRENCY_STORAGE_KEY) || "NGN";
  });
  const currencySymbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "₦";

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(ALLOW_NEGOTIATION_KEY, allowNegotiation ? "true" : "false");
    }
  }, [allowNegotiation]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && price !== "") {
      sessionStorage.setItem(PRICE_STORAGE_KEY, price);
    }
  }, [price]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && currency !== undefined) {
      sessionStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    }
  }, [currency]);

  const priceNumber = Number(price);
  const canContinue = Number.isFinite(priceNumber) && priceNumber > 0;
  const [showPriceError, setShowPriceError] = useState(false);

  const handleContinue = () => {
    if (canContinue) {
      setShowPriceError(false);
      navigate(isManual ? "/seller/create-listing/review" : "/seller/create-listing");
    } else {
      setShowPriceError(true);
    }
  };

  const aiMarketRange = useMemo(() => {
    const scan = getStoredScanResult();
    const priceMin = scan?.priceMin ?? scan?.minPrice ?? scan?.suggestedPriceLow ?? scan?.market_price_min;
    const priceMax = scan?.priceMax ?? scan?.maxPrice ?? scan?.suggestedPriceHigh ?? scan?.market_price_max;
    const rangeText = formatPriceRange(priceMin, priceMax, currencySymbol);
    const demandNote = typeof scan?.demandNote === "string" && scan.demandNote.trim() ? scan.demandNote.trim() : null;
    return {
      rangeText: rangeText ?? null,
      demandNote: demandNote ?? (rangeText ? "Use the range above as a guide based on current market data for this material." : "Complete the scan step to see AI-generated price suggestions."),
    };
  }, [currencySymbol]);

  return (
    <div className="seller-layout seller-layout-create">
      <aside className="producer-sidebar seller-sidebar-white">
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
          <Link to="/seller/account" className="producer-nav-item">
            <IconGear /> <span>Account Settings</span>
          </Link>
        </nav>
      </aside>

      <div className="seller-main-wrap seller-main-wrap-gray">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <Link to="/seller/create-listing">Create Listing</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Set Price</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="set-price-help">
              <span className="set-price-help-text">Help Center</span>
              <IconInfo />
            </div>
          </div>
        </header>

        <main className="create-listing-content set-price-content">
          <h1 className="create-listing-title">Create New Listing Set Price</h1>
          <p className="create-listing-subtitle">Define the price for your material or use the suggested range based on real-time market data.</p>

          <div className="create-listing-stepper material-details-stepper set-price-stepper">
            {steps.map((step, i) => {
              const stepHref =
                step.num === 1
                  ? "/seller/create-listing"
                  : step.num === 2
                    ? "/seller/create-listing/material-details"
                    : step.num === 4
                      ? (isManual ? "/seller/create-listing/review" : "/seller/create-listing/scan")
                      : step.num === 5
                        ? "/seller/create-listing/review"
                        : null;
              const linkStyle = { display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" };
              const circleClass =
                "create-listing-step-circle material-details-step-circle " +
                (step.completed ? "material-details-step-completed " : "") +
                (step.current ? "material-details-step-current " : "") +
                (!step.completed && !step.current ? "material-details-step-pending" : "");
              const content = (
                <>
                  <div className={circleClass}>{step.completed ? <IconCheck /> : step.num}</div>
                  <span className={"create-listing-step-label " + (step.current ? "create-listing-step-label-active" : "")}>{step.label}</span>
                </>
              );
              return (
                <div key={step.num} className="create-listing-step">
                  {stepHref ? (
                    <Link to={stepHref} className="create-listing-step-link" style={linkStyle}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {i < steps.length - 1 && (
                    <div className={"create-listing-step-line " + (step.completed ? "material-details-line-completed" : "material-details-line-pending")} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="set-price-market-card">
            <div className="set-price-market-bg">
              <IconChartTrend />
            </div>
            <div className="set-price-market-header">
              <span className="set-price-market-title">
                <IconSpark /> AI-Generated Market Range
              </span>
              <button type="button" className="set-price-market-info" aria-label="More info">
                <IconInfo />
              </button>
            </div>
            <p className="set-price-market-range">
              {aiMarketRange.rangeText ? (
                <>{aiMarketRange.rangeText} <span className="set-price-market-unit">per ton</span></>
              ) : (
                <span className="set-price-market-unavailable">—</span>
              )}
            </p>
            <p className="set-price-market-note">{aiMarketRange.demandNote}</p>
          </div>

          <div className="create-listing-card set-price-card">
            <label className="material-details-label">Set Your Asking Price</label>
            {showPriceError && !canContinue && (
              <span id="price-error" className="register-field-error set-price-field-error" role="alert">
                Please enter a valid price (greater than 0).
              </span>
            )}
            <div className={"set-price-input-row" + (showPriceError && !canContinue ? " set-price-input-row-invalid" : "")}>
              <span className="set-price-currency" aria-hidden="true" />
              <input
                type="text"
                className="set-price-input"
                placeholder="0.00"
                value={price}
                onChange={(e) => { setPrice(e.target.value.replace(/[^0-9.]/g, "") || ""); setShowPriceError(false); }}
                aria-label="Asking price"
                aria-invalid={showPriceError && !canContinue}
                aria-describedby={showPriceError && !canContinue ? "price-error" : undefined}
              />
              <div className="material-details-select-wrap set-price-unit-wrap">
                <select
                  className="material-details-select set-price-unit-select"
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="NGN">Naira (₦)</option>
                  <option value="USD">Dollar ($)</option>
                  <option value="GBP">Pounds (£)</option>
                </select>
                <IconChevronDown />
              </div>
            </div>
            <p className="material-details-hint set-price-hint">You can also accept bids by setting this as a &quot;Starting Price&quot;.</p>
            <label className="set-price-checkbox-wrap">
              <input
                type="checkbox"
                className="set-price-checkbox"
                checked={allowNegotiation}
                onChange={(e) => setAllowNegotiation(e.target.checked)}
                aria-label="Allow potential buyers to negotiate or send counter-offers"
              />
              <span className="set-price-checkbox-label">Allow potential buyers to negotiate or send counter-offers</span>
            </label>
          </div>

          <div className="material-details-actions">
            <Link to="/seller/create-listing/material-details" className="material-details-back-btn">
              <IconArrowLeft /> Back
            </Link>
            <button
              type="button"
              className="btn btn-primary material-details-continue-btn"
              onClick={handleContinue}
            >
              {isManual ? "Continue to Review" : "Continue to Scan"} <IconArrowRight />
            </button>
          </div>

          <p className="material-details-support">
            Need help with your listing? <Link to="/#contact" className="material-details-support-link">Contact EcoLoop Support</Link>
          </p>

          <div className="set-price-callouts">
            <div className="set-price-callout set-price-callout-blue">
              <IconChartBar />
              <p>Sellers using suggested ranges close deals 40% faster on EcoLoop.</p>
            </div>
            <div className="set-price-callout set-price-callout-orange">
              <IconShield />
              <p>Payment is held in escrow until logistics are confirmed by both parties.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
