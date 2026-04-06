// app/api/watch-along/[id]/chats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Helper function to extract ID from URL
// URL pattern: /api/watch-along/[id]/chats
function getIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // Find the position of 'chats' and get the previous part
  const chatsIndex = pathParts.indexOf('chats');
  if (chatsIndex > 0) {
    return pathParts[chatsIndex - 1];
  }
  return null;
}

/* ─────────────────────────────────────────────
   DELETE  /api/watch-along/[id]/chats
   Deletes a room and all its chat messages
   ───────────────────────────────────────────── */
export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 }
      );
    }

    const roomRef = db.collection("watchAlongRooms").doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Room not found" },
        { status: 404 }
      );
    }

    // Delete all chat messages in the room
    const chatsSnapshot = await roomRef.collection("chats").get();
    const batch = db.batch();
    
    chatsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the room document
    batch.delete(roomRef);
    
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Room and all chats deleted successfully",
    });
  } catch (error) {
    console.error("[chats DELETE]", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────
   GET  /api/watch-along/[id]/chats
   Returns paginated chat messages for a room
   Query params: limit (default: 50)
   ───────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = getIdFromUrl(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 }
      );
    }

    const roomRef = db.collection("watchAlongRooms").doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Room not found" },
        { status: 404 }
      );
    }

    const snapshot = await roomRef
      .collection("chats")
      .orderBy("createdAt", "asc")
      .limitToLast(limit)
      .get();

    const chats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      chats,
      count: chats.length,
    });
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
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { user, text, color } = body;

    if (!user || !text) {
      return NextResponse.json(
        { success: false, message: "user and text are required" },
        { status: 400 }
      );
    }

    const roomRef = db.collection("watchAlongRooms").doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Room not found" },
        { status: 404 }
      );
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