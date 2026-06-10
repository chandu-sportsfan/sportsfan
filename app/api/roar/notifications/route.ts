import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Notification } from "@/app/models/Notification";

async function getResolvedUserId(user: { email: string; userId: string }) {
  let resolvedUserId = user.email;
  let userSnap = await db.collection("users").doc(user.email).get();
  if (!userSnap.exists) {
    userSnap = await db.collection("users").doc(user.userId).get();
    if (userSnap.exists) {
      resolvedUserId = user.userId;
    }
  }
  return resolvedUserId;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedUserId = await getResolvedUserId(user);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    let query = db
      .collection("notifications")
      .doc(resolvedUserId)
      .collection("items")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (unreadOnly) query = query.where("read", "==", false);

    if (lastDocId) {
      const lastDoc = await db
        .collection("notifications")
        .doc(resolvedUserId)
        .collection("items")
        .doc(lastDocId)
        .get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const notifications: Notification[] = snapshot.docs.map((doc) => ({
      ...(doc.data() as Notification),
      notifId: doc.id,
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      pagination: {
        limit,
        hasMore: notifications.length === limit,
        nextCursor:
          notifications.length === limit ? { lastDocId: lastDoc?.id } : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/roar/notifications  body: { notifId?: string, markAll?: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedUserId = await getResolvedUserId(user);

    const body = await req.json();
    const { notifId, markAll } = body;

    const baseRef = db
      .collection("notifications")
      .doc(resolvedUserId)
      .collection("items");

    if (markAll) {
      const unread = await baseRef.where("read", "==", false).get();
      const batch = db.batch();
      unread.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
      await batch.commit();
      return NextResponse.json({ success: true, updated: unread.size });
    }

    if (notifId) {
      await baseRef.doc(notifId).update({ read: true });
      return NextResponse.json({ success: true, updated: 1 });
    }

    return NextResponse.json(
      { error: "Provide notifId or markAll: true" },
      { status: 400 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/roar/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedUserId = await getResolvedUserId(user);

    const body = await req.json();
    const { notifId } = body;

    if (notifId) {
      await db
        .collection("notifications")
        .doc(resolvedUserId)
        .collection("items")
        .doc(notifId)
        .delete();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide notifId" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("DELETE /api/roar/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
