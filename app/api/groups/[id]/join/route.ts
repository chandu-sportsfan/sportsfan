// app/api/groups/[groupId]/join/route.ts


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore'

function getGroupIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/");
  // /api/groups/[groupId]/join  →  groupId is at index -2
  return parts[parts.length - 2];
}

const CURRENT_USER_ID = "u3";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/[groupId]/join
//
// Privacy rules (matching the UI badge colours):
//   public  (🌐 blue globe)    → instant join, 201
//   closed  (🔒 yellow lock)   → join request stored, 202 pending
//   private (🔒 yellow lock)   → invite only, 403
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const groupId = getGroupIdFromUrl(req);

    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const data = groupDoc.data()!;

    // Already a member?
    const memberRef = groupRef.collection("members").doc(CURRENT_USER_ID);
    const memberDoc = await memberRef.get();

    if (memberDoc.exists) {
      return NextResponse.json(
        { error: "Already a member of this group" },
        { status: 409 }
      );
    }

    // Private → invite only, cannot self-join
    if (data.privacy === "private") {
      return NextResponse.json(
        { error: "This group is private. You must be invited to join." },
        { status: 403 }
      );
    }

    // Closed → store a pending join request, notify admins out-of-band
    if (data.privacy === "closed") {
      await groupRef
        .collection("joinRequests")
        .doc(CURRENT_USER_ID)
        .set({ userId: CURRENT_USER_ID, status: "pending", requestedAt: Date.now() });

      return NextResponse.json(
        {
          success: true,
          status: "pending",
          message: "Join request sent. Awaiting admin approval.",
        },
        { status: 202 }
      );
    }

    // Public → instant join
    const now = Date.now();
    const batch = db.batch();

    batch.set(memberRef, { userId: CURRENT_USER_ID, role: "member", joinedAt: now });

    batch.update(groupRef, {
      memberCount: FieldValue.increment(1),
      memberIds: FieldValue.arrayUnion(CURRENT_USER_ID),
      lastActivityAt: now,
      updatedAt: now,
    });

    // Also add user to the linked chat room
    if (data.chatId) {
      batch.update(db.collection("chats").doc(data.chatId as string), {
        participantIds: FieldValue.arrayUnion(CURRENT_USER_ID),
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json(
      { success: true, status: "joined", message: `Joined "${data.name}"` },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/groups/[groupId]/join error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/[groupId]/join
// Leave a group. Owner must transfer ownership or delete the group first.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const groupId = getGroupIdFromUrl(req);

    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const data = groupDoc.data()!;
    const memberRef = groupRef.collection("members").doc(CURRENT_USER_ID);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 404 }
      );
    }

    if (memberDoc.data()?.role === "owner") {
      return NextResponse.json(
        { error: "Owner cannot leave. Transfer ownership or delete the group first." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const batch = db.batch();

    batch.delete(memberRef);
    batch.update(groupRef, {
      memberCount: FieldValue.increment(-1),
      memberIds: FieldValue.arrayRemove(CURRENT_USER_ID),
      updatedAt: now,
    });

    // Remove from linked chat too
    if (data.chatId) {
      batch.update(db.collection("chats").doc(data.chatId as string), {
        participantIds: FieldValue.arrayRemove(CURRENT_USER_ID),
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Left "${data.name}"`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("DELETE /api/groups/[groupId]/join error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}