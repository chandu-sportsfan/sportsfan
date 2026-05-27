// // app/api/groups/[groupId]/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// function getIdFromUrl(req: NextRequest): string {
//   const parts = new URL(req.url).pathname.split("/");
//   return parts[parts.length - 1];
// }

// const CURRENT_USER_ID = "u3";
// const VALID_PRIVACY = ["public", "closed", "private"] as const;

// async function getCallerRole(groupId: string): Promise<string | null> {
//   const doc = await db
//     .collection("groups")
//     .doc(groupId)
//     .collection("members")
//     .doc(CURRENT_USER_ID)
//     .get();
//   return doc.exists ? (doc.data()?.role as string) : null;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // GET /api/groups/[groupId]
// // Full group detail — shown when a user taps a group card
// // ─────────────────────────────────────────────────────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
//     }

//     const docRef = db.collection("groups").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Group not found" }, { status: 404 });
//     }

//     return NextResponse.json({
//       success: true,
//       group: { id: doc.id, ...doc.data() },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/groups/[groupId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // PATCH /api/groups/[groupId]
// // Update group details — admin/owner only
// // Allowed: name, description, privacy, category, tags, avatarUrl, coverUrl
// // ─────────────────────────────────────────────────────────────────────────────
// export async function PATCH(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);
//     const body = await req.json();

//     if (!id) {
//       return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
//     }

//     const role = await getCallerRole(id);
//     if (!role || !["owner", "admin"].includes(role)) {
//       return NextResponse.json(
//         { error: "Admin or owner permission required" },
//         { status: 403 }
//       );
//     }

//     const docRef = db.collection("groups").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Group not found" }, { status: 404 });
//     }

//     if (body.privacy && !VALID_PRIVACY.includes(body.privacy)) {
//       return NextResponse.json(
//         { error: "privacy must be public, closed, or private" },
//         { status: 400 }
//       );
//     }

//     if (body.tags !== undefined && !Array.isArray(body.tags)) {
//       return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
//     }

//     const allowedFields = ["name", "description", "privacy", "category", "tags", "avatarUrl", "coverUrl"];
//     const updates: Record<string, unknown> = { updatedAt: Date.now() };

//     allowedFields.forEach((field) => {
//       if (body[field] !== undefined) updates[field] = body[field];
//     });

//     if (body.tags) {
//       updates.tags = (body.tags as string[]).map((t) => t.toLowerCase());
//     }

//     await docRef.update(updates);
//     const updated = await docRef.get();

//     return NextResponse.json({
//       success: true,
//       group: { id: updated.id, ...updated.data() },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("PATCH /api/groups/[groupId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // DELETE /api/groups/[groupId]
// // Owner only — deletes the group, its members subcollection, and the linked chat
// // ─────────────────────────────────────────────────────────────────────────────
// export async function DELETE(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
//     }

//     const role = await getCallerRole(id);
//     if (role !== "owner") {
//       return NextResponse.json(
//         { error: "Only the group owner can delete a group" },
//         { status: 403 }
//       );
//     }

//     const docRef = db.collection("groups").doc(id);
//     const doc = await docRef.get();

//     if (!doc.exists) {
//       return NextResponse.json({ error: "Group not found" }, { status: 404 });
//     }

//     const { chatId } = doc.data() as { chatId?: string };

//     // Delete members subcollection + group doc in one batch
//     const membersSnap = await docRef.collection("members").get();
//     const batch = db.batch();
//     membersSnap.docs.forEach((d) => batch.delete(d.ref));
//     batch.delete(docRef);

//     // Also delete the linked chat room if present
//     if (chatId) {
//       batch.delete(db.collection("chats").doc(chatId));
//     }

//     await batch.commit();

//     return NextResponse.json({
//       success: true,
//       message: `Group ${id} deleted successfully`,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("DELETE /api/groups/[groupId] error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }







// app/api/groups/[groupId]/route.ts  — BACKEND

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

async function getUser(req: NextRequest) {
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string; name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
    } catch {}
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string; name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
    } catch {}
  }
  return null;
}

function getGroupIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/");
  return parts[parts.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/[groupId]
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groupId = getGroupIdFromUrl(req);
    const doc     = await db.collection("groups").doc(groupId).get();

    if (!doc.exists) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    return NextResponse.json({ success: true, group: { id: doc.id, ...doc.data() } });
  } catch (error: unknown) {
    console.error("GET /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/groups/[groupId]   — update group (owner/admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groupId = getGroupIdFromUrl(req);
    const groupRef = db.collection("groups").doc(groupId);
    const doc      = await groupRef.get();

    if (!doc.exists) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    // Check membership role
    const memberDoc = await groupRef.collection("members").doc(user.userId).get();
    const role      = memberDoc.data()?.role;
    if (!memberDoc.exists || !["owner", "admin"].includes(role)) {
      return NextResponse.json({ error: "Only owners and admins can update this group" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["name", "description", "privacy", "category", "tags", "avatarUrl", "chatId"];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });

    await groupRef.update(updates);
    const updated = await groupRef.get();

    return NextResponse.json({ success: true, group: { id: updated.id, ...updated.data() } });
  } catch (error: unknown) {
    console.error("PATCH /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/[groupId]   — owner deletes group, others leave
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groupId  = getGroupIdFromUrl(req);
    const groupRef = db.collection("groups").doc(groupId);
    const doc      = await groupRef.get();

    if (!doc.exists) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const memberDoc = await groupRef.collection("members").doc(user.userId).get();
    if (!memberDoc.exists) return NextResponse.json({ error: "You are not a member" }, { status: 403 });

    if (memberDoc.data()?.role === "owner") {
      // Owner deletes the whole group
      await groupRef.delete();
      return NextResponse.json({ success: true, message: "Group deleted" });
    }

    // Non-owner leaves
    await groupRef.collection("members").doc(user.userId).delete();
    await groupRef.update({ memberCount: Math.max(0, (doc.data()?.memberCount ?? 1) - 1), updatedAt: Date.now() });

    return NextResponse.json({ success: true, message: "Left group" });
  } catch (error: unknown) {
    console.error("DELETE /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}