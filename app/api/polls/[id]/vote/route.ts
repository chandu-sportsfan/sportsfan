import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { VoteBody, PollOption } from "@/types/polls";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unknown error occurred";
}

function getIdFromUrl(req: NextRequest): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1];
}

// ─── POST /api/polls/:id/vote ─────────────────────────────────────────────────


export async function POST(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Poll ID is required" }, { status: 400 });
    }
    const body: VoteBody = await req.json();

    if (!body.optionId) {
      return NextResponse.json({ success: false, error: "optionId is required" }, { status: 400 });
    }

    const ref = db.collection("polls").doc(id);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Poll not found");

      const data = snap.data()!;
      if (!data.active) throw new Error("Poll is closed");

      if ((data.endsAt as Timestamp).toDate() < new Date()) {
        tx.update(ref, { active: false });
        throw new Error("Poll has expired");
      }

      const options: PollOption[] = data.options;
      const optionIndex = options.findIndex((o) => o.id === body.optionId);
      if (optionIndex === -1) throw new Error("Option not found");

      options[optionIndex].votes += 1;
      tx.update(ref, { options });

      return options;
    });

    return NextResponse.json({ success: true, data: { options: result } });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    const status =
      message === "Poll not found" ? 404 :
      message === "Poll is closed" || message === "Poll has expired" ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}