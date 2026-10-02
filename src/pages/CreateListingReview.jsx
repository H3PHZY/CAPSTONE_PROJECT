import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import { createListingManual, createListingAi } from "../services/listingsApi";
import {
  getQuantityTonsFromStorage,
  hasQuantityInStorage,
  getMaterialTypeFromStorage,
  getCo2Savings,
  getRecyclabilityPercent,
  STORAGE_KEYS,
} from "../utils/environmentalImpact";
import { DRAFT_SAVED } from "../utils/successMessages";
import { getFriendlyMessage } from "../utils/errorMessages";

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Producer") : "Producer";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "P").toUpperCase();
  return { fullName, initials };
}

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
);
const IconScan = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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
const IconLeaf = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);
const IconSpark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z"/></svg>
);
const IconRecycle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16l-4-4m0 0l4-4m-4 4h10a4 4 0 014 4v1M17 8l4 4m0 0l-4 4m4-4H7a4 4 0 01-4-4V7"/></svg>
);
const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);
const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const IconArrowUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
);

const STEPS = [
  { num: 1, label: "Input Details", completed: true },
  { num: 2, label: "Review", completed: true },
];

const STEPS_MANUAL = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", completed: true },
  { num: 3, label: "Price", completed: true },
  { num: 4, label: "Review", completed: true },
];

const isManualMode = () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_manual") === "true";

