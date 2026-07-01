

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

// // ── Message types that support agree/disagree voting ─────────────────────────
// const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take"]);

// // ── PostType map for awardRoarPoints ──────────────────────────────────────────
// const ROOM_TYPE_TO_POST_TYPE: Partial<Record<string, PostType | "post">> = {
//   debate:        "debate",
//   prediction:    "prediction",
//   post:          "post",
//   hottake:       "hot_take",
//   hot_take:      "hot_take",
//   raw_reactions: "post",
//   memory:        "post",
//   quiz:          "quiz",
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // GET  /api/roar/rooms/[roomId]/messages
// // ─────────────────────────────────────────────────────────────────────────────
// //
// // Quota optimisations vs original:
// //
// //  1. resolveUser() → goes through getUserInfo, which is at minimum 1 read
// //     (users/{uid} hit) and may take extra reads on fallback paths (email
// //     query / sanitized-id lookups) — only on the rare miss, not the happy
// //     path. This trades a small amount of worst-case quota for guaranteed
// //     consistency with createpost and roar/posts.
// //
// //  2. Subcollection reads (votes + heart reactions) are batched in a single
// //     Promise.all round-trip instead of serial per-doc loops.
// //     Cost per page: 1 (user) + N (messages) + N (heart reactions)
// //               + V (vote docs, only for votable messages)
// //     Previously the heart read was missing entirely, so userLiked was always
// //     false after a page refresh even when the like existed in Firestore.
// //
// //  3. Pagination uses a timestamp cursor (lastCreatedAt) which avoids the
// //     extra doc read that lastDocId required on every page turn.
// //
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
//     // Legacy cursor support — falls back to doc read only when no timestamp is provided.
//     const lastDocId = searchParams.get("lastDocId");

//     // Resolve user via getUserInfo (same canonical ID as createpost / roar/posts)
//     const resolved = await resolveUser(user.email, user.userId);
//     if (!resolved) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }
//     const resolvedUserId = resolved.id;

//     // Build query — timestamp cursor preferred (0 extra reads vs 1 for doc cursor)
//     const messagesRef = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages");

//     let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

//     if (lastCreatedAt) {
//       // Zero-cost cursor: startAfter a raw timestamp value
//       query = query.startAfter(parseInt(lastCreatedAt, 10));
//     } else if (lastDocId) {
//       // Legacy path: 1 extra read to fetch the cursor doc
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

//     // ── Batch subcollection reads — votes + heart reactions in parallel ────────
//     //
//     // Two parallel Promise.all calls, one round-trip each:
//     //   • votePromises — only for VOTABLE_TYPES (saves reads on chat/post msgs)
//     //   • heartPromises — every message (needed for userLiked state)
//     //
//     // Total subcollection reads per GET page of N messages with V votable:
//     //   V vote reads + N heart reads  (fired in parallel → 1 logical round-trip)

//     const votableIndices: number[] = [];
//     const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
//     const heartPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

//     snapshot.docs.forEach((doc, i) => {
//       const type = (doc.data() as RoomMessage).type;
//       if (VOTABLE_TYPES.has(type)) {
//         votableIndices.push(i);
//         votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
//       }
//       heartPromises.push(
//         doc.ref.collection("reactions").doc(`${resolvedUserId}_heart`).get()
//       );
//     });

//     const [voteResults, heartResults] = await Promise.all([
//       Promise.all(votePromises),
//       Promise.all(heartPromises),
//     ]);

//     // Build lookup maps
//     const userVoteByIndex = new Map<number, string | null>();
//     votableIndices.forEach((docIdx, resultIdx) => {
//       const snap = voteResults[resultIdx];
//       userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
//     });

//     const userLikedByIndex = new Map<number, boolean>();
//     snapshot.docs.forEach((_, i) => {
//       userLikedByIndex.set(i, heartResults[i].exists);
//     });

//     // ── Assemble response ─────────────────────────────────────────────────────
//     const messages = snapshot.docs.map((doc, i) => {
//       const data = doc.data() as RoomMessage;
//       return {
//         ...data,
//         msgId:         doc.id,
//         agreeCount:    data.agreeCount    ?? 0,
//         disagreeCount: data.disagreeCount ?? 0,
//         heartCount:    data.heartCount    ?? 0,
//         replyCount:    data.replyCount    ?? 0,
//         userVote:      userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,
//         userLiked:     userLikedByIndex.get(i) ?? false,
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

// // ─────────────────────────────────────────────────────────────────────────────
// // POST  /api/roar/rooms/[roomId]/messages
// // ─────────────────────────────────────────────────────────────────────────────
// //
// // Quota optimisations vs original:
// //
// //  1. roomSnap fires in parallel with user resolution.
// //
// //  2. Points are awarded via direct awardRoarPoints() call instead of a
// //     fire-and-forget fetch() to /api/award-points, which had no auth headers
// //     and was silently failing on every room message post.
// //
// //  3. User resolution goes through getUserInfo (same as GET above and as
// //     roar/posts/route.ts), so the user doc updated here, the activityLog
// //     entry written inside awardUserPoints, and the totalPoints /
// //     pointsBreakdown increments all land on the same canonical
// //     users/{actualUserId} doc that /api/createpost and /api/roar/posts use.
// //
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

//     // ── Resolve user + room in parallel ───────────────────────────────────────
//     // resolveUser (via getUserInfo) and the room lookup fire simultaneously.
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
//     const predictionClosesAt = type === "prediction"
//       ? Number.isFinite(requestedClosesAt) && requestedClosesAt > now
//         ? requestedClosesAt
//         : Number.isFinite(normalizedCloseAfter) && normalizedCloseAfter > 0
//           ? now + Math.min(Math.max(normalizedCloseAfter, 1), 24 * 60) * 60_000
//           : now + 2 * 60_000
//       : undefined;

//     const message: RoomMessage = {
//       msgId:    msgRef.id,
//       roomId,
//       authorUid:      resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge:    userData.badge,
//       text:           text.trim(),
//       type,
//       fireCount:     0,
//       noChanceCount: 0,
//       heartCount:    0,
//       agreeCount:    0,
//       disagreeCount: 0,
//       replyCount:    0,
//       createdAt:     now,
//       ...(mediaUrls?.length && { mediaUrls }),
//       ...(sideA     && { sideA }),
//       ...(sideB     && { sideB }),
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag    && { memTag }),
//     };

//     // Atomic batch: write message + increment room fan count
//     const batch = db.batch();
//     batch.set(msgRef, message);
//     batch.update(roomRef, { fanCount: FieldValue.increment(1) });
//     await batch.commit();

//     // ── Award points — non-fatal, fire and forget ─────────────────────────────
//     // Uses awardRoarPoints() directly (same path as posts/route.ts).
//     // The old fetch(/api/award-points) had no auth headers and was silently
//     // failing for every room message — points were never written.
//     //
//     // awardUserPoints() inside awardRoarPoints() writes:
//     //   • userPointTransactions/{transactionId}  (idempotency guard)
//     //   • users/{id}.totalPoints + pointsBreakdown + activityLog
//     //   • globalLeaderboard/{id}
//     //   • roarLeaderboard/{id}
//     //
//     // actualUserId here is the same canonical ID used by GET's subcollection
//     // lookups and by roar/posts, so activityLog/points/votes/likes all stay
//     // consistent for the same person across every ROAR surface.

//     const roarPostType = ROOM_TYPE_TO_POST_TYPE[type] ?? "post";
//     const transactionId = `roar_room_${msgRef.id}`;

//     awardRoarPoints({
//       actualUserId: resolvedUserId,
//       authUserId:   user.userId,
//       userName:     userData.username,
//       userEmail:    user.email,
//       userExists:   true,
//       postType:     roarPostType,
//       transactionId,
//       metadata: {
//         postId: msgRef.id,
//         roomId,
//         type,
//         ...(sideA && { sideA }),
//         ...(sideB && { sideB }),
//       ...(type === "prediction" && Array.isArray(predictionOptions) && { predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) }),
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

