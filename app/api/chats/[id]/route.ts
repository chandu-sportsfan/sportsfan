// // app/api/chats/[chatId]/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// function getIdFromUrl(req: NextRequest): string {
//   const parts = new URL(req.url).pathname.split("/");
//   return parts[parts.length - 1];
// }

// const CURRENT_USER_ID = "u3";

// // GET /api/chats/[chatId]

// export async function GET(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
//     }

//     const docRef = db.collection("chats").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Chat not found" }, { status: 404 });
//     }

//     const data = doc.data()!;
//     if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
//       return NextResponse.json({ error: "Access denied" }, { status: 403 });
//     }

//     return NextResponse.json({
//       success: true,
//       chat: { id: doc.id, ...data },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/chats/[chatId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }


// // PATCH /api/chats/[chatId]
// // Updatable fields: name (group only), isMuted, isPinned, avatarUrl

// export async function PATCH(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);
//     const body = await req.json();

//     if (!id) {
//       return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
//     }

//     const docRef = db.collection("chats").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Chat not found" }, { status: 404 });
//     }

//     const data = doc.data()!;
//     if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
//       return NextResponse.json({ error: "Access denied" }, { status: 403 });
//     }

//     if (body.name !== undefined && data.type !== "group") {
//       return NextResponse.json(
//         { error: "Cannot rename a DM conversation" },
//         { status: 400 }
//       );
//     }

//     if (body.isMuted !== undefined && typeof body.isMuted !== "boolean") {
//       return NextResponse.json({ error: "isMuted must be a boolean" }, { status: 400 });
//     }

//     if (body.isPinned !== undefined && typeof body.isPinned !== "boolean") {
//       return NextResponse.json({ error: "isPinned must be a boolean" }, { status: 400 });
//     }

//     const allowedFields = ["name", "isMuted", "isPinned", "avatarUrl"];
//     const updates: Record<string, unknown> = { updatedAt: Date.now() };

//     allowedFields.forEach((field) => {
//       if (body[field] !== undefined) updates[field] = body[field];
//     });

//     await docRef.update(updates);
//     const updated = await docRef.get();

//     return NextResponse.json({
//       success: true,
//       chat: { id: updated.id, ...updated.data() },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("PATCH /api/chats/[chatId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }


// // DELETE /api/chats/[chatId]
// // DM / group owner → hard delete
// // Group member     → removes self from participantIds (leave)

// export async function DELETE(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
//     }

//     const docRef = db.collection("chats").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Chat not found" }, { status: 404 });
//     }

//     const data = doc.data()!;
//     if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
//       return NextResponse.json({ error: "Access denied" }, { status: 403 });
//     }

//     // DM or owner of a group chat → delete entirely
//     if (data.type === "dm" || data.createdBy === CURRENT_USER_ID) {
//       await docRef.delete();
//       return NextResponse.json({
//         success: true,
//         message: `Chat ${id} deleted successfully`,
//       });
//     }

//     // Regular group member → leave (remove self from participants)
//     await docRef.update({
//       participantIds: (data.participantIds as string[]).filter(
//         (uid) => uid !== CURRENT_USER_ID
//       ),
//       updatedAt: Date.now(),
//     });

//     return NextResponse.json({ success: true, message: "Left the group chat" });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("DELETE /api/chats/[chatId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






// app/api/chats/[chatId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── Auth helper — direct JWT verification, same pattern as hostrooms API ──
async function getUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  let token: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = req.cookies.get("token")?.value ?? null;
  }

  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      email?: string;
      userId?: string;
      uid?: string;
      id?: string;
      name?: string;
      role?: string;
    };

    const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
    const email = payload.email ?? payload.userId ?? payload.uid ?? payload.id;
    if (!userId || !email) return null;

    return {
      userId,
      email,
      name: payload.name ?? "",
      role: payload.role ?? "user",
    };
  } catch {
    return null;
  }
}

function getIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/");
  return parts[parts.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats/[chatId]
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId ?? user.email;

    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    const docRef = db.collection("chats").doc(id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      chat:    { id: doc.id, ...data },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/chats/[chatId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/chats/[chatId]
// Updatable fields: name (group only), isMuted, isPinned, avatarUrl
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId ?? user.email;

    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    const body   = await req.json();
    const docRef = db.collection("chats").doc(id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (body.name !== undefined && data.type !== "group") {
      return NextResponse.json(
        { error: "Cannot rename a DM conversation" },
        { status: 400 }
      );
    }

    if (body.isMuted !== undefined && typeof body.isMuted !== "boolean") {
      return NextResponse.json({ error: "isMuted must be a boolean" }, { status: 400 });
    }

    if (body.isPinned !== undefined && typeof body.isPinned !== "boolean") {
      return NextResponse.json({ error: "isPinned must be a boolean" }, { status: 400 });
    }

    const allowedFields                    = ["name", "isMuted", "isPinned", "avatarUrl"];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) updates[field] = body[field];
    });

    await docRef.update(updates);
    const updated = await docRef.get();

    return NextResponse.json({
      success: true,
      chat:    { id: updated.id, ...updated.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/chats/[chatId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chats/[chatId]
// DM / group owner → hard delete
// Group member     → removes self from participantIds (leave)
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const CURRENT_USER_ID = user.userId ?? user.email;

    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    const docRef = db.collection("chats").doc(id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (!(data.participantIds as string[]).includes(CURRENT_USER_ID)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // DM or owner of a group chat → delete entirely
    if (data.type === "dm" || data.createdBy === CURRENT_USER_ID) {
      await docRef.delete();
      return NextResponse.json({
        success: true,
        message: `Chat ${id} deleted successfully`,
      });
    }

    // Regular group member → leave (remove self from participants)
    await docRef.update({
      participantIds: (data.participantIds as string[]).filter(
        (uid) => uid !== CURRENT_USER_ID
      ),
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true, message: "Left the group chat" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("DELETE /api/chats/[chatId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}