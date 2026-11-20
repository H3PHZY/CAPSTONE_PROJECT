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
  "Ogba Industrial Estate": { lat: 6.6353, lng: 3.3429 },
  Ikeja: { lat: 6.6018, lng: 3.3515 },
  "Ikeja Industrial Estate": { lat: 6.6018, lng: 3.3515 },
  Isolo: { lat: 6.5298, lng: 3.3283 },
  Apapa: { lat: 6.4474, lng: 3.359 },
  Oshodi: { lat: 6.5569, lng: 3.3524 },
  Ilupeju: { lat: 6.5481, lng: 3.3644 },
  Other: { lat: 6.5244, lng: 3.3792 },
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
    return CLUSTER_COORDS[zone] || CLUSTER_COORDS.Other || CLUSTER_COORDS.Ogba;
  }, [lat, lng, zone]);

  // OpenStreetMap embed URL — zero API key required, completely free & reliable
  const mapSrc = useMemo(() => {
    const delta = 0.008; // zoom bounding box around coordinates
    const minLon = coords.lng - delta;
    const minLat = coords.lat - delta;
    const maxLon = coords.lng + delta;
    const maxLat = coords.lat + delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
  }, [coords.lat, coords.lng]);

  const externalMapUrl = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`;

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

        {/* External Map launch button floating at bottom-right */}
        <a
          href={externalMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in OpenStreetMap"
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
          <span>Open map ↗</span>
        </a>
      </div>
    </div>
  );
}
