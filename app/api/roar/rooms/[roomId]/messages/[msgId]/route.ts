// //api/roar/rooms/[roomId]/messages/[msgId]/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";

// export async function DELETE(
//   req: NextRequest,
//   { params }: { params: Promise<{ roomId: string; msgId: string }> },
// ) {
//   try {
//     const { roomId, msgId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     await db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages")
//       .doc(msgId)
//       .delete();

//     return NextResponse.json({ success: true });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }





//api/roar/rooms/[roomId]/messages/[msgId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { RoomMessage } from "@/app/models/RoomMessage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; msgId: string }> },
) {
  try {
    const { roomId, msgId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const msgRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId);

    const snap = await msgRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // ── Ownership check ─────────────────────────────────────────────────────
    // Previously this deleted unconditionally — any authenticated user could
    // delete any other user's room message by ID. Mirrors the same check
    // already enforced on feed posts (app/api/posts/[postId]/route.ts):
    // author or admin only, with the same RESTRICTED_USERS escape hatch for
    // consistency across both delete paths.
    const RESTRICTED_USERS = [
      // "venkyiimb@gmail.com",
      // "sethi.anshul39@gmail.com"
      ""
    ];
    const message = snap.data() as RoomMessage;
    if (message.authorUid !== user.userId && user.role !== "admin") {
      const isAdmin = !RESTRICTED_USERS.includes(user.email.toLowerCase());
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await msgRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}