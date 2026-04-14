import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Helper ───────────────────────────────────────────────────────────────────
function getRoomIdFromUrl(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split("/");
  const mediaIdx = parts.indexOf("media");
  return mediaIdx > 0 ? parts[mediaIdx - 1] : null;
}

// ─── GET: List media assets for a room ───────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const roomId = getRoomIdFromUrl(req);
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Read media from the room doc itself — avoids a separate sub-collection read
    const doc = await db.collection("rooms").doc(roomId).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as Record<string, unknown>;
    const mediaAssets = Array.isArray(data.mediaAssets) ? data.mediaAssets : [];

    return NextResponse.json({ success: true, mediaAssets });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id]/media GET]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST: Register uploaded asset URL into room doc ─────────────────────────
// The actual file upload is handled client-side (e.g. Firebase Storage / S3).
// This endpoint just records the asset metadata into the room document.
export async function POST(req: NextRequest) {
  try {
    const roomId = getRoomIdFromUrl(req);
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { url, type, name, sizeBytes } = body;

    if (!url || !type) {
      return NextResponse.json(
        { success: false, error: "url and type are required" },
        { status: 400 }
      );
    }

    const docRef = db.collection("rooms").doc(roomId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as Record<string, unknown>;
    const existing = Array.isArray(data.mediaAssets) ? data.mediaAssets : [];

    const newAsset = {
      url,
      type,   // video | image | document | slide
      name: name || url.split("/").pop() || "asset",
      sizeBytes: sizeBytes || null,
      addedAt: Date.now(),
    };

    // Append — no full doc rewrite needed
    await docRef.update({
      mediaAssets: [...existing, newAsset],
      updatedAt: Date.now(),
    });

    return NextResponse.json(
      { success: true, asset: newAsset },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id]/media POST]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── DELETE: Remove a specific asset by URL ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const roomId = getRoomIdFromUrl(req);
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json(
        { success: false, error: "Asset url is required" },
        { status: 400 }
      );
    }

    const docRef = db.collection("rooms").doc(roomId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as Record<string, unknown>;
    const existing = Array.isArray(data.mediaAssets) ? data.mediaAssets : [];
    const filtered = existing.filter(
      (a: { url: string }) => a.url !== url
    );

    await docRef.update({ mediaAssets: filtered, updatedAt: Date.now() });

    return NextResponse.json({ success: true, message: "Asset removed" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id]/media DELETE]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}