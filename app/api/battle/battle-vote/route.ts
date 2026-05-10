// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";

// // ── Single source of truth: fetch user from Firestore, never construct a name
// //    from outside data if the real document already exists.
// async function getUserInfo(
//   userId: string,
//   fallbackName?: string,
//   fallbackEmail?: string
// ): Promise<{ userName: string; userEmail: string; exists: boolean }> {
//   try {
//     const snap = await db.collection("users").doc(userId).get();

//     if (snap.exists) {
//       const d = snap.data()!;

//       // Build name from whatever fields were stored at signup
//       const userName =
//         d.firstName
//           ? [d.firstName, d.lastName].filter(Boolean).join(" ")
//           : d.name ||
//             (d.email ? d.email.split("@")[0] : fallbackName) ||
//             "User";

//       const userEmail = d.email || fallbackEmail || "";
//       return { userName, userEmail, exists: true };
//     }

//     // Document doesn't exist yet — use fallback values from the auth token
//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//     };
//   } catch (err) {
//     console.error("getUserInfo error:", err);
//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//     };
//   }
// }

// // ── Ensure points fields exist on an already-existing user document.
// //    NEVER creates a new document — that is auth's job.
// async function backfillPointsIfNeeded(userId: string) {
//   const ref = db.collection("users").doc(userId);
//   const snap = await ref.get();
//   if (!snap.exists) return; // nothing to backfill

//   const d = snap.data()!;
//   const updates: Record<string, unknown> = {};

//   if (d.totalPoints === undefined) updates.totalPoints = 0;
//   if (d.pointsBreakdown === undefined) {
//     updates.pointsBreakdown = {
//       CREATE_BATTLE: 0,
//       PLAY_BATTLE: 0,
//       INVITE_ACCEPTED: 0,
//       PREDICTION_CORRECT: 0,
//       FANTASY_WIN: 0,
//       DAILY_LOGIN: 0,
//       SHARE_BATTLE: 0,
//     };
//   }
//   // Merge a computed `name` field for Google-auth users who only have firstName
//   if (!d.name && d.firstName) {
//     updates.name = [d.firstName, d.lastName].filter(Boolean).join(" ");
//   }

//   if (Object.keys(updates).length > 0) {
//     updates.lastUpdated = Date.now();
//     await ref.update(updates);
//   }
// }

// // ─── POST — Record a vote ─────────────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { battleId, playerId, playerName, userId, userEmail, userName, direction } = body;

//     // ── Validation ──────────────────────────────────────────────────────────
//     if (!battleId || typeof battleId !== "string")
//       return NextResponse.json({ error: "battleId is required" }, { status: 400 });
//     if (!playerId || typeof playerId !== "string")
//       return NextResponse.json({ error: "playerId is required" }, { status: 400 });
//     if (!userId || typeof userId !== "string")
//       return NextResponse.json({ error: "userId is required" }, { status: 400 });
//     if (!direction || !["left", "right"].includes(direction))
//       return NextResponse.json({ error: "direction must be 'left' or 'right'" }, { status: 400 });

//     const playerPointsAwarded = direction === "right" ? 15 : 0;
//     const userPointsAwarded   = direction === "right" ? 5  : 0;

//     // ── Battle must exist ────────────────────────────────────────────────────
//     const battleSnap = await db.collection("fanBattles").doc(battleId).get();
//     if (!battleSnap.exists)
//       return NextResponse.json({ error: "Battle not found" }, { status: 404 });

//     // ── Prevent duplicate votes ──────────────────────────────────────────────
//     const voteId  = `${battleId}_${userId}_${playerId}`;
//     const voteRef = db.collection("battleVotes").doc(voteId);
//     if ((await voteRef.get()).exists) {
//       return NextResponse.json(
//         { error: "You have already voted for this player in this battle", alreadyVoted: true },
//         { status: 409 }
//       );
//     }

