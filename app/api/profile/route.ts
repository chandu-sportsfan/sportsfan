// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseadmin"; // your existing firebase admin import
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const doc = await db.collection("users").doc(userId).get();
  if (!doc.exists) return NextResponse.json({});
  return NextResponse.json(doc.data());
}

// AFTER
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { userId, name, location, description, website, avatarUrl, subtitle } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const updateData: Record<string, string> = {};
    if (name        !== undefined) updateData.name        = name;
    if (location    !== undefined) updateData.location    = location;
    if (description !== undefined) updateData.description = description;
    if (website     !== undefined) updateData.website     = website;
    if (subtitle    !== undefined) updateData.subtitle    = subtitle;
    if (avatarUrl   !== undefined) updateData.avatarUrl   = avatarUrl;

    await db.collection("users").doc(userId).set(updateData, { merge: true });
    return NextResponse.json({ success: true });
}
