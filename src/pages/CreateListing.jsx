import { useRef, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import { STORAGE_KEYS } from "../utils/environmentalImpact";
import { analyzeListingImage } from "../services/listingsApi";
import { getFriendlyMessage } from "../utils/errorMessages";

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
const IconCamera = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const IconLightbulb = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
);
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);
const IconSpark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z"/></svg>
);

const STEPS = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Quantity" },
  { num: 3, label: "Price" },
  { num: 4, label: "Scan" },
  { num: 5, label: "Review" },
];

const STEPS_MANUAL = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Quantity" },
  { num: 3, label: "Price" },
  { num: 4, label: "Review" },
];

/** AI Scan flow: single "Input Details" step then Review */
const STEPS_AI_SCAN = [
  { num: 1, label: "Input Details" },
  { num: 2, label: "Review" },
];

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Producer") : "Producer";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "P").toUpperCase();
  return { fullName, initials };
}

const QUANTITY_PATH = "/seller/create-listing/material-details";
const TITLE_STORAGE_KEY = "ecoloop_create_listing_title";
const PRICE_STORAGE_KEY = "ecoloop_create_listing_price";
const ALLOW_NEGOTIATION_KEY = "ecoloop_create_listing_allow_negotiation";
const SCAN_RESULT_STORAGE_KEY = "ecoloop_create_listing_scan_result";

const isManualMode = () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_manual") === "true";

