import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Types
interface PointTransaction {
  userId: string;
  userEmail: string;
  userName: string;
  points: number;
  reason: 'CREATE_BATTLE' | 'PLAY_BATTLE' | 'INVITE_ACCEPTED' | 'PREDICTION_CORRECT' | 'FANTASY_WIN' | 'DAILY_LOGIN' | 'SHARE_BATTLE';
  metadata?: {
    battleId?: string;
    predictionId?: string;
    fantasyGameId?: string;
    invitedUserId?: string;
  };
  createdAt: number;
}

// Point values for different actions
const POINTS_CONFIG = {
  CREATE_BATTLE: 10,
  PLAY_BATTLE: 5,
  INVITE_ACCEPTED: 10,
  PREDICTION_CORRECT: 20,
  FANTASY_WIN: 50,
  DAILY_LOGIN: 2,
  SHARE_BATTLE: 3,
} as const;

// ─── POST — Award points to a user ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userEmail, userName, reason, metadata } = body;

    // Validation
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!reason || !POINTS_CONFIG[reason as keyof typeof POINTS_CONFIG]) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const pointsToAdd = POINTS_CONFIG[reason as keyof typeof POINTS_CONFIG];
    
    // Get user reference
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    // Create transaction record
    const transactionId = `${userId}_${Date.now()}_${reason}`;
    const transactionRef = db.collection("userPointTransactions").doc(transactionId);

    // Check for duplicate transactions (prevent double counting)
    const existingTransaction = await transactionRef.get();
    if (existingTransaction.exists) {
      return NextResponse.json(
        { error: "Transaction already recorded" },
        { status: 409 }
      );
    }

    // Prepare transaction data
    const transaction: PointTransaction = {
      userId,
      userEmail: userEmail || "",
      userName: userName || "Unknown User",
      points: pointsToAdd,
      reason,
      metadata: metadata || {},
      createdAt: Date.now(),
    };

    // Run batch write to ensure consistency
    const batch = db.batch();

    // 1. Add transaction record
    batch.set(transactionRef, transaction);

    // 2. Update user's total points in the users collection
    if (!userSnap.exists) {
      // Create user document if it doesn't exist
      batch.set(userRef, {
        userId,
        email: userEmail,
        name: userName,
        totalPoints: pointsToAdd,
        pointsBreakdown: {
          [reason]: pointsToAdd,
        },
        lastUpdated: Date.now(),
      });
    } else {
      // Update existing user
      batch.update(userRef, {
        totalPoints: FieldValue.increment(pointsToAdd),
        [`pointsBreakdown.${reason}`]: FieldValue.increment(pointsToAdd),
        lastUpdated: Date.now(),
      });
    }

    // 3. Update global leaderboard
    const leaderboardRef = db.collection("globalLeaderboard").doc(userId);
    batch.set(
      leaderboardRef,
      {
        userId,
        userName: userName || "Unknown User",
        userEmail: userEmail || "",
        totalPoints: FieldValue.increment(pointsToAdd),
        lastUpdated: Date.now(),
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json({
      success: true,
      pointsAwarded: pointsToAdd,
      totalPointsAfter: (userSnap.exists ? userSnap.data()?.totalPoints || 0 : 0) + pointsToAdd,
      reason,
      message: `+${pointsToAdd} points awarded!`,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/user-points error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — Fetch global leaderboard ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const timeFrame = searchParams.get("timeFrame") || "all-time";

    const leaderboardQuery = db.collection("globalLeaderboard")
      .orderBy("totalPoints", "desc")
      .limit(limit);

    const leaderboardSnap = await leaderboardQuery.get();
    
    const leaderboard = leaderboardSnap.docs.map((doc, index) => ({
      rank: index + 1,
      ...doc.data(),
    }));

    // Get current user's rank and points
    let currentUserRank = null;
    let currentUserPoints = null;
    
    if (userId && userId !== "null" && userId !== "undefined") {
      const userLeaderboardRef = db.collection("globalLeaderboard").doc(userId);
      const userLeaderboardSnap = await userLeaderboardRef.get();
      
      if (userLeaderboardSnap.exists) {
        currentUserPoints = userLeaderboardSnap.data()?.totalPoints || 0;
        
        // Find user's rank (consider using a more efficient method in production)
        const allUsers = await db.collection("globalLeaderboard")
          .orderBy("totalPoints", "desc")
          .get();
        
        currentUserRank = allUsers.docs.findIndex(doc => doc.id === userId) + 1;
        if (currentUserRank === 0) currentUserRank = null;
      }
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      currentUser: {
        userId: userId || null,
        rank: currentUserRank,
        points: currentUserPoints,
      },
      total: leaderboard.length,
      timeFrame,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/user-points error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



// // ─── GET /transactions — Fetch user's point history 
// export async function PATCH(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const userId = searchParams.get("userId");
//     const limit = parseInt(searchParams.get("limit") || "20");

//     if (!userId) {
//       return NextResponse.json({ error: "userId is required" }, { status: 400 });
//     }

//     const transactionsSnap = await db
//       .collection("userPointTransactions")
//       .where("userId", "==", userId)
//       .orderBy("createdAt", "desc")
//       .limit(limit)
//       .get();

//     const transactions = transactionsSnap.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data(),
//     }));

//     return NextResponse.json({
//       success: true,
//       transactions,
//       total: transactions.length,
//     });

//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/user-points/transactions error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }