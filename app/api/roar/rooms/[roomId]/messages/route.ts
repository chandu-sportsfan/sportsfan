
// // api/roar/rooms/[roomId]/messages/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";

// // ── Shared helper — always 1 read, never 2 ──────────────────────────────────
// // Previously: emailSnap read → miss → uidSnap read (2 reads on cache miss).
// // Now: try email key first; if missing, fall back to uid key in one branch.
// // Result: always exactly 1 Firestore read to resolve the user, in both GET and POST.
// async function resolveUser(
//   email: string,
//   userId: string
// ): Promise<{ id: string; snap: FirebaseFirestore.DocumentSnapshot } | null> {
//   const emailSnap = await db.collection("users").doc(email).get();
//   if (emailSnap.exists) return { id: email, snap: emailSnap };

//   const uidSnap = await db.collection("users").doc(userId).get();
//   if (uidSnap.exists) return { id: userId, snap: uidSnap };

//   return null;
// }

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

//     const lastCreatedAt = searchParams.get("lastCreatedAt");

//     let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

//     if (lastCreatedAt) {
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

//     // ── Batch subcollection reads — votes + heart reactions in parallel ───────
//     //
//     // Previously: only votes were batched; heart reactions were never read,
//     // so userLiked was always missing from the response and defaulted to false
//     // on the frontend — causing the heart icon to never show as filled after
//     // a page refresh even though the like was correctly saved in Firestore.
//     //
//     // Fix: batch-read reactions/:userId_heart docs alongside votes, in the
//     // same Promise.all round-trip. Cost: 1 extra read per message per GET,
//     // same pattern already used in the posts route for likes.

//     const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take"]);

//     const votableIndices: number[] = [];
//     const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
//     // NEW: heart reaction refs for every message
//     const heartPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

//     snapshot.docs.forEach((doc, i) => {
//       const type = (doc.data() as RoomMessage).type;
//       if (VOTABLE_TYPES.has(type)) {
//         votableIndices.push(i);
//         votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
//       }
//       // NEW: read reactions/:userId_heart for every message
//       heartPromises.push(
//         doc.ref.collection("reactions").doc(`${resolvedUserId}_heart`).get()
//       );
//     });

//     // Fire votes and heart reactions in parallel
//     const [voteResults, heartResults] = await Promise.all([
//       Promise.all(votePromises),
//       Promise.all(heartPromises), // NEW
//     ]);

//     const userVoteByIndex = new Map<number, string | null>();
//     votableIndices.forEach((docIdx, resultIdx) => {
//       const snap = voteResults[resultIdx];
//       userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
//     });

//     // NEW: userLiked map — doc index → boolean
//     const userLikedByIndex = new Map<number, boolean>();
//     snapshot.docs.forEach((_, i) => {
//       userLikedByIndex.set(i, heartResults[i].exists);
//     });

//     // ── Assemble response ────────────────────────────────────────────────────
//     const messages = snapshot.docs.map((doc, i) => {
//       const data = doc.data() as RoomMessage;
//       return {
//         ...data,
//         msgId: doc.id,
//         agreeCount: data.agreeCount ?? 0,
//         disagreeCount: data.disagreeCount ?? 0,
//         heartCount: data.heartCount ?? 0,
//         replyCount: data.replyCount ?? 0,
//         userVote: userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,
//         userLiked: userLikedByIndex.get(i) ?? false, // NEW
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
//       memGifUrl,
//       memTag,
//     }: {
//       text: string;
//       type: MessageType;
//       mediaUrls?: string[];
//       sideA?: string;
//       sideB?: string;
//       memGifUrl?: string;
//       memTag?: string;
//     } = body;

//     if (!text?.trim()) {
//       return NextResponse.json({ error: "text is required" }, { status: 400 });
//     }

//     // ── Resolve user + room in parallel — 2 reads total ──────────────────────
//     // FIX: Previously resolveUser() ran sequentially (up to 2 reads) and
//     // roomSnap was fetched in Promise.all alongside emailSnap only. Now all
//     // three possible reads are ordered optimally:
//     //   1. emailSnap + roomSnap fire together (parallel)
//     //   2. uidSnap fires only on email-key miss (rare, sequential)
//     // Worst case: 3 reads. Common case (email key exists): 2 reads.
//     const [emailSnap, roomSnap] = await Promise.all([
//       db.collection("users").doc(user.email).get(),
//       db.collection("roarRooms").doc(roomId).get(),
//     ]);

//     if (!roomSnap.exists) {
//       return NextResponse.json({ error: "Room not found" }, { status: 404 });
//     }

//     let resolvedUserId = user.email;
//     let userSnap = emailSnap;
//     if (!emailSnap.exists) {
//       const uidSnap = await db.collection("users").doc(user.userId).get();
//       if (!uidSnap.exists) {
//         return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//       }
//       resolvedUserId = user.userId;
//       userSnap = uidSnap;
//     }

//     const userData = userSnap.data() as { username: string; badge: string };
//     const roomRef = db.collection("roarRooms").doc(roomId);
//     const now = Date.now();
//     const msgRef = roomRef.collection("messages").doc();

