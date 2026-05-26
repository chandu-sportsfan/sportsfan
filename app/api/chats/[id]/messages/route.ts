// // app/api/chats/[chatId]/messages/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from 'firebase-admin/firestore'

// function getChatIdFromUrl(req: NextRequest): string {
//   const parts = new URL(req.url).pathname.split("/");
//   // /api/chats/[chatId]/messages  →  chatId is second-to-last segment
//   return parts[parts.length - 2];
// }

// const CURRENT_USER_ID = "u3";
// const VALID_TYPES = ["text", "image", "video", "audio", "file"] as const;


// // GET /api/chats/[chatId]/messages
// //   ?limit=50
// //   ?lastDocId=<id>
// //   ?lastDocCreatedAt=<ms>
// // Returns messages in chronological order (oldest → newest, ready to render).
// // Also resets unreadCount on the chat to 0.
// // ─────────────────────────────────────────────────────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const chatId = getChatIdFromUrl(req);
//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

//     // Verify chat + access
//     const chatRef = db.collection("chats").doc(chatId);
//     const chatDoc = await chatRef.get();

//     if (!chatDoc.exists) {
//       return NextResponse.json({ error: "Chat not found" }, { status: 404 });
//     }
//     if (!(chatDoc.data()?.participantIds as string[]).includes(CURRENT_USER_ID)) {
//       return NextResponse.json({ error: "Access denied" }, { status: 403 });
//     }

//     // Fetch messages newest-first (for efficient pagination), then reverse
//     let query = db
//       .collection("messages")
//       .where("chatId", "==", chatId)
//       .orderBy("createdAt", "desc")
//       .limit(limit);

//     if (lastDocId && lastDocCreatedAt) {
//       const lastRef = db.collection("messages").doc(lastDocId);
//       const lastDoc = await lastRef.get();
//       if (lastDoc.exists) query = query.startAfter(lastDoc);
//     }

//     const snapshot = await query.get();

//     // Chronological order for UI rendering
//     const messages = snapshot.docs
//       .map((doc) => ({ id: doc.id, ...doc.data() }))
//       .reverse();

//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     // Batch: mark unread messages as read + reset chat unreadCount
//     const unreadDocs = snapshot.docs.filter(
//       (doc) => !doc.data().isRead && doc.data().senderId !== CURRENT_USER_ID
//     );
//     if (unreadDocs.length > 0) {
//       const batch = db.batch();
//       unreadDocs.forEach((doc) => batch.update(doc.ref, { isRead: true }));
//       batch.update(chatRef, { unreadCount: 0 });
//       await batch.commit();
//     }

//     return NextResponse.json({
//       success: true,
//       messages,
//       pagination: {
//         limit,
//         hasMore: snapshot.docs.length === limit,
//         nextCursor:
//           snapshot.docs.length === limit
//             ? {
//                 lastDocId: lastDoc?.id,
//                 lastDocCreatedAt: lastDoc?.data()?.createdAt,
//               }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/chats/[chatId]/messages error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/chats/[chatId]/messages
// // Send a message. Also updates the chat's lastMessageContent + lastMessageAt.
// //
// // Body: { content: string, type?: MessageType, replyToId?: string, mediaUrl?: string }
// // ─────────────────────────────────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const chatId = getChatIdFromUrl(req);
//     const body = await req.json();
//     const { content, type = "text", replyToId, mediaUrl } = body;

//     if (!content || typeof content !== "string" || !content.trim()) {
//       return NextResponse.json({ error: "content is required" }, { status: 400 });
//     }

//     if (!VALID_TYPES.includes(type)) {
//       return NextResponse.json(
//         { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
//         { status: 400 }
//       );
//     }

//     // Verify chat + access
//     const chatRef = db.collection("chats").doc(chatId);
//     const chatDoc = await chatRef.get();

//     if (!chatDoc.exists) {
//       return NextResponse.json({ error: "Chat not found" }, { status: 404 });
//     }
//     if (!(chatDoc.data()?.participantIds as string[]).includes(CURRENT_USER_ID)) {
//       return NextResponse.json({ error: "Access denied" }, { status: 403 });
//     }

//     // Validate replyToId belongs to this chat
//     if (replyToId) {
//       const replyDoc = await db.collection("messages").doc(replyToId).get();
//       if (!replyDoc.exists || replyDoc.data()?.chatId !== chatId) {
//         return NextResponse.json(
//           { error: "Replied-to message not found in this chat" },
//           { status: 404 }
//         );
//       }
//     }

//     const now = Date.now();
//     const newMessage: Record<string, unknown> = {
//       chatId,
//       senderId: CURRENT_USER_ID,
//       type,
//       content: content.trim(),
//       isRead: false,
//       createdAt: now,
//       updatedAt: now,
//     };

//     if (replyToId) newMessage.replyToId = replyToId;
//     if (mediaUrl)  newMessage.mediaUrl = mediaUrl;

//     const msgRef = await db.collection("messages").add(newMessage);

//     // Update chat snapshot visible in the My Chats list row
//     const otherCount = (chatDoc.data()?.participantIds as string[]).filter(
//       (id) => id !== CURRENT_USER_ID
//     ).length;

