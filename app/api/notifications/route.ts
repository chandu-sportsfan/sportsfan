import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── GET — fetch notifications for a user by email ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const snapshot = await db
      .collection("notifications")
      .where("recipientEmail", "==", email)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH — mark one or all notifications as read ───────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, action } = body;

    // Mark single notification as read
    if (action === "markRead" && id) {
      await db.collection("notifications").doc(id).update({
        isRead: true,
        readAt: Date.now(),
      });
      return NextResponse.json({ success: true });
    }

    // Mark all notifications as read for a user
    if (action === "markAllRead" && email) {
      const snapshot = await db
        .collection("notifications")
        .where("recipientEmail", "==", email)
        .where("isRead", "==", false)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ success: true, updated: 0 });
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true, readAt: Date.now() });
      });
      await batch.commit();

      return NextResponse.json({ success: true, updated: snapshot.size });
    }

    return NextResponse.json({ error: "Invalid action or missing fields" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE — clear one notification or all for a user ───────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, all } = body;

    // Delete single notification
    if (id && !all) {
      await db.collection("notifications").doc(id).delete();
      return NextResponse.json({ success: true });
    }

    // Delete all notifications for a user
    if (email && all) {
      const snapshot = await db
        .collection("notifications")
        .where("recipientEmail", "==", email)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ success: true, deleted: 0 });
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      return NextResponse.json({ success: true, deleted: snapshot.size });
    }

    return NextResponse.json(
      { error: "Provide id for single delete, or email + all:true for bulk delete" },
      { status: 400 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}