// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";

// // ─── POST — Record a vote (swipe right = +15 pts for player, +5 for user) ───
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { battleId, playerId, playerName, userId, userEmail, userName, direction } = body;

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
//     const playerPointsAwarded = direction === "right" ? 15 : 0;
//     const userPointsAwarded = direction === "right" ? 5 : 0; // User gets 5 points for playing

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

//     // Start batch write for all operations
//     const batch = db.batch();

//     // 1. Write vote record
//     batch.set(voteRef, {
//       battleId,
//       playerId,
//       playerName: playerName || "Unknown",
//       userId,
//       direction,
//       pointsAwarded: playerPointsAwarded,
//       createdAt: Date.now(),
//     });

//     // 2. Update player leaderboard subcollection under the battle
//     if (playerPointsAwarded > 0) {
//       const leaderboardRef = db
//         .collection("fanBattles")
//         .doc(battleId)
//         .collection("leaderboard")
//         .doc(playerId);

//       batch.set(
//         leaderboardRef,
//         {
//           playerId,
//           playerName: playerName || "Unknown",
//           points: FieldValue.increment(playerPointsAwarded),
//           votes: FieldValue.increment(1),
//           updatedAt: Date.now(),
//         },
//         { merge: true }
//       );
//     }

//     // 3. Award global points to the user for playing
//     if (userPointsAwarded > 0) {
//       const transactionId = `${userId}_${Date.now()}_PLAY_BATTLE`;
//       const transactionRef = db.collection("userPointTransactions").doc(transactionId);
      
//       batch.set(transactionRef, {
//         userId,
//         userEmail: userEmail || "",
//         userName: userName || "Unknown User",
//         points: userPointsAwarded,
//         reason: 'PLAY_BATTLE',
//         metadata: { battleId },
//         createdAt: Date.now(),
//       });

//       // Update user's total points
//       const userRef = db.collection("users").doc(userId);
//       const userSnap = await userRef.get();
      
//       if (!userSnap.exists) {
//         batch.set(userRef, {
//           userId,
//           email: userEmail,
//           name: userName,
//           totalPoints: userPointsAwarded,
//           pointsBreakdown: { PLAY_BATTLE: userPointsAwarded },
//           lastUpdated: Date.now(),
//         });
//       } else {
//         batch.update(userRef, {
//           totalPoints: FieldValue.increment(userPointsAwarded),
//           'pointsBreakdown.PLAY_BATTLE': FieldValue.increment(userPointsAwarded),
//           lastUpdated: Date.now(),
//         });
//       }

//       // Update global leaderboard
//       const globalLeaderboardRef = db.collection("globalLeaderboard").doc(userId);
//       batch.set(
//         globalLeaderboardRef,
//         {
//           userId,
//           userName: userName || "Unknown User",
//           userEmail: userEmail || "",
//           totalPoints: FieldValue.increment(userPointsAwarded),
//           lastUpdated: Date.now(),
//         },
//         { merge: true }
//       );
//     }

//     await batch.commit();

//     return NextResponse.json(
//       {
//         success: true,
//         playerPointsAwarded,
//         userPointsAwarded,
//         message: direction === "right" ? `+${playerPointsAwarded} for player, +${userPointsAwarded} for you!` : "Skipped",
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
//     const userId = searchParams.get("userId");

//     if (!battleId) {
//       return NextResponse.json({ error: "battleId is required" }, { status: 400 });
//     }

//     // Fetch leaderboard for this battle
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

//     // Fetch which players the user has voted for
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

