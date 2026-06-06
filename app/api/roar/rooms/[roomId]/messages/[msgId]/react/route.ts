import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; msgId: string }> },
) {
  try {
    const { roomId, msgId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { reaction }: { reaction: "fire" | "noChance" } = body;

    if (reaction !== "fire" && reaction !== "noChance") {
      return NextResponse.json(
        { error: "reaction must be 'fire' or 'noChance'" },
        { status: 400 },
      );
    }

    const field = reaction === "fire" ? "fireCount" : "noChanceCount";
    const msgRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId);

    const snap = await msgRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const current = (snap.data() as any)[field] ?? 0;
    await msgRef.update({ [field]: current + 1 });

    return NextResponse.json({ success: true, [field]: current + 1 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
