import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Helper function to extract ID from URL
function getIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  return pathParts[pathParts.length - 1] || null;
}

/* ─────────────────────────────────────────────
   GET  /api/watch-along/[id]/chats
   Returns paginated chat messages for a room
   ───────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const id   = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const roomRef = db.collection("watchAlongRooms").doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });
    }

    const snapshot = await roomRef
      .collection("chats")
      .orderBy("createdAt", "asc")
      .limitToLast(limit)
      .get();

    const chats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, chats });
  } catch (error) {
    console.error("[chats GET]", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────
   POST  /api/watch-along/[id]/chats
   Adds a chat message to a room
   Body: JSON { user, text, color }
   ───────────────────────────────────────────── */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { user, text, color } = body;

    if (!user || !text) {
      return NextResponse.json(
        { success: false, message: "user and text are required" },
        { status: 400 }
      );
    }

    const roomRef = db.collection("watchAlongRooms").doc(params.id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });
    }

    const chatData = {
      user,
      text,
      color: color || "text-pink-400",
      createdAt: Date.now(),
    };

    const docRef = await roomRef.collection("chats").add(chatData);

    return NextResponse.json({
      success: true,
      chat: { id: docRef.id, ...chatData },
    });
  } catch (error) {
    console.error("[chats POST]", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}