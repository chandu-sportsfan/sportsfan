import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ─── POST — Record a vote (swipe right = +15 pts) ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { battleId, playerId, playerName, userId, direction } = body;

    // ── Validation ──
    if (!battleId || typeof battleId !== "string") {
      return NextResponse.json({ error: "battleId is required" }, { status: 400 });
    }
    if (!playerId || typeof playerId !== "string") {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!direction || !["left", "right"].includes(direction)) {
      return NextResponse.json(
        { error: "direction must be 'left' or 'right'" },
        { status: 400 }
      );
    }

    // Only award points on right swipe
    const pointsAwarded = direction === "right" ? 15 : 0;

    // ── Check battle exists ──
    const battleRef = db.collection("fanBattles").doc(battleId);
    const battleSnap = await battleRef.get();
    if (!battleSnap.exists) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // ── Prevent duplicate votes: one vote per user per player per battle ──
    const voteId = `${battleId}_${userId}_${playerId}`;
    const voteRef = db.collection("battleVotes").doc(voteId);
    const voteSnap = await voteRef.get();

    if (voteSnap.exists) {
      return NextResponse.json(
        { error: "You have already voted for this player in this battle", alreadyVoted: true },
        { status: 409 }
      );
    }

    // ── Write vote record ──
    await voteRef.set({
      battleId,
      playerId,
      playerName: playerName || "Unknown",
      userId,
      direction,
      pointsAwarded,
      createdAt: Date.now(),
    });

    // ── Update leaderboard subcollection under the battle (upsert) ──
    if (pointsAwarded > 0) {
      const leaderboardRef = db
        .collection("fanBattles")
        .doc(battleId)
        .collection("leaderboard")
        .doc(playerId);

      await leaderboardRef.set(
        {
          playerId,
          playerName: playerName || "Unknown",
          points: FieldValue.increment(pointsAwarded),
          votes: FieldValue.increment(1),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pointsAwarded,
        message: direction === "right" ? "+15 points awarded!" : "Skipped",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/battle-vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — Fetch leaderboard for a specific battle ───────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const battleId = searchParams.get("battleId");
    const userId = searchParams.get("userId"); // optional: highlight user's voted players

    if (!battleId) {
      return NextResponse.json({ error: "battleId is required" }, { status: 400 });
    }

    // ── Fetch leaderboard for this battle ──
    const leaderboardSnap = await db
      .collection("fanBattles")
      .doc(battleId)
      .collection("leaderboard")
      .orderBy("points", "desc")
      .get();

    const leaderboard = leaderboardSnap.docs.map((doc, index) => ({
      rank: index + 1,
      ...doc.data(),
    }));

    // ── Fetch which players the user has voted for in this battle ──
    let votedPlayerIds: string[] = [];
    if (userId) {
      const votesSnap = await db
        .collection("battleVotes")
        .where("battleId", "==", battleId)
        .where("userId", "==", userId)
        .get();
      votedPlayerIds = votesSnap.docs.map((doc) => doc.data().playerId);
    }

    return NextResponse.json({
      success: true,
      battleId,
      leaderboard,
      votedPlayerIds,
      total: leaderboard.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/battle-vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}