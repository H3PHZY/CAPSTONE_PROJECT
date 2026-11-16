import { getZoneCoordinates } from "@/lib/listings";

export type ListingLocationInput = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export function getPublishLocation(location: ListingLocationInput, zone: string) {
  const hasCoordinates =
    location.lat != null &&
    location.lng != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180;

  if (hasCoordinates) {
    return {
      address: location.address.trim(),
      lat: location.lat,
      lng: location.lng,
      usedZoneDefault: false,
    };
  }

  return {
    address: "",
    ...getZoneCoordinates(zone),
    usedZoneDefault: true,
  };
}
