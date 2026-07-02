
// // api/roar/rooms/[roomId]/messages/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import { awardRoarPoints } from "@/lib/roarPoints";
// import { getUserInfo } from "@/lib/userPoints";
// import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";
// import type { PostType } from "@/app/models/Post";

// // ── Shared helper ─────────────────────────────────────────────────────────────
// // NOTE: previously this checked `users/{email}` before `users/{uid}` locally.
// // That diverged from getUserInfo (used by /api/createpost via awardUserPoints,
// // and now by /api/roar/posts), which checks `users/{uid}` first and has extra
// // sanitized-email fallbacks. The mismatch meant the same person's room
// // messages could resolve to a *different* users/{id} doc than their ROAR
// // posts or social posts — splitting activityLog, totalPoints, and the
// // votes/reactions subcollections (causing userVote/userLiked to read back
// // wrong after a refresh). We now use getUserInfo everywhere so there's a
// // single source of truth for "what is this user's doc ID".
// async function resolveUser(
//   email: string,
//   userId: string
// ): Promise<{ id: string; snap: FirebaseFirestore.DocumentSnapshot } | null> {
//   const info = await getUserInfo(userId, undefined, email);
//   if (!info.exists) return null;

//   const snap = await db.collection("users").doc(info.actualUserId).get();
//   if (!snap.exists) return null;

//   return { id: info.actualUserId, snap };
// }

// // ── Message types that support agree/disagree voting (single vote per msg) ───
// const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take", "debate"]);

// // ── Message types that hold MULTIPLE independent questions per message,     ──
// // ── needing one vote per (user, questionIndex) instead of one per (user).   ──
// // predictions_live was previously missing from any votable set at all, which
// // is why a saved vote never came back after a refresh — the GET route simply
// // never looked it up.
// const MULTI_QUESTION_VOTABLE_TYPES = new Set(["predictions_live"]);

// // ── PostType map for awardRoarPoints ──────────────────────────────────────────
// const ROOM_TYPE_TO_POST_TYPE: Partial<Record<string, PostType | "post">> = {
//   debate: "debate",
//   prediction: "prediction",
//   post: "post",
//   hottake: "hot_take",
//   hot_take: "hot_take",
//   raw_reactions: "post",
//   memory: "post",
//   quiz: "quiz",
// };



// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ roomId: string }> }
// ) {
//   try {
//     const { roomId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
//     const lastCreatedAt = searchParams.get("lastCreatedAt");
//     const lastDocId = searchParams.get("lastDocId");

//     const resolved = await resolveUser(user.email, user.userId);
//     if (!resolved) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }
//     const resolvedUserId = resolved.id;

//     const messagesRef = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages");

//     let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

//     const since = searchParams.get("since");

//     if (since) {
//       query = messagesRef
//         .where("createdAt", ">", parseInt(since, 10))
//         .orderBy("createdAt", "desc")
//         .limit(limit);
//     } else if (lastCreatedAt) {
//       query = query.startAfter(parseInt(lastCreatedAt, 10));
//     } else if (lastDocId) {
//       const cursorDoc = await messagesRef.doc(lastDocId).get();
//       if (cursorDoc.exists) query = query.startAfter(cursorDoc);
//     }

//     const snapshot = await query.get();
//     if (snapshot.empty) {
//       return NextResponse.json({
//         success: true,
//         messages: [],
//         pagination: { limit, hasMore: false, nextCursor: null },
//       });
//     }

//     // ── Batch vote reads only (reactions now read from doc map field) ─────────
//     const votableIndices: number[] = [];
//     const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

//     // predictions_live: fetch ALL of this user's vote docs for the message in
//     // one query (there can be one per question), instead of a single doc.
//     const multiVotableIndices: number[] = [];
//     const multiVotePromises: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

//     snapshot.docs.forEach((doc, i) => {
//       const type = (doc.data() as RoomMessage).type;
//       if (VOTABLE_TYPES.has(type)) {
//         votableIndices.push(i);
//         votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
//       } else if (MULTI_QUESTION_VOTABLE_TYPES.has(type)) {
//         multiVotableIndices.push(i);
//         multiVotePromises.push(
//           doc.ref.collection("votes").where("userId", "==", resolvedUserId).get()
//         );
//       }
//     });

