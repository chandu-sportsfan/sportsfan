import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── GET: Fetch events for room creation Step 1 selector ──────────────────────
// Kept lean — only returns fields the UI needs (id, name, sport, date, status).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const sport = searchParams.get("sport"); // e.g. badminton, cricket
    const status = searchParams.get("status"); // upcoming | live | completed
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");

    // SEARCH PATH — uses pre-stored nameLower field, same pattern as playershome
    if (search) {
      let q: FirebaseFirestore.Query = db
        .collection("events")
        .where("nameLower", ">=", search)
        .where("nameLower", "<=", search + "\uf8ff")
        .limit(limit);

      if (sport) q = q.where("sport", "==", sport);

      const snap = await q.get();
      return NextResponse.json({
        success: true,
        events: snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          sport: d.data().sport,
          scheduledAt: d.data().scheduledAt,
          status: d.data().status,
          thumbnail: d.data().thumbnail ?? null,
        })),
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // NORMAL PAGINATED PATH
    let query: FirebaseFirestore.Query = db
      .collection("events")
      .orderBy("scheduledAt", "asc");

    if (sport) query = query.where("sport", "==", sport);
    if (status) query = query.where("status", "==", status);

    if (lastDocId) {
      const lastDocRef = db.collection("events").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    query = query.limit(limit);
    const snap = await query.get();
    const lastDoc = snap.docs[snap.docs.length - 1];

    const events = snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      sport: d.data().sport,
      scheduledAt: d.data().scheduledAt,
      status: d.data().status,
      thumbnail: d.data().thumbnail ?? null,
    }));

    return NextResponse.json({
      success: true,
      events,
      pagination: {
        limit,
        hasMore: events.length === limit,
        nextCursor: events.length === limit ? lastDoc?.id : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[events GET]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST: Create event (admin use) ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sport, scheduledAt, status = "upcoming", thumbnail } = body;

    if (!name || !sport || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: "name, sport, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const newEvent = {
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      sport,
      scheduledAt,
      status,
      thumbnail: thumbnail || null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("events").add(newEvent);

    return NextResponse.json(
      { success: true, id: docRef.id, event: { id: docRef.id, ...newEvent } },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[events POST]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}