//     // ── Resolve user info from Firestore (single source of truth) ───────────
//     //    Pass auth-provided values only as fallbacks, never as primary.
//     const { userName: resolvedName, userEmail: resolvedEmail, exists: userExists } =
//       await getUserInfo(userId, userName, userEmail);

//     // Backfill missing points fields — NEVER creates a new document
//     if (userExists) await backfillPointsIfNeeded(userId);

//     // ── Build batch ──────────────────────────────────────────────────────────
//     const batch = db.batch();

//     // 1. Vote record
//     batch.set(voteRef, {
//       battleId,
//       playerId,
//       playerName: playerName || "Unknown",
//       userId,
//       direction,
//       pointsAwarded: playerPointsAwarded,
//       createdAt: Date.now(),
//     });

//     // 2. Player leaderboard (subcollection under the battle)
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

//     // 3. User points — only if the user document already exists in Firestore.
//     //    If it doesn't exist, we skip writing to `users` entirely.
//     //    The document will be created properly when they next sign in / via auth flow.
//     //    This is what prevents the duplicate-document bug.
//     if (userPointsAwarded > 0) {
//       const transactionRef = db
//         .collection("userPointTransactions")
//         .doc(`${userId}_${Date.now()}_PLAY_BATTLE`);

//       batch.set(transactionRef, {
//         userId,
//         userEmail: resolvedEmail,
//         userName: resolvedName,
//         points: userPointsAwarded,
//         reason: "PLAY_BATTLE",
//         metadata: { battleId },
//         createdAt: Date.now(),
//       });

//       if (userExists) {
//         // ✅ User document exists — safe to increment
//         const userRef = db.collection("users").doc(userId);
//         batch.update(userRef, {
//           totalPoints: FieldValue.increment(userPointsAwarded),
//           "pointsBreakdown.PLAY_BATTLE": FieldValue.increment(userPointsAwarded),
//           lastUpdated: Date.now(),
//         });
//       }
//       // ❌ If userExists is false, we do NOT create a users doc here.
//       //    Points are recorded in userPointTransactions and can be reconciled
//       //    when the user document is eventually created by the auth flow.

//       // 4. Global leaderboard — safe to upsert (separate collection, not users)
//       const globalLeaderboardRef = db.collection("globalLeaderboard").doc(userId);
//       batch.set(
//         globalLeaderboardRef,
//         {
//           userId,
//           userName: resolvedName,
//           userEmail: resolvedEmail,
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
//         message:
//           direction === "right"
//             ? `+${playerPointsAwarded} for player, +${userPointsAwarded} for you!`
//             : "Skipped",
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/battle-vote error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─── GET — Fetch leaderboard for a battle ────────────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const battleId = searchParams.get("battleId");
//     const userId   = searchParams.get("userId");

//     if (!battleId)
//       return NextResponse.json({ error: "battleId is required" }, { status: 400 });

//     const leaderboardSnap = await db
//       .collection("fanBattles")
//       .doc(battleId)
//       .collection("leaderboard")
//       .orderBy("points", "desc")
//       .get();

//     const leaderboard = leaderboardSnap.docs.map((doc, i) => ({
//       rank: i + 1,
//       ...doc.data(),
//     }));

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

interface PointsBreakdown {
  CREATE_BATTLE: number;
  PLAY_BATTLE: number;
  INVITE_ACCEPTED: number;
  PREDICTION_CORRECT: number;
  FANTASY_WIN: number;
  DAILY_LOGIN: number;
  SHARE_BATTLE: number;
  [key: string]: number;
}

interface UserData {
  userId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  totalPoints?: number;
  pointsBreakdown?: PointsBreakdown;
  lastUpdated?: number;
}

