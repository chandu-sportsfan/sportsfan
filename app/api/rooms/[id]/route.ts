import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Helper ───────────────────────────────────────────────────────────────────
function getIdFromUrl(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split("/");
  return parts[parts.length - 1] || null;
}

// ─── GET: Fetch single room by ID ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    const doc = await db.collection("rooms").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room: { id: doc.id, ...doc.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id] GET]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── PUT: Partial update (used per step save / draft) ────────────────────────
// Each step sends only its own fields — no full-doc replacement needed.
export async function PUT(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Room ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Strip undefined values so Firestore doesn't error
    const sanitized = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    );

    // Keep titleLower in sync if title is being updated
    if (sanitized.title) {
      sanitized.titleLower = String(sanitized.title).trim().toLowerCase();
    }

    const docRef = db.collection("rooms").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    await docRef.update({ ...sanitized, updatedAt: Date.now() });

    return NextResponse.json({ success: true, message: "Room updated" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id] PUT]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── DELETE: Remove room ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
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

    await docRef.delete();

    return NextResponse.json({ success: true, message: "Room deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms/[id] DELETE]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}