export default function CreateListingReview() {
  const { fullName, initials } = getFullNameAndInitials();
  const navigate = useNavigate();
  const isManual = isManualMode();
  const steps = isManual ? STEPS_MANUAL : STEPS; // AI Scan: 2 steps (Input Details, Review)
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState(() => {
    if (typeof sessionStorage === "undefined") return "";
    const raw = sessionStorage.getItem(STORAGE_KEYS.notes);
    if (raw != null) return raw; // keep empty string if user cleared notes
    return "";
  });
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesEditDraft, setNotesEditDraft] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  const startEditingNotes = () => {
    setNotesEditDraft(specialInstructions);
    setIsEditingNotes(true);
  };
  const saveNotes = () => {
    const trimmed = notesEditDraft.trim();
    setSpecialInstructions(trimmed);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_KEYS.notes, trimmed);
    setIsEditingNotes(false);
  };
  const cancelEditingNotes = () => {
    setNotesEditDraft(specialInstructions);
    setIsEditingNotes(false);
  };

  const handleSaveDraft = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("ecoloop_create_listing_draft_saved_at", new Date().toISOString());
    }
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 3000);
  };

  const quantityTons = getQuantityTonsFromStorage();
  const materialType = getMaterialTypeFromStorage();
  const hasQuantity = hasQuantityInStorage();
  const hasMaterialType = (materialType || "").trim().length > 0;
  const rawUnitFromStorage = typeof sessionStorage !== "undefined"
    ? (sessionStorage.getItem(STORAGE_KEYS.unit) || "tons").toLowerCase()
    : "tons";
  const rawUnitFromStorageSafe = rawUnitFromStorage === "pcs" ? "kg" : rawUnitFromStorage;
  const rawQuantityFromStorage = typeof sessionStorage !== "undefined" ? parseFloat(String(sessionStorage.getItem(STORAGE_KEYS.quantity) || "").replace(/[^0-9.]/g, "")) || 0 : 0;
  const quantityDisplay = rawUnitFromStorageSafe === "kg"
    ? `${Math.round(rawQuantityFromStorage)} kg`
    : quantityTons >= 1
      ? `${quantityTons.toFixed(1)} Tons`
      : `${Math.round(quantityTons * 1000)} kg`;
  const { display: co2Display } = getCo2Savings(quantityTons);
  const recyclabilityPercent = getRecyclabilityPercent(materialType);

  const rawPriceFromStorage = typeof sessionStorage !== "undefined"
    ? String(sessionStorage.getItem("ecoloop_create_listing_price") || "")
    : "";
  const priceFromStorage = parseFloat(rawPriceFromStorage.replace(/[^0-9.]/g, ""));
  const currency = typeof sessionStorage !== "undefined"
    ? (sessionStorage.getItem(STORAGE_KEYS.currency) || "NGN").trim().toUpperCase()
    : "NGN";
  const currencySymbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "₦";
  const allowNegotiationFromStorage = typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_allow_negotiation") === "true";
  const weightKg = Math.round(quantityTons * 1000) || 5000;
  const cleanMaterialType = (materialType || "").trim();
  const rawTitleFromStorage = typeof sessionStorage !== "undefined"
    ? String(sessionStorage.getItem("ecoloop_create_listing_title") || "")
    : "";
  const cleanTitleFromStorage = rawTitleFromStorage.trim();
  const titleFromFlow = cleanTitleFromStorage || cleanMaterialType;
  const imagePreview = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ecoloop_create_listing_upload") : null;
  const listingDescriptionPreview =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.description) || "").trim() : "";
  const listingStatePreview =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.listingState) || "").trim() : "";
  const listingLocationPreview =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.location) || "").trim() : "";
  const impactStepName = isManual ? "Quantity step" : "Input Details";
  const impactStepPath = isManual ? "/seller/create-listing/material-details" : "/seller/create-listing";

  /** Publish listing to the marketplace only when the user clicks "Publish Listing". No auto-publish on load or navigation. */
  const handlePublish = async (e) => {
    e.preventDefault();
    setPublishError("");
    setPublishing(true);
    try {
      const image = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ecoloop_create_listing_upload") : null;
      const allowNegotiation = typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_allow_negotiation") === "true";
      const title = titleFromFlow;
      const description =
        typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.description) || "").trim() : "";
      const state =
        typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.listingState) || "").trim() : "";
      const location =
        typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.location) || "").trim() : "";
      const notes = specialInstructions.trim();
      const price = priceFromStorage;
      const materialTypeStr = (materialType || "PLASTIC").trim().toUpperCase();
      const rawUnit = (typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.unit) || "tons") : "tons").toLowerCase();
      const rawUnitSafe = rawUnit === "pcs" ? "kg" : rawUnit;
      const rawQty = typeof sessionStorage !== "undefined" ? parseFloat(String(sessionStorage.getItem(STORAGE_KEYS.quantity) || "").replace(/[^0-9.]/g, "")) || 0 : 0;
      const quantityForApi = rawUnitSafe === "kg" ? weightKg : Number(quantityTons.toFixed(1));
      const unitForApi = rawUnitSafe === "kg" ? "kg" : "tons";

      // Debug logs to verify what we send to backend (remove after debugging)
      // eslint-disable-next-line no-console
      console.log("[CreateListingReview] publish payload snapshot", {
        flow: image && image.startsWith("data:") ? "ai" : "manual",
        materialTypeFromStorage: materialType,
        titleFromFlow,
        title,
        price,
        currency,
        hasImage: Boolean(image),
        quantityForApi,
        unitForApi,
        state,
        location,
        notesPreview: notes ? `${notes.slice(0, 40)}${notes.length > 40 ? "..." : ""}` : "",
      });

      if (!image || !title || !Number.isFinite(price) || price <= 0) {
        setPublishError("Image, Title, Material Type, and Price are required to publish. Please go back and complete these fields.");
        return;
      }
      if (!description || description.length < 3) {
        setPublishError("Description is required (at least 3 characters). Go back and complete the listing form.");
        return;
      }
      if (!state || state.length < 2) {
        setPublishError("State is required. Go back and complete the listing form.");
        return;
      }
      if (isManual && (!location || location.length < 2)) {
        setPublishError("Location is required for manual listings. Go back and complete the listing form.");
        return;
      }

      // Validate quantity for backend payload.
      const quantityOkForApi =
        rawUnitSafe === "kg"
          ? Number.isFinite(quantityForApi) && quantityForApi >= 100
          : Number.isFinite(quantityForApi) && quantityForApi >= 0.1; // tons
      if (!quantityOkForApi) {
        setPublishError("Quantity is required. Please go back and complete the quantity step.");
        return;
      }

      if (!materialTypeStr || materialTypeStr.length < 3) {
        setPublishError("Material type is required. Please go back and complete the material step.");
        return;
      }

      let data;
      if (!isManual) {
        data = await createListingAi({
          image,
          title,
          description,
          price,
          currency,
          state,
          location,
          notes,
          materialType: materialTypeStr,
          quantity: quantityForApi,
          unit: unitForApi,
          allowNegotiation,
        });
      } else {
        data = await createListingManual({
          image,
          title,
          description,
          materialType: materialTypeStr,
          quantity: quantityForApi,
          unit: unitForApi,
          price,
          currency,
          state,
          location,
          notes,
        });
      }
      const listingId = data.listing?.id ?? data.id ?? data.listingId;
      const listing = data.listing ?? data;
      navigate("/seller/listing-published", {
        state: {
          listingId,
          listing: { ...listing, allowNegotiation },
          allowNegotiation,
        },
      });
      return;
    } catch (err) {
      const status = err && typeof err.status === "number" ? err.status : null;
      const message = getFriendlyMessage(status, err instanceof Error ? err.message : "Failed to publish listing", "listing");
      setPublishError(message);
      navigate("/seller/listing-published", {
        state: { publishError: true, errorMessage: message },
      });
    } finally {
      setPublishing(false);
    }
  };
  return (
    <div className="seller-layout seller-layout-create seller-layout-review">
      <aside className="producer-sidebar seller-sidebar seller-sidebar-green seller-sidebar-with-plan">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="producer-sidebar-logo">
          <img src={ecoLoopLogo} alt="EcoLoop" />
        </Link>
        <nav className="producer-sidebar-nav">
          <Link to="/seller/dashboard" className="producer-nav-item">
            <IconGrid /> <span>Dashboard</span>
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
            <span className="breadcrumb-current">Review</span>
          </nav>
          <div className="seller-topbar-right">
            <span className="review-topbar-leaf" aria-hidden="true">
              <IconLeaf />
            </span>
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="create-listing-content review-content">
          <h1 className="create-listing-title">Review & Publish Listing</h1>
          <p className="create-listing-subtitle">Confirm all details. The listing will only go live on the marketplace when you click &quot;Publish Listing&quot; below.</p>

          {publishError && (
            <div className="register-form-errors review-publish-error" role="alert">
              {publishError}
            </div>
          )}
          {draftSaved && (
            <p className="review-draft-saved-msg" role="status">
              {DRAFT_SAVED}
            </p>
          )}
          <div className="review-progress-row">
            <span className="review-step-label">{isManual ? "STEP 4 OF 4" : "STEP 2 OF 2"}: REVIEW</span>
            <span className="review-percent">100% Complete</span>
          </div>
          <div className="create-listing-stepper material-details-stepper review-stepper">
            {steps.map((step, i) => {
              const isCurrent = isManual ? step.num === 4 : step.num === 2;
              const stepContent = (
                <>
                  <div className={"create-listing-step-circle material-details-step-circle " + (isCurrent ? "review-step-current" : "review-step-completed")}>
                    {isCurrent ? <span className="review-step-dot" /> : <IconCheck />}
                  </div>
                  <span className={"create-listing-step-label " + (isCurrent ? "create-listing-step-label-active" : "review-step-label-completed")}>
                    {step.label.toUpperCase()}
                  </span>
                </>
              );
              let stepHref;
              if (isManual) {
                stepHref = step.num === 1 ? "/seller/create-listing" : step.num === 2 ? "/seller/create-listing/material-details" : step.num === 3 ? "/seller/create-listing/price" : "/seller/create-listing/review";
              } else {
                stepHref = step.num === 1 ? "/seller/create-listing" : "/seller/create-listing/review";
              }
              return (
                <div key={step.num} className="create-listing-step">
                  <Link to={stepHref} className="create-listing-step-link" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    {stepContent}
                  </Link>
                  {i < steps.length - 1 && (
                    <div className="create-listing-step-line material-details-line-completed" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="review-card review-listing-card">
            <div className="review-listing-image-wrap">
              {imagePreview ? (
                <img src={imagePreview} alt={titleFromFlow || "Listing image"} className="review-listing-image" />
              ) : (
                <div className="review-listing-image-placeholder" aria-hidden="true" />
              )}
            </div>
            <div className="review-listing-details">
              <button type="button" className="review-listing-menu-btn" aria-label="More options">
                <IconMenu />
              </button>
              <h2 className="review-listing-name">{titleFromFlow || "Listing"}</h2>
              <p className="review-listing-type">{(cleanMaterialType || "Material")} • Recyclable</p>
              {listingDescriptionPreview ? (
                <p className="review-listing-description">{listingDescriptionPreview}</p>
              ) : null}
              <div className="review-listing-meta">
                {listingStatePreview ? (
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">STATE</span>
                    <span className="review-listing-meta-value">{listingStatePreview}</span>
                  </div>
                ) : null}
                {listingLocationPreview ? (
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">LOCATION</span>
                    <span className="review-listing-meta-value">{listingLocationPreview}</span>
                  </div>
                ) : null}
                <div className="review-listing-meta-item">
                  <span className="review-listing-meta-label">QUANTITY</span>
                  <span className="review-listing-meta-value">{quantityDisplay}</span>
                </div>
                <div className="review-listing-meta-item">
                  <span className="review-listing-meta-label">PRICING</span>
                  <span className="review-listing-meta-value">
                    {Number.isFinite(priceFromStorage) && priceFromStorage > 0
                      ? (() => {
                          const unitLabel = (typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(STORAGE_KEYS.unit) || "tons") : "tons").toLowerCase();
                          return isManual
                            ? `${currencySymbol}${Number(priceFromStorage).toLocaleString()} / ${unitLabel}`
                            : `${currencySymbol}${Number(priceFromStorage).toLocaleString()} total`;
                        })()
                      : "—"}
                  </span>
                </div>
                {isManual && (
                  <div className="review-listing-meta-item">
                    <span className="review-listing-meta-label">NEGOTIATION</span>
                    <span className="review-listing-meta-value">{allowNegotiationFromStorage ? "Price negotiable" : "Fixed price"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="review-section">
            <div className="review-section-header">
              <span className="review-section-title">
                <IconDoc className="review-section-icon" />
                NOTES
              </span>
              {!isEditingNotes ? (
                <button type="button" className="review-edit-notes" onClick={startEditingNotes}>
                  EDIT NOTES
                </button>
              ) : null}
            </div>
            {isEditingNotes ? (
              <div className="review-instructions-edit">
                <textarea
                  className="review-instructions-textarea"
                  value={notesEditDraft}
                  onChange={(e) => setNotesEditDraft(e.target.value)}
                  placeholder="Add special instructions for buyers (pick-up, loading, contact, etc.)"
                  rows={4}
                  aria-label="Special instructions"
                />
                <div className="review-instructions-edit-actions">
                  <button type="button" className="btn btn-primary review-edit-save-btn" onClick={saveNotes}>
                    Save notes
                  </button>
                  <button type="button" className="review-edit-cancel-btn" onClick={cancelEditingNotes}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="review-instructions-box">
                {specialInstructions}
              </div>
            )}
          </section>

          <section className="review-section" aria-labelledby="review-impact-heading">
            <h3 id="review-impact-heading" className="review-section-title review-section-title-main">
              <IconSpark className="review-section-icon" />
              ENVIRONMENTAL IMPACT INSIGHTS
            </h3>
            <p className="review-impact-caption">
              {hasQuantity && hasMaterialType
                ? (isManual ? "Based on your quantity and material type from the Quantity step." : "Based on your quantity and material type from Input Details.")
                : (isManual ? "Complete the Quantity step (quantity and material type) to see your listing's impact." : "Complete Input Details (quantity and material type) to see your listing's impact.")}
            </p>
            <div className="review-impact-cards">
              <div className="review-impact-card">
                <div className="review-impact-icon review-impact-icon-green">
                  <IconLeaf />
                </div>
                <span className="review-impact-label">CO₂ SAVINGS</span>
                <span className="review-impact-value" title={hasQuantity ? undefined : `Add quantity in ${impactStepName}`}>
                  {hasQuantity ? co2Display : "—"}
                </span>
                {!hasQuantity && (
                  <span className="review-impact-hint">
                    {isManual ? <Link to={impactStepPath} className="review-impact-hint-link">Go to Quantity step</Link> : "Add quantity to see estimate"}
                  </span>
                )}
              </div>
              <div className="review-impact-card">
                <div className="review-impact-icon review-impact-icon-green">
                  <IconRecycle />
                </div>
                <span className="review-impact-label">RECYCLABILITY</span>
                <span className="review-impact-value" title={hasMaterialType ? undefined : `Add material type in ${impactStepName}`}>
                  {hasMaterialType ? `${recyclabilityPercent}%` : "—"}
                </span>
                {!hasMaterialType && (
                  <span className="review-impact-hint">
                    {isManual ? <Link to={impactStepPath} className="review-impact-hint-link">Go to Quantity step</Link> : "Add material type to see estimate"}
                  </span>
                )}
              </div>
            </div>
          </section>

          <div className="material-details-actions review-actions">
            <Link to={isManual ? "/seller/create-listing/price" : "/seller/create-listing"} className="material-details-back-btn">
              <IconHelp /> {isManual ? "Back to Pricing" : "Back to Input Details"}
            </Link>
            <button
              type="button"
              className="btn btn-secondary review-save-draft-btn"
              onClick={handleSaveDraft}
              disabled={publishing}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="btn btn-primary material-details-continue-btn review-publish-btn"
              onClick={handlePublish}
              disabled={publishing}
            >
              <IconArrowUp /> {publishing ? "Publishing…" : "Publish Listing"}
            </button>
          </div>

          <p className="material-details-support">
            Need help with your listing? <Link to="/#contact" className="material-details-support-link">Contact EcoLoop Support</Link>
          </p>

          <p className="review-disclaimer">
            BY PUBLISHING, YOU AGREE TO ECOLOOP'S SELLER GUIDELINES AND CONFIRM THAT ALL MATERIAL SPECIFICATIONS PROVIDED ARE ACCURATE AND REPRESENT THE ACTUAL WASTE QUALITY.
          </p>
        </main>
      </div>
    </div>
  );
}
