import { NextResponse } from "next/server";

export async function GET() {
  try {
    const POINTS_TABLE_URL = "https://res.cloudinary.com/dflnsufit/raw/upload/v1777856863/sf360/scripts/IPL_Points_Table_2026.html";
    const CAPS_URL = "https://res.cloudinary.com/dflnsufit/raw/upload/v1777856864/sf360/scripts/IPL_Caps_2026.html";

    const [pointsRes, capsRes] = await Promise.all([
      fetch(POINTS_TABLE_URL, { cache: 'no-store' }),
      fetch(CAPS_URL, { cache: 'no-store' })
    ]);

    const pointsHtml = await pointsRes.text();
    const capsHtml = await capsRes.text();

    // ✅ Add CORS headers to the response so the frontend is allowed to read it
    return NextResponse.json({
      pointsTableHtml: pointsHtml,
      capsHtml: capsHtml
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows access from any frontend URL
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error("Failed to fetch IPL CDN data:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