// // ── Message types that support agree/disagree voting ─────────────────────────
// const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take"]);

// // ── PostType map for awardRoarPoints ──────────────────────────────────────────
// const ROOM_TYPE_TO_POST_TYPE: Partial<Record<string, PostType | "post">> = {
//   debate:        "debate",
//   prediction:    "prediction",
//   post:          "post",
//   hottake:       "hot_take",
//   hot_take:      "hot_take",
//   raw_reactions: "post",
//   memory:        "post",
//   quiz:          "quiz",
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // GET  /api/roar/rooms/[roomId]/messages
// // ─────────────────────────────────────────────────────────────────────────────
// //
// // Quota optimisations vs original:
// //
// //  1. resolveUser() → goes through getUserInfo, which is at minimum 1 read
// //     (users/{uid} hit) and may take extra reads on fallback paths (email
// //     query / sanitized-id lookups) — only on the rare miss, not the happy
// //     path. This trades a small amount of worst-case quota for guaranteed
// //     consistency with createpost and roar/posts.
// //
// //  2. Subcollection reads (votes + reactions) are batched in a single
// //     Promise.all round-trip instead of serial per-doc loops.
// //     Cost per page: 1 (user) + N (messages) + N (reaction docs)
// //               + V (vote docs, only for votable messages)
// //
// //  3. Pagination uses a timestamp cursor (lastCreatedAt) which avoids the
// //     extra doc read that lastDocId required on every page turn.
// //
// //  4. CHANGED: reactions now read from the same `likes/{userId}` subcollection
// //     shape that roar/posts uses (see likesection/route.ts's room-aware
// //     branch), not the old `reactions/{userId}_heart` doc-per-reaction-type
// //     scheme. Each message now returns `userReaction` (one of
// //     heart|fire|laugh|sad|thumb, or null) instead of a boolean `userLiked`,
// //     so DiscussionRoom.tsx can drive the same ReactionPicker component
// //     HomeFeed.tsx uses and show the correct emoji on load/refresh — not
// //     just a yes/no heart state.
// //
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
//     // Legacy cursor support — falls back to doc read only when no timestamp is provided.
//     const lastDocId = searchParams.get("lastDocId");

//     // Resolve user via getUserInfo (same canonical ID as createpost / roar/posts)
//     const resolved = await resolveUser(user.email, user.userId);
//     if (!resolved) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }
//     const resolvedUserId = resolved.id;

//     // Build query — timestamp cursor preferred (0 extra reads vs 1 for doc cursor)
//     const messagesRef = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages");

//     let query = messagesRef.orderBy("createdAt", "desc").limit(limit);

//     if (lastCreatedAt) {
//       // Zero-cost cursor: startAfter a raw timestamp value
//       query = query.startAfter(parseInt(lastCreatedAt, 10));
//     } else if (lastDocId) {
//       // Legacy path: 1 extra read to fetch the cursor doc
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

//     // ── Batch subcollection reads — votes + reactions in parallel ──────────────
//     //
//     // Two parallel Promise.all calls, one round-trip each:
//     //   • votePromises     — only for VOTABLE_TYPES (saves reads on chat/post msgs)
//     //   • reactionPromises — every message, reading likes/{resolvedUserId}
//     //     (the same shape roar/posts uses, NOT the old reactions/{uid}_heart
//     //     doc-per-type scheme)
//     //
//     // Total subcollection reads per GET page of N messages with V votable:
//     //   V vote reads + N reaction reads  (fired in parallel → 1 logical round-trip)

//     const votableIndices: number[] = [];
//     const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
//     const reactionPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

//     snapshot.docs.forEach((doc, i) => {
//       const type = (doc.data() as RoomMessage).type;
//       if (VOTABLE_TYPES.has(type)) {
//         votableIndices.push(i);
//         votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
//       }
//       reactionPromises.push(doc.ref.collection("likes").doc(resolvedUserId).get());
//     });

//     const [voteResults, reactionResults] = await Promise.all([
//       Promise.all(votePromises),
//       Promise.all(reactionPromises),
//     ]);

