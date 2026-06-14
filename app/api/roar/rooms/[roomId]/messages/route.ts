// //api/roar/rooms/[roomId]/messages/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";

// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ roomId: string }> },
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

//     let query = db
//       .collection("roarRooms")
//       .doc(roomId)
//       .collection("messages")
//       .orderBy("createdAt", "desc")
//       .limit(limit);

//     if (lastDocId) {
//       const lastDoc = await db
//         .collection("roarRooms")
//         .doc(roomId)
//         .collection("messages")
//         .doc(lastDocId)
//         .get();
//       if (lastDoc.exists) query = query.startAfter(lastDoc);
//     }

//     const snapshot = await query.get();
//     const messages: RoomMessage[] = snapshot.docs.map((doc) => ({
//       ...(doc.data() as RoomMessage),
//       msgId: doc.id,
//     }));

//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       messages,
//       pagination: {
//         limit,
//         hasMore: messages.length === limit,
//         nextCursor:
//           messages.length === limit ? { lastDocId: lastDoc?.id } : null,
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
//   { params }: { params: Promise<{ roomId: string }> },
// ) {
//   try {
//     const { roomId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     // const { text, type = "chat", mediaUrls }: { text: string; type: MessageType; mediaUrls?: string[] } = body;
//     const { 
//   text, 
//   type = "chat", 
//   mediaUrls,
//   sideA,
//   sideB,
// }: { 
//   text: string; 
//   type: MessageType; 
//   mediaUrls?: string[];
//   sideA?: string;
//   sideB?: string;
// } = body;

//     if (!text?.trim()) {
//       return NextResponse.json({ error: "text is required" }, { status: 400 });
//     }

//     let userSnap = await db.collection("users").doc(user.email).get();
//     let resolvedUserId = user.email;
//     if (!userSnap.exists) {
//       userSnap = await db.collection("users").doc(user.userId).get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }
//     if (!userSnap.exists) {
//       return NextResponse.json(
//         { error: "User profile not found" },
//         { status: 404 },
//       );
//     }
//     const userData = userSnap.data() as { username: string; badge: string };

//     const roomRef = db.collection("roarRooms").doc(roomId);
//     const roomSnap = await roomRef.get();
//     if (!roomSnap.exists) {
//       return NextResponse.json({ error: "Room not found" }, { status: 404 });
//     }

//     const now = Date.now();
//     const msgRef = roomRef
//       .collection("messages")
//       .doc();

//     // const message: RoomMessage = {
//     //   msgId: msgRef.id,
//     //   roomId: roomId,
//     //   authorUid: resolvedUserId,
//     //   authorUsername: userData.username,
//     //   authorBadge: userData.badge,
//     //   text: text.trim(),
//     //   type,
//     //   fireCount: 0,
//     //   noChanceCount: 0,
//     //   createdAt: now,
//     //   ...(mediaUrls && { mediaUrls }),
//     // };

//     const message: RoomMessage = {
//   msgId: msgRef.id,
//   roomId: roomId,
//   authorUid: resolvedUserId,
//   authorUsername: userData.username,
//   authorBadge: userData.badge,
//   text: text.trim(),
//   type,
//   fireCount: 0,
//   noChanceCount: 0,
//   heartCount: 0,
//   createdAt: now,
//   ...(mediaUrls && { mediaUrls }),
//   ...(sideA && { sideA }),
//   ...(sideB && { sideB }),
// };

//     const batch = db.batch();
//     batch.set(msgRef, message);
//     // Bump room's fanCount as a presence proxy
//     batch.update(roomRef, {
//       fanCount: FieldValue.increment(1),
//     });

//     await batch.commit();

//     return NextResponse.json({ success: true, msgId: msgRef.id, message });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/roar/rooms/messages error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }


//api/roar/rooms/[roomId]/messages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import type { RoomMessage, MessageType } from "@/app/models/RoomMessage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const lastDocId = searchParams.get("lastDocId");

    // ── Resolve user ID (one read, done once) ────────────────────────────────
    let resolvedUserId = user.email;
    const emailSnap = await db.collection("users").doc(user.email).get();
    if (!emailSnap.exists) {
      const uidSnap = await db.collection("users").doc(user.userId).get();
      if (uidSnap.exists) resolvedUserId = user.userId;
    }

    // ── Fetch messages ───────────────────────────────────────────────────────
    let query = db
      .collection("roarRooms")
      .doc(roomId)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId) {
      const cursorDoc = await db
        .collection("roarRooms")
        .doc(roomId)
        .collection("messages")
        .doc(lastDocId)
        .get();
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

    // ── Batch vote reads — only for message types that support voting ─────────
    // This avoids N reads for post/memory/debate/quiz cards where votes don't apply.
    const VOTABLE_TYPES = new Set(["hottake", "prediction", "hot_take"]);

    const votableIndices: number[] = [];
    const votePromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];

    snapshot.docs.forEach((doc, i) => {
      const type = (doc.data() as RoomMessage).type;
      if (VOTABLE_TYPES.has(type)) {
        votableIndices.push(i);
        votePromises.push(
          doc.ref.collection("votes").doc(resolvedUserId).get()
        );
      }
    });

    // Fire all vote reads in parallel — one round-trip for all votable messages
    const voteResults = await Promise.all(votePromises);

    // Build a lookup: doc index → userVote string | null
    const userVoteByIndex = new Map<number, string | null>();
    votableIndices.forEach((docIdx, resultIdx) => {
      const snap = voteResults[resultIdx];
      userVoteByIndex.set(
        docIdx,
        snap.exists ? ((snap.data() as any).vote ?? null) : null
      );
    });

    // ── Assemble response — zero extra reads ─────────────────────────────────
    const messages = snapshot.docs.map((doc, i) => {
      const data = doc.data() as RoomMessage;
      return {
        ...data,
        msgId: doc.id,
        agreeCount: data.agreeCount ?? 0,
        disagreeCount: data.disagreeCount ?? 0,
        heartCount: data.heartCount ?? 0,
        replyCount: data.replyCount ?? 0,
        // userVote is only set for votable types; undefined for others (frontend ignores it)
        userVote: userVoteByIndex.has(i) ? userVoteByIndex.get(i) : null,
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        hasMore: messages.length === limit,
        nextCursor: messages.length === limit ? { lastDocId: lastDoc?.id } : null,
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
  { params }: { params: Promise<{ roomId: string }> },
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
    }: {
      text: string;
      type: MessageType;
      mediaUrls?: string[];
      sideA?: string;
      sideB?: string;
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // ── Resolve user (parallel with room check) ──────────────────────────────
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
      const uidSnap = await db.collection("users").doc(user.userId).get();
      if (uidSnap.exists) {
        resolvedUserId = user.userId;
        userSnap = uidSnap;
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const userData = userSnap.data() as { username: string; badge: string };
    const roomRef = db.collection("roarRooms").doc(roomId);
    const now = Date.now();
    const msgRef = roomRef.collection("messages").doc();

    const message: RoomMessage = {
      msgId: msgRef.id,
      roomId,
      authorUid: resolvedUserId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      text: text.trim(),
      type,
      fireCount: 0,
      noChanceCount: 0,
      heartCount: 0,
      // Initialize vote counts so GET never has to treat undefined as 0
      agreeCount: 0,
      disagreeCount: 0,
      replyCount: 0,
      createdAt: now,
      ...(mediaUrls?.length && { mediaUrls }),
      ...(sideA && { sideA }),
      ...(sideB && { sideB }),
    };

    const batch = db.batch();
    batch.set(msgRef, message);
    batch.update(roomRef, { fanCount: FieldValue.increment(1) });
    await batch.commit();

    return NextResponse.json({ success: true, msgId: msgRef.id, message });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/rooms/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}