// // app/api/groups/route.ts
// // Powers the "Discover Groups" tab

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// const CURRENT_USER_ID = "u3";
// const VALID_PRIVACY = ["public", "closed", "private"] as const;

// // ─────────────────────────────────────────────────────────────────────────────
// // GET /api/groups
// // Discover Groups list — all groups, filterable and searchable
// //
// // Query params:
// //   ?privacy=public|closed|private
// //   ?trending=true                    → only groups with isTrending: true
// //   ?category=Announcement            → filter by category field
// //   ?joined=true                      → only groups the current user has joined
// //   ?limit=20
// //   ?lastDocId=<id>
// //   ?lastDocAt=<ms>
// // ─────────────────────────────────────────────────────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
//     const privacy = searchParams.get("privacy");
//     const trending = searchParams.get("trending");
//     const category = searchParams.get("category");
//     const joined = searchParams.get("joined");
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocAt = searchParams.get("lastDocAt");

//     // Base query — joined=true switches the filter field
//     let query =
//       joined === "true"
//         ? db
//             .collection("groups")
//             .where("memberIds", "array-contains", CURRENT_USER_ID)
//             .orderBy("lastActivityAt", "desc")
//         : db.collection("groups").orderBy("lastActivityAt", "desc");

//     if (privacy && VALID_PRIVACY.includes(privacy as typeof VALID_PRIVACY[number])) {
//       query = query.where("privacy", "==", privacy);
//     }

//     if (trending === "true") {
//       query = query.where("isTrending", "==", true);
//     }

//     if (category) {
//       query = query.where("category", "==", category);
//     }

//     query = query.limit(limit);

//     // Cursor pagination (matches cricket articles pattern)
//     if (lastDocId && lastDocAt) {
//       const lastRef = db.collection("groups").doc(lastDocId);
//       const lastDoc = await lastRef.get();
//       if (lastDoc.exists) query = query.startAfter(lastDoc);
//     }

//     const snapshot = await query.get();
//     const groups = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       groups,
//       pagination: {
//         limit,
//         hasMore: groups.length === limit,
//         nextCursor:
//           groups.length === limit
//             ? {
//                 lastDocId: lastDoc?.id,
//                 lastDocAt: lastDoc?.data()?.lastActivityAt,
//               }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/groups error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/groups
// // Create a new group (also creates a linked chat room)
// //
// // Body: { name, description?, privacy, category?, tags?, avatarUrl?, coverUrl? }
// // ─────────────────────────────────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { name, description, privacy = "public", category, tags, avatarUrl, coverUrl } = body;

//     if (!name || typeof name !== "string" || !name.trim()) {
//       return NextResponse.json({ error: "name is required" }, { status: 400 });
//     }

//     if (!VALID_PRIVACY.includes(privacy)) {
//       return NextResponse.json(
//         { error: "privacy must be public, closed, or private" },
//         { status: 400 }
//       );
//     }

//     if (tags !== undefined && !Array.isArray(tags)) {
//       return NextResponse.json(
//         { error: "tags must be an array of strings" },
//         { status: 400 }
//       );
//     }

//     const now = Date.now();

//     // 1. Create the group doc
//     const newGroup = {
//       name: name.trim(),
//       description: description?.trim() ?? "",
//       privacy,
//       category: category ?? "",
//       tags: Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase()) : [],
//       avatarUrl: avatarUrl ?? "",
//       coverUrl: coverUrl ?? "",
//       memberCount: 1,
//       memberIds: [CURRENT_USER_ID],   // used for array-contains queries
//       isTrending: false,
//       isVerified: false,
//       createdBy: CURRENT_USER_ID,
//       lastActivityAt: now,
//       createdAt: now,
//       updatedAt: now,
//     };

//     const groupRef = await db.collection("groups").add(newGroup);

//     // 2. Auto-add creator to the members subcollection as owner
//     await groupRef.collection("members").doc(CURRENT_USER_ID).set({
//       userId: CURRENT_USER_ID,
//       role: "owner",
//       joinedAt: now,
//     });

//     // 3. Create a linked group chat room
//     const chatDoc = {
//       type: "group",
//       name: name.trim(),
//       participantIds: [CURRENT_USER_ID],
//       lastMessageContent: "",
//       lastMessageAt: now,
//       unreadCount: 0,
//       isOnline: false,
//       isVerified: false,
//       isPinned: false,
//       isMuted: false,
//       groupId: groupRef.id,
//       createdBy: CURRENT_USER_ID,
//       createdAt: now,
//       updatedAt: now,
//     };

