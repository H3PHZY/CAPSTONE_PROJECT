"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import {
  GoogleMapLocationPicker,
  type SelectedLocation,
} from "@/components/marketplace/GoogleMapLocationPicker";
import { useAuth } from "@/lib/auth-context";
import {
  CATS,
  RADII,
  RADIUS_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/data";
import { fetchLiveListings } from "@/lib/listings";
import type { Listing, MaterialCategory, RadiusOption, SortOption } from "@/lib/types";
import { ListingCard } from "./ListingCard";

function priceNum(p: string) {
  return parseFloat(String(p).replace(/,/g, "")) || 0;
}

const EMPTY_LISTINGS: Listing[] = [];

export function MarketplacePage() {
  const { profile } = useAuth();
  const [viewerLocation, setViewerLocation] = useState<SelectedLocation>({
    address: "",
    lat: null,
    lng: null,
  });
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState<RadiusOption>("Within 10 km");
  const [cat, setCat] = useState<MaterialCategory | "All categories">("All categories");
  const [sort, setSort] = useState<SortOption>("Nearest first");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [listingResult, setListingResult] = useState<{
    key: string;
    listings: Listing[];
    error: string | null;
  } | null>(null);
  const [appliedProfileKey, setAppliedProfileKey] = useState<string | null>(null);
  const profileKey = profile
    ? JSON.stringify([
        profile.id,
        profile.address,
        profile.lat,
        profile.lng,
      ])
    : null;
  if (profile && profileKey !== appliedProfileKey) {
    setViewerLocation({
      address: profile.address || "",
      lat: profile.lat,
      lng: profile.lng,
    });
    setAppliedProfileKey(profileKey);
  }
  const unresolvedSearchLocation = Boolean(
    viewerLocation.address.trim() &&
      (viewerLocation.lat == null || viewerLocation.lng == null)
  );
  const requestKey = JSON.stringify([
    profile?.cluster,
    viewerLocation.lat,
    viewerLocation.lng,
    unresolvedSearchLocation,
  ]);
  const currentListingResult =
    !unresolvedSearchLocation && listingResult?.key === requestKey
      ? listingResult
      : null;
  const listings = currentListingResult?.listings ?? EMPTY_LISTINGS;
  const error = currentListingResult?.error ?? null;
  const loading = Boolean(!unresolvedSearchLocation && !currentListingResult);
  const searchLoading = loading && !unresolvedSearchLocation;

  useEffect(() => {
    if (unresolvedSearchLocation) return;

    let active = true;
    void fetchLiveListings(profile?.cluster, viewerLocation)
      .then((rows) => {
        if (!active) return;
        setListingResult({ key: requestKey, listings: rows, error: null });
      })
      .catch((err) => {
        if (!active) return;
        setListingResult({
          key: requestKey,
          listings: [],
          error: err instanceof Error ? err.message : "Could not load listings",
        });
      });
    return () => {
      active = false;
    };
  }, [
    requestKey,
    profile?.cluster,
    viewerLocation,
    unresolvedSearchLocation,
  ]);

  const list = useMemo(() => {
    if (unresolvedSearchLocation) return [];
    const max = RADII[radius] ?? 999;
    const query = q.trim().toLowerCase();
    let filtered: Listing[] = listings.filter(
      (L) =>
        L.distance <= max &&
        (cat === "All categories" || L.material === cat) &&
        (!verifiedOnly || L.verified) &&
        (!query ||
          `${L.title} ${L.material} ${L.seller}`.toLowerCase().includes(query))
    );

    if (sort === "Heaviest first") {
      filtered = [...filtered].sort((a, b) => b.weight - a.weight);
    } else if (sort === "Lowest price") {
      filtered = [...filtered].sort((a, b) => priceNum(a.price) - priceNum(b.price));
    } else {
      filtered = [...filtered].sort((a, b) => a.distance - b.distance);
    }
    return filtered;
  }, [listings, q, radius, cat, sort, verifiedOnly, unresolvedSearchLocation]);

  const chips: { label: string; v: MaterialCategory | "All categories" }[] = [
    { label: "All", v: "All categories" },
    ...CATS.map((c) => ({ label: c, v: c as MaterialCategory })),
  ];

  function clearFilters() {
    setQ("");
    setCat("All categories");
    setRadius("All Lagos State");
    setVerifiedOnly(false);
  }

  const categoryOptions = ["All categories", ...CATS];

  return (
    <div className="page-shell page-shell--xl">
      <div className="filter-panel">
        <div className="filter-grid">
          <div className="filter-search">
            <span className="filter-search-icon">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search materials, e.g. aluminium offcuts, HDPE drums"
              className="input input--search"
            />
          </div>
          <Select
            value={radius}
            options={[...RADIUS_OPTIONS]}
            onChange={(v) => setRadius(v as RadiusOption)}
            aria-label="Distance radius"
          />
          <Select
            value={cat}
            options={categoryOptions}
            onChange={(v) => setCat(v as MaterialCategory | "All categories")}
            aria-label="Material category"
          />
          <Select
            value={sort}
            options={[...SORT_OPTIONS]}
            onChange={(v) => setSort(v as SortOption)}
            aria-label="Sort listings"
          />
        </div>

        <div className="filter-location">
          <GoogleMapLocationPicker
            value={viewerLocation}
            zone={profile?.cluster || "Ogba"}
            onChange={setViewerLocation}
          />
        </div>

        <div className="filter-chips-row">
          <span className="filter-chips-label">QUICK FILTER</span>
          {chips.map((c) => (
            <button
              key={c.v}
              type="button"
              className={cat === c.v ? "chip is-active" : "chip"}
              onClick={() => setCat(c.v)}
            >
              {c.label}
            </button>
          ))}
          <span className="filter-spacer" />
          <label className="check-label">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
            Verified sellers only
          </label>
        </div>
      </div>

      <div className="market-head">
        <div>
          <h1 className="page-title">Available materials near you</h1>
          <div className="page-sub">
            {searchLoading
              ? "Loading listings…"
              : `${list.length} listings · ${cat.toLowerCase()} · ${radius.toLowerCase()} of ${viewerLocation.address || profile?.cluster || "Ogba"}`}
          </div>
        </div>
        <div className="live-pill">
          <span className="live-pill-dot" />
          <span>Live listings only</span>
        </div>
      </div>

      {unresolvedSearchLocation ? (
        <div className="upload-error">
          Find the search address on the map to apply this location.
        </div>
      ) : error ? (
        <div className="upload-error">{error}</div>
      ) : null}

      <div className="market-grid">
        {list.map((L) => (
          <ListingCard key={L.id} listing={L} />
        ))}
      </div>

      {(!loading || unresolvedSearchLocation) && list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">
            {viewerLocation.address.trim() &&
            (viewerLocation.lat == null || viewerLocation.lng == null)
              ? "Resolve this location first"
              : listings.length === 0
              ? "No live listings yet"
              : "No listings match this filter"}
          </div>
          <div className="empty-sub">
            {viewerLocation.address.trim() &&
            (viewerLocation.lat == null || viewerLocation.lng == null)
              ? "Select Find on map to apply the address as your search origin."
              : listings.length === 0
              ? "Be the first to publish surplus material from Quick listing."
              : "Widen the proximity / category filters, or clear them."}
          </div>
          {listings.length === 0 &&
          !(viewerLocation.address.trim() &&
            (viewerLocation.lat == null || viewerLocation.lng == null)) ? (
            <Link href="/listings/new" className="btn btn-primary">
              List a material
            </Link>
          ) : (
            <button type="button" className="btn btn-outline" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
