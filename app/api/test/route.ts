// app/api/test/route.ts

import { db } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.collection("debug").add({
      test: true,
      time: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DEBUG ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}