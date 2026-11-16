import { NextRequest, NextResponse } from "next/server";

type GeocodeResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
};

export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Google Maps geocoding is not configured on the server." },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address")?.trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const hasLat = lat !== null;
  const hasLng = lng !== null;
  const reverse = hasLat && hasLng;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (
    hasLat !== hasLng ||
    (address && reverse) ||
    (!address && !reverse) ||
    (address && address.length > 500) ||
    (reverse &&
      (!lat?.trim() ||
        !lng?.trim() ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180))
  ) {
    return NextResponse.json(
      { error: "Provide an address or a valid latitude and longitude pair." },
      { status: 400 }
    );
  }

  const query = new URLSearchParams({ key });
  if (reverse) query.set("latlng", `${latitude},${longitude}`);
  else query.set("address", `${address}, Lagos, Nigeria`);

  let response: Response;
  try {
    response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${query}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
  } catch {
    return NextResponse.json(
      { error: "Google Maps geocoding request failed or timed out." },
      { status: 502 }
    );
  }
  if (!response.ok) {
    return NextResponse.json(
      { error: "Google Maps geocoding request failed." },
      { status: 502 }
    );
  }

  let data: {
    status: string;
    error_message?: string;
    results?: GeocodeResult[];
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return NextResponse.json(
      { error: "Google Maps returned an invalid geocoding response." },
      { status: 502 }
    );
  }
  if (data.status !== "OK" || !data.results?.[0]) {
    const status = data.status === "ZERO_RESULTS" ? 404 : 502;
    return NextResponse.json(
      { error: data.error_message || `Google Maps geocoding returned ${data.status}.` },
      { status }
    );
  }

  const result = data.results[0];
  const resultLat = result.geometry?.location?.lat;
  const resultLng = result.geometry?.location?.lng;
  if (
    typeof result.formatted_address !== "string" ||
    !Number.isFinite(resultLat) ||
    !Number.isFinite(resultLng) ||
    resultLat < -90 ||
    resultLat > 90 ||
    resultLng < -180 ||
    resultLng > 180
  ) {
    return NextResponse.json(
      { error: "Google Maps returned an invalid location." },
      { status: 502 }
    );
  }
  return NextResponse.json({
    address: result.formatted_address,
    lat: resultLat,
    lng: resultLng,
  });
}