//     // Build lookup maps
//     const userVoteByIndex = new Map<number, string | null>();
//     votableIndices.forEach((docIdx, resultIdx) => {
//       const snap = voteResults[resultIdx];
//       userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
//     });

//     // userReaction: the actual reaction type (heart|fire|laugh|sad|thumb) the
//     // current user picked on this message, or null if they haven't reacted.
//     const userReactionByIndex = new Map<number, string | null>();
//     snapshot.docs.forEach((_, i) => {
//       const snap = reactionResults[i];
//       userReactionByIndex.set(i, snap.exists ? ((snap.data() as any).reaction ?? "heart") : null);
//     });

//     // ── Assemble response ─────────────────────────────────────────────────────
//     const messages = snapshot.docs.map((doc, i) => {
//       const data = doc.data() as RoomMessage;
//       return {
//         ...data,
//         msgId:         doc.id,
//         agreeCount:    data.agreeCount    ?? 0,
//         disagreeCount: data.disagreeCount ?? 0,
//         // heartCount is the single aggregate reaction counter (incremented
//         // for ANY of the 5 reaction types by likesection/route.ts's
//         // room-aware branch — not heart-specific despite the field name).
//         heartCount:    (data as any).heartCount ?? 0,
//         replyCount:    data.replyCount    ?? 0,
//         userVote:      userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,
//         userReaction:  userReactionByIndex.get(i) ?? null,
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

// // ─────────────────────────────────────────────────────────────────────────────
// // POST  /api/roar/rooms/[roomId]/messages
// // ─────────────────────────────────────────────────────────────────────────────
// //
// // Quota optimisations vs original:
// //
// //  1. roomSnap fires in parallel with user resolution.
// //
// //  2. Points are awarded via direct awardRoarPoints() call instead of a
// //     fire-and-forget fetch() to /api/award-points, which had no auth headers
// //     and was silently failing on every room message post.
// //
// //  3. User resolution goes through getUserInfo (same as GET above and as
// //     roar/posts/route.ts), so the user doc updated here, the activityLog
// //     entry written inside awardUserPoints, and the totalPoints /
// //     pointsBreakdown increments all land on the same canonical
// //     users/{actualUserId} doc that /api/createpost and /api/roar/posts use.
// //
// // NOTE: this handler is UNCHANGED by the reaction-system migration. New
// // messages still start with heartCount: 0 — the room-aware branch in
// // likesection/route.ts is what increments/decrements it now, instead of the
// // old /rooms/[roomId]/messages/[msgId]/react endpoint.
// //
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

//     // ── Resolve user + room in parallel ───────────────────────────────────────
//     // resolveUser (via getUserInfo) and the room lookup fire simultaneously.
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
//     const predictionClosesAt = type === "prediction"
//       ? Number.isFinite(requestedClosesAt) && requestedClosesAt > now
//         ? requestedClosesAt
//         : Number.isFinite(normalizedCloseAfter) && normalizedCloseAfter > 0
//           ? now + Math.min(Math.max(normalizedCloseAfter, 1), 24 * 60) * 60_000
//           : now + 2 * 60_000
//       : undefined;

//     const message: RoomMessage = {
//       msgId:    msgRef.id,
//       roomId,
//       authorUid:      resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge:    userData.badge,
//       text:           text.trim(),
//       type,
//       fireCount:     0,
//       noChanceCount: 0,
//       heartCount:    0,
//       agreeCount:    0,
//       disagreeCount: 0,
//       replyCount:    0,
//       createdAt:     now,
//       ...(mediaUrls?.length && { mediaUrls }),
//       ...(sideA     && { sideA }),
//       ...(sideB     && { sideB }),
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag    && { memTag }),
//     };

//     // Atomic batch: write message + increment room fan count
//     const batch = db.batch();
//     batch.set(msgRef, message);
//     batch.update(roomRef, { fanCount: FieldValue.increment(1) });
//     await batch.commit();