//     const chatRef = await db.collection("chats").add(chatDoc);

//     // 4. Link the chat back onto the group
//     await groupRef.update({ chatId: chatRef.id });

//     return NextResponse.json(
//       {
//         success: true,
//         id: groupRef.id,
//         group: { id: groupRef.id, ...newGroup, chatId: chatRef.id },
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/groups error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }





// app/api/groups/route.ts  — BACKEND
// Collections used:
//   • "groups"  — group metadata (name, description, privacy, memberCount, etc.)
//   • "groupMembers" — subcollection per group: groups/{groupId}/members/{userId}

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
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
    } catch {}
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups
//   ?privacy=public|closed|private
//   ?trending=true
//   ?joined=true          ← only groups the current user is a member of
//   ?category=<string>
//   ?limit=20
//   ?lastDocId=<id>
//   ?lastDocAt=<ms>
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
     console.log("[GET /api/groups] user:", user ? user.userId : "NULL — UNAUTHORIZED");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const privacy  = searchParams.get("privacy");
    const trending = searchParams.get("trending") === "true";
    const joined   = searchParams.get("joined")   === "true";
    const category = searchParams.get("category");
    const limit    = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");
    const lastDocAt = searchParams.get("lastDocAt");

    // ── "joined" filter: fetch memberships first ─────────────────────────────
    if (joined) {
      const memberSnap = await db
        .collectionGroup("members")
        .where("userId", "==", user.userId)
        .get();

      const groupIds = memberSnap.docs.map(d => d.ref.parent.parent!.id);
      if (groupIds.length === 0) {
        return NextResponse.json({
          success: true, groups: [],
          pagination: { limit, hasMore: false, nextCursor: null },
        });
      }

      // Firestore "in" supports max 30 — chunk if needed
      const chunks: string[][] = [];
      for (let i = 0; i < groupIds.length; i += 30) chunks.push(groupIds.slice(i, i + 30));

      const groups: FirebaseFirestore.DocumentData[] = [];
      for (const chunk of chunks) {
        const snap = await db.collection("groups").where("__name__", "in", chunk).get();
        snap.docs.forEach(d => groups.push({ id: d.id, ...d.data() }));
      }

      return NextResponse.json({
        success: true, groups,
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // ── Normal listing ───────────────────────────────────────────────────────
    let query: FirebaseFirestore.Query = db.collection("groups");

    if (privacy) query = query.where("privacy", "==", privacy);
    if (trending) query = query.where("isTrending", "==", true);
    if (category) query = query.where("category",  "==", category);

    query = query.orderBy("lastActivityAt", "desc").limit(limit);

    if (lastDocId && lastDocAt) {
      const lastRef = db.collection("groups").doc(lastDocId);
      const lastDoc = await lastRef.get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const groups   = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastDoc  = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      groups,
      pagination: {
        limit,
        hasMore: groups.length === limit,
        nextCursor:
          groups.length === limit
            ? { lastDocId: lastDoc?.id, lastDocAt: lastDoc?.data()?.lastActivityAt }
            : null,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups   — create a group
// Body: { name, description?, privacy?, category?, tags? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // try {
  //   const user = await getUser(req);
  //   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  //   const body = await req.json();
  //   const { name, description = "", privacy = "public", category = "", tags = [] } = body;

  //   if (!name?.trim()) {
  //     return NextResponse.json({ error: "name is required" }, { status: 400 });
  //   }
  console.log("[POST /api/groups] called");
  try {
    const user = await getUser(req);
    console.log("[POST /api/groups] user:", user ? user.userId : "NULL — UNAUTHORIZED");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    console.log("[POST /api/groups] body:", body);
    const { name, description = "", privacy = "public", category = "", tags = [] } = body;

    if (!name?.trim()) {
      console.log("[POST /api/groups] ERROR: name missing");
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const now = Date.now();
    const newGroup = {
      name:           name.trim(),
      description:    description.trim(),
      privacy,
      category,
      tags:           Array.isArray(tags) ? tags : [],
      memberCount:    1,
      isTrending:     false,
      isVerified:     false,
      lastActivityAt: now,
      createdBy:      user.userId,
      createdAt:      now,
      updatedAt:      now,
    };

    const groupRef = await db.collection("groups").add(newGroup);

    // Add creator as owner member
    await groupRef.collection("members").doc(user.userId).set({
      userId:   user.userId,
      email:    user.email,
      name:     user.name,
      role:     "owner",
      joinedAt: now,
    });

    return NextResponse.json(
      { success: true, id: groupRef.id, group: { id: groupRef.id, ...newGroup } },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/groups error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}