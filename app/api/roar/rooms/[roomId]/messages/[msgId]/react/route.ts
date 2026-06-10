import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";

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
    const { reaction }: { reaction: "fire" | "noChance" | "heart" } = body;

    if (reaction !== "fire" && reaction !== "noChance" && reaction !== "heart") {
      return NextResponse.json(
        { error: "reaction must be 'fire', 'noChance' or 'heart'" },
        { status: 400 },
      );
    }

    // Resolve user ID
    let resolvedUserId = user.email;
    let userSnap = await db.collection("users").doc(user.email).get();
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }

    let field = "fireCount";
    if (reaction === "noChance") field = "noChanceCount";
    else if (reaction === "heart") field = "heartCount";
    const msgRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId);

    const reactionRef = msgRef.collection("reactions").doc(`${resolvedUserId}_${reaction}`);

    let finalCount = 0;

    await db.runTransaction(async (tx) => {
      const [msgSnap, reactionSnap] = await Promise.all([
        tx.get(msgRef),
        tx.get(reactionRef),
      ]);

      if (!msgSnap.exists) {
        throw new Error("Message not found");
      }

      if (reactionSnap.exists) {
        throw new Error("Already reacted");
      }

      const current = (msgSnap.data() as any)[field] ?? 0;
      finalCount = current + 1;

      tx.update(msgRef, {
        [field]: FieldValue.increment(1),
      });

      tx.set(reactionRef, {
        reaction,
        reactedAt: Date.now(),
      });
    });

    return NextResponse.json({ success: true, [field]: finalCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    if (msg === "Message not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Already reacted") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
