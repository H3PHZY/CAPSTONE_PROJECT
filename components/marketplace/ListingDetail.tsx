"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { co2Of } from "@/lib/carbon";
import { CATS } from "@/lib/data";
import { fetchListingById } from "@/lib/listings";
import { PaystackButton } from "@/components/marketplace/PaystackButton";
import { GoogleMapLocation } from "@/components/marketplace/GoogleMapLocation";
import type { Listing } from "@/lib/types";

interface ListingDetailProps {
  id: string;
}

function priceNum(p: string) {
  return parseFloat(String(p).replace(/,/g, "")) || 0;
}

export function ListingDetail({ id }: ListingDetailProps) {
  const router = useRouter();
  const { user, profile, openAuth } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  // Tracks local sold state so UI updates instantly after purchase
  const [soldLocally, setSoldLocally] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setActivePhoto(null);

    void fetchListingById(id, profile?.cluster, {
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    })
      .then((row) => {
        if (!active) return;
        if (!row) {
          setError("Listing not found");
          setListing(null);
          return;
        }
        setListing(row);
        const gallery =
          row.photoUrls && row.photoUrls.length > 0
            ? row.photoUrls
            : row.photoUrl
              ? [row.photoUrl]
              : [];
        setActivePhoto(gallery[0] ?? null);
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
  }, [id, profile?.cluster, profile?.lat, profile?.lng]);

  if (loading) {
    return (
      <div className="page-shell page-shell--detail">
        <div className="page-sub">Loading listing…</div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="page-shell page-shell--detail">
        <Link href="/marketplace" className="btn btn-outline btn-sm back-link">
          ← Back to marketplace
        </Link>
        <div className="empty-state">
          <div className="empty-title">{error || "Listing not found"}</div>
        </div>
      </div>
    );
  }

  const conf = listing.conf;
  const alt = CATS.filter((c) => c !== listing.material).slice(0, 2);
  const breakdown = [
    { label: listing.material, pct: conf, tone: "primary" as const },
    {
      label: alt[0],
      pct: Math.round((100 - conf) * 0.6),
      tone: "muted" as const,
    },
    {
      label: alt[1],
      pct: Math.round((100 - conf) * 0.4),
      tone: "faint" as const,
    },
  ];
  const listedLabel = listing.createdAt
    ? new Date(listing.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  const specs = [
    { k: "CATEGORY", v: listing.material },
    { k: "WEIGHT", v: `${listing.weight} kg` },
    { k: "CONDITION", v: "Dry, sorted" },
    { k: "AVAILABLE", v: "Immediately" },
    { k: "MIN. ORDER", v: "Full lot" },
    { k: "LOADING", v: "Buyer arranges" },
    { k: "LISTED", v: listedLabel },
    {
      k: "LISTING REF",
      v: `ECL-${listing.id.slice(0, 8).toUpperCase()}`,
    },
  ];
  const co2 = co2Of(listing).toLocaleString();
  const perKg =
    listing.weight > 0
      ? Math.round(priceNum(listing.price) / listing.weight).toLocaleString()
      : "0";
  const photos =
    listing.photoUrls && listing.photoUrls.length > 0
      ? listing.photoUrls
      : listing.photoUrl
        ? [listing.photoUrl]
        : [];
  const heroUrl = activePhoto ?? photos[0] ?? listing.photoUrl;
  const heroStyle = heroUrl
    ? {
        backgroundImage: `url(${heroUrl})`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
      }
    : undefined;

  function contact() {
    if (!user) {
      openAuth("login", `/marketplace/${id}`);
      return;
    }
    router.push(`/messages?listing=${id}`);
  }

  const isOwnListing = Boolean(
    user && listing && (user.id === listing.sellerId || user.id === listing.seller)
  );
  // listing.seller holds the business name — we need seller_id from raw data;
  // we do a cheaper check: if the user is the verified owner they can manage it.
  const rawStatus = soldLocally ? "Sold" : listing?.status;
  const isLive = rawStatus === "Live";
  const isSold = rawStatus === "Sold";
  const isReserved = rawStatus === "Reserved";
  const canPurchase = isLive && Boolean(user) && !isOwnListing;
  const rawPriceNgn = priceNum(listing?.price ?? "0");

  return (
    <div className="page-shell page-shell--detail">
      <Link href="/marketplace" className="btn btn-outline btn-sm back-link">
        ← Back to marketplace
      </Link>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="panel panel--flush">
            <div className="detail-hero-media" style={heroStyle}>
              <div className="listing-card-ai listing-card-ai--lg">
                <span className="listing-card-ai-dot" />
                <span>
                  AI · {listing.material} · {conf}% CONFIDENCE
                </span>
              </div>
            </div>
            {photos.length > 0 ? (
              <div className="detail-thumbs">
                {photos.slice(0, 4).map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={
                      url === heroUrl ? "detail-thumb is-active" : "detail-thumb"
                    }
                    style={{
                      backgroundImage: `url(${url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={() => setActivePhoto(url)}
                    aria-label="Show photo"
                  />
                ))}
                {photos.length > 4 ? (
                  <div className="detail-thumb detail-thumb--more">
                    +{photos.length - 4}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="panel panel--pad">
            <div className="panel-label">CLASSIFICATION REPORT</div>
            <div className="breakdown-list">
              {breakdown.map((b) => (
                <div key={b.label} className="breakdown-row">
                  <div className="breakdown-label">{b.label}</div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill bar-fill--${b.tone}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <div className="breakdown-pct">{b.pct}%</div>
                </div>
              ))}
            </div>
            <p className="panel-copy">
              Classification is confirmed by the seller before going live. Confidence below 60%
              should be reviewed carefully.
            </p>
          </div>

          <div className="panel panel--pad">
            <div className="panel-label">SPECIFICATION</div>
            <div className="spec-grid">
              {specs.map((s) => (
                <div key={s.k} className="spec-cell">
                  <div className="stat-label">{s.k}</div>
                  <div className="spec-value">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="detail-aside">
          <div className="panel panel--pad">
            <div className="live-badge">
              {listing.material} ·{" "}
              <span
                style={{
                  color: isSold
                    ? "oklch(0.62 0.14 155)"
                    : isReserved
                      ? "oklch(0.72 0.12 85)"
                      : undefined,
                }}
              >
                {rawStatus ?? "LIVE"}
              </span>
            </div>
            <h1 className="detail-title">{listing.title}</h1>
            <div className="detail-price-row">
              <div className="detail-price">₦{listing.price}</div>
              <div className="detail-price-meta">
                for {listing.weight} kg · ₦{perKg}/kg
              </div>
            </div>

            {/* ── Action panel ── */}
            <div className="detail-actions">
              {isSold ? (
                <div className="paystack-success">
                  <div className="paystack-success-icon">✓</div>
                  <div className="paystack-success-title">This lot has been sold</div>
                  <p className="paystack-success-copy">
                    Check the marketplace for similar available materials.
                  </p>
                </div>
              ) : isReserved ? (
                <>
                  <div className="upload-error" style={{ textAlign: "center" }}>
                    Reserved — deal in progress
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-block"
                    onClick={contact}
                  >
                    Message seller
                  </button>
                </>
              ) : user ? (
                <>
                  {/* Purchase button — hidden for own listings */}
                  {!isOwnListing && rawPriceNgn > 0 ? (
                    <PaystackButton
                      buyerEmail={user.email ?? ""}
                      buyerId={user.id}
                      listingId={listing.id}
                      priceFormatted={listing.price}
                      priceNgn={rawPriceNgn}
                      listingTitle={listing.title}
                      onPurchaseComplete={() => setSoldLocally(true)}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline btn-block"
                    onClick={contact}
                  >
                    Initiate contact
                  </button>
                </>
              ) : (
                /* Not logged in */
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={() => openAuth("login", `/marketplace/${id}`)}
                >
                  Log in to purchase
                </button>
              )}
            </div>
            <div className="detail-reply-note">
              Contact opens Messages with this seller · exact address shared after you accept
            </div>
          </div>

          <div className="carbon-card">
            <div className="carbon-card-label">ESTIMATED CARBON BENEFIT</div>
            <div className="carbon-card-row">
              <div className="carbon-card-v">{co2}</div>
              <div className="carbon-card-unit">kg CO₂e diverted</div>
            </div>
            <p className="carbon-card-copy">
              LCA-based estimate for recovered {listing.material.toLowerCase()} versus virgin
              material extraction. An estimate, not a certified measurement.
            </p>
          </div>

          <div className="panel panel--pad">
            <div className="panel-label">PICKUP LOCATION</div>
            <GoogleMapLocation
              lat={listing.lat}
              lng={listing.lng}
              zone={listing.zone}
              distance={listing.distance}
            />
            <div className="map-meta">
              <div>{listing.address || `${listing.zone}, Lagos State`}</div>
              <div className="map-meta-sub">
                Exact address shared after contact is accepted
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