//     // ── Batch-fetch live avatarUrl/badge per unique author ────────────────────
//     const authorMap = new Map<string, { avatarUrl: string | null; badge: string | null }>();
//     const uniqueAuthorUids = Array.from(
//       new Set(snapshot.docs.map((d) => (d.data() as RoomMessage).authorUid))
//     );

//     const [voteResults, multiVoteResults, authorSnaps] = await Promise.all([
//       Promise.all(votePromises),
//       Promise.all(multiVotePromises),
//       Promise.all(uniqueAuthorUids.map((uid) => db.collection("users").doc(uid).get())),
//     ]);

//     uniqueAuthorUids.forEach((uid, i) => {
//       const s = authorSnaps[i];
//       const data = s.exists ? (s.data() as any) : null;
//       authorMap.set(uid, {
//         avatarUrl: data?.avatarUrl ?? null,
//         badge: data?.badge ?? null,
//       });
//     });

//     // Build vote lookup map (single-question votable types)
//     const userVoteByIndex = new Map<number, string | null>();
//     votableIndices.forEach((docIdx, resultIdx) => {
//       const snap = voteResults[resultIdx];
//       userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
//     });

//     // Build per-question vote lookup map (predictions_live)
//     const userPredictionVotesByIndex = new Map<number, Record<number, string>>();
//     multiVotableIndices.forEach((docIdx, resultIdx) => {
//       const querySnap = multiVoteResults[resultIdx];
//       const votesMap: Record<number, string> = {};
//       querySnap.docs.forEach((d) => {
//         const data = d.data() as any;
//         if (typeof data.questionIndex === "number" && typeof data.vote === "string") {
//           votesMap[data.questionIndex] = data.vote;
//         }
//       });
//       userPredictionVotesByIndex.set(docIdx, votesMap);
//     });

//     // ── Assemble response ─────────────────────────────────────────────────────
//     const messages = snapshot.docs.map((doc, i) => {
//       const data = doc.data() as RoomMessage;
//       const author = authorMap.get(data.authorUid);
//       return {
//         ...data,
//         msgId: doc.id,
//         agreeCount: data.agreeCount ?? 0,
//         disagreeCount: data.disagreeCount ?? 0,

//         // Total reaction count across all emoji types
//         heartCount: (data as any).likeCount ?? 0,

//         // Individual emoji counts
//         fireCount: (data as any).fireCount ?? 0,
//         mindblownCount: (data as any).mindblownCount ?? 0,
//         goatCount: (data as any).goatCount ?? 0,
//         clapCount: (data as any).clapCount ?? 0,
//         nochanceCount: (data as any).nochanceCount ?? 0,
//         laughCount: (data as any).laughCount ?? 0,
//         sadCount: (data as any).sadCount ?? 0,
//         thumbCount: (data as any).thumbCount ?? 0,

//         replyCount: data.replyCount ?? 0,
//         userVote: userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,

//         // predictions_live: map of questionIndex -> vote ("agree" | "disagree"
//         // | "option_N"), used by the client to restore selection + disable
//         // already-answered questions after a refresh.
//         userPredictionVotes: userPredictionVotesByIndex.has(i) ? userPredictionVotesByIndex.get(i) : undefined,

//         // Read userReaction from the reactions map on the doc itself —
//         // written by likesection as reactions.{userId}: "fire"|"heart" etc.
//         // Zero extra reads vs the old likes subcollection approach.
//         userReaction: (data as any).reactions?.[resolvedUserId] ?? null,
//         closesAt: data.closesAt ?? 0,

//         authorAvatarUrl: author?.avatarUrl ?? null,
//         authorBadge: author?.badge ?? data.authorBadge,
//       };
//     });

//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];
//     const lastMsg = messages[messages.length - 1];

//     return NextResponse.json({
//       success: true,
//       messages,
//       pagination: {
//         limit,
//         hasMore: messages.length === limit,
//         nextCursor:
//           messages.length === limit
//             ? { lastDocId: lastDoc?.id, lastCreatedAt: lastMsg?.createdAt ?? null }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/rooms/messages error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// export async function POST(
//   req: NextRequest,
//   { params }: { params: Promise<{ roomId: string }> }
// ) {
//   try {
//     const { roomId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     const {
//       text,
//       type = "chat",
//       mediaUrls,
//       sideA,
//       sideB,
//       predictionOptions,
//       closesAt,
//       closeAfterMinutes,
//       memGifUrl,
//       memTag,
//       questions,
//       matchTitle,
//     }: {
//       text: string;
//       type: MessageType;
//       mediaUrls?: string[];
//       sideA?: string;
//       sideB?: string;
//       predictionOptions?: string[];
//       closesAt?: number;
//       closeAfterMinutes?: number;
//       memGifUrl?: string;
//       memTag?: string;
//       questions?: { question: string; options: { label: string; emoji: string }[] }[];
//       matchTitle?: string;
//     } = body;

