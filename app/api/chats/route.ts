// // app/api/chats/route.ts
// // Powers the "My Chats" tab — list of DMs and group chats

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// const CURRENT_USER_ID = "u3"; // swap → getServerSession() / JWT in production

// // ─────────────────────────────────────────────────────────────────────────────
// // GET /api/chats
// //   ?type=dm|group          filter by chat type
// //   ?limit=20               results per page (max 50)
// //   ?lastDocId=<id>         \  cursor-based pagination
// //   ?lastDocUpdatedAt=<ms>  /  (same pattern as cricket articles)
// // ─────────────────────────────────────────────────────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const type = searchParams.get("type");           // "dm" | "group" | null
//     const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocUpdatedAt = searchParams.get("lastDocUpdatedAt");

//     // Base query — current user must be a participant
//     let query = db
//       .collection("chats")
//       .where("participantIds", "array-contains", CURRENT_USER_ID)
//       .orderBy("updatedAt", "desc");

//     // Optionally narrow to DMs or group chats
//     if (type === "dm" || type === "group") {
//       query = db
//         .collection("chats")
//         .where("participantIds", "array-contains", CURRENT_USER_ID)
//         .where("type", "==", type)
//         .orderBy("updatedAt", "desc");
//     }

//     query = query.limit(limit);

//     // Cursor pagination
//     if (lastDocId && lastDocUpdatedAt) {
//       const lastRef = db.collection("chats").doc(lastDocId);
//       const lastDoc = await lastRef.get();
//       if (lastDoc.exists) query = query.startAfter(lastDoc);
//     }

//     const snapshot = await query.get();
//     const chats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       chats,
//       pagination: {
//         limit,
//         hasMore: chats.length === limit,
//         nextCursor:
//           chats.length === limit
//             ? {
//                 lastDocId: lastDoc?.id,
//                 lastDocUpdatedAt: lastDoc?.data()?.updatedAt,
//               }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/chats error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/chats
// // Create a DM or a group chat
// //
// // DM body:    { type: "dm",    participantId: string }
// // Group body: { type: "group", name: string, participantIds?: string[] }
// // ─────────────────────────────────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { type, participantId, participantIds, name } = body;

//     if (!type || !["dm", "group"].includes(type)) {
//       return NextResponse.json(
//         { error: "type must be 'dm' or 'group'" },
//         { status: 400 }
//       );
//     }

//     // ── DM ──────────────────────────────────────────────────────────────────
//     if (type === "dm") {
//       if (!participantId) {
//         return NextResponse.json(
//           { error: "participantId is required for DMs" },
//           { status: 400 }
//         );
//       }

//       // Return existing DM if one already exists between the two users
//       const existing = await db
//         .collection("chats")
//         .where("type", "==", "dm")
//         .where("participantIds", "array-contains", CURRENT_USER_ID)
//         .get();

//       const alreadyExists = existing.docs.find((d) =>
//         (d.data().participantIds as string[]).includes(participantId)
//       );
//       if (alreadyExists) {
//         return NextResponse.json({
//           success: true,
//           id: alreadyExists.id,
//           chat: { id: alreadyExists.id, ...alreadyExists.data() },
//           message: "Existing DM returned",
//         });
//       }

//       const now = Date.now();
//       const newChat = {
//         type: "dm",
//         name: "",                  // UI derives name from the other participant's profile
//         participantIds: [CURRENT_USER_ID, participantId],
//         lastMessageContent: "",
//         lastMessageAt: now,
//         unreadCount: 0,
//         isOnline: false,
//         isVerified: false,
//         isPinned: false,
//         isMuted: false,
//         createdBy: CURRENT_USER_ID,
//         createdAt: now,
//         updatedAt: now,
//       };

//       const docRef = await db.collection("chats").add(newChat);
//       return NextResponse.json(
//         { success: true, id: docRef.id, chat: { id: docRef.id, ...newChat } },
//         { status: 201 }
//       );
//     }

//     // ── Group chat ───────────────────────────────────────────────────────────
//     if (!name || !name.trim()) {
//       return NextResponse.json(
//         { error: "name is required for group chats" },
//         { status: 400 }
//       );
//     }

//     const members = Array.isArray(participantIds)
//       ? Array.from(new Set([CURRENT_USER_ID, ...participantIds]))
//       : [CURRENT_USER_ID];

//     const now = Date.now();
//     const newChat = {
//       type: "group",
//       name: name.trim(),
//       participantIds: members,
//       lastMessageContent: "",
//       lastMessageAt: now,
//       unreadCount: 0,
//       isOnline: false,
//       isVerified: false,
//       isPinned: false,
//       isMuted: false,
//       createdBy: CURRENT_USER_ID,
//       createdAt: now,
//       updatedAt: now,
//     };

