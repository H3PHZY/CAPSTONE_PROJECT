"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { co2FromWeight } from "@/lib/carbon";
import { CATS, PICKUP_LOCATIONS } from "@/lib/data";
import { uploadListingPhoto } from "@/lib/listing-photos";
import { createLiveListing, parsePriceNgn } from "@/lib/listings";
import type { MaterialCategory } from "@/lib/types";

const STEP_DEFS = [
  { n: "1", label: "Photo", hint: "drag or capture" },
  { n: "2", label: "AI check", hint: "classify & override" },
  { n: "3", label: "Publish", hint: "weight, price, go live" },
];

type Stage = "idle" | "scanning" | "done";

type AiAlt = { label: string; pct: number };

type ClassifyResponse = {
  material: MaterialCategory;
  confidence: number;
  confidencePct: number;
  alternatives: { label: MaterialCategory; pct: number }[];
  modelId: string;
  lowConfidence: boolean;
  error?: string;
};

export function QuickListingPage() {
  const { user, isAuthenticated, openAuth } = useAuth();
  const [stage, setStage] = useState<Stage>("idle");
  const [scanPct, setScanPct] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timing, setTiming] = useState(false);
  const [aiLabel, setAiLabel] = useState<MaterialCategory>("Metal");
  const [aiConfidence, setAiConfidence] = useState(0);
  const [aiAlts, setAiAlts] = useState<AiAlt[]>([]);
  const [aiModelId, setAiModelId] = useState("hf-endpoint");
  const [aiLowConfidence, setAiLowConfidence] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [override, setOverride] = useState<MaterialCategory>("Metal");
  const [overridden, setOverridden] = useState(false);
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("180");
  const [price, setPrice] = useState("52,000");
  const [pickup, setPickup] = useState<string>(PICKUP_LOCATIONS[0]);
  const [published, setPublished] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!timing || published) return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [timing, published]);

  useEffect(() => {
    return () => {
      if (scanRef.current) clearInterval(scanRef.current);
      if (doneRef.current) clearTimeout(doneRef.current);
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    };
  }, []);

  const activeStep = published ? 2 : stage === "done" ? 1 : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const timer = `${mm}:${ss}`;
  const previewCo2 = co2FromWeight(parseFloat(weight) || 0, override).toLocaleString();
  const displayPhoto = photoUrl ?? previewUrl;

  function clearScanTimers() {
    if (scanRef.current) clearInterval(scanRef.current);
    if (doneRef.current) clearTimeout(doneRef.current);
    scanRef.current = null;
    doneRef.current = null;
  }

  function startScanAnimation() {
    clearScanTimers();
    setStage("scanning");
    setScanPct(0);
    setTiming(true);
    // Visual progress only — stage becomes "done" when upload finishes.
    scanRef.current = setInterval(() => {
      setScanPct((prev) => Math.min(92, prev + 7 + Math.random() * 8));
    }, 130);
  }

  async function classifyPhoto(publicUrl: string) {
    setClassifying(true);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });
      const data = (await res.json()) as ClassifyResponse;
      if (!res.ok) {
        throw new Error(data.error || "Classification failed");
      }
      setAiLabel(data.material);
      setAiConfidence(data.confidencePct);
      setAiAlts(
        (data.alternatives ?? []).map((a) => ({ label: a.label, pct: a.pct }))
      );
      setAiModelId(data.modelId || "hf-endpoint");
      setAiLowConfidence(Boolean(data.lowConfidence));
      setOverride(data.material);
      setOverridden(false);
      setTitle((prev) => {
        if (prev.trim()) return prev;
        const hints: Record<MaterialCategory, string> = {
          Plastic: "Plastic scrap, mixed grades",
          Glass: "Broken glass cullet, mixed",
          Metal: "Metal offcuts, mixed gauge",
          Biodegradable: "Wood, cardboard or organic waste",
          Rubber: "Rubber hose / scrap, mixed",
        };
        return hints[data.material] || `${data.material} surplus`;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI classify failed. Pick the category manually.";
      setAiLabel("Biodegradable");
      setAiConfidence(0);
      setAiAlts([]);
      setAiLowConfidence(true);
      setAiModelId("manual");
      // Don't force Metal — leave category for the seller to confirm
      setOverride("Biodegradable");
      setOverridden(true);
      setTitle((prev) =>
        prev.trim() && !prev.toLowerCase().includes("metal")
          ? prev
          : "Wood, cardboard or organic waste"
      );
      setUploadError(`${message} Pick the right category below, then publish.`);
    } finally {
      setClassifying(false);
    }
  }

  async function handleSelectedFile(file: File) {
    if (!isAuthenticated || !user) {
      openAuth("login", "/listings/new");
      return;
    }

    setUploadError(null);
    setUploading(true);

    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    const local = URL.createObjectURL(file);
    previewObjectUrl.current = local;
    setPreviewUrl(local);
    setPhotoUrl(null);
    setPhotoPath(null);

    startScanAnimation();

    try {
      const uploaded = await uploadListingPhoto(user.id, file);
      setPhotoPath(uploaded.path);
      setPhotoUrl(uploaded.publicUrl);
      await classifyPhoto(uploaded.publicUrl);
      clearScanTimers();
      setScanPct(100);
      setStage("done");
    } catch (err) {
      clearScanTimers();
      setStage("idle");
      setPhotoUrl(null);
      setPhotoPath(null);
      setPreviewUrl(null);
      if (previewObjectUrl.current) {
        URL.revokeObjectURL(previewObjectUrl.current);
        previewObjectUrl.current = null;
      }
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleSelectedFile(file);
  }

  function openFilePicker() {
    if (!isAuthenticated || !user) {
      openAuth("login", "/listings/new");
      return;
    }
    fileRef.current?.click();
  }

  function onDropZoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleSelectedFile(file);
  }

  function resetFlow() {
    clearScanTimers();
    setStage("idle");
    setScanPct(0);
    setSeconds(0);
    setTiming(false);
    setPublished(false);
    setOverridden(false);
    setOverride("Metal");
    setAiLabel("Metal");
    setAiConfidence(0);
    setAiAlts([]);
    setAiModelId("hf-endpoint");
    setAiLowConfidence(false);
    setClassifying(false);
    setTitle("");
    setUploadError(null);
    setUploading(false);
    setPublishing(false);
    setPublishedId(null);
    setPhotoUrl(null);
    setPhotoPath(null);
    setPreviewUrl(null);
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
    }
  }

  async function publish() {
    if (!isAuthenticated || !user) {
      openAuth("login", "/listings/new");
      return;
    }
    if (!photoUrl || !photoPath) {
      setUploadError("Upload a material photo before publishing.");
      return;
    }
    const weightKg = parseFloat(weight);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setUploadError("Enter a valid weight in kg.");
      return;
    }
    if (!title.trim()) {
      setUploadError("Add a listing title.");
      return;
    }

    setUploadError(null);
    setPublishing(true);
    try {
      const listing = await createLiveListing({
        sellerId: user.id,
        title,
        material: override,
        weightKg,
        priceNgn: parsePriceNgn(price),
        photoUrl,
        zone: pickup,
        predictedMaterial: aiLabel,
        confidence: Math.max(0.01, Math.min(1, aiConfidence / 100 || 0.5)),
        overridden,
        modelId: aiModelId,
      });
      setPublishedId(listing.id);
      setPublished(true);
      setTiming(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not publish listing.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="page-shell">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onFileInputChange}
      />

      <div className="page-head">
        <div>
          <h1 className="page-title">List surplus material</h1>
          <div className="page-sub">Three steps · photo, confirm, publish</div>
        </div>
        <div className="timer-chip">
          <span className="timer-chip-label">ELAPSED</span>
          <span className="timer-chip-value">{timer}</span>
          <span className="timer-chip-hint">/ 60s target</span>
        </div>
      </div>

      <div className="steps-bar">
        {STEP_DEFS.map((st, i) => (
          <div
            key={st.n}
            className={i === activeStep ? "step-cell is-active" : "step-cell"}
          >
            <div className={i <= activeStep ? "step-dot is-on" : "step-dot"}>{st.n}</div>
            <div>
              <div className="step-label">{st.label}</div>
              <div className="step-hint">{st.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {published ? (
        <div className="publish-success">
          <div className="publish-check">✓</div>
          <h2 className="publish-title">Listing published in {timer}</h2>
          <p className="publish-copy">
            Your material is now visible to 9 verified buyers within 10 km of {pickup}. You will
            be notified the moment a buyer initiates contact.
          </p>
          <p className="publish-copy publish-copy--mono">
            Saved to Supabase · listing is Live in the marketplace.
          </p>
          <div className="publish-actions">
            {publishedId ? (
              <>
                <Link href={`/listings/${publishedId}/manage`} className="btn btn-primary">
                  Manage listing &amp; photos
                </Link>
                <Link href={`/marketplace/${publishedId}`} className="btn btn-outline">
                  View listing
                </Link>
              </>
            ) : null}
            <Link href="/listings/mine" className="btn btn-outline">
              View my listings
            </Link>
            <button type="button" className="btn btn-outline" onClick={resetFlow}>
              List another material
            </button>
          </div>
        </div>
      ) : (
        <div className="listing-flow-grid">
          <div className="panel panel--pad">
            <div className="panel-label">1 · MATERIAL PHOTO</div>

            {stage === "idle" ? (
              <div
                className="upload-drop"
                onClick={openFilePicker}
                onDragOver={onDragOver}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={onDropZoneKeyDown}
              >
                <div className="upload-icon">↑</div>
                <div className="upload-copy">
                  <div className="upload-title">Drag a photo here, or tap to capture</div>
                  <div className="upload-sub">
                    JPG or PNG up to 8 MB · one clear shot of the pile is enough
                  </div>
                </div>
                <div className="upload-btns">
                  <span className="btn btn-primary btn-sm">Take photo</span>
                  <span className="btn btn-outline btn-sm">Choose file</span>
                </div>
              </div>
            ) : null}

            {stage === "scanning" ? (
              <div
                className="scan-stage"
                style={
                  displayPhoto
                    ? { backgroundImage: `url(${displayPhoto})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              >
                <span className="listing-card-photo-label">
                  {uploading
                    ? "Uploading to EcoLoop…"
                    : classifying
                      ? "Classifying with Hugging Face…"
                      : "Classifying…"}
                </span>
                <div className="scan-beam" />
                <div className="scan-overlay">
                  <div className="scan-overlay-row">
                    <span>UPLOAD · STORAGE</span>
                    <span className="scan-pct">{scanPct}%</span>
                  </div>
                  <div className="progress-track progress-track--dark-thin">
                    <div
                      className="progress-fill progress-fill--scan"
                      style={{ width: `${scanPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {stage === "done" ? (
              <>
                <div
                  className="scan-stage scan-stage--done"
                  style={
                    displayPhoto
                      ? {
                          backgroundImage: `url(${displayPhoto})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  <div className="detect-box">
                    <span className="detect-label">
                      {aiLabel.toLowerCase()} {aiConfidence || "—"}%
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm replace-btn"
                    onClick={resetFlow}
                  >
                    Replace
                  </button>
                </div>

                <div className="ai-result">
                  <div className="ai-result-icon">{aiConfidence > 0 ? "✓" : "!"}</div>
                  <div>
                    <div className="ai-result-title">
                      {aiConfidence > 0
                        ? `${aiLabel} detected — ${aiConfidence}% confidence`
                        : "Pick a category below — AI result unavailable"}
                    </div>
                    <div className="ai-result-meta">
                      {aiConfidence <= 0
                        ? "AI could not classify this photo — confirm the category below"
                        : aiLowConfidence
                          ? "Low confidence — please confirm or override"
                          : `Classified with ${aiModelId}`}
                    </div>
                  </div>
                </div>

                <div className="ai-alts">
                  {aiAlts.map((a) => (
                    <div key={a.label} className="ai-alt-row">
                      <div className="ai-alt-label">{a.label}</div>
                      <div className="bar-track bar-track--thin">
                        <div
                          className="bar-fill bar-fill--muted"
                          style={{ width: `${a.pct}%` }}
                        />
                      </div>
                      <div className="ai-alt-pct">{a.pct}%</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {uploadError ? <div className="upload-error">{uploadError}</div> : null}
          </div>

          <div className="listing-flow-side">
            <div className="panel panel--pad">
              <div className="panel-label">2 · CONFIRM & DETAIL</div>
              <div className="form-stack">
                <div>
                  <label className="field-label">
                    Material category{" "}
                    <span className="field-hint">— override the AI if wrong</span>
                  </label>
                  <Select
                    value={override}
                    options={[...CATS]}
                    onChange={(v) => {
                      const next = v as MaterialCategory;
                      setOverride(next);
                      setOverridden(next !== aiLabel);
                      const hints: Record<MaterialCategory, string> = {
                        Plastic: "Plastic scrap, mixed grades",
                        Glass: "Broken glass cullet, mixed",
                        Metal: "Metal offcuts, mixed gauge",
                        Biodegradable: "Wood, cardboard or organic waste",
                        Rubber: "Rubber hose / scrap, mixed",
                      };
                      const previousHints = Object.values(hints);
                      setTitle((prev) =>
                        !prev.trim() || previousHints.includes(prev) ? hints[next] : prev
                      );
                    }}
                    aria-label="Material category"
                  />
                  {overridden ? (
                    <div className="override-note">
                      <span className="override-dot" />
                      Manual override logged for model retraining
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="field-label">Listing title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Aluminium sheet offcuts, mixed gauge"
                    className="input"
                  />
                </div>
                <div className="form-row-2">
                  <div>
                    <label className="field-label">Weight (kg)</label>
                    <input
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="120"
                      className="input input--mono"
                    />
                  </div>
                  <div>
                    <label className="field-label">Asking price (₦)</label>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="48000"
                      className="input input--mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="field-label">Pickup location</label>
                  <Select
                    value={pickup}
                    options={[...PICKUP_LOCATIONS]}
                    onChange={setPickup}
                    aria-label="Pickup location"
                  />
                  <div className="field-foot">Saved from your profile · tap to change</div>
                </div>
              </div>
            </div>

            <div className="carbon-card">
              <div className="carbon-card-label">CARBON PREVIEW</div>
              <div className="carbon-card-row">
                <div className="carbon-card-v carbon-card-v--md">{previewCo2}</div>
                <div className="carbon-card-unit">kg CO₂e if this sells</div>
              </div>
            </div>

            <div className="panel panel--pad">
              <div className="panel-label">3 · PUBLISH</div>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={publish}
                disabled={uploading || publishing || stage !== "done" || !photoUrl}
              >
                {publishing ? "Publishing…" : "Publish listing"}
              </button>
              <div className="field-foot">
                Publishes a Live listing to Supabase with your photo and details.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
