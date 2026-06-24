// // /api/roar/rooms/[roomId]/messages/[msgId]/vote/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import { awardRoarPointsByReason } from "@/lib/roarPoints";   // ADD THIS
// import { getUserInfo } from "@/lib/userPoints";  

// export async function POST(
//   req: NextRequest,
//   { params }: { params: Promise<{ roomId: string; msgId: string }> },
// ) {
//   try {
//     const { roomId, msgId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { vote }: { vote: "agree" | "disagree" } = await req.json();
//     if (vote !== "agree" && vote !== "disagree") {
//       return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
//     }

//     // ── Resolve user ID ──────────────────────────────────────────────────────
//     let resolvedUserId = user.email;
//     const emailSnap = await db.collection("users").doc(user.email).get();
//     if (!emailSnap.exists) {
//       const uidSnap = await db.collection("users").doc(user.userId).get();
//       if (uidSnap.exists) resolvedUserId = user.userId;
//     }

//     const msgRef = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages")
//       .doc(msgId);

//     const voteRef = msgRef.collection("votes").doc(resolvedUserId);

//     // ── Check for existing vote (one read) ───────────────────────────────────
//     const existingVote = await voteRef.get();
//     if (existingVote.exists) {
//       return NextResponse.json(
//         { error: "Already voted", message: "Already voted" },
//         { status: 409 }
//       );
//     }

//     // ── Write vote + increment counter atomically ────────────────────────────
//     const batch = db.batch();
//     batch.set(voteRef, { vote, createdAt: Date.now() });
//     batch.update(msgRef, {
//       [vote === "agree" ? "agreeCount" : "disagreeCount"]: FieldValue.increment(1),
//     });
//     await batch.commit();

//     return NextResponse.json({ success: true });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST room message vote error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }




// /api/roar/rooms/[roomId]/messages/[msgId]/vote/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import { awardRoarPointsByReason } from "@/lib/roarPoints";
import { getUserInfo } from "@/lib/userPoints";

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

    const { vote }: { vote: "agree" | "disagree" } = await req.json();
    if (vote !== "agree" && vote !== "disagree") {
      return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
    }

    // ── Resolve user ID ──────────────────────────────────────────────────────
    const info = await getUserInfo(user.userId, undefined, user.email);
    const resolvedUserId = info.exists ? info.actualUserId : user.userId;

    const msgRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId);

    const voteRef = msgRef.collection("votes").doc(resolvedUserId);

    // ── Check for existing vote ──────────────────────────────────────────────
    const existingVote = await voteRef.get();
    if (existingVote.exists) {
      return NextResponse.json(
        { error: "Already voted", message: "Already voted" },
        { status: 409 }
      );
    }

    // ── Read message type to decide which points reason to award ─────────────
    const msgSnap = await msgRef.get();
    const msgType = msgSnap.exists ? (msgSnap.data() as any).type : null;

    // ── Write vote + increment counter atomically ────────────────────────────
    const batch = db.batch();
    batch.set(voteRef, { vote, createdAt: Date.now() });
    batch.update(msgRef, {
      [vote === "agree" ? "agreeCount" : "disagreeCount"]: FieldValue.increment(1),
    });
    await batch.commit();

    // ── Award points based on message type ───────────────────────────────────
    // debate / hottake / hot_take  → ROAR_DEBATE_PARTICIPATE
    // prediction                   → ROAR_PREDICTION_PARTICIPATE
    const DEBATE_TYPES = new Set(["debate", "hottake", "hot_take"]);
    const reason = msgType === "prediction"
      ? "ROAR_PREDICTION_PARTICIPATE"
      : DEBATE_TYPES.has(msgType)
        ? "ROAR_DEBATE_PARTICIPATE"
        : null;

    if (reason) {
      awardRoarPointsByReason({
        actualUserId:  resolvedUserId,
        authUserId:    user.userId,
        userName:      info.userName,
        userEmail:     info.userEmail || user.email,
        userExists:    info.exists,
        reason,
        points:        2,
        transactionId: `roar_vote_${msgId}_${resolvedUserId}`,
        metadata: { postId: msgId, roomId, vote, type: msgType },
      }).catch((err) => {
        console.warn(`[vote] Failed to award ${reason} points:`, err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST room message vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}