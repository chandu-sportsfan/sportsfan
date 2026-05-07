// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";

// // ─── POST — Record a vote (swipe right = +15 pts) ────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { battleId, playerId, playerName, userId, direction } = body;

//     // ── Validation ──
//     if (!battleId || typeof battleId !== "string") {
//       return NextResponse.json({ error: "battleId is required" }, { status: 400 });
//     }
//     if (!playerId || typeof playerId !== "string") {
//       return NextResponse.json({ error: "playerId is required" }, { status: 400 });
//     }
//     if (!userId || typeof userId !== "string") {
//       return NextResponse.json({ error: "userId is required" }, { status: 400 });
//     }
//     if (!direction || !["left", "right"].includes(direction)) {
//       return NextResponse.json(
//         { error: "direction must be 'left' or 'right'" },
//         { status: 400 }
//       );
//     }

//     // Only award points on right swipe
//     const pointsAwarded = direction === "right" ? 15 : 0;

//     // ── Check battle exists ──
//     const battleRef = db.collection("fanBattles").doc(battleId);
//     const battleSnap = await battleRef.get();
//     if (!battleSnap.exists) {
//       return NextResponse.json({ error: "Battle not found" }, { status: 404 });
//     }

//     // ── Prevent duplicate votes: one vote per user per player per battle ──
//     const voteId = `${battleId}_${userId}_${playerId}`;
//     const voteRef = db.collection("battleVotes").doc(voteId);
//     const voteSnap = await voteRef.get();

//     if (voteSnap.exists) {
//       return NextResponse.json(
//         { error: "You have already voted for this player in this battle", alreadyVoted: true },
//         { status: 409 }
//       );
//     }

//     // ── Write vote record ──
//     await voteRef.set({
//       battleId,
//       playerId,
//       playerName: playerName || "Unknown",
//       userId,
//       direction,
//       pointsAwarded,
//       createdAt: Date.now(),
//     });

//     // ── Update leaderboard subcollection under the battle (upsert) ──
//     if (pointsAwarded > 0) {
//       const leaderboardRef = db
//         .collection("fanBattles")
//         .doc(battleId)
//         .collection("leaderboard")
//         .doc(playerId);

//       await leaderboardRef.set(
//         {
//           playerId,
//           playerName: playerName || "Unknown",
//           points: FieldValue.increment(pointsAwarded),
//           votes: FieldValue.increment(1),
//           updatedAt: Date.now(),
//         },
//         { merge: true }
//       );
//     }

//     return NextResponse.json(
//       {
//         success: true,
//         pointsAwarded,
//         message: direction === "right" ? "+15 points awarded!" : "Skipped",
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/battle-vote error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─── GET — Fetch leaderboard for a specific battle ───────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const battleId = searchParams.get("battleId");
//     const userId = searchParams.get("userId"); // optional: highlight user's voted players

//     if (!battleId) {
//       return NextResponse.json({ error: "battleId is required" }, { status: 400 });
//     }

//     // ── Fetch leaderboard for this battle ──
//     const leaderboardSnap = await db
//       .collection("fanBattles")
//       .doc(battleId)
//       .collection("leaderboard")
//       .orderBy("points", "desc")
//       .get();

//     const leaderboard = leaderboardSnap.docs.map((doc, index) => ({
//       rank: index + 1,
//       ...doc.data(),
//     }));

//     // ── Fetch which players the user has voted for in this battle ──
//     let votedPlayerIds: string[] = [];
//     if (userId) {
//       const votesSnap = await db
//         .collection("battleVotes")
//         .where("battleId", "==", battleId)
//         .where("userId", "==", userId)
//         .get();
//       votedPlayerIds = votesSnap.docs.map((doc) => doc.data().playerId);
//     }

//     return NextResponse.json({
//       success: true,
//       battleId,
//       leaderboard,
//       votedPlayerIds,
//       total: leaderboard.length,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/battle-vote error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ─── POST — Record a vote (swipe right = +15 pts for player, +5 for user) ───
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { battleId, playerId, playerName, userId, userEmail, userName, direction } = body;

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
    const playerPointsAwarded = direction === "right" ? 15 : 0;
    const userPointsAwarded = direction === "right" ? 5 : 0; // User gets 5 points for playing

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

    // Start batch write for all operations
    const batch = db.batch();

    // 1. Write vote record
    batch.set(voteRef, {
      battleId,
      playerId,
      playerName: playerName || "Unknown",
      userId,
      direction,
      pointsAwarded: playerPointsAwarded,
      createdAt: Date.now(),
    });

    // 2. Update player leaderboard subcollection under the battle
    if (playerPointsAwarded > 0) {
      const leaderboardRef = db
        .collection("fanBattles")
        .doc(battleId)
        .collection("leaderboard")
        .doc(playerId);

      batch.set(
        leaderboardRef,
        {
          playerId,
          playerName: playerName || "Unknown",
          points: FieldValue.increment(playerPointsAwarded),
          votes: FieldValue.increment(1),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    // 3. Award global points to the user for playing
    if (userPointsAwarded > 0) {
      const transactionId = `${userId}_${Date.now()}_PLAY_BATTLE`;
      const transactionRef = db.collection("userPointTransactions").doc(transactionId);
      
      batch.set(transactionRef, {
        userId,
        userEmail: userEmail || "",
        userName: userName || "Unknown User",
        points: userPointsAwarded,
        reason: 'PLAY_BATTLE',
        metadata: { battleId },
        createdAt: Date.now(),
      });

      // Update user's total points
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        batch.set(userRef, {
          userId,
          email: userEmail,
          name: userName,
          totalPoints: userPointsAwarded,
          pointsBreakdown: { PLAY_BATTLE: userPointsAwarded },
          lastUpdated: Date.now(),
        });
      } else {
        batch.update(userRef, {
          totalPoints: FieldValue.increment(userPointsAwarded),
          'pointsBreakdown.PLAY_BATTLE': FieldValue.increment(userPointsAwarded),
          lastUpdated: Date.now(),
        });
      }

      // Update global leaderboard
      const globalLeaderboardRef = db.collection("globalLeaderboard").doc(userId);
      batch.set(
        globalLeaderboardRef,
        {
          userId,
          userName: userName || "Unknown User",
          userEmail: userEmail || "",
          totalPoints: FieldValue.increment(userPointsAwarded),
          lastUpdated: Date.now(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        playerPointsAwarded,
        userPointsAwarded,
        message: direction === "right" ? `+${playerPointsAwarded} for player, +${userPointsAwarded} for you!` : "Skipped",
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
    const userId = searchParams.get("userId");

    if (!battleId) {
      return NextResponse.json({ error: "battleId is required" }, { status: 400 });
    }

    // Fetch leaderboard for this battle
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

    // Fetch which players the user has voted for
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