//     // ── Award points — non-fatal, fire and forget ─────────────────────────────
//     // Uses awardRoarPoints() directly (same path as posts/route.ts).
//     // The old fetch(/api/award-points) had no auth headers and was silently
//     // failing for every room message — points were never written.
//     //
//     // awardUserPoints() inside awardRoarPoints() writes:
//     //   • userPointTransactions/{transactionId}  (idempotency guard)
//     //   • users/{id}.totalPoints + pointsBreakdown + activityLog
//     //   • globalLeaderboard/{id}
//     //   • roarLeaderboard/{id}
//     //
//     // actualUserId here is the same canonical ID used by GET's subcollection
//     // lookups and by roar/posts, so activityLog/points/votes/likes all stay
//     // consistent for the same person across every ROAR surface.

//     const roarPostType = ROOM_TYPE_TO_POST_TYPE[type] ?? "post";
//     const transactionId = `roar_room_${msgRef.id}`;

//     awardRoarPoints({
//       actualUserId: resolvedUserId,
//       authUserId:   user.userId,
//       userName:     userData.username,
//       userEmail:    user.email,
//       userExists:   true,
//       postType:     roarPostType,
//       transactionId,
//       metadata: {
//         postId: msgRef.id,
//         roomId,
//         type,
//         ...(sideA && { sideA }),
//         ...(sideB && { sideB }),
//       ...(type === "prediction" && Array.isArray(predictionOptions) && { predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) }),
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

// ── Message types that support agree/disagree voting ─────────────────────────
const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take", "debate"]);

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

//     snapshot.docs.forEach((doc, i) => {
//       const type = (doc.data() as RoomMessage).type;
//       if (VOTABLE_TYPES.has(type)) {
//         votableIndices.push(i);
//         votePromises.push(doc.ref.collection("votes").doc(resolvedUserId).get());
//       }
//     });

//     // ── Batch-fetch live avatarUrl/badge per unique author ────────────────────
//     const authorMap = new Map<string, { avatarUrl: string | null; badge: string | null }>();
//     const uniqueAuthorUids = Array.from(
//       new Set(snapshot.docs.map((d) => (d.data() as RoomMessage).authorUid))
//     );

//     const [voteResults, authorSnaps] = await Promise.all([
//       Promise.all(votePromises),
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

//     // Build vote lookup map
//     const userVoteByIndex = new Map<number, string | null>();
//     votableIndices.forEach((docIdx, resultIdx) => {
//       const snap = voteResults[resultIdx];
//       userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
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



