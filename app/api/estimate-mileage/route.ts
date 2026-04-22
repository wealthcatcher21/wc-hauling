import { NextRequest, NextResponse } from "next/server";

const DUMP_ADDRESS = "3131 K-Ville Avenue, Auburndale, FL 33823";
const MILEAGE_RATE = 1.19;
// Straight-line to driving distance multiplier for central FL road network
const DRIVING_FACTOR = 1.35;

function haversimeMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WCHaulingPolk/1.0 tmonecla93@gmail.com",
      "Accept-Language": "en",
    },
  });
  const data = await res.json();
  if (!data?.[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const [customerCoords, dumpCoords] = await Promise.all([
    geocode(address),
    geocode(DUMP_ADDRESS),
  ]);

  if (!customerCoords) return NextResponse.json({ error: "Could not locate customer address. Check the address and try again." }, { status: 422 });
  if (!dumpCoords) return NextResponse.json({ error: "Could not locate dump address." }, { status: 422 });

  const straightLine = haversimeMiles(
    customerCoords.lat, customerCoords.lon,
    dumpCoords.lat, dumpCoords.lon
  );

  // Round trip: customer ↔ dump
  const estimatedMiles = Math.round(straightLine * DRIVING_FACTOR * 2 * 10) / 10;
  const mileageCost = Math.round(estimatedMiles * MILEAGE_RATE * 100) / 100;

  return NextResponse.json({
    estimatedMiles,
    mileageCost,
    rate: MILEAGE_RATE,
    note: "Estimate based on straight-line distance × 1.35 driving factor, round trip to dump.",
  });
}
