import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { ChatRoom } from "@/app/models/ChatRoom";

// GET /api/roar/rooms - List all active discussion rooms
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await db
      .collection("roarRooms")
      .get();

    const rooms: ChatRoom[] = snapshot.docs
      .map((doc) => ({
        ...(doc.data() as ChatRoom),
        roomId: doc.id,
      }))
      .filter((room) => room.isActive !== false)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      success: true,
      rooms,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/rooms error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/roar/rooms - Create a new discussion room
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, icon, sport, description, isActive, scheduledStartTime } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }

    const roomRef = db.collection("roarRooms").doc();
    const newRoom: ChatRoom = {
      roomId: roomRef.id,
      name: name.trim(),
      ...(icon && { icon }),
      sport: sport || "general",
      ...(description && { description: description.trim() }),
      createdAt: Date.now(),
      isActive: isActive !== undefined ? isActive : true,
      fanCount: 0,
      ...(scheduledStartTime && { scheduledStartTime: Number(scheduledStartTime) }),
    };

    await roomRef.set(newRoom);

    return NextResponse.json({
      success: true,
      room: newRoom,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/rooms error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