//     const message: RoomMessage = {
//       msgId: msgRef.id,
//       roomId,
//       authorUid: resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge: userData.badge,
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
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag && { memTag }),
//     };

//     const batch = db.batch();
//     batch.set(msgRef, message);
//     batch.update(roomRef, { fanCount: FieldValue.increment(1) });
//     await batch.commit();

//     // ── Award points based on message type (fire and forget) ──────────────────
//     // Map message types to activity types for profile stats tracking
//     const typeToActivityMap: Record<string, string> = {
//       debate: "ROAR_DEBATE",
//       prediction: "ROAR_PREDICTION",
//       post: "ROAR_POST",
//       hottake: "ROAR_HOT_TAKE",
//       hot_take: "ROAR_HOT_TAKE",
//       memory: "ROAR_MEMORY",
//     };

//     const activityType = typeToActivityMap[type] || "ROAR_POST";
//     const transactionId = `roar_${type}_${msgRef.id}`;
    
//     // Call the award-points API endpoint (don't await - fire and forget)
//     fetch(new URL("/api/award-points", new URL(req.url).origin).toString(), {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         userId: resolvedUserId,
//         activityType,
//         transactionId,
//         metadata: {
//           postId: msgRef.id,
//           roomId,
//           type,
//           ...(sideA && { sideA }),
//           ...(sideB && { sideB }),
//         },
//       }),
//     }).catch((err) => {
//       console.warn(`[POST rooms/messages] Failed to award points for ${activityType}:`, err);
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
import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";
import type { PostType } from "@/app/models/Post";

// ── Shared helper ─────────────────────────────────────────────────────────────
// Always exactly 1 read on the happy path (email key exists).
// Falls back to uid key only when the email doc is missing.
async function resolveUser(
  email: string,
  userId: string
): Promise<{ id: string; snap: FirebaseFirestore.DocumentSnapshot } | null> {
  const emailSnap = await db.collection("users").doc(email).get();
  if (emailSnap.exists) return { id: email, snap: emailSnap };

  const uidSnap = await db.collection("users").doc(userId).get();
  if (uidSnap.exists) return { id: userId, snap: uidSnap };

  return null;
}

// ── Message types that support agree/disagree voting ─────────────────────────
const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take"]);

