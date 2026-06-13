import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";

// POST — join
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roomRef = db.collection("roarRooms").doc(roomId);

    // 1 write only — no read needed
    await roomRef.update({
      fanCount: FieldValue.increment(1),
    });

    const snap = await roomRef.get();
    return NextResponse.json({
      success: true,
      fanCount: snap.data()?.fanCount ?? 1,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — leave
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roomRef = db.collection("roarRooms").doc(roomId);

    // 1 write only — FieldValue.increment handles atomicity
    // -1 is safe; Firestore allows negative but we reset via a scheduled job
    await roomRef.update({
      fanCount: FieldValue.increment(-1),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}