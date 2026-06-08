import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Leaderboard, LeaderboardEntry } from "@/app/models/LeaderboardEntry";

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // period: "all_time" | "this_month" | "cricket" | "football"
    const period = searchParams.get("period") ?? "all_time";

    const validPeriods = ["all_time", "this_month", "cricket", "football"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    // Map UI tab name -> Firestore doc id
    const periodKey =
      period === "this_month"
        ? `month_${new Date().toISOString().slice(0, 7)}` // "month_2025-06"
        : period;

    const snap = await db.collection("leaderboard").doc(periodKey).get();

    if (!snap.exists) {
      return NextResponse.json({
        success: true,
        leaderboard: { period: periodKey, entries: [], updatedAt: 0 },
      });
    }

    const leaderboard = snap.data() as Leaderboard;

    // Find current user's entry for "Your rank" card
    const userEntry = leaderboard.entries.find((e: LeaderboardEntry) => e.uid === user.userId);

    return NextResponse.json({
      success: true,
      leaderboard,
      currentUserEntry: userEntry ?? null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/leaderboard error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