const MULTI_QUESTION_TYPES = new Set(["predictions_live"]);

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

    const snapshot = await query.get();
    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        messages: [],
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // ── Batch vote reads ────────────────────────────────────────────────────
    // Two cases:
    //  1. Single-question votable types (debate/hottake/prediction) → one
    //     vote doc per message, keyed `${resolvedUserId}_q0`.
    //  2. Multi-question types (predictions_live) → one vote doc PER
    //     QUESTION in that message, keyed `${resolvedUserId}_q{idx}`, so we
    //     can restore which specific question(s) the user already answered.
    const votableIndices: number[] = [];
    const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

    const multiQuestionIndices: number[] = [];
    // For each doc index, the list of question indices we're fetching votes for,
    // and the corresponding promises (parallel arrays, same order).
    const multiQuestionMeta: { docIdx: number; qIdx: number }[] = [];
    const multiQuestionVotePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

    snapshot.docs.forEach((doc, i) => {
      const data = doc.data() as RoomMessage & { questions?: any[] };
      const type = data.type;

      if (MULTI_QUESTION_TYPES.has(type)) {
        const questions = Array.isArray(data.questions) ? data.questions : [];
        multiQuestionIndices.push(i);
        questions.forEach((_q, qIdx) => {
          multiQuestionMeta.push({ docIdx: i, qIdx });
          multiQuestionVotePromises.push(
            doc.ref.collection("votes").doc(`${resolvedUserId}_q${qIdx}`).get()
          );
        });
      } else if (VOTABLE_TYPES.has(type)) {
        votableIndices.push(i);
        votePromises.push(doc.ref.collection("votes").doc(`${resolvedUserId}_q0`).get());
      }
    });

    // ── Batch-fetch live avatarUrl/badge per unique author ────────────────────
    const authorMap = new Map<string, { avatarUrl: string | null; badge: string | null }>();
    const uniqueAuthorUids = Array.from(
      new Set(snapshot.docs.map((d) => (d.data() as RoomMessage).authorUid))
    );

    const [voteResults, multiQuestionVoteResults, authorSnaps] = await Promise.all([
      Promise.all(votePromises),
      Promise.all(multiQuestionVotePromises),
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

    // Build single-question vote lookup map: docIdx -> vote string | null
    const userVoteByIndex = new Map<number, string | null>();
    votableIndices.forEach((docIdx, resultIdx) => {
      const snap = voteResults[resultIdx];
      userVoteByIndex.set(docIdx, snap.exists ? ((snap.data() as any).vote ?? null) : null);
    });

    // Build multi-question vote lookup map: docIdx -> { qIdx: vote }
    const userPredictionVotesByIndex = new Map<number, Record<number, string>>();
    multiQuestionMeta.forEach((meta, resultIdx) => {
      const snap = multiQuestionVoteResults[resultIdx];
      if (snap.exists) {
        const existing = userPredictionVotesByIndex.get(meta.docIdx) ?? {};
        existing[meta.qIdx] = (snap.data() as any).vote;
        userPredictionVotesByIndex.set(meta.docIdx, existing);
      }
    });

    // ── Assemble response ─────────────────────────────────────────────────────
    const messages = snapshot.docs.map((doc, i) => {
      const data = doc.data() as RoomMessage & {
        questions?: any[];
        questionVoteCounts?: Record<string, Record<string, number>>;
      };
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

        // Per-question votes/counts for predictions_live messages, so the
        // client can restore exactly which question(s) this user already
        // answered and disable those options after a refresh.
        userPredictionVotes: userPredictionVotesByIndex.get(i) ?? {},
        questionVoteCounts: data.questionVoteCounts ?? {},

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
//       questions?: { question: string; options: { label: string; emoji: string }[] }[];  // ← add
//   matchTitle?: string;
//     } = body;

//     if (!text?.trim()) {
//       return NextResponse.json({ error: "text is required" }, { status: 400 });
//     }

//     // ── Resolve user + room in parallel ───────────────────────────────────────
//     // resolveUser (via getUserInfo) and the room lookup fire simultaneously.
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
//     const predictionClosesAt = type === "prediction"
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
//       ...(type === "prediction" && Array.isArray(predictionOptions) && { predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) }),
//       ...(predictionClosesAt && { closesAt: predictionClosesAt }),
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag && { memTag }),
//     };

//     // Atomic batch: write message + increment room fan count
//     const batch = db.batch();
//     batch.set(msgRef, message);
//     batch.update(roomRef, { fanCount: FieldValue.increment(1) });
//     await batch.commit();

//     // ── Award points — non-fatal, fire and forget ─────────────────────────────
//     // Uses awardRoarPoints() directly (same path as posts/route.ts).
//     // The old fetch(/api/award-points) had no auth headers and was silently
//     // failing for every room message — points were never written.
//     //
//     // awardUserPoints() inside awardRoarPoints() writes:
//     //   • userPointTransactions/{transactionId}  (idempotency guard)
//     //   • users/{id}.totalPoints + pointsBreakdown + activityLog
//     //   • globalLeaderboard/{id}
//     //   • roarLeaderboard/{id}
//     //
//     // actualUserId here is the same canonical ID used by GET's subcollection
//     // lookups and by roar/posts, so activityLog/points/votes/likes all stay
//     // consistent for the same person across every ROAR surface.

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
//         ...(type === "prediction" && Array.isArray(predictionOptions) && { predictionOptions: predictionOptions.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) }),
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

    // Atomic batch: write message + increment room fan count
    const batch = db.batch();
    batch.set(msgRef, message);
    batch.update(roomRef, { fanCount: FieldValue.increment(1) });
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