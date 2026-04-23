import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 4) return NextResponse.json([]);

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WCHaulingPolk/1.0 tmonecla93@gmail.com",
      "Accept-Language": "en",
    },
  });

  const data = await res.json();

  // Return cleaned address strings
  const suggestions = data.map((r: { display_name: string; address: Record<string, string>; place_id: number }) => {
    const a = r.address;
    const parts = [
      a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
      a.city || a.town || a.village || a.county,
      a.state,
      a.postcode,
    ].filter(Boolean);
    return { label: parts.join(", ") || r.display_name, place_id: r.place_id };
  });

  return NextResponse.json(suggestions);
}
