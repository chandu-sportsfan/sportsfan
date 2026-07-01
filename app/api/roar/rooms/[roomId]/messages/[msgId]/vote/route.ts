
// // /api/roar/rooms/[roomId]/messages/[msgId]/vote/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import { awardRoarPointsByReason } from "@/lib/roarPoints";
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

//     const { vote }: { vote: string } = await req.json();
//     if (typeof vote !== "string") {
//       return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
//     }

//     // ── Resolve user ID ──────────────────────────────────────────────────────
//     const info = await getUserInfo(user.userId, undefined, user.email);
//     const resolvedUserId = info.exists ? info.actualUserId : user.userId;

//     const msgRef = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages")
//       .doc(msgId);

//     const voteRef = msgRef.collection("votes").doc(resolvedUserId);

//     // ── Check for existing vote ──────────────────────────────────────────────
//     const existingVote = await voteRef.get();
//     if (existingVote.exists) {
//       return NextResponse.json(
//         { error: "Already voted", message: "Already voted" },
//         { status: 409 }
//       );
//     }

//     // ── Read message type to decide which points reason to award ─────────────
//         const msgSnap = await msgRef.get();
//     if (!msgSnap.exists) {
//       return NextResponse.json({ error: "Message not found" }, { status: 404 });
//     }
//     const msgData = msgSnap.data() as {
//       type?: string;
//       predictionOptions?: string[];
//       closesAt?: number;
//       closedAt?: number;
//       resolvedAt?: number;
//     };
//     const msgType = msgData.type ?? "";
//     const optionVoteMatch = /^option_(\d+)$/.exec(vote);
//     if (vote !== "agree" && vote !== "disagree" && !optionVoteMatch) {
//       return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
//     }
//         if (optionVoteMatch) {
//       const optionIndex = Number(optionVoteMatch[1]);
//       if (msgType !== "prediction" || !Array.isArray(msgData.predictionOptions) || optionIndex < 2 || optionIndex >= msgData.predictionOptions.length) {
//         return NextResponse.json({ error: "Invalid prediction option" }, { status: 400 });
//       }
//     }

//     const now = Date.now();
//     if (msgType === "prediction" && (msgData.resolvedAt || msgData.closedAt || (msgData.closesAt && msgData.closesAt <= now))) {
//       if (!msgData.closedAt && msgData.closesAt && msgData.closesAt <= now) {
//         await msgRef.update({ closedAt: now, updatedAt: now });
//       }
//       return NextResponse.json({ error: "Prediction poll is closed" }, { status: 409 });
//     }

//     // ── Write vote + increment counter atomically ────────────────────────────
//     const batch = db.batch();
//     batch.set(voteRef, { vote, createdAt: now });
//     batch.update(msgRef, {
//       [vote === "agree" ? "agreeCount" : vote === "disagree" ? "disagreeCount" : `predictionOptionCounts.${vote}`]: FieldValue.increment(1),
//     });
//     await batch.commit();

//     // ── Award points based on message type ───────────────────────────────────
//     // debate / hottake / hot_take  → ROAR_DEBATE_PARTICIPATE
//     // prediction                   → ROAR_PREDICTION_PARTICIPATE
//     const DEBATE_TYPES = new Set(["debate", "hottake", "hot_take"]);
//     const reason = msgType === "prediction"
//       ? "ROAR_PREDICTION_PARTICIPATE"
//       : DEBATE_TYPES.has(msgType)
//         ? "ROAR_DEBATE_PARTICIPATE"
//         : null;