//     if (!text?.trim()) {
//       return NextResponse.json({ error: "text is required" }, { status: 400 });
//     }

//     // ── Resolve user + room in parallel ───────────────────────────────────────
//     const [resolved, roomSnap] = await Promise.all([
//       resolveUser(user.email, user.userId),
//       db.collection("roarRooms").doc(roomId).get(),
//     ]);

//     if (!roomSnap.exists) {
//       return NextResponse.json({ error: "Room not found" }, { status: 404 });
//     }
//     if (!resolved) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }

//     const { id: resolvedUserId, snap: userSnap } = resolved;
//     const userData = userSnap.data() as { username: string; badge: string };
//     const roomRef = db.collection("roarRooms").doc(roomId);
//     const now = Date.now();
//     const msgRef = roomRef.collection("messages").doc();
//     const normalizedCloseAfter = Number(closeAfterMinutes);
//     const requestedClosesAt = Number(closesAt);

//     // ⭐ FIX: Allow both "prediction" and "predictions_live" types
//     const predictionClosesAt = (type === "prediction" || type === "predictions_live")
//       ? Number.isFinite(requestedClosesAt) && requestedClosesAt > now
//         ? requestedClosesAt
//         : Number.isFinite(normalizedCloseAfter) && normalizedCloseAfter > 0
//           ? now + Math.min(Math.max(normalizedCloseAfter, 1), 24 * 60) * 60_000
//           : now + 2 * 60_000
//       : undefined;

//     const message: RoomMessage = {
//       msgId: msgRef.id,
//       roomId,
//       authorUid: resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge: userData.badge,
//       authorEmail: user.email,
//       text: text.trim(),
//       type,
//       fireCount: 0,
//       noChanceCount: 0,
//       heartCount: 0,
//       agreeCount: 0,
//       disagreeCount: 0,
//       replyCount: 0,
//       createdAt: now,
//       ...(mediaUrls?.length && { mediaUrls }),
//       ...(sideA && { sideA }),
//       ...(sideB && { sideB }),
//       ...(questions?.length && { questions }),
//       ...(matchTitle && { matchTitle }),
//       ...(type === "prediction" && Array.isArray(predictionOptions) && {
//         predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6)
//       }),
//       // ⭐ FIX: Include closesAt for predictions_live too
//       ...(predictionClosesAt !== undefined && { closesAt: predictionClosesAt }),
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag && { memTag }),
//     };

//     // Atomic batch: write message + increment room fan count
//     const batch = db.batch();
//     batch.set(msgRef, message);
//     batch.update(roomRef, { fanCount: FieldValue.increment(1) });
//     await batch.commit();

//     // ── Award points — non-fatal, fire and forget ─────────────────────────────
//     const roarPostType = ROOM_TYPE_TO_POST_TYPE[type] ?? "post";
//     const transactionId = `roar_room_${msgRef.id}`;

//     awardRoarPoints({
//       actualUserId: resolvedUserId,
//       authUserId: user.userId,
//       userName: userData.username,
//       userEmail: user.email,
//       userExists: true,
//       postType: roarPostType,
//       transactionId,
//       metadata: {
//         postId: msgRef.id,
//         roomId,
//         type,
//         ...(sideA && { sideA }),
//         ...(sideB && { sideB }),
//         ...(type === "prediction" && Array.isArray(predictionOptions) && {
//           predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6)
//         }),
//       },
//     }).catch((err) => {
//       console.warn(`[POST rooms/messages] Failed to award points for ${roarPostType}:`, err);
//     });

//     return NextResponse.json({ success: true, msgId: msgRef.id, message });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/roar/rooms/messages error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }





