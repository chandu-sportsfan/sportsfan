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

export async function POST(req: NextRequest) {

  const body = await req.json();
  const {
  userId,
  name,
  location,
  description,
  website,
  avatarUrl
} = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

 await db.collection("users").doc(userId).set(
{
  name,
  location,
  description,
  website,
  avatarUrl
},
{ merge: true }
);
  return NextResponse.json({ success: true });
}