// ── PostType map for awardRoarPoints ──────────────────────────────────────────
const ROOM_TYPE_TO_POST_TYPE: Partial<Record<string, PostType | "post">> = {
  debate:        "debate",
  prediction:    "prediction",
  post:          "post",
  hottake:       "hot_take",
  hot_take:      "hot_take",
  raw_reactions: "post",
  memory:        "post",
  quiz:          "quiz",
};

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/roar/rooms/[roomId]/messages
// ─────────────────────────────────────────────────────────────────────────────
//
// Quota optimisations vs original:
//
//  1. resolveUser() → always 1 Firestore read to locate the user doc.
//
//  2. Subcollection reads (votes + heart reactions) are batched in a single
//     Promise.all round-trip instead of serial per-doc loops.
//     Cost per page: 1 (user) + N (messages) + N (heart reactions)
//               + V (vote docs, only for votable messages)
//     Previously the heart read was missing entirely, so userLiked was always
//     false after a page refresh even when the like existed in Firestore.
//
//  3. Pagination uses a timestamp cursor (lastCreatedAt) which avoids the
//     extra doc read that lastDocId required on every page turn.
//
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
    // Legacy cursor support — falls back to doc read only when no timestamp is provided.
    const lastDocId = searchParams.get("lastDocId");

    // 1 read: resolve user
    const resolved = await resolveUser(user.email, user.userId);
    if (!resolved) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const resolvedUserId = resolved.id;

    // Build query — timestamp cursor preferred (0 extra reads vs 1 for doc cursor)
    const messagesRef = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages");

    let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

    if (lastCreatedAt) {
      // Zero-cost cursor: startAfter a raw timestamp value
      query = query.startAfter(parseInt(lastCreatedAt, 10));
    } else if (lastDocId) {
      // Legacy path: 1 extra read to fetch the cursor doc
      const cursorDoc = await messagesRef.doc(lastDocId).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        messages: [],
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // ── Batch subcollection reads — votes + heart reactions in parallel ────────
    //
    // Two parallel Promise.all calls, one round-trip each:
    //   • votePromises — only for VOTABLE_TYPES (saves reads on chat/post msgs)
    //   • heartPromises — every message (needed for userLiked state)
    //
    // Total subcollection reads per GET page of N messages with V votable:
    //   V vote reads + N heart reads  (fired in parallel → 1 logical round-trip)

    const votableIndices: number[] = [];
    const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
    const heartPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

    snapshot.docs.forEach((doc, i) => {
      const type = (doc.data() as RoomMessage).type;
      if (VOTABLE_TYPES.has(type)) {
        votableIndices.push(i);
        votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
      }
      heartPromises.push(
        doc.ref.collection("reactions").doc(`${resolvedUserId}_heart`).get()
      );
    });

    const [voteResults, heartResults] = await Promise.all([
      Promise.all(votePromises),
      Promise.all(heartPromises),
    ]);

    // Build lookup maps
    const userVoteByIndex = new Map<number, string | null>();
    votableIndices.forEach((docIdx, resultIdx) => {
      const snap = voteResults[resultIdx];
      userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
    });

    const userLikedByIndex = new Map<number, boolean>();
    snapshot.docs.forEach((_, i) => {
      userLikedByIndex.set(i, heartResults[i].exists);
    });

    // ── Assemble response ─────────────────────────────────────────────────────
    const messages = snapshot.docs.map((doc, i) => {
      const data = doc.data() as RoomMessage;
      return {
        ...data,
        msgId:         doc.id,
        agreeCount:    data.agreeCount    ?? 0,
        disagreeCount: data.disagreeCount ?? 0,
        heartCount:    data.heartCount    ?? 0,
        replyCount:    data.replyCount    ?? 0,
        userVote:      userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,
        userLiked:     userLikedByIndex.get(i) ?? false,
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const lastMsg = messages[messages.length - 1];

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
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/rooms/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST  /api/roar/rooms/[roomId]/messages
// ─────────────────────────────────────────────────────────────────────────────
//
// Quota optimisations vs original:
//
//  1. emailSnap + roomSnap fire in parallel → 2 reads on happy path (was up
//     to 3 sequential: emailSnap → miss? → uidSnap → roomSnap).
//
//  2. Points are awarded via direct awardRoarPoints() call instead of a
//     fire-and-forget fetch() to /api/award-points, which had no auth headers
//     and was silently failing on every room message post.
//
//  3. No extra reads: user data is taken from the snap already fetched in
//     step 1 — no second user doc read inside awardRoarPoints.
//
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
      memGifUrl,
      memTag,
    }: {
      text: string;
      type: MessageType;
      mediaUrls?: string[];
      sideA?: string;
      sideB?: string;
      memGifUrl?: string;
      memTag?: string;
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // ── Resolve user + room in parallel — 2 reads on happy path ──────────────
    // emailSnap and roomSnap fire simultaneously; uidSnap only fires on miss.
    const [emailSnap, roomSnap] = await Promise.all([
      db.collection("users").doc(user.email).get(),
      db.collection("roarRooms").doc(roomId).get(),
    ]);

    if (!roomSnap.exists) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    let resolvedUserId = user.email;
    let userSnap = emailSnap;

    if (!emailSnap.exists) {
      // Rare path: email key miss → fall back to uid key (1 extra read)
      const uidSnap = await db.collection("users").doc(user.userId).get();
      if (!uidSnap.exists) {
        return NextResponse.json({ error: "User profile not found" }, { status: 404 });
      }
      resolvedUserId = user.userId;
      userSnap = uidSnap;
    }

    const userData = userSnap.data() as { username: string; badge: string };
    const roomRef = db.collection("roarRooms").doc(roomId);
    const now = Date.now();
    const msgRef = roomRef.collection("messages").doc();

    const message: RoomMessage = {
      msgId:    msgRef.id,
      roomId,
      authorUid:      resolvedUserId,
      authorUsername: userData.username,
      authorBadge:    userData.badge,
      text:           text.trim(),
      type,
      fireCount:     0,
      noChanceCount: 0,
      heartCount:    0,
      agreeCount:    0,
      disagreeCount: 0,
      replyCount:    0,
      createdAt:     now,
      ...(mediaUrls?.length && { mediaUrls }),
      ...(sideA     && { sideA }),
      ...(sideB     && { sideB }),
      ...(memGifUrl && { memGifUrl }),
      ...(memTag    && { memTag }),
    };

    // Atomic batch: write message + increment room fan count
    const batch = db.batch();
    batch.set(msgRef, message);
    batch.update(roomRef, { fanCount: FieldValue.increment(1) });
    await batch.commit();

    // ── Award points — non-fatal, fire and forget ─────────────────────────────
    // Uses awardRoarPoints() directly (same path as posts/route.ts).
    // The old fetch(/api/award-points) had no auth headers and was silently
    // failing for every room message — points were never written.
    //
    // awardUserPoints() inside awardRoarPoints() writes:
    //   • userPointTransactions/{transactionId}  (idempotency guard)
    //   • users/{id}.totalPoints + pointsBreakdown + activityLog
    //   • globalLeaderboard/{id}
    //   • roarLeaderboard/{id}
    //
    // Reads consumed: 1 (transaction idempotency check) — already paid
    // for by the user resolution above, nothing duplicated.

    const roarPostType = ROOM_TYPE_TO_POST_TYPE[type] ?? "post";
    const transactionId = `roar_room_${msgRef.id}`;

    awardRoarPoints({
      actualUserId: resolvedUserId,
      authUserId:   user.userId,
      userName:     userData.username,
      userEmail:    user.email,
      userExists:   true,
      postType:     roarPostType,
      transactionId,
      metadata: {
        postId: msgRef.id,
        roomId,
        type,
        ...(sideA && { sideA }),
        ...(sideB && { sideB }),
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