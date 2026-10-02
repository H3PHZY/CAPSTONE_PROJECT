import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import { STORAGE_KEYS } from "../utils/environmentalImpact";
import AvatarMenu from "../components/AvatarMenu";

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
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);

const STEPS = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", current: true },
  { num: 3, label: "Price" },
  { num: 4, label: "Scan" },
  { num: 5, label: "Review" },
];

const STEPS_MANUAL = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", current: true },
  { num: 3, label: "Price" },
  { num: 4, label: "Review" },
];

const isManualMode = () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_manual") === "true";

export default function CreateListingMaterialDetails() {
  const { fullName, initials } = getFullNameAndInitials();
  const navigate = useNavigate();
  const isManual = isManualMode();
  const steps = isManual ? STEPS_MANUAL : STEPS;
  useEffect(() => {
    if (!isManual) navigate("/seller/create-listing", { replace: true });
  }, [isManual, navigate]);
  const [materialType, setMaterialType] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.materialType) || "" : ""
  );
  const [quantity, setQuantity] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.quantity) || "" : ""
  );
  const [unit, setUnit] = useState(() =>
    typeof sessionStorage !== "undefined"
      ? (() => {
        const raw = sessionStorage.getItem(STORAGE_KEYS.unit) || "tons";
        const u = String(raw).toLowerCase();
        // Backend rejects `unit=pcs`; only allow kg/tons.
        return u === "pcs" ? "kg" : (u || "tons");
      })()
      : "tons"
  );
  const [description, setDescription] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.description) || "" : ""
  );
  const [listingState, setListingState] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.listingState) || "" : ""
  );
  const [location, setLocation] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.location) || "" : ""
  );
  const [notes, setNotes] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.notes) || "" : ""
  );

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      if (materialType !== undefined) sessionStorage.setItem(STORAGE_KEYS.materialType, materialType);
    }
  }, [materialType]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      if (quantity !== undefined) sessionStorage.setItem(STORAGE_KEYS.quantity, quantity);
    }
  }, [quantity]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      if (unit !== undefined) sessionStorage.setItem(STORAGE_KEYS.unit, unit);
    }
  }, [unit]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && description !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.description, description);
  }, [description]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && listingState !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.listingState, listingState);
  }, [listingState]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && location !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.location, location);
  }, [location]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && notes !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.notes, notes);
  }, [notes]);

  const cleanMaterialType = materialType.trim();
  const quantityNumber = parseFloat(String(quantity).replace(/,/g, "")) || 0;
  const qtyKg = unit === "kg" ? quantityNumber : quantityNumber * 1000; // unit is kg or tons
  const quantityOk = Number.isFinite(qtyKg) && qtyKg >= 100;
  const cleanDescription = description.trim();
  const cleanListingState = listingState.trim();
  const cleanLocation = location.trim();
  const descriptionOk = cleanDescription.length >= 3 && cleanDescription.length <= 2000;
  const listingStateOk = cleanListingState.length >= 2 && cleanListingState.length <= 100;
  const locationOk = cleanLocation.length >= 2 && cleanLocation.length <= 200;
  const canContinue =
    cleanMaterialType.length >= 3 &&
    cleanMaterialType.length <= 200 &&
    quantityOk &&
    descriptionOk &&
    listingStateOk &&
    locationOk;
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const materialTypeInvalid =
    showFieldErrors &&
    (cleanMaterialType.length === 0 || cleanMaterialType.length < 3 || cleanMaterialType.length > 200);
  const quantityInvalid = showFieldErrors && (!quantity.trim() || !Number.isFinite(qtyKg) || qtyKg < 100);
  const descriptionInvalid =
    showFieldErrors && (cleanDescription.length === 0 || cleanDescription.length < 3 || cleanDescription.length > 2000);
  const listingStateInvalid =
    showFieldErrors && (cleanListingState.length === 0 || cleanListingState.length < 2 || cleanListingState.length > 100);
  const locationInvalid =
    showFieldErrors && (cleanLocation.length === 0 || cleanLocation.length < 2 || cleanLocation.length > 200);

  const handleContinue = () => {
    if (canContinue) {
      setShowFieldErrors(false);
      navigate("/seller/create-listing/price");
    } else {
      setShowFieldErrors(true);
    }
  };

  return (
    <div className="seller-layout seller-layout-create">
      <aside className="producer-sidebar seller-sidebar-white seller-sidebar-with-plan">
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
        <div className="seller-sidebar-plan">
          <div className="seller-sidebar-plan-label">PRODUCER PLAN</div>
          <div className="seller-sidebar-plan-bar-wrap">
            <div className="seller-sidebar-plan-bar" style={{ width: "85%" }} />
          </div>
          <div className="seller-sidebar-plan-text">85% of monthly limit used</div>
        </div>
      </aside>

      <div className="seller-main-wrap seller-main-wrap-gray">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <Link to="/seller/create-listing">Create Listing</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Quantity</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="create-listing-content material-details-content">
          <h1 className="create-listing-title">Create New Listing Material Details</h1>
          <p className="create-listing-subtitle">Provide detailed information about your material.</p>

          <div className="create-listing-stepper material-details-stepper">
            {steps.map((step, i) => {
              const stepHref =
                step.num === 1
                  ? "/seller/create-listing"
                  : step.num === 3
                    ? "/seller/create-listing/price"
                    : step.num === 4
                      ? (isManual ? "/seller/create-listing/review" : "/seller/create-listing/scan")
                      : step.num === 5
                        ? "/seller/create-listing/review"
                        : null;
              const circleClass =
                "create-listing-step-circle material-details-step-circle " +
                (step.completed ? "material-details-step-completed " : "") +
                (step.current ? "material-details-step-current " : "") +
                (!step.completed && !step.current ? "material-details-step-pending" : "");
              const content = (
                <>
                  <div className={circleClass}>{step.completed ? <IconCheck /> : step.num}</div>
                  <span className={`create-listing-step-label ${step.current ? "create-listing-step-label-active" : ""}`}>{step.label}</span>
                </>
              );
              const linkDisabled = step.num === 3 && !canContinue;
              return (
                <div key={step.num} className="create-listing-step">
                  {stepHref ? (
                    <Link
                      to={stepHref}
                      className={"create-listing-step-link" + (linkDisabled ? " create-listing-step-link-disabled" : "")}
                      onClick={(e) => linkDisabled && e.preventDefault()}
                      aria-disabled={linkDisabled}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {i < steps.length - 1 && (
                    <div className={`create-listing-step-line ${step.completed ? "material-details-line-completed" : "material-details-line-pending"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="create-listing-card material-details-card">
            <div className="material-details-field">
              <label className="material-details-label">Material Type</label>
              <input
                type="text"
                className={"material-details-input" + (materialTypeInvalid ? " material-details-input-invalid" : "")}
                placeholder="e.g., Polyethylene (PE)"
                aria-label="Material type"
                aria-invalid={materialTypeInvalid}
                aria-describedby={materialTypeInvalid ? "material-type-error" : undefined}
                value={materialType}
                onChange={(e) => { setMaterialType(e.target.value); setShowFieldErrors(false); }}
              />
              {materialTypeInvalid && (
                <span id="material-type-error" className="register-field-error" role="alert">
                  {cleanMaterialType.length === 0
                    ? "Material type is required"
                    : "Material type must be between 3 and 200 characters"}
                </span>
              )}
            </div>
            <div className="material-details-field">
              <label className="material-details-label">Description</label>
              <textarea
                className={"material-details-textarea material-details-input" + (descriptionInvalid ? " material-details-input-invalid" : "")}
                rows={4}
                placeholder="Describe the material, condition, and any relevant details for buyers."
                aria-label="Listing description"
                aria-invalid={descriptionInvalid}
                aria-describedby={descriptionInvalid ? "description-error" : undefined}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setShowFieldErrors(false); }}
              />
              {descriptionInvalid && (
                <span id="description-error" className="register-field-error" role="alert">
                  {cleanDescription.length === 0
                    ? "Description is required"
                    : cleanDescription.length < 3
                      ? "Description must be at least 3 characters"
                      : "Description must be at most 2000 characters"}
                </span>
              )}
            </div>
            <div className="material-details-field">
              <label className="material-details-label">State</label>
              <input
                type="text"
                className={"material-details-input" + (listingStateInvalid ? " material-details-input-invalid" : "")}
                placeholder="e.g., Lagos"
                aria-label="State or region"
                aria-invalid={listingStateInvalid}
                aria-describedby={listingStateInvalid ? "listing-state-error" : undefined}
                value={listingState}
                onChange={(e) => { setListingState(e.target.value); setShowFieldErrors(false); }}
              />
              {listingStateInvalid && (
                <span id="listing-state-error" className="register-field-error" role="alert">
                  {cleanListingState.length === 0 ? "State is required" : "State must be between 2 and 100 characters"}
                </span>
              )}
            </div>
            <div className="material-details-field">
              <label className="material-details-label">Location</label>
              <input
                type="text"
                className={"material-details-input" + (locationInvalid ? " material-details-input-invalid" : "")}
                placeholder="e.g., City, area, or landmark"
                aria-label="Pickup or material location"
                aria-invalid={locationInvalid}
                aria-describedby={locationInvalid ? "location-error" : undefined}
                value={location}
                onChange={(e) => { setLocation(e.target.value); setShowFieldErrors(false); }}
              />
              {locationInvalid && (
                <span id="location-error" className="register-field-error" role="alert">
                  {cleanLocation.length === 0 ? "Location is required" : "Location must be between 2 and 200 characters"}
                </span>
              )}
            </div>
            <div className="material-details-field">
              <label className="material-details-label">Quantity Available</label>
              <div className="material-details-quantity-row">
                <input
                  type="text"
                  className={"material-details-input" + (quantityInvalid ? " material-details-input-invalid" : "")}
                  placeholder="e.g., 500"
                  aria-label="Quantity available"
                  aria-invalid={quantityInvalid}
                  aria-describedby={quantityInvalid ? "quantity-error" : undefined}
                  value={quantity}
                  onChange={(e) => { setQuantity(e.target.value); setShowFieldErrors(false); }}
                />
                <div className="material-details-select-wrap material-details-unit-wrap">
                  <select
                    className="material-details-select material-details-unit-select"
                    aria-label="Unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="tons">TONS</option>
                    <option value="kg">KG</option>
                  </select>
                  <IconChevronDown />
                </div>
              </div>
              <p className="material-details-hint">Minimum listing requirement is 100 kg.</p>
              {quantityInvalid && (
                <span id="quantity-error" className="register-field-error" role="alert">
                  {!quantity.trim()
                    ? "Quantity is required."
                    : (!Number.isFinite(qtyKg) || qtyKg < 100 ? "Quantity must be at least 100 kg." : "")}
                </span>
              )}
            </div>
            <div className="material-details-field">
              <label className="material-details-label material-details-label-optional">
                Notes (optional)
                <span className="material-details-optional-tag">OPTIONAL</span>
              </label>
              <textarea
                className="material-details-textarea"
                placeholder="Pick-up windows, loading help, contact preferences, etc."
                rows={3}
                aria-label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="material-details-actions">
            <Link to="/seller/create-listing" className="material-details-back-btn">
              <IconArrowLeft /> Back
            </Link>
            <button
              type="button"
              className="btn btn-primary material-details-continue-btn"
              onClick={handleContinue}
            >
              Continue <IconArrowRight />
            </button>
          </div>

          <p className="material-details-support">
            Need help with your listing? <Link to="/#contact" className="material-details-support-link">Contact EcoLoop Support</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