// Helper function to get standardized user info
async function getStandardizedUserInfo(userId: string, providedName?: string, providedEmail?: string) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      
      // Extract name from different formats
      let userName = "";
      if (providedName && providedName !== "Unknown User") {
        userName = providedName;
      } else if (userData?.firstName) {
        userName = [userData.firstName, userData.lastName].filter(Boolean).join(" ");
      } else if (userData?.name) {
        userName = userData.name;
      } else if (userData?.email) {
        userName = userData.email.split("@")[0];
      } else {
        userName = "User";
      }
      
      // Get email
      const userEmail = providedEmail || userData?.email || "";
      
      // Ensure points fields exist
      if (userData?.totalPoints === undefined || userData?.pointsBreakdown === undefined) {
        await userRef.update({
          totalPoints: userData?.totalPoints || 0,
          pointsBreakdown: {
            CREATE_BATTLE: 0,
            PLAY_BATTLE: 0,
            INVITE_ACCEPTED: 0,
            PREDICTION_CORRECT: 0,
            FANTASY_WIN: 0,
            DAILY_LOGIN: 0,
            SHARE_BATTLE: 0
          },
          lastUpdated: Date.now()
        });
      }
      
      return { userName, userEmail, userData };
    }
    
    // User doesn't exist, return provided info or defaults
    return {
      userName: providedName || "User",
      userEmail: providedEmail || "",
      userData: null
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    return {
      userName: providedName || "User",
      userEmail: providedEmail || "",
      userData: null
    };
  }
}

// Helper to ensure user has points fields
async function ensureUserHasPointsFields(userId: string, userEmail: string, userName: string) {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  
  if (!userSnap.exists) {
    // Create new user with complete structure
    return {
      exists: false,
      ref: userRef,
      data: {
        userId,
        email: userEmail,
        name: userName,
        firstName: userName.split(" ")[0] || "",
        lastName: userName.split(" ")[1] || "",
        totalPoints: 0,
        pointsBreakdown: {
          CREATE_BATTLE: 0,
          PLAY_BATTLE: 0,
          INVITE_ACCEPTED: 0,
          PREDICTION_CORRECT: 0,
          FANTASY_WIN: 0,
          DAILY_LOGIN: 0,
          SHARE_BATTLE: 0
        },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        status: "active",
        role: "user"
      }
    };
  }
  
  const userData = userSnap.data();
  
  // Check and add missing points fields
  const updates: {
    totalPoints?: number;
    pointsBreakdown?: {
      CREATE_BATTLE: number;
      PLAY_BATTLE: number;
      INVITE_ACCEPTED: number;
      PREDICTION_CORRECT: number;
      FANTASY_WIN: number;
      DAILY_LOGIN: number;
      SHARE_BATTLE: number;
    };
    name?: string;
    lastUpdated?: number;
  } = {};
  let needsUpdate = false;
  
  if (userData?.totalPoints === undefined) {
    updates.totalPoints = 0;
    needsUpdate = true;
  }
  
  if (userData?.pointsBreakdown === undefined) {
    updates.pointsBreakdown = {
      CREATE_BATTLE: 0,
      PLAY_BATTLE: 0,
      INVITE_ACCEPTED: 0,
      PREDICTION_CORRECT: 0,
      FANTASY_WIN: 0,
      DAILY_LOGIN: 0,
      SHARE_BATTLE: 0
    };
    needsUpdate = true;
  }
  
  // Add missing name field for Google auth users
  if (!userData?.name && userData?.firstName) {
    updates.name = [userData.firstName, userData.lastName].filter(Boolean).join(" ");
    needsUpdate = true;
  }
  
  if (needsUpdate) {
    updates.lastUpdated = Date.now();
    await userRef.update(updates);
  }
  
  return { exists: true, ref: userRef, data: userData };
}

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

    // Get standardized user info
    const { userName: standardizedName, userEmail: standardizedEmail } = 
      await getStandardizedUserInfo(userId, userName, userEmail);

    // Ensure user has points fields
    await ensureUserHasPointsFields(userId, standardizedEmail, standardizedName);

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
        userEmail: standardizedEmail,
        userName: standardizedName,
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
          email: standardizedEmail,
          name: standardizedName,
          firstName: standardizedName.split(" ")[0] || "",
          lastName: standardizedName.split(" ")[1] || "",
          totalPoints: userPointsAwarded,
          pointsBreakdown: { 
            CREATE_BATTLE: 0,
            PLAY_BATTLE: userPointsAwarded,
            INVITE_ACCEPTED: 0,
            PREDICTION_CORRECT: 0,
            FANTASY_WIN: 0,
            DAILY_LOGIN: 0,
            SHARE_BATTLE: 0
          },
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          status: "active",
          role: "user"
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
          userName: standardizedName,
          userEmail: standardizedEmail,
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