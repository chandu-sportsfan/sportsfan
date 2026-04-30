import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unknown error occurred";
}

type PollUpdates = {
  title?: string;
  active?: boolean;
  endsAt?: Timestamp;
};

function getIdFromUrl(req: NextRequest): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1];
}

// GET - Fetch single article by ID
export async function GET(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Poll ID is required" }, { status: 400 });
    }

    const snap = await db.collection("polls").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: "Poll not found" }, { status: 404 });
    }
    const data = snap.data()!;
    return NextResponse.json({
      success: true,
      data: {
        id: snap.id,
        ...data,
        endsAt: (data.endsAt as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  }
}

// ─── PUT /api/polls/:id ───────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Poll ID is required" }, { status: 400 });
    }
    const ref = db.collection("polls").doc(id);

    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: "Poll not found" }, { status: 404 });
    }

    const updates: PollUpdates = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.active !== undefined) updates.active = body.active;
    if (body.endsAt !== undefined) updates.endsAt = Timestamp.fromDate(new Date(body.endsAt));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    await ref.update(updates);

    const updated = await ref.get();
    const d = updated.data()!;
    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        ...d,
        endsAt: (d.endsAt as Timestamp).toDate().toISOString(),
        createdAt: (d.createdAt as Timestamp).toDate().toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  }
}

// ─── DELETE /api/polls/:id ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);
    // const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Poll ID is required" }, { status: 400 });
    }
    const ref = db.collection("polls").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: "Poll not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ success: true, message: "Poll deleted" });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  }
}