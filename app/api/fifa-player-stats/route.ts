// api/fifa-player-stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { validateFifaPlayerStatsCreate } from "@/lib/validations/fifaPlayerStatsValidation";
import { validateFifaPlayerStatsRecord } from "@/lib/ingestion/fifaPlayerStatsRules";

// GET /api/fifa-player-stats
// Query params: tournament, team, position, season, limit, after
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournament = searchParams.get("tournament");
  const team = searchParams.get("team");
  const position = searchParams.get("position");
  const season = searchParams.get("season");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 500);
  const after = searchParams.get("after");

  try {
    let query: FirebaseFirestore.Query = db.collection("fifaPlayerStats").orderBy("player_name");

    if (tournament) query = query.where("tournament", "==", tournament);
    if (team) query = query.where("team", "==", team);
    if (position) query = query.where("position", "==", position);
    if (season) query = query.where("season", "==", parseInt(season, 10));

    if (after) {
      const cursorDoc = await db.collection("fifaPlayerStats").doc(after).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    query = query.limit(limit);
    const snap = await query.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return NextResponse.json({ success: true, data, nextCursor, count: data.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/fifa-player-stats — single manual entry
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const injection = validateFifaPlayerStatsRecord(body);
  if (!injection.valid) {
    return NextResponse.json({ success: false, errors: injection.errors }, { status: 422 });
  }

  const schema = validateFifaPlayerStatsCreate(body);
  if (!schema.success) {
    return NextResponse.json({ success: false, errors: schema.errors }, { status: 422 });
  }

  const stat = schema.data!;

  const existing = await db
    .collection("fifaPlayerStats")
    .where("player_name", "==", stat.player_name)
    .where("tournament", "==", stat.tournament)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json(
      { success: false, error: `${stat.player_name} already exists for ${stat.tournament}` },
      { status: 409 }
    );
  }

  const docRef = await db.collection("fifaPlayerStats").add({
    ...stat,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
}