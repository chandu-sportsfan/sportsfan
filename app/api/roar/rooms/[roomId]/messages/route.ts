//api/roar/rooms/[roomId]/messages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const lastDocId = searchParams.get("lastDocId");

    let query = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId) {
      const lastDoc = await db
        .collection("roarRooms")
        .doc(roomId)
        .collection("messages")
        .doc(lastDocId)
        .get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const messages: RoomMessage[] = snapshot.docs.map((doc) => ({
      ...(doc.data() as RoomMessage),
      msgId: doc.id,
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        hasMore: messages.length === limit,
        nextCursor:
          messages.length === limit ? { lastDocId: lastDoc?.id } : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/rooms/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // const { text, type = "chat", mediaUrls }: { text: string; type: MessageType; mediaUrls?: string[] } = body;
    const { 
  text, 
  type = "chat", 
  mediaUrls,
  sideA,
  sideB,
}: { 
  text: string; 
  type: MessageType; 
  mediaUrls?: string[];
  sideA?: string;
  sideB?: string;
} = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    let userSnap = await db.collection("users").doc(user.email).get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }
    const userData = userSnap.data() as { username: string; badge: string };

    const roomRef = db.collection("roarRooms").doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const now = Date.now();
    const msgRef = roomRef
      .collection("messages")
      .doc();

    // const message: RoomMessage = {
    //   msgId: msgRef.id,
    //   roomId: roomId,
    //   authorUid: resolvedUserId,
    //   authorUsername: userData.username,
    //   authorBadge: userData.badge,
    //   text: text.trim(),
    //   type,
    //   fireCount: 0,
    //   noChanceCount: 0,
    //   createdAt: now,
    //   ...(mediaUrls && { mediaUrls }),
    // };

    const message: RoomMessage = {
  msgId: msgRef.id,
  roomId: roomId,
  authorUid: resolvedUserId,
  authorUsername: userData.username,
  authorBadge: userData.badge,
  text: text.trim(),
  type,
  fireCount: 0,
  noChanceCount: 0,
  heartCount: 0,
  createdAt: now,
  ...(mediaUrls && { mediaUrls }),
  ...(sideA && { sideA }),
  ...(sideB && { sideB }),
};

    const batch = db.batch();
    batch.set(msgRef, message);
    // Bump room's fanCount as a presence proxy
    batch.update(roomRef, {
      fanCount: FieldValue.increment(1),
    });

    await batch.commit();

    return NextResponse.json({ success: true, msgId: msgRef.id, message });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/rooms/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