// ── Single source of truth: fetch user from Firestore, never construct a name
async function getUserInfo(
  userId: string,
  fallbackName?: string,
  fallbackEmail?: string
): Promise<{ userName: string; userEmail: string; exists: boolean; userData?: UserData }> {
  try {
    // Try exact match first
    let snap = await db.collection("users").doc(userId).get();

    // If not found, try to find by email (for Google auth users)
    if (!snap.exists && fallbackEmail) {
      const emailQuery = await db.collection("users")
        .where("email", "==", fallbackEmail)
        .limit(1)
        .get();
      
      if (!emailQuery.empty) {
        snap = emailQuery.docs[0];
        console.log(`Found user by email: ${snap.id} for userId: ${userId}`);
      }
    }

    if (snap.exists) {
      const d = snap.data()!;
      
      // Build name from whatever fields were stored at signup
      const userName =
        d.firstName
          ? [d.firstName, d.lastName].filter(Boolean).join(" ")
          : d.name ||
            (d.email ? d.email.split("@")[0] : fallbackName) ||
            "User";

      const userEmail = d.email || fallbackEmail || "";
      return { userName, userEmail, exists: true, userData: d };
    }

    // Document doesn't exist yet — use fallback values from the auth token
    return {
      userName: fallbackName || "User",
      userEmail: fallbackEmail || "",
      exists: false,
    };
  } catch (err) {
    console.error("getUserInfo error:", err);
    return {
      userName: fallbackName || "User",
      userEmail: fallbackEmail || "",
      exists: false,
    };
  }
}

// ── Ensure points fields exist on an already-existing user document
async function backfillPointsIfNeeded(userId: string, userDocId?: string) {
  const docId = userDocId || userId;
  const ref = db.collection("users").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const d = snap.data()!;
  const updates: Record<string, unknown> = {};

  if (d.totalPoints === undefined) updates.totalPoints = 0;
  if (d.pointsBreakdown === undefined) {
    updates.pointsBreakdown = {
      CREATE_BATTLE: 0,
      PLAY_BATTLE: 0,
      INVITE_ACCEPTED: 0,
      PREDICTION_CORRECT: 0,
      FANTASY_WIN: 0,
      DAILY_LOGIN: 0,
      SHARE_BATTLE: 0,
    };
  }
  
  if (!d.name && d.firstName) {
    updates.name = [d.firstName, d.lastName].filter(Boolean).join(" ");
  }

  if (Object.keys(updates).length > 0) {
    updates.lastUpdated = Date.now();
    await ref.update(updates);
    return true;
  }
  
  return false;
}

// ── Check if user already has a transaction for this specific action today
async function hasRecentTransaction(
  userId: string,
  reason: string,
  battleId?: string,
  hoursWindow: number = 24
): Promise<boolean> {
  const cutoffTime = Date.now() - (hoursWindow * 60 * 60 * 1000);
  
  let query = db.collection("userPointTransactions")
    .where("userId", "==", userId)
    .where("reason", "==", reason)
    .where("createdAt", ">=", cutoffTime);
  
  if (battleId) {
    query = query.where("metadata.battleId", "==", battleId);
  }
  
  const snapshot = await query.limit(1).get();
  return !snapshot.empty;
}

