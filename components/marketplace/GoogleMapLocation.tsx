"use client";

import { useMemo } from "react";

type GoogleMapLocationProps = {
  lat?: number | null;
  lng?: number | null;
  zone: string;
  distance?: number;
};

// Default coordinates for Lagos SME clusters
const CLUSTER_COORDS: Record<string, { lat: number; lng: number }> = {
  Ogba: { lat: 6.6353, lng: 3.3429 },
  Ikeja: { lat: 6.6018, lng: 3.3515 },
  Isolo: { lat: 6.5298, lng: 3.3283 },
  Apapa: { lat: 6.4474, lng: 3.359 },
  Oshodi: { lat: 6.5569, lng: 3.3524 },
  Ilupeju: { lat: 6.5481, lng: 3.3644 },
};

export function GoogleMapLocation({
  lat,
  lng,
  zone,
  distance,
}: GoogleMapLocationProps) {
  const coords = useMemo(() => {
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return CLUSTER_COORDS[zone] || CLUSTER_COORDS.Ogba;
  }, [lat, lng, zone]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Use official Embed API if key is present; otherwise use Google Maps web embed
  const mapSrc = useMemo(() => {
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${coords.lat},${coords.lng}&zoom=14`;
    }
    return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=14&output=embed`;
  }, [apiKey, coords.lat, coords.lng]);

  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

  return (
    <div className="google-map-container" style={{ marginTop: 12 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "170px",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid var(--border, #e5e5e5)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <iframe
          title={`Map location for ${zone}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={mapSrc}
        />

        {/* Distance pill floating over top-left of the map */}
        {distance != null && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(4px)",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--ink, #1f2937)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#16a34a",
              }}
            />
            {distance} km away · {zone}
          </div>
        )}

        {/* External Google Maps launch button floating at bottom-right */}
        <a
          href={externalMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google Maps"
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "#ffffff",
            padding: "4px 8px",
            borderRadius: "5px",
            fontSize: "10.5px",
            fontWeight: 600,
            color: "#2563eb",
            textDecoration: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>Open in Google Maps ↗</span>
        </a>
      </div>
    </div>
  );
}

