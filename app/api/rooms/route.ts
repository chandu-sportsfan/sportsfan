import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

//  GET: Fetch rooms (paginated + optional filters) 
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId");
    const status = searchParams.get("status"); // draft | published | live | ended
    const roomType = searchParams.get("roomType"); // open | inner | moment | reflection
    const eventId = searchParams.get("eventId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50); // cap at 50
    const lastDocId = searchParams.get("lastDocId");

    let query: FirebaseFirestore.Query = db
      .collection("rooms")
      .orderBy("createdAt", "desc");

    // Apply filters — each reduces docs scanned
    if (hostId) query = query.where("hostId", "==", hostId);
    if (status) query = query.where("status", "==", status);
    if (roomType) query = query.where("roomType", "==", roomType);
    if (eventId) query = query.where("eventId", "==", eventId);

    // Cursor-based pagination — avoids offset scans
    if (lastDocId) {
      const lastDocRef = db.collection("rooms").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit);
    const snap = await query.get();

    const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lastDoc = snap.docs[snap.docs.length - 1];

    return NextResponse.json({
      success: true,
      rooms,
      pagination: {
        limit,
        hasMore: rooms.length === limit,
        nextCursor: rooms.length === limit ? lastDoc?.id : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms GET]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

//  POST: Create a new room (all 4 steps merged or step-by-step via status) ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      // Step 1
      hostId,
      eventId,
      roomType, // open | inner | moment | reflection

      // Step 2
      title,
      description,
      thumbnail,
      capacity,
      language,
      tags,
      scheduledAt,
      moderators,

      // Step 3
      mediaAssets, // array of { url, type, name }

      // Step 4
      price,

      // Meta
      status = "draft", // draft | published
    } = body;

    // Minimal validation — require only core fields
    if (!hostId || !eventId || !roomType) {
      return NextResponse.json(
        { success: false, error: "hostId, eventId, and roomType are required" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const newRoom = {
      hostId,
      eventId,
      roomType,

      title: title?.trim() || "",
      titleLower: title?.trim().toLowerCase() || "", // enables case-insensitive search
      description: description?.trim() || "",
      thumbnail: thumbnail || null,
      capacity: capacity || null,
      language: language || null,
      tags: Array.isArray(tags) ? tags : [],
      scheduledAt: scheduledAt || null,
      moderators: Array.isArray(moderators) ? moderators : [],

      mediaAssets: Array.isArray(mediaAssets) ? mediaAssets : [],

      price: price !== undefined ? Number(price) : null,

      status,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("rooms").add(newRoom);

    return NextResponse.json(
      { success: true, id: docRef.id, room: { id: docRef.id, ...newRoom } },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("[rooms POST]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}