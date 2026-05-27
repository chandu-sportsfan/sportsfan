// // app/api/groups/[groupId]/join/route.ts


// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from 'firebase-admin/firestore'

// function getGroupIdFromUrl(req: NextRequest): string {
//   const parts = new URL(req.url).pathname.split("/");
//   // /api/groups/[groupId]/join  →  groupId is at index -2
//   return parts[parts.length - 2];
// }

// const CURRENT_USER_ID = "u3";

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/groups/[groupId]/join
// //
// // Privacy rules (matching the UI badge colours):
// //   public  (🌐 blue globe)    → instant join, 201
// //   closed  (🔒 yellow lock)   → join request stored, 202 pending
// //   private (🔒 yellow lock)   → invite only, 403
// // ─────────────────────────────────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const groupId = getGroupIdFromUrl(req);

//     const groupRef = db.collection("groups").doc(groupId);
//     const groupDoc = await groupRef.get();

//     if (!groupDoc.exists) {
//       return NextResponse.json({ error: "Group not found" }, { status: 404 });
//     }

//     const data = groupDoc.data()!;

//     // Already a member?
//     const memberRef = groupRef.collection("members").doc(CURRENT_USER_ID);
//     const memberDoc = await memberRef.get();

//     if (memberDoc.exists) {
//       return NextResponse.json(
//         { error: "Already a member of this group" },
//         { status: 409 }
//       );
//     }

//     // Private → invite only, cannot self-join
//     if (data.privacy === "private") {
//       return NextResponse.json(
//         { error: "This group is private. You must be invited to join." },
//         { status: 403 }
//       );
//     }

//     // Closed → store a pending join request, notify admins out-of-band
//     if (data.privacy === "closed") {
//       await groupRef
//         .collection("joinRequests")
//         .doc(CURRENT_USER_ID)
//         .set({ userId: CURRENT_USER_ID, status: "pending", requestedAt: Date.now() });

//       return NextResponse.json(
//         {
//           success: true,
//           status: "pending",
//           message: "Join request sent. Awaiting admin approval.",
//         },
//         { status: 202 }
//       );
//     }

//     // Public → instant join
//     const now = Date.now();
//     const batch = db.batch();

//     batch.set(memberRef, { userId: CURRENT_USER_ID, role: "member", joinedAt: now });

//     batch.update(groupRef, {
//       memberCount: FieldValue.increment(1),
//       memberIds: FieldValue.arrayUnion(CURRENT_USER_ID),
//       lastActivityAt: now,
//       updatedAt: now,
//     });

//     // Also add user to the linked chat room
//     if (data.chatId) {
//       batch.update(db.collection("chats").doc(data.chatId as string), {
//         participantIds: FieldValue.arrayUnion(CURRENT_USER_ID),
//         updatedAt: now,
//       });
//     }

//     await batch.commit();

//     return NextResponse.json(
//       { success: true, status: "joined", message: `Joined "${data.name}"` },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/groups/[groupId]/join error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // DELETE /api/groups/[groupId]/join
// // Leave a group. Owner must transfer ownership or delete the group first.
// // ─────────────────────────────────────────────────────────────────────────────
// export async function DELETE(req: NextRequest) {
//   try {
//     const groupId = getGroupIdFromUrl(req);

//     const groupRef = db.collection("groups").doc(groupId);
//     const groupDoc = await groupRef.get();

//     if (!groupDoc.exists) {
//       return NextResponse.json({ error: "Group not found" }, { status: 404 });
//     }

//     const data = groupDoc.data()!;
//     const memberRef = groupRef.collection("members").doc(CURRENT_USER_ID);
//     const memberDoc = await memberRef.get();

//     if (!memberDoc.exists) {
//       return NextResponse.json(
//         { error: "You are not a member of this group" },
//         { status: 404 }
//       );
//     }

//     if (memberDoc.data()?.role === "owner") {
//       return NextResponse.json(
//         { error: "Owner cannot leave. Transfer ownership or delete the group first." },
//         { status: 400 }
//       );
//     }

//     const now = Date.now();
//     const batch = db.batch();

//     batch.delete(memberRef);
//     batch.update(groupRef, {
//       memberCount: FieldValue.increment(-1),
//       memberIds: FieldValue.arrayRemove(CURRENT_USER_ID),
//       updatedAt: now,
//     });

//     // Remove from linked chat too
//     if (data.chatId) {
//       batch.update(db.collection("chats").doc(data.chatId as string), {
//         participantIds: FieldValue.arrayRemove(CURRENT_USER_ID),
//         updatedAt: now,
//       });
//     }

//     await batch.commit();

//     return NextResponse.json({
//       success: true,
//       message: `Left "${data.name}"`,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("DELETE /api/groups/[groupId]/join error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






// app/api/groups/[groupId]/join/route.ts  — BACKEND
// POST  → join group (or request to join if closed)
// DELETE → leave group

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
  // /api/groups/[groupId]/join  →  groupId is 3rd from end
  return parts[parts.length - 2];
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/[groupId]/join
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groupId  = getGroupIdFromUrl(req);
    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const groupData = groupDoc.data()!;

    // Already a member?
    const existingMember = await groupRef.collection("members").doc(user.userId).get();
    if (existingMember.exists && existingMember.data()?.status !== "pending") {
      return NextResponse.json({ success: true, status: "joined", message: "Already a member" });
    }

    const now = Date.now();

    if (groupData.privacy === "closed") {
      // Request to join — pending approval
      await groupRef.collection("members").doc(user.userId).set({
        userId:    user.userId,
        email:     user.email,
        name:      user.name,
        role:      "member",
        status:    "pending",
        joinedAt:  now,
      });
      return NextResponse.json({ success: true, status: "pending", message: "Join request sent" });
    }

    if (groupData.privacy === "private") {
      return NextResponse.json({ error: "This group is private — invite only" }, { status: 403 });
    }

    // Public group — join immediately
    await groupRef.collection("members").doc(user.userId).set({
      userId:   user.userId,
      email:    user.email,
      name:     user.name,
      role:     "member",
      status:   "active",
      joinedAt: now,
    });

    await groupRef.update({
      memberCount:    (groupData.memberCount ?? 0) + 1,
      lastActivityAt: now,
      updatedAt:      now,
    });

    return NextResponse.json({ success: true, status: "joined", message: "Joined group successfully" });
  } catch (error: unknown) {
    console.error("POST /api/groups/[groupId]/join error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/[groupId]/join   — leave group
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groupId  = getGroupIdFromUrl(req);
    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const memberDoc = await groupRef.collection("members").doc(user.userId).get();
    if (!memberDoc.exists) return NextResponse.json({ error: "You are not a member" }, { status: 400 });

    if (memberDoc.data()?.role === "owner") {
      return NextResponse.json({ error: "Owner cannot leave — delete the group instead" }, { status: 400 });
    }

    await groupRef.collection("members").doc(user.userId).delete();
    await groupRef.update({
      memberCount: Math.max(0, (groupDoc.data()?.memberCount ?? 1) - 1),
      updatedAt:   Date.now(),
    });

    return NextResponse.json({ success: true, message: "Left group successfully" });
  } catch (error: unknown) {
    console.error("DELETE /api/groups/[groupId]/join error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}