"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { PICKUP_LOCATIONS } from "@/lib/data";
import { uploadListingPhoto } from "@/lib/listing-photos";
import {
  deleteOwnedListing,
  fetchOwnedListing,
  listingPhotoGallery,
  parsePriceNgn,
  updateOwnedListing,
} from "@/lib/listings";
import type { ListingStatus } from "@/lib/types";

const MAX_PHOTOS = 6;
const STATUS_OPTIONS: ListingStatus[] = ["Live", "Draft", "Reserved", "Sold"];

interface ManageListingPageProps {
  id: string;
}

export function ManageListingPage({ id }: ManageListingPageProps) {
  const router = useRouter();
  const { ready, user, openAuth } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [zone, setZone] = useState<string>(PICKUP_LOCATIONS[0]);
  const [status, setStatus] = useState<ListingStatus>("Live");
  const [material, setMaterial] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const gallery = [coverUrl, ...extraUrls].filter(
    (u): u is string => Boolean(u && u.trim())
  );
  const uniqueGallery = [...new Set(gallery)];
  const zoneOptions = [...PICKUP_LOCATIONS].includes(
    zone as (typeof PICKUP_LOCATIONS)[number]
  )
    ? [...PICKUP_LOCATIONS]
    : [zone, ...PICKUP_LOCATIONS];

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      openAuth("login", `/listings/${id}/manage`);
      router.replace("/");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void fetchOwnedListing(id, user.id)
      .then((row) => {
        if (!active) return;
        if (!row) {
          setError("Listing not found, or you are not the seller.");
          return;
        }
        const photos = listingPhotoGallery(row);
        setTitle(row.title);
        setWeight(String(row.weight_kg));
        setPrice(
          row.price_ngn != null
            ? Math.round(Number(row.price_ngn)).toLocaleString("en-NG")
            : ""
        );
        setZone(row.zone || PICKUP_LOCATIONS[0]);
        setStatus(row.status);
        setMaterial(row.material);
        setCoverUrl(photos[0] ?? row.photo_url);
        setExtraUrls(photos.slice(1));
        setActivePhoto(photos[0] ?? row.photo_url);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load listing");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, user, id, openAuth, router]);

  async function onAddPhotos(files: FileList | null) {
    if (!user || !files?.length) return;
    setError(null);
    setMsg(null);

    const room = MAX_PHOTOS - uniqueGallery.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos per listing.`);
      return;
    }

    const batch = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of batch) {
        const result = await uploadListingPhoto(user.id, file);
        uploaded.push(result.publicUrl);
      }
      if (!coverUrl && uploaded.length) {
        setCoverUrl(uploaded[0]);
        setExtraUrls((prev) => [...prev, ...uploaded.slice(1)]);
        setActivePhoto(uploaded[0]);
      } else {
        setExtraUrls((prev) => [...prev, ...uploaded]);
        if (uploaded[0]) setActivePhoto(uploaded[0]);
      }
      setMsg(
        uploaded.length === 1
          ? "Photo added. Save to publish it on the marketplace."
          : `${uploaded.length} photos added. Save to publish them.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    setMsg(null);
    if (coverUrl === url) {
      const next = extraUrls[0] ?? null;
      setCoverUrl(next);
      setExtraUrls(extraUrls.slice(1));
      setActivePhoto(next);
      return;
    }
    setExtraUrls((prev) => prev.filter((u) => u !== url));
    if (activePhoto === url) setActivePhoto(coverUrl);
  }

  function makeCover(url: string) {
    if (coverUrl === url) return;
    const rest = [coverUrl, ...extraUrls].filter(
      (u): u is string => Boolean(u) && u !== url
    );
    setCoverUrl(url);
    setExtraUrls(rest);
    setActivePhoto(url);
    setMsg("Cover photo updated. Save to apply.");
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setMsg(null);

    const weightKg = parseFloat(weight);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }
    const priceNgn = price.trim() ? parsePriceNgn(price) : null;
    if (price.trim() && priceNgn == null) {
      setError("Enter a valid price in Naira.");
      return;
    }
    if (!coverUrl) {
      setError("Add at least one product photo.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateOwnedListing(id, user.id, {
        title,
        weightKg,
        priceNgn,
        status,
        photoUrl: coverUrl,
        photoUrls: extraUrls,
        zone,
      });
      const photos = listingPhotoGallery(updated);
      setCoverUrl(photos[0] ?? null);
      setExtraUrls(photos.slice(1));
      setMsg("Listing updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save listing";
      if (/photo_urls/i.test(message) || /column/i.test(message)) {
        setError(
          "Run supabase/migrations/008_listing_photo_urls.sql in the Supabase SQL Editor, then try again."
        );
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!user) return;
    const locked = status === "Reserved" || status === "Sold";
    if (locked) {
      setError(
        "Reserved or sold listings can’t be deleted. Change status only if the deal fell through, or keep the record."
      );
      return;
    }
    const ok = window.confirm(
      `Delete “${title || "this listing"}”? It will leave the marketplace and can’t be undone.`
    );
    if (!ok) return;

    setError(null);
    setMsg(null);
    setDeleting(true);
    try {
      await deleteOwnedListing(id, user.id);
      router.replace("/listings/mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete listing");
      setDeleting(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="page-shell">
        <div className="page-sub">Loading listing…</div>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="page-shell">
        <Link href="/listings/mine" className="btn btn-outline btn-sm back-link">
          ← My listings
        </Link>
        <div className="empty-state">
          <div className="empty-title">{error}</div>
        </div>
      </div>
    );
  }

  const previewStyle = activePhoto
    ? {
        backgroundImage: `url(${activePhoto})`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
      }
    : undefined;

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <Link href="/listings/mine" className="btn btn-outline btn-sm back-link">
            ← My listings
          </Link>
          <h1 className="page-title" style={{ marginTop: 12 }}>
            Manage listing
          </h1>
          <div className="page-sub">
            {material ? `${material} · ` : ""}
            ECL-{id.slice(0, 8).toUpperCase()}
          </div>
        </div>
        <div className="page-head-actions">
          <Link href={`/marketplace/${id}`} className="btn btn-outline">
            View in marketplace
          </Link>
        </div>
      </div>

      <div className="manage-grid">
        <form className="panel panel--pad" onSubmit={onSave}>
          <div className="panel-label">LISTING DETAILS</div>
          <div className="form-stack" style={{ marginTop: 14 }}>
            <div>
              <label className="field-label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2">
              <div>
                <label className="field-label">Weight (kg)</label>
                <input
                  className="input input--mono"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Price (₦)</label>
                <input
                  className="input input--mono"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="52,000"
                />
              </div>
            </div>

            <div className="form-row-2">
              <div>
                <label className="field-label">Pickup zone</label>
                <Select
                  value={zone}
                  options={zoneOptions}
                  onChange={setZone}
                  aria-label="Pickup zone"
                />
              </div>
              <div>
                <label className="field-label">Status</label>
                <Select
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => setStatus(v as ListingStatus)}
                  aria-label="Listing status"
                />
              </div>
            </div>

            {error ? <div className="upload-error">{error}</div> : null}
            {msg ? (
              <div className="field-foot" style={{ color: "oklch(0.45 0.08 155)" }}>
                {msg}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={saving || uploading || deleting}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <div className="panel panel--pad">
          <div className="panel-label">PRODUCT PHOTOS</div>
          <p className="panel-copy" style={{ marginTop: 10 }}>
            Cover photo shows on marketplace cards. Add up to {MAX_PHOTOS} images of the
            lot (angles, close-ups, packing).
          </p>

          <div className="manage-photo-hero" style={previewStyle}>
            {!activePhoto ? (
              <div className="manage-photo-empty">No photos yet</div>
            ) : null}
          </div>

          <div className="manage-photo-grid">
            {uniqueGallery.map((url) => {
              const isCover = url === coverUrl;
              const isActive = url === activePhoto;
              return (
                <div
                  key={url}
                  className={
                    isActive
                      ? "manage-photo-tile is-active"
                      : "manage-photo-tile"
                  }
                >
                  <button
                    type="button"
                    className="manage-photo-preview"
                    style={{
                      backgroundImage: `url(${url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    onClick={() => setActivePhoto(url)}
                    aria-label={isCover ? "Cover photo" : "Gallery photo"}
                  />
                  {isCover ? <span className="manage-photo-badge">Cover</span> : null}
                  <div className="manage-photo-actions">
                    {!isCover ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => makeCover(url)}
                      >
                        Set cover
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => removePhoto(url)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            {uniqueGallery.length < MAX_PHOTOS ? (
              <button
                type="button"
                className="manage-photo-add"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : "+ Add photos"}
              </button>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            hidden
            onChange={(e) => void onAddPhotos(e.target.files)}
          />
        </div>
      </div>

      <div className="panel panel--pad manage-danger-panel">
        <div className="panel-label">DELETE LISTING</div>
        <p className="panel-copy" style={{ marginTop: 10 }}>
          Removes this listing from the marketplace. Open buyer interest is cleared.
          Reserved or sold lots are kept for exchange history.
        </p>
        {status === "Reserved" || status === "Sold" ? (
          <div className="field-foot" style={{ marginTop: 8 }}>
            Status is {status} — delete is locked.
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-danger"
          style={{ marginTop: 14 }}
          disabled={
            deleting || saving || uploading || status === "Reserved" || status === "Sold"
          }
          onClick={() => void onDelete()}
        >
          {deleting ? "Deleting…" : "Delete this listing"}
        </button>
      </div>
    </div>
  );
}
