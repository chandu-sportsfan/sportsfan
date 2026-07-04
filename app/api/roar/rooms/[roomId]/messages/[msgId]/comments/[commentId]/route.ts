// api/roar/rooms/[roomId]/messages/[msgId]/comments/[commentId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getUser } from "@/lib/getUser";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string; msgId: string; commentId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId, msgId, commentId } = params;
    const commentRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId)
      .collection("comments")
      .doc(commentId);

    const snap = await commentRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const data = snap.data() as any;
    const isAuthor = data.authorUid === user.userId || data.authorEmail === user.email;
    if (!isAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await commentRef.delete();

    // Best-effort decrement, mirrors the increment in POST /comments
    db.collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId)
      .update({ replyCount: FieldValue.increment(-1) })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}