//     const docRef = await db.collection("chats").add(newChat);
//     return NextResponse.json(
//       { success: true, id: docRef.id, chat: { id: docRef.id, ...newChat } },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/chats error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






// app/api/chats/route.ts
// Powers the "My Chats" tab — list of DMs and group chats

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Auth helper — mirrors /api/auth/host/me, same pattern as LiveRoomsCard ──
async function getUser(req: NextRequest) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_URL}/api/auth/host/me`, {
      headers: {
        cookie:        req.headers.get("cookie")        ?? "",
        authorization: req.headers.get("authorization") ?? "",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.user) return null;
    return json.user as { userId?: string; email: string; name: string; role: string };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats
//   ?type=dm|group          filter by chat type
//   ?limit=20               results per page (max 50)
//   ?lastDocId=<id>         \  cursor-based pagination
//   ?lastDocUpdatedAt=<ms>  /
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId ?? user.email;

    const { searchParams } = new URL(req.url);
    const type             = searchParams.get("type");
    const limit            = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId        = searchParams.get("lastDocId");
    const lastDocUpdatedAt = searchParams.get("lastDocUpdatedAt");

    // Base query — current user must be a participant
    let query = db
      .collection("chats")
      .where("participantIds", "array-contains", CURRENT_USER_ID)
      .orderBy("updatedAt", "desc");

    // Optionally narrow to DMs or group chats
    if (type === "dm" || type === "group") {
      query = db
        .collection("chats")
        .where("participantIds", "array-contains", CURRENT_USER_ID)
        .where("type", "==", type)
        .orderBy("updatedAt", "desc");
    }

    query = query.limit(limit);

    // Cursor pagination
    if (lastDocId && lastDocUpdatedAt) {
      const lastRef = db.collection("chats").doc(lastDocId);
      const lastDoc = await lastRef.get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const chats    = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const lastDoc  = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      chats,
      pagination: {
        limit,
        hasMore: chats.length === limit,
        nextCursor:
          chats.length === limit
            ? {
                lastDocId:        lastDoc?.id,
                lastDocUpdatedAt: lastDoc?.data()?.updatedAt,
              }
            : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/chats error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chats
// Create a DM or a group chat
//
// DM body:    { type: "dm",    participantId: string }
// Group body: { type: "group", name: string, participantIds?: string[] }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId ?? user.email;

    const body = await req.json();
    const { type, participantId, participantIds, name } = body;

    if (!type || !["dm", "group"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'dm' or 'group'" },
        { status: 400 }
      );
    }

    // ── DM ──────────────────────────────────────────────────────────────────
    if (type === "dm") {
      if (!participantId) {
        return NextResponse.json(
          { error: "participantId is required for DMs" },
          { status: 400 }
        );
      }

      // Return existing DM if one already exists between the two users
      const existing = await db
        .collection("chats")
        .where("type", "==", "dm")
        .where("participantIds", "array-contains", CURRENT_USER_ID)
        .get();

      const alreadyExists = existing.docs.find((d) =>
        (d.data().participantIds as string[]).includes(participantId)
      );
      if (alreadyExists) {
        return NextResponse.json({
          success: true,
          id:      alreadyExists.id,
          chat:    { id: alreadyExists.id, ...alreadyExists.data() },
          message: "Existing DM returned",
        });
      }

      const now     = Date.now();
      const newChat = {
        type:               "dm",
        name:               "",
        participantIds:     [CURRENT_USER_ID, participantId],
        lastMessageContent: "",
        lastMessageAt:      now,
        unreadCount:        0,
        isOnline:           false,
        isVerified:         false,
        isPinned:           false,
        isMuted:            false,
        createdBy:          CURRENT_USER_ID,
        createdAt:          now,
        updatedAt:          now,
      };

      const docRef = await db.collection("chats").add(newChat);
      return NextResponse.json(
        { success: true, id: docRef.id, chat: { id: docRef.id, ...newChat } },
        { status: 201 }
      );
    }

    // ── Group chat ───────────────────────────────────────────────────────────
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "name is required for group chats" },
        { status: 400 }
      );
    }

    const members = Array.isArray(participantIds)
      ? Array.from(new Set([CURRENT_USER_ID, ...participantIds]))
      : [CURRENT_USER_ID];

    const now     = Date.now();
    const newChat = {
      type:               "group",
      name:               name.trim(),
      participantIds:     members,
      lastMessageContent: "",
      lastMessageAt:      now,
      unreadCount:        0,
      isOnline:           false,
      isVerified:         false,
      isPinned:           false,
      isMuted:            false,
      createdBy:          CURRENT_USER_ID,
      createdAt:          now,
      updatedAt:          now,
    };

    const docRef = await db.collection("chats").add(newChat);
    return NextResponse.json(
      { success: true, id: docRef.id, chat: { id: docRef.id, ...newChat } },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/chats error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}