// api/roar/rooms/[roomId]/messages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import { awardRoarPoints } from "@/lib/roarPoints";
import { getUserInfo } from "@/lib/userPoints";
import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";
import type { PostType } from "@/app/models/Post";

// ── Shared helper ─────────────────────────────────────────────────────────────
// NOTE: previously this checked `users/{email}` before `users/{uid}` locally.
// That diverged from getUserInfo (used by /api/createpost via awardUserPoints,
// and now by /api/roar/posts), which checks `users/{uid}` first and has extra
// sanitized-email fallbacks. The mismatch meant the same person's room
// messages could resolve to a *different* users/{id} doc than their ROAR
// posts or social posts — splitting activityLog, totalPoints, and the
// votes/reactions subcollections (causing userVote/userLiked to read back
// wrong after a refresh). We now use getUserInfo everywhere so there's a
// single source of truth for "what is this user's doc ID".
async function resolveUser(
  email: string,
  userId: string
): Promise<{ id: string; snap: FirebaseFirestore.DocumentSnapshot } | null> {
  const info = await getUserInfo(userId, undefined, email);
  if (!info.exists) return null;

  const snap = await db.collection("users").doc(info.actualUserId).get();
  if (!snap.exists) return null;

  return { id: info.actualUserId, snap };
}

// ── Message types that support agree/disagree voting (single vote per msg) ───
const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take", "debate"]);

// ── Message types that hold MULTIPLE independent questions per message,     ──
// ── needing one vote per (user, questionIndex) instead of one per (user).   ──
// predictions_live was previously missing from any votable set at all, which
// is why a saved vote never came back after a refresh — the GET route simply
// never looked it up.
const MULTI_QUESTION_VOTABLE_TYPES = new Set(["predictions_live"]);

// ── PostType map for awardRoarPoints ──────────────────────────────────────────
const ROOM_TYPE_TO_POST_TYPE: Partial<Record<string, PostType | "post">> = {
  debate: "debate",
  prediction: "prediction",
  post: "post",
  hottake: "hot_take",
  hot_take: "hot_take",
  raw_reactions: "post",
  memory: "post",
  quiz: "quiz",
};