//     if (reason) {
//       awardRoarPointsByReason({
//         actualUserId:  resolvedUserId,
//         authUserId:    user.userId,
//         userName:      info.userName,
//         userEmail:     info.userEmail || user.email,
//         userExists:    info.exists,
//         reason,
//         points:        2,
//         transactionId: `roar_vote_${msgId}_${resolvedUserId}`,
//         metadata: { postId: msgId, roomId, vote, type: msgType },
//       }).catch((err) => {
//         console.warn(`[vote] Failed to award ${reason} points:`, err);
//       });
//     }

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

    const { vote, questionIndex }: { vote: string; questionIndex?: number } = await req.json();
    if (typeof vote !== "string") {
      return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
    }

    // ── Normalize question index ───────────────────────────────────────────
    // For non-multi-question message types (debate/hottake/prediction) this
    // is always 0. For predictions_live it identifies which question in the
    // `questions[]` array this vote belongs to.
    const qIdx = Number.isInteger(questionIndex) && (questionIndex as number) >= 0
      ? (questionIndex as number)
      : 0;

    // ── Resolve user ID ──────────────────────────────────────────────────────
    const info = await getUserInfo(user.userId, undefined, user.email);
    const resolvedUserId = info.exists ? info.actualUserId : user.userId;

    const msgRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId);

    // ── Vote doc is keyed per (user, question) so a single message with
    //    multiple questions (predictions_live) tracks each question's vote
    //    independently instead of colliding on one doc per message. ─────────
    const voteDocId = `${resolvedUserId}_q${qIdx}`;
    const voteRef = msgRef.collection("votes").doc(voteDocId);

    // ── Check for existing vote on THIS question ──────────────────────────
    const existingVote = await voteRef.get();
    if (existingVote.exists) {
      return NextResponse.json(
        { error: "Already voted", message: "Already voted" },
        { status: 409 }
      );
    }

    // ── Read message type to decide which points reason to award ─────────────
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    const msgData = msgSnap.data() as {
      type?: string;
      predictionOptions?: string[];
      questions?: { question: string; options: { label?: string; text?: string; emoji?: string }[] }[];
      closesAt?: number;
      closedAt?: number;
      resolvedAt?: number;
    };
    const msgType = msgData.type ?? "";
    const optionVoteMatch = /^option_(\d+)$/.exec(vote);
    if (vote !== "agree" && vote !== "disagree" && !optionVoteMatch) {
      return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
    }

    if (optionVoteMatch) {
      const optionIndex = Number(optionVoteMatch[1]);

      if (msgType === "predictions_live") {
        // Validate against the specific question's own options array,
        // not the (irrelevant) top-level predictionOptions field.
        const questions = Array.isArray(msgData.questions) ? msgData.questions : [];
        const q = questions[qIdx];
        const optsLen = Array.isArray(q?.options) ? q!.options.length : 0;
        if (!q || optionIndex < 2 || optionIndex >= optsLen) {
          return NextResponse.json({ error: "Invalid prediction option" }, { status: 400 });
        }
      } else {
        if (
          msgType !== "prediction" ||
          !Array.isArray(msgData.predictionOptions) ||
          optionIndex < 2 ||
          optionIndex >= msgData.predictionOptions.length
        ) {
          return NextResponse.json({ error: "Invalid prediction option" }, { status: 400 });
        }
      }
    }

    if (msgType === "predictions_live") {
      const questions = Array.isArray(msgData.questions) ? msgData.questions : [];
      if (qIdx < 0 || qIdx >= questions.length) {
        return NextResponse.json({ error: "Invalid question index" }, { status: 400 });
      }
    }

    const now = Date.now();
    const isPredictionType = msgType === "prediction" || msgType === "predictions_live";
    if (isPredictionType && (msgData.resolvedAt || msgData.closedAt || (msgData.closesAt && msgData.closesAt <= now))) {
      if (!msgData.closedAt && msgData.closesAt && msgData.closesAt <= now) {
        await msgRef.update({ closedAt: now, updatedAt: now });
      }
      return NextResponse.json({ error: "Prediction poll is closed" }, { status: 409 });
    }

    // ── Write vote + increment counter atomically ────────────────────────────
    const batch = db.batch();
    batch.set(voteRef, { vote, questionIndex: qIdx, userId: resolvedUserId, createdAt: now });

    if (msgType === "predictions_live") {
      // Per-question counters live under questionVoteCounts.q{idx}.{vote}
      // so multiple questions on the same message don't share a tally.
      batch.update(msgRef, {
        [`questionVoteCounts.q${qIdx}.${vote}`]: FieldValue.increment(1),
      });
    } else {
      // Legacy single-question types (debate/hottake/prediction) keep the
      // original top-level counters for backwards compatibility.
      batch.update(msgRef, {
        [vote === "agree" ? "agreeCount" : vote === "disagree" ? "disagreeCount" : `predictionOptionCounts.${vote}`]: FieldValue.increment(1),
      });
    }

    await batch.commit();

    // ── Award points based on message type ───────────────────────────────────
    // debate / hottake / hot_take  → ROAR_DEBATE_PARTICIPATE
    // prediction / predictions_live → ROAR_PREDICTION_PARTICIPATE
    const DEBATE_TYPES = new Set(["debate", "hottake", "hot_take"]);
    const reason = isPredictionType
      ? "ROAR_PREDICTION_PARTICIPATE"
      : DEBATE_TYPES.has(msgType)
        ? "ROAR_DEBATE_PARTICIPATE"
        : null;

    if (reason) {
      // Transaction id includes the question index so a user can earn
      // points for voting on each distinct question within the same
      // predictions_live message, while still being idempotent per-question.
      awardRoarPointsByReason({
        actualUserId: resolvedUserId,
        authUserId: user.userId,
        userName: info.userName,
        userEmail: info.userEmail || user.email,
        userExists: info.exists,
        reason,
        points: 2,
        transactionId: `roar_vote_${msgId}_q${qIdx}_${resolvedUserId}`,
        metadata: { postId: msgId, roomId, vote, type: msgType, questionIndex: qIdx },
      }).catch((err) => {
        console.warn(`[vote] Failed to award ${reason} points:`, err);
      });
    }

    return NextResponse.json({ success: true, questionIndex: qIdx });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST room message vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}