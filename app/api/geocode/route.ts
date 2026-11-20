import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Geoapify geocoding is not configured on the server." },
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

  let apiUrl: string;
  if (reverse) {
    apiUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${encodeURIComponent(
      key
    )}`;
  } else {
    apiUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
      `${address}, Lagos, Nigeria`
    )}&filter=countrycode:ng&limit=1&apiKey=${encodeURIComponent(key)}`;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      { error: "Geoapify geocoding request failed or timed out." },
      { status: 502 }
    );
  }
  if (!response.ok) {
    return NextResponse.json(
      { error: "Geoapify geocoding request failed." },
      { status: 502 }
    );
  }

  type GeoapifyFeature = {
    properties?: {
      formatted?: string;
      lat?: number;
      lon?: number;
    };
    geometry?: {
      coordinates?: [number, number]; // [lon, lat]
    };
  };

  let data: {
    features?: GeoapifyFeature[];
    message?: string;
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return NextResponse.json(
      { error: "Geoapify returned an invalid geocoding response." },
      { status: 502 }
    );
  }

  const feature = data.features?.[0];
  if (!feature) {
    return NextResponse.json(
      { error: "No location found for this address." },
      { status: 404 }
    );
  }

  const coords = feature.geometry?.coordinates;
  const resultLon = coords?.[0] ?? feature.properties?.lon;
  const resultLat = coords?.[1] ?? feature.properties?.lat;
  const formattedAddress =
    feature.properties?.formatted || address || `${resultLat}, ${resultLon}`;

  if (
    !Number.isFinite(resultLat) ||
    !Number.isFinite(resultLon) ||
    resultLat! < -90 ||
    resultLat! > 90 ||
    resultLon! < -180 ||
    resultLon! > 180
  ) {
    return NextResponse.json(
      { error: "Geoapify returned an invalid location coordinate." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    address: formattedAddress,
    lat: resultLat,
    lng: resultLon,
  });
}
