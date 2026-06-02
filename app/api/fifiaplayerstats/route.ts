// api/fifa-player-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FifaPlayerStatsCreateSchema, validateFifaPlayerStatsCreate } from "@/lib/validations/fifaPlayerStats";

// GET - List FIFA player stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const player = searchParams.get("player");
    const team = searchParams.get("team");
    const position = searchParams.get("position");
    const minGoals = searchParams.get("minGoals");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(Number(limitParam), 500)) : 100;

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection("fifaPlayerStats").orderBy("goals", "desc");

    if (player) {
      query = query.where("player", "==", player);
    }
    if (team) {
      query = query.where("team", "==", team);
    }
    if (position) {
      query = query.where("position", "==", position);
    }

    const snapshot = await query.limit(limit).get();
    let stats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (minGoals) {
      stats = stats.filter((s: any) => s.goals >= parseInt(minGoals));
    }

    return NextResponse.json({ success: true, stats, count: stats.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching FIFA player stats:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST - Create new FIFA player stats
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const validation = validateFifaPlayerStatsCreate(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const statsData = validation.data!;
    
    // Check for duplicate player-team combination
    const existing = await db.collection("fifaPlayerStats")
      .where("player", "==", statsData.player)
      .where("team", "==", statsData.team)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      return NextResponse.json(
        { success: false, error: `Stats for ${statsData.player} (${statsData.team}) already exist` },
        { status: 409 }
      );
    }
    
    const newStats = {
      ...statsData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const docRef = await db.collection("fifaPlayerStats").add(newStats);
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      stats: { id: docRef.id, ...newStats },
    }, { status: 201 });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error creating FIFA player stats:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}