//     await chatRef.update({
//       lastMessageContent: content.trim(),
//       lastMessageAt: now,
//       updatedAt: now,
//       // Increment unread for every other participant
//       unreadCount: FieldValue.increment(otherCount),
//     });

//     return NextResponse.json(
//       {
//         success: true,
//         id: msgRef.id,
//         message: { id: msgRef.id, ...newMessage },
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/chats/[chatId]/messages error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }





// app/api/chats/[chatId]/messages/route.ts  — BACKEND

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/auth.config";   // ← NextAuth helper for Google users

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Handles BOTH login flows:
//   • Email/password → sets an httpOnly "token" JWT cookie via /api/auth/login
//   • Google         → uses NextAuth session (no "token" cookie, different mechanism)
// ─────────────────────────────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
  // ── 1. JWT cookie (email/password users) ────────────────────────────────────
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?:  string; role?:  string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return {
          userId,
          email: payload.email,
          name:  payload.name ?? "",
          role:  payload.role ?? "user",
        };
      }
    } catch {
      // Expired or tampered — fall through to NextAuth
    }
  }

  // ── 2. NextAuth session (Google users) ──────────────────────────────────────
  try {
    const session = await auth();
    const u = session?.user as {
      email?: string; userId?: string; name?: string; role?: string;
    } | undefined;

    if (u?.email) {
      return {
        userId: u.userId ?? u.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"),
        email:  u.email,
        name:   u.name  ?? "",
        role:   u.role  ?? "user",
      };
    }
  } catch {
    // NextAuth not available or session invalid
  }

  return null;
}

function getChatIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/");
  // /api/chats/[chatId]/messages  →  chatId is second-to-last segment
  return parts[parts.length - 2];
}

const VALID_TYPES = ["text", "image", "video", "audio", "file"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats/[chatId]/messages
//   ?limit=50
//   ?lastDocId=<id>
//   ?lastDocCreatedAt=<ms>
// Returns messages in chronological order (oldest → newest).
// Also resets unreadCount on the chat to 0 for the current user.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId;

    const chatId           = getChatIdFromUrl(req);
    const { searchParams } = new URL(req.url);
    const limit            = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const lastDocId        = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    // Verify chat + access
    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    if (!(chatDoc.data()?.participantIds as string[]).includes(CURRENT_USER_ID)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch messages newest-first (for efficient pagination), then reverse
    let query = db
      .collection("messages")
      .where("chatId", "==", chatId)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId && lastDocCreatedAt) {
      const lastRef = db.collection("messages").doc(lastDocId);
      const lastDoc = await lastRef.get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    // Chronological order for UI rendering
    const messages = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .reverse();

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Batch: mark unread messages as read + reset chat unreadCount
    const unreadDocs = snapshot.docs.filter(
      (doc) => !doc.data().isRead && doc.data().senderId !== CURRENT_USER_ID
    );
    if (unreadDocs.length > 0) {
      const batch = db.batch();
      unreadDocs.forEach((doc) => batch.update(doc.ref, { isRead: true }));
      batch.update(chatRef, { unreadCount: 0 });
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        hasMore: snapshot.docs.length === limit,
        nextCursor:
          snapshot.docs.length === limit
            ? {
                lastDocId:        lastDoc?.id,
                lastDocCreatedAt: lastDoc?.data()?.createdAt,
              }
            : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/chats/[chatId]/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chats/[chatId]/messages
// Send a message. Also updates the chat's lastMessageContent + lastMessageAt.
//
// Body: { content: string, type?: MessageType, replyToId?: string, mediaUrl?: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId;

    const chatId                                           = getChatIdFromUrl(req);
    const body                                             = await req.json();
    const { content, type = "text", replyToId, mediaUrl } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify chat + access
    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    if (!(chatDoc.data()?.participantIds as string[]).includes(CURRENT_USER_ID)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate replyToId belongs to this chat
    if (replyToId) {
      const replyDoc = await db.collection("messages").doc(replyToId).get();
      if (!replyDoc.exists || replyDoc.data()?.chatId !== chatId) {
        return NextResponse.json(
          { error: "Replied-to message not found in this chat" },
          { status: 404 }
        );
      }
    }

    const now = Date.now();
    const newMessage: Record<string, unknown> = {
      chatId,
      senderId:  CURRENT_USER_ID,
      type,
      content:   content.trim(),
      isRead:    false,
      createdAt: now,
      updatedAt: now,
    };

    if (replyToId) newMessage.replyToId = replyToId;
    if (mediaUrl)  newMessage.mediaUrl  = mediaUrl;

    const msgRef = await db.collection("messages").add(newMessage);

    // Update chat snapshot visible in the My Chats list row
    const otherCount = (chatDoc.data()?.participantIds as string[]).filter(
      (id) => id !== CURRENT_USER_ID
    ).length;

    await chatRef.update({
      lastMessageContent: content.trim(),
      lastMessageAt:      now,
      updatedAt:          now,
      unreadCount:        FieldValue.increment(otherCount),
    });

    return NextResponse.json(
      {
        success: true,
        id:      msgRef.id,
        message: { id: msgRef.id, ...newMessage },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/chats/[chatId]/messages error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}