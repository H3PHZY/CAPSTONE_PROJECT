import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import GlobalSearchBar from "../components/GlobalSearchBar";
import { analyzeListingImage } from "../services/listingsApi";
import { getFriendlyMessage } from "../utils/errorMessages";
import { STORAGE_KEYS } from "../utils/environmentalImpact";

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
const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconCloudUpload = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconSpark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const STEPS = [
  { num: 1, label: "Upload", completed: true },
  { num: 2, label: "Quantity", completed: true },
  { num: 3, label: "Price", completed: true },
  { num: 4, label: "Scan", current: true },
  { num: 5, label: "Review" },
];

const UPLOAD_STORAGE_KEY = "ecoloop_create_listing_upload";
const SCAN_RESULT_STORAGE_KEY = "ecoloop_create_listing_scan_result";

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Producer") : "Producer";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "P").toUpperCase();
  return { fullName, initials };
}

export default function AIRecognition() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCreateListingFlow = pathname.includes("/seller/create-listing/scan");
  const fileInputRef = useRef(null);
  const [hasUpload, setHasUpload] = useState(false);
  const { fullName, initials } = getFullNameAndInitials();
  const [uploadedImageUrl, setUploadedImageUrl] = useState(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(UPLOAD_STORAGE_KEY);
  });
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [imageToScan, setImageToScan] = useState(null);

  useEffect(() => {
    if (isCreateListingFlow && typeof window !== "undefined") {
      if (sessionStorage.getItem("ecoloop_create_listing_manual") === "true") {
        navigate("/seller/create-listing/review", { replace: true });
        return;
      }
      navigate("/seller/create-listing", { replace: true });
      return;
    }
  }, [isCreateListingFlow, pathname, navigate]);

  const runScan = useCallback(async (imageDataUrl) => {
    if (!imageDataUrl || typeof imageDataUrl !== "string") return;
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await analyzeListingImage(imageDataUrl);
      setScanResult(result);
    } catch (err) {
      // Use backend AI Scan message directly (e.g. "Image missing", "AI analysis failed")
      setScanError(err instanceof Error && err.message ? err.message : "AI analysis failed");
    } finally {
      setScanLoading(false);
    }
  }, []);

  useEffect(() => {
    const imageUrl = isCreateListingFlow ? uploadedImageUrl : (hasUpload ? uploadedImageUrl : null);
    setImageToScan(imageUrl || null);
    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
      runScan(imageUrl);
    }
  }, [isCreateListingFlow, uploadedImageUrl, hasUpload, runScan]);

  useEffect(() => {
    if (isCreateListingFlow && scanResult != null && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(SCAN_RESULT_STORAGE_KEY, JSON.stringify(scanResult));
        // Backend AI returns "title"; we show it as Material Type and pre-fill the Quantity step
        if (scanResult.materialType) {
          sessionStorage.setItem(STORAGE_KEYS.materialType, String(scanResult.materialType).trim());
        }
      } catch (_) {}
    }
  }, [isCreateListingFlow, scanResult]);

  const retryScan = useCallback(() => {
    if (imageToScan) runScan(imageToScan);
  }, [imageToScan, runScan]);

  const handleZoneClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setHasUpload(true);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setUploadedImageUrl(reader.result);
          setImageToScan(reader.result);
          runScan(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const handleRemove = () => setHasUpload(false);

  return (
    <div className="seller-layout ai-recognition-layout">
      <aside className="producer-sidebar ai-scan-sidebar">
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
          <Link to="/seller/transactions" className="producer-nav-item">
            <IconArrows /> <span>Transactions</span>
          </Link>
          <Link to="/seller/account" className="producer-nav-item">
            <IconGear /> <span>Account Settings</span>
          </Link>
        </nav>
        <div className="ai-scan-storage">
          <div className="ai-scan-storage-label">Storage Limit</div>
          <div className="ai-scan-storage-bar-wrap">
            <div className="ai-scan-storage-bar" style={{ width: "65%" }} />
          </div>
          <div className="ai-scan-storage-text">650/1000 Tons</div>
        </div>
      </aside>

      <div className="marketplace-main ai-recognition-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            {isCreateListingFlow ? (
              <>
                <Link to="/seller/create-listing">Create Listing</Link>
                <span className="breadcrumb-sep">&gt;</span>
                <span className="breadcrumb-current">Scan</span>
              </>
            ) : (
              <span className="breadcrumb-current">Scan</span>
            )}
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="ai-recognition-content">
          <h1 className="ai-recognition-title">AI Material Recognition</h1>
          <p className="ai-recognition-desc">
            Upload images of your recyclables. Our advanced neural network identifies material types and purity levels automatically for faster listing.
          </p>

          <div className="ai-recognition-stepper">
            {STEPS.map((step, i) => (
              <div key={step.num} className="ai-recognition-step">
                {step.num === 1 ? (
                  <Link to="/seller/create-listing" className="ai-recognition-step-link" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    <div className={"ai-recognition-step-circle " + (step.completed ? "ai-recognition-step-completed " : "") + (step.current ? "ai-recognition-step-active " : "") + (!step.completed && !step.current ? "ai-recognition-step-pending" : "")}>
                      {step.completed ? <IconCheck /> : step.num}
                    </div>
                    <span className={"ai-recognition-step-label " + (step.current ? "ai-recognition-step-label-active" : "")}>{step.label}</span>
                  </Link>
                ) : step.num === 2 ? (
                  <Link to="/seller/create-listing/material-details" className="ai-recognition-step-link" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    <div className={"ai-recognition-step-circle " + (step.completed ? "ai-recognition-step-completed " : "") + (step.current ? "ai-recognition-step-active " : "") + (!step.completed && !step.current ? "ai-recognition-step-pending" : "")}>
                      {step.completed ? <IconCheck /> : step.num}
                    </div>
                    <span className={"ai-recognition-step-label " + (step.current ? "ai-recognition-step-label-active" : "")}>{step.label}</span>
                  </Link>
                ) : step.num === 3 ? (
                  <Link to="/seller/create-listing/price" className="ai-recognition-step-link" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    <div className={"ai-recognition-step-circle " + (step.completed ? "ai-recognition-step-completed " : "") + (step.current ? "ai-recognition-step-active " : "") + (!step.completed && !step.current ? "ai-recognition-step-pending" : "")}>
                      {step.completed ? <IconCheck /> : step.num}
                    </div>
                    <span className={"ai-recognition-step-label " + (step.current ? "ai-recognition-step-label-active" : "")}>{step.label}</span>
                  </Link>
                ) : step.num === 5 ? (
                  <Link to="/seller/create-listing/review" className="ai-recognition-step-link" style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    <div className={"ai-recognition-step-circle " + (step.completed ? "ai-recognition-step-completed " : "") + (step.current ? "ai-recognition-step-active " : "") + (!step.completed && !step.current ? "ai-recognition-step-pending" : "")}>
                      {step.completed ? <IconCheck /> : step.num}
                    </div>
                    <span className={"ai-recognition-step-label " + (step.current ? "ai-recognition-step-label-active" : "")}>{step.label}</span>
                  </Link>
                ) : (
                  <>
                    <div className={"ai-recognition-step-circle " + (step.completed ? "ai-recognition-step-completed " : "") + (step.current ? "ai-recognition-step-active " : "") + (!step.completed && !step.current ? "ai-recognition-step-pending" : "")}>
                      {step.completed ? <IconCheck /> : step.num}
                    </div>
                    <span className={"ai-recognition-step-label " + (step.current ? "ai-recognition-step-label-active" : "")}>{step.label}</span>
                  </>
                )}
                {i < STEPS.length - 1 && (
                  <div className={"ai-recognition-step-line " + (step.completed ? "ai-recognition-step-line-completed" : "")} />
                )}
              </div>
            ))}
          </div>

          <div className="ai-recognition-columns">
            <div className="ai-recognition-left">
              {isCreateListingFlow ? (
                uploadedImageUrl ? (
                  <div className="ai-recognition-current">
                    <div className="ai-recognition-current-header">
                      <span className="ai-recognition-current-dot" aria-hidden="true" />
                      <span className="ai-recognition-current-title">Material for AI scan</span>
                    </div>
                    <div className="ai-recognition-preview-wrap">
                      <img src={uploadedImageUrl} alt="Material from upload step" className="ai-recognition-preview-img" />
                      <span className="ai-recognition-preview-badge">1</span>
                    </div>
                  </div>
                ) : (
                  <div className="ai-recognition-no-upload">
                    <p className="ai-recognition-no-upload-text">No image from upload step.</p>
                    <p className="ai-recognition-no-upload-hint">Go back to Upload to add an image, then continue to Scan.</p>
                    <Link to="/seller/create-listing" className="btn btn-secondary ai-recognition-back-upload-btn">
                      ← Back to Upload
                    </Link>
                  </div>
                )
              ) : hasUpload ? (
                <div className="ai-recognition-current">
                  <div className="ai-recognition-current-header">
                    <span className="ai-recognition-current-dot" aria-hidden="true" />
                    <span className="ai-recognition-current-title">Current Upload</span>
                    <button type="button" className="ai-recognition-remove" onClick={handleRemove}>
                      Remove
                    </button>
                  </div>
                  <div className="ai-recognition-preview-wrap">
                    <img src={uploadedImageUrl} alt="Uploaded material" className="ai-recognition-preview-img" />
                    <span className="ai-recognition-preview-badge">1</span>
                  </div>
                </div>
              ) : (
                <div
                  className="ai-recognition-upload-zone"
                  onClick={handleZoneClick}
                  onKeyDown={(e) => e.key === "Enter" && handleZoneClick()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload material image"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="ai-recognition-file-input"
                    onChange={handleFileChange}
                    aria-hidden
                  />
                  <IconCloudUpload className="ai-recognition-upload-icon" />
                  <h3 className="ai-recognition-upload-title">Upload Material Image</h3>
                  <p className="ai-recognition-upload-hint">Drag and drop your photos here, or click to browse files.</p>
                  <p className="ai-recognition-upload-types">SUPPORTS JPG, PNG UP TO 10MB</p>
                </div>
              )}
            </div>

            <div className="ai-recognition-right">
              <div className="ai-recognition-results-card">
                <h3 className="ai-recognition-results-title">
                  <IconSpark className="ai-recognition-results-icon" />
                  AI Detection Results
                </h3>
                {scanLoading && (
                  <div className="ai-recognition-scan-loading" aria-live="polite">
                    <span className="ai-recognition-scan-loading-text">Scanning...</span>
                  </div>
                )}
                {scanError && !scanLoading && (
                  <div className="ai-recognition-scan-error">
                    <p className="ai-recognition-scan-error-text">{scanError}</p>
                    {imageToScan && (
                      <button type="button" className="ai-recognition-scan-retry-btn" onClick={retryScan}>
                        Retry scan
                      </button>
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
                      <span className="ai-recognition-field-meta">Confidence Score: {scanResult.confidence}%</span>
                    </div>
                    <div className="ai-recognition-field ai-recognition-field-with-btn">
                      <div>
                        <span className="ai-recognition-field-label">Recycled</span>
                        <span className="ai-recognition-field-meta">Confidence Score: {scanResult.confidence}%</span>
                      </div>
                      <button type="button" className="ai-recognition-yes-btn">{scanResult.recycled ? "Yes" : "No"}</button>
                    </div>
                  </>
                )}
                {!scanLoading && !scanError && !scanResult && !imageToScan && (
                  <p className="ai-recognition-scan-placeholder">Upload or add an image to scan.</p>
                )}
                {!scanLoading && !scanError && !scanResult && imageToScan && (
                  <p className="ai-recognition-scan-placeholder">Waiting for results...</p>
                )}
              </div>
              {isCreateListingFlow ? (
                <>
                  <div className="material-details-actions" style={{ marginTop: "1rem" }}>
                    <Link to="/seller/create-listing/price" className="material-details-back-btn">
                      ← Back
                    </Link>
                    <Link
                      to="/seller/create-listing"
                      className="btn btn-secondary ai-recognition-proceed-btn"
                      onClick={() => {
                        try {
                          sessionStorage.setItem("ecoloop_create_listing_manual", "true");
                          sessionStorage.removeItem("ecoloop_create_listing_scan_result");
                        } catch (_) {}
                      }}
                    >
                      Manual Entry
                    </Link>
                    <Link to="/seller/create-listing/review" className="btn btn-primary material-details-continue-btn">
                      Proceed with AI Results
                    </Link>
                  </div>
                  <p className="material-details-support" style={{ marginTop: "1rem" }}>
                    Need help with your listing? <Link to="/#contact" className="material-details-support-link">Contact EcoLoop Support</Link>
                  </p>
                </>
              ) : (
                <Link to="/seller/create-listing" className="btn btn-primary ai-recognition-create-btn">
                  Create Listing
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