// ─── POST — Record a vote ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { battleId, playerId, playerName, userId, userEmail, userName, direction } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!battleId || typeof battleId !== "string")
      return NextResponse.json({ error: "battleId is required" }, { status: 400 });
    if (!playerId || typeof playerId !== "string")
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    if (!userId || typeof userId !== "string")
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!direction || !["left", "right"].includes(direction))
      return NextResponse.json({ error: "direction must be 'left' or 'right'" }, { status: 400 });

    const playerPointsAwarded = direction === "right" ? 15 : 0;
    const userPointsAwarded   = direction === "right" ? 5  : 0;

    // ── Battle must exist ────────────────────────────────────────────────────
    const battleSnap = await db.collection("fanBattles").doc(battleId).get();
    if (!battleSnap.exists)
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });

    // ── Prevent duplicate votes per battle per player ────────────────────────
    const voteId  = `${battleId}_${userId}_${playerId}`;
    const voteRef = db.collection("battleVotes").doc(voteId);
    if ((await voteRef.get()).exists) {
      return NextResponse.json(
        { error: "You have already voted for this player in this battle", alreadyVoted: true },
        { status: 409 }
      );
    }

    // ── Resolve user info from Firestore (single source of truth) ───────────
    const { userName: resolvedName, userEmail: resolvedEmail, exists: userExists, userData } =
      await getUserInfo(userId, userName, userEmail);

    // Get the actual document ID (might be different from userId for Google auth)
    const actualUserId = userData?.userId || userId;
    
    // Backfill missing points fields if user exists
    if (userExists) {
      await backfillPointsIfNeeded(actualUserId);
    }

    // ── Check for duplicate PLAY_BATTLE transaction (within last 5 seconds) ──
    const hasRecentPlayBattle = await hasRecentTransaction(userId, "PLAY_BATTLE", battleId, 0.0014); // ~5 seconds
    if (userPointsAwarded > 0 && hasRecentPlayBattle) {
      console.log(`Duplicate PLAY_BATTLE detected for user ${userId}, skipping`);
      return NextResponse.json(
        { 
          success: true, 
          playerPointsAwarded,
          userPointsAwarded: 0,
          message: "Vote recorded but points already awarded for this battle",
          duplicate: true
        },
        { status: 200 }
      );
    }

    // ── Build batch ──────────────────────────────────────────────────────────
    const batch = db.batch();

    // 1. Vote record
    batch.set(voteRef, {
      battleId,
      playerId,
      playerName: playerName || "Unknown",
      userId,
      direction,
      pointsAwarded: playerPointsAwarded,
      createdAt: Date.now(),
    });

    // 2. Player leaderboard (subcollection under the battle)
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

    // 3. User points transaction - use consistent ID pattern to prevent duplicates
    if (userPointsAwarded > 0) {
      // Create a deterministic transaction ID based on userId, battleId, and action
      // This prevents duplicate transactions for the same battle
      const transactionId = `${userId}_${battleId}_PLAY_BATTLE`;
      const transactionRef = db.collection("userPointTransactions").doc(transactionId);
      
      const existingTransaction = await transactionRef.get();
      
      if (!existingTransaction.exists) {
        batch.set(transactionRef, {
          userId: actualUserId,
          userEmail: resolvedEmail,
          userName: resolvedName,
          points: userPointsAwarded,
          reason: "PLAY_BATTLE",
          metadata: { battleId, playerId, playerName },
          createdAt: Date.now(),
        });
      } else {
        console.log(`Transaction ${transactionId} already exists, skipping creation`);
      }

      if (userExists) {
        const userDocRef = db.collection("users").doc(actualUserId);
        batch.update(userDocRef, {
          totalPoints: FieldValue.increment(userPointsAwarded),
          "pointsBreakdown.PLAY_BATTLE": FieldValue.increment(userPointsAwarded),
          lastUpdated: Date.now(),
        });
      }
    }

    // 4. Global leaderboard — use consistent ID
    const globalLeaderboardRef = db.collection("globalLeaderboard").doc(actualUserId);
    batch.set(
      globalLeaderboardRef,
      {
        userId: actualUserId,
        userName: resolvedName,
        userEmail: resolvedEmail,
        totalPoints: FieldValue.increment(userPointsAwarded),
        lastUpdated: Date.now(),
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        playerPointsAwarded,
        userPointsAwarded,
        message:
          direction === "right"
            ? `+${playerPointsAwarded} for player, +${userPointsAwarded} for you!`
            : "Skipped",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/battle-vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — Fetch leaderboard for a battle ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const battleId = searchParams.get("battleId");
    const userId   = searchParams.get("userId");

    if (!battleId)
      return NextResponse.json({ error: "battleId is required" }, { status: 400 });

    const leaderboardSnap = await db
      .collection("fanBattles")
      .doc(battleId)
      .collection("leaderboard")
      .orderBy("points", "desc")
      .get();

    const leaderboard = leaderboardSnap.docs.map((doc, i) => ({
      rank: i + 1,
      ...doc.data(),
    }));

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