export default function CreateListing() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isImage, setIsImage] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { fullName, initials } = getFullNameAndInitials();
  const isManual = isManualMode();
  const steps = isManual ? STEPS_MANUAL : STEPS_AI_SCAN;

  const [title, setTitle] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TITLE_STORAGE_KEY) || "" : ""
  );
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
  const [price, setPrice] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(PRICE_STORAGE_KEY) || "" : ""
  );
  const [currency, setCurrency] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.currency) || "NGN" : "NGN"
  );
  const [allowNegotiation, setAllowNegotiation] = useState(() =>
    typeof sessionStorage !== "undefined" && sessionStorage.getItem(ALLOW_NEGOTIATION_KEY) === "true"
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
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    if (previewUrl || fileName) return;
    try {
      const saved = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ecoloop_create_listing_upload") : null;
      if (saved) {
        setPreviewUrl(saved);
        setFileName("Uploaded image");
        setIsImage(true);
      }
    } catch (_) {}
  }, [previewUrl, fileName]);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && title !== undefined)
      sessionStorage.setItem(TITLE_STORAGE_KEY, title);
  }, [title]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && materialType !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.materialType, materialType);
  }, [materialType]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && quantity !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.quantity, quantity);
  }, [quantity]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && unit !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.unit, unit);
  }, [unit]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(PRICE_STORAGE_KEY, price);
  }, [price]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && currency !== undefined)
      sessionStorage.setItem(STORAGE_KEYS.currency, currency);
  }, [currency]);
  useEffect(() => {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(ALLOW_NEGOTIATION_KEY, allowNegotiation ? "true" : "false");
  }, [allowNegotiation]);
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

  const runScan = useCallback(async (imageDataUrl) => {
    if (!imageDataUrl || typeof imageDataUrl !== "string") return;
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await analyzeListingImage(imageDataUrl);
      setScanResult(result);
      if (result.materialType) setMaterialType(String(result.materialType).trim());
      if (result.priceMin != null && Number.isFinite(result.priceMin) && !price)
        setPrice(String(Math.round(result.priceMin)));
    } catch (err) {
      // Use backend AI Scan message directly (e.g. "Image missing", "AI analysis failed")
      setScanError(err instanceof Error && err.message ? err.message : "AI analysis failed");
    } finally {
      setScanLoading(false);
    }
  }, [price]);
  const retryScan = useCallback(() => {
    const img = previewUrl || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ecoloop_create_listing_upload") : null);
    if (img) runScan(img);
  }, [previewUrl, runScan]);
  useEffect(() => {
    if (!isManual && scanResult != null && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(SCAN_RESULT_STORAGE_KEY, JSON.stringify(scanResult));
        if (scanResult.materialType)
          sessionStorage.setItem(STORAGE_KEYS.materialType, String(scanResult.materialType).trim());
      } catch (_) {}
    }
  }, [isManual, scanResult]);

  useEffect(() => {
    if (!isManual && previewUrl && typeof previewUrl === "string" && previewUrl.startsWith("data:")) {
      // Require image + title + price before running AI scan.
      const cleanTitleLocal = String(title || "").trim();
      const titleOkLocal = cleanTitleLocal.length >= 3 && cleanTitleLocal.length <= 200;
      const priceNumLocal = parseFloat(String(price || "").replace(/[^0-9.]/g, "")) || 0;
      if (titleOkLocal && priceNumLocal > 0) runScan(previewUrl);
    }
  }, [isManual, previewUrl, runScan, title, price]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowUploadError(false);
    setPreviewUrl(null);
    const type = (file.type || "").toLowerCase();
    const isImageByType = type.startsWith("image/");
    const isImageByExt = /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
    const isImg = isImageByType || isImageByExt;
    setIsImage(isImg);

    if (!isImg) {
      setFileName(null);
      setPreviewLoading(false);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    setPreviewLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewLoading(false);
      if (typeof reader.result === "string") {
        setPreviewUrl(reader.result);
        try {
          sessionStorage.setItem("ecoloop_create_listing_upload", reader.result);
        } catch (_) {}
      }
    };
    reader.onerror = () => {
      setPreviewLoading(false);
      setPreviewUrl(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearFile = (e) => {
    e?.stopPropagation();
    setPreviewUrl(null);
    setFileName(null);
    setPreviewLoading(false);
    try {
      sessionStorage.removeItem("ecoloop_create_listing_upload");
    } catch (_) {}
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [showUploadError, setShowUploadError] = useState(false);
  const canContinueUpload = Boolean(previewUrl || fileName);
  const cleanTitle = title.trim();
  const cleanMaterialType = materialType.trim();
  const quantityNumber = parseFloat(String(quantity).replace(/,/g, "")) || 0;
  const qtyKg = unit === "kg" ? quantityNumber : quantityNumber * 1000; // unit is kg or tons
  const quantityOk = Number.isFinite(qtyKg) && qtyKg >= 100;
  const priceNum = parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
  const titleLengthOk = cleanTitle.length >= 3 && cleanTitle.length <= 200;
  const materialTypeLengthOk = cleanMaterialType.length >= 3 && cleanMaterialType.length <= 200;
  const cleanDescription = description.trim();
  const cleanListingState = listingState.trim();
  const descriptionOk = cleanDescription.length >= 3 && cleanDescription.length <= 2000;
  const listingStateOk = cleanListingState.length >= 2 && cleanListingState.length <= 100;
  const canRunAiScan = titleLengthOk && Number.isFinite(priceNum) && priceNum > 0;
  const canContinueAi =
    canContinueUpload &&
    titleLengthOk &&
    materialTypeLengthOk &&
    descriptionOk &&
    listingStateOk &&
    quantityOk &&
    Number.isFinite(priceNum) &&
    priceNum > 0;
  const canContinue = isManual ? canContinueUpload : canContinueAi;

  const handleContinue = () => {
    if (isManual) {
      if (canContinueUpload) {
        setShowUploadError(false);
        navigate(QUANTITY_PATH);
      } else setShowUploadError(true);
    } else {
      if (canContinueAi) {
        setShowUploadError(false);
        navigate("/seller/create-listing/review");
      } else setShowUploadError(true);
    }
  };

  const handleSwitchToManual = () => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("ecoloop_create_listing_manual", "true");
        sessionStorage.removeItem(SCAN_RESULT_STORAGE_KEY);
      }
    } catch (_) {}
    // Always route to the Upload page first for manual flow.
    navigate("/seller/create-listing");
  };

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
            <span className="breadcrumb-current">{isManual ? "Upload" : "Input Details"}</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="create-listing-content">
          <h1 className="create-listing-title">Create New Listing</h1>
          <p className="create-listing-subtitle">Upload your material details to connect with verified recyclers.</p>

          <div className="create-listing-stepper">
            {steps.map((step, i) => {
              const isCurrent = i === 0;
              const circle = (
                <div className={`create-listing-step-circle ${isCurrent ? "create-listing-step-circle-active" : ""}`}>
                  {step.num}
                </div>
              );
              const label = (
                <span className={`create-listing-step-label ${isCurrent ? "create-listing-step-label-active" : ""}`}>
                  {step.label}
                </span>
              );
              let to = null;
              if (isManual) {
                to = step.num === 2 ? QUANTITY_PATH : step.num === 3 ? "/seller/create-listing/price" : step.num === 4 ? "/seller/create-listing/review" : null;
              } else {
                to = step.num === 2 ? "/seller/create-listing/review" : null;
              }
              const linkDisabled = isManual && step.num === 2 && !canContinueUpload;
              return (
                <div key={step.num} className="create-listing-step">
                  {to ? (
                    <Link
                      to={to}
                      className={"create-listing-step-link" + (linkDisabled ? " create-listing-step-link-disabled" : "")}
                      onClick={(e) => linkDisabled && e.preventDefault()}
                      aria-disabled={linkDisabled}
                    >
                      {circle}
                      {label}
                    </Link>
                  ) : (
                    <>
                      {circle}
                      {label}
                    </>
                  )}
                  {i < steps.length - 1 && <div className="create-listing-step-line" />}
                </div>
              );
            })}
          </div>

          <div className="create-listing-card">
            <h2 className="create-listing-card-title">{isManual ? "Step 1: Upload Material" : "Upload image"}</h2>
            <div
              className="create-listing-upload-zone"
              onClick={() => !previewUrl && !fileName && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && !previewUrl && !fileName && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload image"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="create-listing-file-input"
                onChange={handleFileChange}
                aria-hidden
              />
              {previewLoading ? (
                <p className="create-listing-upload-text">Loading preview…</p>
              ) : previewUrl && isImage ? (
                <div className="create-listing-preview-inner">
                  <img src={previewUrl} alt="Upload preview" className="create-listing-preview-img create-listing-preview-img-in-box" />
                </div>
              ) : fileName && !isImage ? (
                <div className="create-listing-preview-file create-listing-preview-file-in-box">
                  <IconFile />
                  <span className="create-listing-preview-filename">{fileName}</span>
                </div>
              ) : (
                <>
                  <IconCamera />
                  <p className="create-listing-upload-text">Upload image of material</p>
                  <p className="create-listing-upload-hint">Images only: JPG, PNG, GIF, WebP up to 10MB</p>
                </>
              )}
              <div className="create-listing-upload-zone-actions">
                <button type="button" className="create-listing-choose-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <IconFile /> {previewUrl || fileName ? "Change file" : "Choose File"}
                </button>
                {(previewUrl || fileName) && (
                  <button type="button" className="create-listing-remove-btn" onClick={(e) => { e.stopPropagation(); clearFile(e); }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="create-listing-tips">
              <span className="create-listing-tips-icon">
                <IconLightbulb />
              </span>
              <p className="create-listing-tips-text">Tips for better visibility / Capture the material in natural lighting and show the scale.</p>
            </div>
          </div>

          {!isManual && (
            <>
              <div className="create-listing-card material-details-card">
                <div className="material-details-field">
                  <label className="material-details-label">Title</label>
                  <input
                    type="text"
                    className="material-details-input"
                    placeholder="e.g., HDPE Plastic Pellets"
                    aria-label="Listing title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  {showUploadError && !titleLengthOk && (
                    <span className="register-field-error" role="alert">
                      {cleanTitle.length === 0
                        ? "Title is required"
                        : "Title must be between 3 and 200 characters"}
                    </span>
                  )}
                </div>
                <div className="material-details-field">
                  <label className="material-details-label">Description</label>
                  <textarea
                    className="material-details-input material-details-textarea"
                    rows={4}
                    placeholder="Describe the material, condition, and any relevant details for buyers."
                    aria-label="Listing description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  {showUploadError && !descriptionOk && (
                    <span className="register-field-error" role="alert">
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
                    className="material-details-input"
                    placeholder="e.g., Lagos"
                    aria-label="State or region"
                    value={listingState}
                    onChange={(e) => setListingState(e.target.value)}
                  />
                  {showUploadError && !listingStateOk && (
                    <span className="register-field-error" role="alert">
                      {cleanListingState.length === 0 ? "State is required" : "State must be between 2 and 100 characters"}
                    </span>
                  )}
                </div>
                <div className="material-details-field">
                  <label className="material-details-label">Location</label>
                  <input
                    type="text"
                    className="material-details-input"
                    placeholder="e.g., City, area, or landmark"
                    aria-label="Pickup or material location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="material-details-field">
                  <label className="material-details-label">Notes</label>
                  <textarea
                    className="material-details-input material-details-textarea"
                    rows={3}
                    placeholder="Optional: pick-up windows, loading help, contact preferences, etc."
                    aria-label="Additional notes for buyers"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="material-details-field">
                  <label className="material-details-label">Quantity Available</label>
                  <div className="material-details-quantity-row">
                    <input
                      type="text"
                      className="material-details-input"
                      placeholder="e.g., 500"
                      aria-label="Quantity available"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                    <div className="material-details-select-wrap material-details-unit-wrap">
                      <select className="material-details-select material-details-unit-select" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                        <option value="tons">TONS</option>
                        <option value="kg">KG</option>
                      </select>
                      <IconChevronDown />
                    </div>
                  </div>
                  <p className="material-details-hint">Minimum listing requirement is 100 kg.</p>
                </div>
              </div>
              <div className="create-listing-card set-price-card">
                <label className="material-details-label">Set Your Asking Price</label>
                <div className="set-price-input-row">
                  <span className="set-price-currency" aria-hidden="true" />
                  <input
                    type="text"
                    className="set-price-input"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, "") || "")}
                    aria-label="Asking price"
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
                <label className="set-price-checkbox-wrap">
                  <input type="checkbox" className="set-price-checkbox" checked={allowNegotiation} onChange={(e) => setAllowNegotiation(e.target.checked)} aria-label="Allow negotiation" />
                  <span className="set-price-checkbox-label">Allow potential buyers to negotiate or send counter-offers</span>
                </label>
              </div>
              {/* Scan is triggered automatically once image + valid title + valid price are provided. */}
              <div className="create-listing-card ai-recognition-results-card">
                <h3 className="ai-recognition-results-title">
                  <IconSpark className="ai-recognition-results-icon" /> AI Scan
                </h3>
                {scanLoading && <div className="ai-recognition-scan-loading" aria-live="polite"><span className="ai-recognition-scan-loading-text">Scanning...</span></div>}
                {scanError && !scanLoading && (
                  <div className="ai-recognition-scan-error">
                    <p className="ai-recognition-scan-error-text">{scanError}</p>
                    {(previewUrl || (typeof sessionStorage !== "undefined" && sessionStorage.getItem("ecoloop_create_listing_upload"))) && (
                      <button type="button" className="ai-recognition-scan-retry-btn" onClick={retryScan}>Retry scan</button>
                    )}
                  </div>
                )}
                {scanResult && !scanLoading && !scanError && (
                  <>
                    <div className="ai-recognition-field ai-recognition-field-highlight">
                      <span className="ai-recognition-field-label">Material Type</span>
                      <span className="ai-recognition-field-value">{scanResult.materialType}</span>
                    </div>
                    <div className="ai-recognition-field">
                      <span className="ai-recognition-field-label">{scanResult.subtype}</span>
                      <span className="ai-recognition-field-meta">Confidence: {scanResult.confidence}%</span>
                    </div>
                  </>
                )}
                {!scanLoading && !scanError && !scanResult && (previewUrl || fileName) && (
                  <p className="ai-recognition-scan-placeholder">
                    {canRunAiScan
                      ? "AI scan will run automatically once your inputs are ready."
                      : "Image, title, and price are required before AI scan shows results."}
                  </p>
                )}
                {!scanLoading && !scanError && !scanResult && !previewUrl && !fileName && (
                  <p className="ai-recognition-scan-placeholder">Upload an image above to run AI scan.</p>
                )}
              </div>
            </>
          )}

          {showUploadError && (
            <div className="register-form-errors create-listing-field-errors" role="alert">
              {isManual
                ? "Please upload an image to continue."
                : "Please complete all fields: upload an image, title, description, state, quantity (min 100 kg or 1 piece), price, and a successful AI Scan (for material type)."}
            </div>
          )}
          <p className="material-details-support">
            Need help with your listing? <Link to="/#contact" className="material-details-support-link">Contact EcoLoop Support</Link>
          </p>
          <div className="create-listing-actions">
            {!isManual && (
              <button type="button" className="btn btn-secondary create-listing-dashboard-btn" onClick={handleSwitchToManual}>
                Manual Entry
              </button>
            )}
            <button type="button" className="btn btn-primary create-listing-dashboard-btn" onClick={handleContinue}>
              {isManual ? "Continue to Quantity" : "Continue to Review"} <IconArrowRight />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
