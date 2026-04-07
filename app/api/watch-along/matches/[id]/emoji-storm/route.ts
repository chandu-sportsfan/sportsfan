import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type RouteContext = { params: Promise<{ id: string }> };

/* ─────────────────────────────────────────────
   Firestore structure:
   watchAlongMatches/{id}/emojiReactions/counts
   {
     "🔥": 8421,
     "💪": 6234,
     ...
     updatedAt: number
   }

   Single document with one field per emoji —
   FieldValue.increment keeps concurrent taps safe
   without needing transactions.
   ───────────────────────────────────────────── */

const ALLOWED_EMOJIS = new Set([
  "🔥","💪","😱","🏏","👏","🎉","❤️","🚀","😮","🤩",
]);

/* ─────────────────────────────────────────────
   GET  /api/watch-along/matches/[id]/emoji-storm
   Returns aggregated emoji reaction counts
   ───────────────────────────────────────────── */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const matchRef = db.collection("watchAlongMatches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    const countsRef = matchRef.collection("emojiReactions").doc("counts");
    const countsDoc = await countsRef.get();

    if (!countsDoc.exists) {
      const empty: Record<string, number> = {};
      ALLOWED_EMOJIS.forEach((e) => { empty[e] = 0; });
      return NextResponse.json({ success: true, reactions: empty });
    }

    const { updatedAt, ...reactions } = countsDoc.data() as Record<string, unknown>;
    void updatedAt;

    return NextResponse.json({ success: true, reactions });
  } catch (error) {
    console.error("[emoji-storm GET]", error);
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────
   POST  /api/watch-along/matches/[id]/emoji-storm
   Send one or more emoji reactions (max 10 per request)
   Body: { emoji: string }
     or  { emojis: string[] }
   ───────────────────────────────────────────── */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();

    const raw: string[] = body.emojis
      ? body.emojis
      : body.emoji
      ? [body.emoji]
      : [];

    if (raw.length === 0) {
      return NextResponse.json(
        { success: false, message: "Provide emoji or emojis[]" },
        { status: 400 }
      );
    }
    if (raw.length > 10) {
      return NextResponse.json(
        { success: false, message: "Max 10 emojis per request" },
        { status: 400 }
      );
    }

    const invalid = raw.filter((e) => !ALLOWED_EMOJIS.has(e));
    if (invalid.length > 0) {
      return NextResponse.json(
        { success: false, message: `Unsupported emoji(s): ${invalid.join(" ")}` },
        { status: 400 }
      );
    }

    const matchRef = db.collection("watchAlongMatches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    // Tally duplicates locally → one Firestore write
    const tally: Record<string, number> = {};
    for (const e of raw) tally[e] = (tally[e] || 0) + 1;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [emoji, count] of Object.entries(tally)) {
      updates[emoji] = FieldValue.increment(count);
    }

    const countsRef = matchRef.collection("emojiReactions").doc("counts");
    await countsRef.set(updates, { merge: true });

    const updated = await countsRef.get();
    const { updatedAt, ...reactions } = updated.data() as Record<string, unknown>;
    void updatedAt;

    return NextResponse.json({ success: true, reactions });
  } catch (error) {
    console.error("[emoji-storm POST]", error);
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────
   DELETE  /api/watch-along/matches/[id]/emoji-storm
   Admin: reset all emoji counts for the match
   ───────────────────────────────────────────── */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const matchRef = db.collection("watchAlongMatches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    const reset: Record<string, unknown> = { updatedAt: Date.now() };
    ALLOWED_EMOJIS.forEach((e) => { reset[e] = 0; });

    await matchRef.collection("emojiReactions").doc("counts").set(reset);

    return NextResponse.json({ success: true, message: "Emoji counts reset" });
  } catch (error) {
    console.error("[emoji-storm DELETE]", error);
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}