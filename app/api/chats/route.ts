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





// app/api/chats/route.ts  — BACKEND
// Powers the "My Chats" tab — list of DMs and group chats

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Path A — Email/password: httpOnly "token" cookie set by /api/auth/login
// Path B — Google users:   "Authorization: Bearer <token>" sent by chatApi.ts
//           Token is issued by frontend's /api/session-token route,
//           signed with the same JWT_SECRET — verified identically here.
//
// NOTE: No auth() / NextAuth import needed. The Bearer token approach works
// cross-domain because it's just a JWT in a header, not a cookie.
// ─────────────────────────────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
  // ── Path A: JWT cookie (email/password users) ─────────────────────────────
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {
      // Expired or tampered — fall through to Bearer
    }
  }

  // ── Path B: Bearer token (Google users) ───────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(bearerToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {
      // Invalid token
    }
  }

  return null;
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
    const CURRENT_USER_ID = user.userId;

    const { searchParams } = new URL(req.url);
    const type             = searchParams.get("type");
    const limit            = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId        = searchParams.get("lastDocId");
    const lastDocUpdatedAt = searchParams.get("lastDocUpdatedAt");

    let query = db
      .collection("chats")
      .where("participantIds", "array-contains", CURRENT_USER_ID)
      .orderBy("updatedAt", "desc");

    if (type === "dm" || type === "group") {
      query = db
        .collection("chats")
        .where("participantIds", "array-contains", CURRENT_USER_ID)
        .where("type", "==", type)
        .orderBy("updatedAt", "desc");
    }

    query = query.limit(limit);

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
            ? { lastDocId: lastDoc?.id, lastDocUpdatedAt: lastDoc?.data()?.updatedAt }
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
// DM body:    { type: "dm",    participantId: string }
// Group body: { type: "group", name: string, participantIds?: string[] }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId;

    const body = await req.json();
    const { type, participantId, participantIds, name } = body;

    if (!type || !["dm", "group"].includes(type)) {
      return NextResponse.json({ error: "type must be 'dm' or 'group'" }, { status: 400 });
    }

    // ── DM ───────────────────────────────────────────────────────────────────
    if (type === "dm") {
      if (!participantId) {
        return NextResponse.json({ error: "participantId is required for DMs" }, { status: 400 });
      }

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
        type: "dm", name: body.name?.trim() || "",
        participantIds:     [CURRENT_USER_ID, participantId],
        lastMessageContent: "", lastMessageAt: now, unreadCount: 0,
        isOnline: false, isVerified: false, isPinned: false, isMuted: false,
        createdBy: CURRENT_USER_ID, createdAt: now, updatedAt: now,
      };

      const docRef = await db.collection("chats").add(newChat);
      return NextResponse.json(
        { success: true, id: docRef.id, chat: { id: docRef.id, ...newChat } },
        { status: 201 }
      );
    }

    // ── Group ────────────────────────────────────────────────────────────────
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required for group chats" }, { status: 400 });
    }

    const members = Array.isArray(participantIds)
      ? Array.from(new Set([CURRENT_USER_ID, ...participantIds]))
      : [CURRENT_USER_ID];

    const now     = Date.now();
    const newChat = {
      type: "group", name: name.trim(),
      participantIds:     members,
      lastMessageContent: "", lastMessageAt: now, unreadCount: 0,
      isOnline: false, isVerified: false, isPinned: false, isMuted: false,
      createdBy: CURRENT_USER_ID, createdAt: now, updatedAt: now,
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