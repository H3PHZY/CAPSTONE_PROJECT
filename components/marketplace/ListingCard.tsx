"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { co2Of } from "@/lib/carbon";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  showCarbon?: boolean;
  variant?: "market" | "sample";
}

function mediaStyle(listing: Listing): CSSProperties | undefined {
  const url = listing.photoUrl || (listing.photo.startsWith("http") ? listing.photo : null);
  if (!url) return undefined;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function ListingCard({
  listing,
  showCarbon = true,
  variant = "market",
}: ListingCardProps) {
  const router = useRouter();
  const co2 = co2Of(listing).toLocaleString();
  const href = `/marketplace/${listing.id}`;
  const style = mediaStyle(listing);

  function open() {
    router.push(href);
  }

  function contact(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/messages?listing=${listing.id}`);
  }

  if (variant === "sample") {
    return (
      <article className="listing-card listing-card--sample" onClick={open} role="link">
        <div className="listing-card-media listing-card-media--sm" style={style}>
          <div className="listing-card-badge-dark">
            {listing.material} · {listing.conf}%
          </div>
        </div>
        <div className="listing-card-body listing-card-body--tight">
          <div className="listing-card-title listing-card-title--sm">{listing.title}</div>
          <div className="listing-card-meta-row">
            <span>{listing.weight} kg</span>
            <span>{listing.distance} km</span>
            <span className="text-green">≈{co2} kg CO₂e</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="listing-card">
      <div className="listing-card-media" onClick={open} role="link" style={style}>
        <div className="listing-card-ai">
          <span className="listing-card-ai-dot" />
          <span>AI-VERIFIED · {listing.material}</span>
        </div>
        <div className="listing-card-conf">{listing.conf}%</div>
        {showCarbon ? (
          <div className="listing-card-co2">≈ {co2} kg CO₂e SAVED</div>
        ) : null}
      </div>
      <div className="listing-card-body">
        <div>
          <Link href={href} className="listing-card-title">
            {listing.title}
          </Link>
          <div className="listing-card-seller">
            <span>{listing.seller}</span>
            {listing.verified ? <span className="verified-pill">VERIFIED</span> : null}
          </div>
        </div>
        <div className="listing-card-stats">
          <div>
            <div className="stat-label">WEIGHT</div>
            <div className="stat-value">{listing.weight} kg</div>
          </div>
          <div>
            <div className="stat-label">DISTANCE</div>
            <div className="stat-value">{listing.distance} km</div>
          </div>
          <div>
            <div className="stat-label">ASKING</div>
            <div className="stat-value">₦{listing.price}</div>
          </div>
        </div>
        <div className="listing-card-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={contact}>
            Initiate contact
          </button>
          <Link href={href} className="btn btn-outline">
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
