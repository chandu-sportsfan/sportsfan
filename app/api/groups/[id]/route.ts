// app/api/groups/[groupId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

function getIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/");
  return parts[parts.length - 1];
}

const CURRENT_USER_ID = "u3";
const VALID_PRIVACY = ["public", "closed", "private"] as const;

async function getCallerRole(groupId: string): Promise<string | null> {
  const doc = await db
    .collection("groups")
    .doc(groupId)
    .collection("members")
    .doc(CURRENT_USER_ID)
    .get();
  return doc.exists ? (doc.data()?.role as string) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/[groupId]
// Full group detail — shown when a user taps a group card
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    }

    const docRef = db.collection("groups").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      group: { id: doc.id, ...doc.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/groups/[groupId]
// Update group details — admin/owner only
// Allowed: name, description, privacy, category, tags, avatarUrl, coverUrl
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    }

    const role = await getCallerRole(id);
    if (!role || !["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Admin or owner permission required" },
        { status: 403 }
      );
    }

    const docRef = db.collection("groups").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (body.privacy && !VALID_PRIVACY.includes(body.privacy)) {
      return NextResponse.json(
        { error: "privacy must be public, closed, or private" },
        { status: 400 }
      );
    }

    if (body.tags !== undefined && !Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }

    const allowedFields = ["name", "description", "privacy", "category", "tags", "avatarUrl", "coverUrl"];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) updates[field] = body[field];
    });

    if (body.tags) {
      updates.tags = (body.tags as string[]).map((t) => t.toLowerCase());
    }

    await docRef.update(updates);
    const updated = await docRef.get();

    return NextResponse.json({
      success: true,
      group: { id: updated.id, ...updated.data() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/[groupId]
// Owner only — deletes the group, its members subcollection, and the linked chat
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    }

    const role = await getCallerRole(id);
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Only the group owner can delete a group" },
        { status: 403 }
      );
    }

    const docRef = db.collection("groups").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { chatId } = doc.data() as { chatId?: string };

    // Delete members subcollection + group doc in one batch
    const membersSnap = await docRef.collection("members").get();
    const batch = db.batch();
    membersSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(docRef);

    // Also delete the linked chat room if present
    if (chatId) {
      batch.delete(db.collection("chats").doc(chatId));
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Group ${id} deleted successfully`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("DELETE /api/groups/[groupId] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}