// ── Room-level type counters (mirrors of fanCount) ────────────────────────────
// Kept as simple increment/decrement fields on the room doc so the client can
// show accurate category badge counts (Posts/Debates/Predictions) without
// having to load every paginated message into memory first.
const COUNT_FIELD_BY_TYPE: Partial<Record<string, "postCount" | "debateCount" | "predictionCount">> = {
  post: "postCount",
  chat: "postCount",
  debate: "debateCount",
  prediction: "predictionCount",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const lastCreatedAt = searchParams.get("lastCreatedAt");
    const lastDocId = searchParams.get("lastDocId");

    const resolved = await resolveUser(user.email, user.userId);
    if (!resolved) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const resolvedUserId = resolved.id;

    const roomRef = db.collection("roarRooms").doc(roomId);
    // Fetched in parallel with the messages query below — used only to read
    // postCount/debateCount/predictionCount for the category badge counts.
    const roomSnapPromise = roomRef.get();

    const messagesRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages");

    let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

    const since = searchParams.get("since");

    if (since) {
      query = messagesRef
        .where("createdAt", ">", parseInt(since, 10))
        .orderBy("createdAt", "desc")
        .limit(limit);
    } else if (lastCreatedAt) {
      query = query.startAfter(parseInt(lastCreatedAt, 10));
    } else if (lastDocId) {
      const cursorDoc = await messagesRef.doc(lastDocId).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const [snapshot, roomSnapForEmpty] = await Promise.all([query.get(), roomSnapPromise]);

    if (snapshot.empty) {
      const roomDataEmpty = roomSnapForEmpty.exists ? (roomSnapForEmpty.data() as any) : null;
      return NextResponse.json({
        success: true,
        messages: [],
        pagination: { limit, hasMore: false, nextCursor: null },
        counts: {
          post: roomDataEmpty?.postCount ?? 0,
          debate: roomDataEmpty?.debateCount ?? 0,
          prediction: roomDataEmpty?.predictionCount ?? 0,
        },
      });
    }

    // ── Batch vote reads only (reactions now read from doc map field) ─────────
    const votableIndices: number[] = [];
    const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

    // predictions_live: fetch ALL of this user's vote docs for the message in
    // one query (there can be one per question), instead of a single doc.
    const multiVotableIndices: number[] = [];
    const multiVotePromises: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    snapshot.docs.forEach((doc, i) => {
      const type = (doc.data() as RoomMessage).type;
      if (VOTABLE_TYPES.has(type)) {
        votableIndices.push(i);
        votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
      } else if (MULTI_QUESTION_VOTABLE_TYPES.has(type)) {
        multiVotableIndices.push(i);
        multiVotePromises.push(
          doc.ref.collection("votes").where("userId", "==", resolvedUserId).get()
        );
      }
    });

    // ── Batch-fetch live avatarUrl/badge per unique author ────────────────────
    const authorMap = new Map<string, { avatarUrl: string | null; badge: string | null }>();
    const uniqueAuthorUids = Array.from(
      new Set(snapshot.docs.map((d) => (d.data() as RoomMessage).authorUid))
    );

    const [voteResults, multiVoteResults, authorSnaps] = await Promise.all([
      Promise.all(votePromises),
      Promise.all(multiVotePromises),
      Promise.all(uniqueAuthorUids.map((uid) => db.collection("users").doc(uid).get())),
    ]);

    uniqueAuthorUids.forEach((uid, i) => {
      const s = authorSnaps[i];
      const data = s.exists ? (s.data() as any) : null;
      authorMap.set(uid, {
        avatarUrl: data?.avatarUrl ?? null,
        badge: data?.badge ?? null,
      });
    });

    // Build vote lookup map (single-question votable types)
    const userVoteByIndex = new Map<number, string | null>();
    votableIndices.forEach((docIdx, resultIdx) => {
      const snap = voteResults[resultIdx];
      userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
    });

    // Build per-question vote lookup map (predictions_live)
    const userPredictionVotesByIndex = new Map<number, Record<number, string>>();
    multiVotableIndices.forEach((docIdx, resultIdx) => {
      const querySnap = multiVoteResults[resultIdx];
      const votesMap: Record<number, string> = {};
      querySnap.docs.forEach((d) => {
        const data = d.data() as any;
        if (typeof data.questionIndex === "number" && typeof data.vote === "string") {
          votesMap[data.questionIndex] = data.vote;
        }
      });
      userPredictionVotesByIndex.set(docIdx, votesMap);
    });

    // ── Assemble response ─────────────────────────────────────────────────────
    const messages = snapshot.docs.map((doc, i) => {
      const data = doc.data() as RoomMessage;
      const author = authorMap.get(data.authorUid);
      return {
        ...data,
        msgId: doc.id,
        agreeCount: data.agreeCount ?? 0,
        disagreeCount: data.disagreeCount ?? 0,

        // Total reaction count across all emoji types
        heartCount: (data as any).likeCount ?? 0,

        // Individual emoji counts
        fireCount: (data as any).fireCount ?? 0,
        mindblownCount: (data as any).mindblownCount ?? 0,
        goatCount: (data as any).goatCount ?? 0,
        clapCount: (data as any).clapCount ?? 0,
        nochanceCount: (data as any).nochanceCount ?? 0,
        laughCount: (data as any).laughCount ?? 0,
        sadCount: (data as any).sadCount ?? 0,
        thumbCount: (data as any).thumbCount ?? 0,

        replyCount: data.replyCount ?? 0,
        userVote: userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,

        // predictions_live: map of questionIndex -> vote ("agree" | "disagree"
        // | "option_N"), used by the client to restore selection + disable
        // already-answered questions after a refresh.
        userPredictionVotes: userPredictionVotesByIndex.has(i) ? userPredictionVotesByIndex.get(i) : undefined,

        // Read userReaction from the reactions map on the doc itself —
        // written by likesection as reactions.{userId}: "fire"|"heart" etc.
        // Zero extra reads vs the old likes subcollection approach.
        userReaction: (data as any).reactions?.[resolvedUserId] ?? null,
        closesAt: data.closesAt ?? 0,

        authorAvatarUrl: author?.avatarUrl ?? null,
        authorBadge: author?.badge ?? data.authorBadge,
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const lastMsg = messages[messages.length - 1];

    const roomSnap = await roomSnapPromise;
    const roomData = roomSnap.exists ? (roomSnap.data() as any) : null;

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        hasMore: messages.length === limit,
        nextCursor:
          messages.length === limit
            ? { lastDocId: lastDoc?.id, lastCreatedAt: lastMsg?.createdAt ?? null }
            : null,
      },
      counts: {
        post: roomData?.postCount ?? 0,
        debate: roomData?.debateCount ?? 0,
        prediction: roomData?.predictionCount ?? 0,
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
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      text,
      type = "chat",
      mediaUrls,
      sideA,
      sideB,
      predictionOptions,
      closesAt,
      closeAfterMinutes,
      memGifUrl,
      memTag,
      questions,
      matchTitle,
    }: {
      text: string;
      type: MessageType;
      mediaUrls?: string[];
      sideA?: string;
      sideB?: string;
      predictionOptions?: string[];
      closesAt?: number;
      closeAfterMinutes?: number;
      memGifUrl?: string;
      memTag?: string;
      questions?: { question: string; options: { label: string; emoji: string }[] }[];
      matchTitle?: string;
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // ── Resolve user + room in parallel ───────────────────────────────────────
    const [resolved, roomSnap] = await Promise.all([
      resolveUser(user.email, user.userId),
      db.collection("roarRooms").doc(roomId).get(),
    ]);

    if (!roomSnap.exists) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (!resolved) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const { id: resolvedUserId, snap: userSnap } = resolved;
    const userData = userSnap.data() as { username: string; badge: string };
    const roomRef = db.collection("roarRooms").doc(roomId);
    const now = Date.now();
    const msgRef = roomRef.collection("messages").doc();
    const normalizedCloseAfter = Number(closeAfterMinutes);
    const requestedClosesAt = Number(closesAt);

    // ⭐ FIX: Allow both "prediction" and "predictions_live" types
    const predictionClosesAt = (type === "prediction" || type === "predictions_live")
      ? Number.isFinite(requestedClosesAt) && requestedClosesAt > now
        ? requestedClosesAt
        : Number.isFinite(normalizedCloseAfter) && normalizedCloseAfter > 0
          ? now + Math.min(Math.max(normalizedCloseAfter, 1), 24 * 60) * 60_000
          : now + 2 * 60_000
      : undefined;

    const message: RoomMessage = {
      msgId: msgRef.id,
      roomId,
      authorUid: resolvedUserId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      authorEmail: user.email,
      text: text.trim(),
      type,
      fireCount: 0,
      noChanceCount: 0,
      heartCount: 0,
      agreeCount: 0,
      disagreeCount: 0,
      replyCount: 0,
      createdAt: now,
      ...(mediaUrls?.length && { mediaUrls }),
      ...(sideA && { sideA }),
      ...(sideB && { sideB }),
      ...(questions?.length && { questions }),
      ...(matchTitle && { matchTitle }),
      ...(type === "prediction" && Array.isArray(predictionOptions) && {
        predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6)
      }),
      // ⭐ FIX: Include closesAt for predictions_live too
      ...(predictionClosesAt !== undefined && { closesAt: predictionClosesAt }),
      ...(memGifUrl && { memGifUrl }),
      ...(memTag && { memTag }),
    };

    // Atomic batch: write message + increment room fan count + type-specific count
    const countField = COUNT_FIELD_BY_TYPE[type];

    const batch = db.batch();
    batch.set(msgRef, message);
    batch.update(roomRef, {
      fanCount: FieldValue.increment(1),
      ...(countField && { [countField]: FieldValue.increment(1) }),
    });
    await batch.commit();

    // ── Award points — non-fatal, fire and forget ─────────────────────────────
    const roarPostType = ROOM_TYPE_TO_POST_TYPE[type] ?? "post";
    const transactionId = `roar_room_${msgRef.id}`;

    awardRoarPoints({
      actualUserId: resolvedUserId,
      authUserId: user.userId,
      userName: userData.username,
      userEmail: user.email,
      userExists: true,
      postType: roarPostType,
      transactionId,
      metadata: {
        postId: msgRef.id,
        roomId,
        type,
        ...(sideA && { sideA }),
        ...(sideB && { sideB }),
        ...(type === "prediction" && Array.isArray(predictionOptions) && {
          predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6)
        }),
      },
    }).catch((err) => {
      console.warn(`[POST rooms/messages] Failed to award points for ${roarPostType}:`, err);
    });

    return NextResponse.json({ success: true, msgId: msgRef.id, message });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/rooms/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}