"use client";

import { useState } from "react";
import { GoogleMapLocation } from "@/components/marketplace/GoogleMapLocation";

export type SelectedLocation = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type GeocodeResponse = SelectedLocation & { error?: string };

type GoogleMapLocationPickerProps = {
  value: SelectedLocation;
  zone: string;
  onChange: (location: SelectedLocation) => void;
};

export function GoogleMapLocationPicker({
  value,
  zone,
  onChange,
}: GoogleMapLocationPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function geocode(params: URLSearchParams) {
    const response = await fetch(`/api/geocode?${params}`);
    const result = (await response.json()) as GeocodeResponse;
    if (!response.ok) {
      throw new Error(result.error || "Could not resolve this location.");
    }
    onChange({
      address: result.address,
      lat: result.lat,
      lng: result.lng,
    });
  }

  async function findAddress() {
    if (!value.address.trim()) {
      setError("Enter an address to find it on the map.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ address: value.address.trim() });
      await geocode(params);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not find address.";
      setError(`${message} You can still publish using the selected pickup zone.`);
    } finally {
      setBusy(false);
    }
  }

  function updateAddress(address: string) {
    setError(null);
    onChange({
      address,
      lat: address === value.address ? value.lat : null,
      lng: address === value.address ? value.lng : null,
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location access is not available in this browser.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            lat: String(coords.latitude),
            lng: String(coords.longitude),
          });
          await geocode(params);
        } catch (reason) {
          const message =
            reason instanceof Error ? reason.message : "Could not resolve your location.";
          setError(`${message} You can still publish using the selected pickup zone.`);
        } finally {
          setBusy(false);
        }
      },
      (reason) => {
        setBusy(false);
        setError(reason.message || "Location permission was denied.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="form-stack">
      <label className="field-label" htmlFor="location-address">
        Address or pickup point
      </label>
      <div className="form-row-2">
        <input
          id="location-address"
          className="input"
          value={value.address}
          onChange={(event) => updateAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void findAddress();
            }
          }}
          placeholder="Search a Lagos address or business"
          autoComplete="street-address"
        />
        <div className="form-row-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void findAddress()}
            disabled={busy}
          >
            Find on map
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={useCurrentLocation}
            disabled={busy}
          >
            Use my location
          </button>
        </div>
      </div>
      {busy ? <div className="field-foot">Resolving location…</div> : null}
      {!busy && value.address.trim() && (value.lat == null || value.lng == null) ? (
        <div className="field-foot">
          Verified coordinates improve distance estimates; if unavailable, the selected pickup
          zone is used for publishing.
        </div>
      ) : null}
      {error ? (
        <div className="field-foot" role="alert" style={{ color: "oklch(0.52 0.13 30)" }}>
          {error}
        </div>
      ) : null}
      {value.lat != null && value.lng != null ? (
        <GoogleMapLocation
          lat={value.lat}
          lng={value.lng}
          zone={zone}
        />
      ) : null}
    </div>
  );
}
