import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Helper ───────────────────────────────────────────────────────────────────
function getRoomIdFromUrl(req: NextRequest): string | null {
  // Path: /api/rooms/[id]/publish → parts[-2]
  const parts = new URL(req.url).pathname.split("/");
  const publishIdx = parts.indexOf("publish");
  return publishIdx > 0 ? parts[publishIdx - 1] : null;
}

// ─── POST: Publish room (Step 4 final action) ─────────────────────────────────
// Validates required fields are present before flipping status to "published".
export async function POST(req: NextRequest) {
  try {
    const id = getRoomIdFromUrl(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    const docRef = db.collection("rooms").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as Record<string, unknown>;

    // Guard: block publish if already published/live
    if (data.status === "published" || data.status === "live") {
      return NextResponse.json(
        { success: false, error: `Room is already ${data.status}` },
        { status: 409 }
      );
    }

    // Validate minimum required fields across all steps
    const missing: string[] = [];
    if (!data.eventId) missing.push("eventId");
    if (!data.roomType) missing.push("roomType");
    if (!data.title) missing.push("title");

    // Inner / Moment rooms must have a price
    if (
      (data.roomType === "inner" || data.roomType === "moment") &&
      data.price === null
    ) {
      missing.push("price (required for premium rooms)");
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot publish — missing required fields",
          missing,
        },
        { status: 422 }
      );
    }

    // Accept optional price override from request body (Step 4 final price)
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (body.price !== undefined) {
      updates.price = Number(body.price);
    }

    await docRef.update(updates);

    return NextResponse.json({
      success: true,
      message: "Room published successfully",
      room: { id, ...data, ...updates },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id]/publish POST]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}