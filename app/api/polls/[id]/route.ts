import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { UpdatePollBody } from "@/types/polls";

type Params = { params: { id: string } };

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unknown error occurred";
}

type PollUpdates = {
  title?: string;
  active?: boolean;
  endsAt?: Timestamp;
};

// ─── GET /api/polls/:id ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const snap = await db.collection("polls").doc(params.id).get();
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
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const body: UpdatePollBody = await req.json();
    const ref = db.collection("polls").doc(params.id);

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
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ref = db.collection("polls").doc(params.id);
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