// app/api/chat/groups/route.ts
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
    console.log("Received request for chat groups",req);
  try {
    // Placeholder response - replace with actual group data fetching logic
    const groups = [
      { id: "group1", name: "Football Fans" },
      { id: "group2", name: "Cricket Enthusiasts" },
    ];
    return NextResponse.json({ success: true, groups });
  }
    catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}