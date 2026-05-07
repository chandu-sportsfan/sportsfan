// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// type BattleType = "PLAYERS" | "CLUBS";

// interface InvitedFriend {
//   email: string;
//   name: string;
// }

// interface BattlePayload {
//   battleName: string;
//   battleType: BattleType;
//   selectedPlayers?: string[];
//   selectedClubs?: string[];
//   invitedFriends?: InvitedFriend[];
//   userId: string;
//   userName: string;
// }

// // ─── POST — Create a new battle ───────────────────────────────────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body: BattlePayload = await req.json();

//     const {
//       battleName,
//       battleType,
//       selectedPlayers,
//       selectedClubs,
//       invitedFriends,
//       userId,
//       userName,
//     } = body;

//     // ── Required field validation ──
//     if (!battleName || typeof battleName !== "string" || !battleName.trim()) {
//       return NextResponse.json(
//         { error: "battleName is required and must be a non-empty string" },
//         { status: 400 }
//       );
//     }

//     const validBattleTypes: BattleType[] = ["PLAYERS", "CLUBS"];
//     if (!battleType || !validBattleTypes.includes(battleType)) {
//       return NextResponse.json(
//         { error: "battleType is required and must be PLAYERS or CLUBS" },
//         { status: 400 }
//       );
//     }

//     if (!userId || typeof userId !== "string") {
//       return NextResponse.json(
//         { error: "userId is required" },
//         { status: 400 }
//       );
//     }

//     if (!userName || typeof userName !== "string") {
//       return NextResponse.json(
//         { error: "userName is required" },
//         { status: 400 }
//       );
//     }

//     // ── Type-specific validation ──
//     if (battleType === "PLAYERS") {
//       if (!Array.isArray(selectedPlayers) || selectedPlayers.length === 0) {
//         return NextResponse.json(
//           { error: "selectedPlayers must be a non-empty array when battleType is PLAYERS" },
//           { status: 400 }
//         );
//       }
//     }

//     if (battleType === "CLUBS") {
//       if (!Array.isArray(selectedClubs) || selectedClubs.length === 0) {
//         return NextResponse.json(
//           { error: "selectedClubs must be a non-empty array when battleType is CLUBS" },
//           { status: 400 }
//         );
//       }
//     }

//     // ── Validate invitedFriends shape if provided ──
//     if (invitedFriends !== undefined) {
//       if (!Array.isArray(invitedFriends)) {
//         return NextResponse.json(
//           { error: "invitedFriends must be an array" },
//           { status: 400 }
//         );
//       }

//       for (const friend of invitedFriends) {
//         if (!friend.email || !friend.name) {
//           return NextResponse.json(
//             { error: "Each invitedFriend must have both email and name fields" },
//             { status: 400 }
//           );
//         }
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(friend.email)) {
//           return NextResponse.json(
//             { error: `Invalid email address: ${friend.email}` },
//             { status: 400 }
//           );
//         }
//       }
//     }

//     const newBattle = {
//       battleName: battleName.trim(),
//       battleType,
//       selectedPlayers: battleType === "PLAYERS" ? (selectedPlayers ?? []) : [],
//       selectedClubs: battleType === "CLUBS" ? (selectedClubs ?? []) : [],
//       invitedFriends: invitedFriends ?? [],
//       userId,
//       userName,
//       createdAt: Date.now(),
//       updatedAt: Date.now(),
//     };

//     const docRef = await db.collection("fanBattles").add(newBattle);

//     return NextResponse.json(
//       {
//         success: true,
//         id: docRef.id,
//         battle: { id: docRef.id, ...newBattle },
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/battles error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─── GET — List battles (with filters + cursor pagination) ────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);

//     const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
//     const battleType = searchParams.get("battleType");
//     const userId = searchParams.get("userId");
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

//     let query: FirebaseFirestore.Query = db
//       .collection("fanBattles")
//       .orderBy("createdAt", "desc");

//     // ── Optional filters ──
//     if (battleType && ["PLAYERS", "CLUBS"].includes(battleType)) {
//       query = query.where("battleType", "==", battleType);
//     }

//     if (userId) {
//       query = query.where("userId", "==", userId);
//     }

//     query = query.limit(limit);

//     // ── Cursor-based pagination ──
//     if (lastDocId && lastDocCreatedAt) {
//       const lastDocRef = db.collection("fanBattles").doc(lastDocId);
//       const lastDocSnap = await lastDocRef.get();
//       if (lastDocSnap.exists) {
//         query = query.startAfter(lastDocSnap);
//       }
//     }

//     const snapshot = await query.get();

//     const battles = snapshot.docs.map((doc) => ({
//       id: doc.id,
//       ...doc.data(),
//     }));

//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       battles,
//       pagination: {
//         limit,
//         hasMore: battles.length === limit,
//         nextCursor:
//           battles.length === limit
//             ? {
//                 lastDocId: lastDoc?.id,
//                 lastDocCreatedAt: lastDoc?.data()?.createdAt,
//               }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/battles error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }




import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type BattleType = "PLAYERS" | "CLUBS";

interface InvitedFriend {
  email: string;
  name: string;
}

interface BattlePayload {
  battleName: string;
  battleType: BattleType;
  selectedPlayers?: string[];
  selectedClubs?: string[];
  invitedFriends?: InvitedFriend[];
  userId: string;
  userName: string;
  userEmail?: string; // Added userEmail for points tracking
}

// ─── POST — Create a new battle ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: BattlePayload = await req.json();

    const {
      battleName,
      battleType,
      selectedPlayers,
      selectedClubs,
      invitedFriends,
      userId,
      userName,
      userEmail,
    } = body;

    // ── Required field validation ──
    if (!battleName || typeof battleName !== "string" || !battleName.trim()) {
      return NextResponse.json(
        { error: "battleName is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const validBattleTypes: BattleType[] = ["PLAYERS", "CLUBS"];
    if (!battleType || !validBattleTypes.includes(battleType)) {
      return NextResponse.json(
        { error: "battleType is required and must be PLAYERS or CLUBS" },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!userName || typeof userName !== "string") {
      return NextResponse.json(
        { error: "userName is required" },
        { status: 400 }
      );
    }

    // ── Type-specific validation ──
    if (battleType === "PLAYERS") {
      if (!Array.isArray(selectedPlayers) || selectedPlayers.length === 0) {
        return NextResponse.json(
          { error: "selectedPlayers must be a non-empty array when battleType is PLAYERS" },
          { status: 400 }
        );
      }
    }

    if (battleType === "CLUBS") {
      if (!Array.isArray(selectedClubs) || selectedClubs.length === 0) {
        return NextResponse.json(
          { error: "selectedClubs must be a non-empty array when battleType is CLUBS" },
          { status: 400 }
        );
      }
    }

    // ── Validate invitedFriends shape if provided ──
    if (invitedFriends !== undefined) {
      if (!Array.isArray(invitedFriends)) {
        return NextResponse.json(
          { error: "invitedFriends must be an array" },
          { status: 400 }
        );
      }

      for (const friend of invitedFriends) {
        if (!friend.email || !friend.name) {
          return NextResponse.json(
            { error: "Each invitedFriend must have both email and name fields" },
            { status: 400 }
          );
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(friend.email)) {
          return NextResponse.json(
            { error: `Invalid email address: ${friend.email}` },
            { status: 400 }
          );
        }
      }
    }

    // Create a batch for atomic operations
    const batch = db.batch();

    // ── Create the battle document ──
    const newBattle = {
      battleName: battleName.trim(),
      battleType,
      selectedPlayers: battleType === "PLAYERS" ? (selectedPlayers ?? []) : [],
      selectedClubs: battleType === "CLUBS" ? (selectedClubs ?? []) : [],
      invitedFriends: invitedFriends ?? [],
      userId,
      userName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const battleRef = db.collection("fanBattles").doc();
    batch.set(battleRef, newBattle);

    // ── Award points for creating a battle ──
    const pointsToAward = 10; // CREATE_BATTLE = 10 points
    
    // Create transaction record
    const transactionId = `${userId}_${Date.now()}_CREATE_BATTLE`;
    const transactionRef = db.collection("userPointTransactions").doc(transactionId);
    
    batch.set(transactionRef, {
      userId,
      userEmail: userEmail || "",
      userName: userName || "Unknown User",
      points: pointsToAward,
      reason: 'CREATE_BATTLE',
      metadata: { battleId: battleRef.id },
      createdAt: Date.now(),
    });

    // Update user's total points in the users collection
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      // Create user document if it doesn't exist
      batch.set(userRef, {
        userId,
        email: userEmail,
        name: userName,
        totalPoints: pointsToAward,
        pointsBreakdown: {
          CREATE_BATTLE: pointsToAward,
        },
        lastUpdated: Date.now(),
      });
    } else {
      // Update existing user
      batch.update(userRef, {
        totalPoints: FieldValue.increment(pointsToAward),
        'pointsBreakdown.CREATE_BATTLE': FieldValue.increment(pointsToAward),
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
        totalPoints: FieldValue.increment(pointsToAward),
        lastUpdated: Date.now(),
      },
      { merge: true }
    );

    // Commit all changes
    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        id: battleRef.id,
        battle: { id: battleRef.id, ...newBattle },
        pointsAwarded: pointsToAward,
        message: `Battle created successfully! +${pointsToAward} points awarded!`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/battles error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — List battles (with filters + cursor pagination) ────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const battleType = searchParams.get("battleType");
    const userId = searchParams.get("userId");
    const lastDocId = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    let query: FirebaseFirestore.Query = db
      .collection("fanBattles")
      .orderBy("createdAt", "desc");

    // ── Optional filters ──
    if (battleType && ["PLAYERS", "CLUBS"].includes(battleType)) {
      query = query.where("battleType", "==", battleType);
    }

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    query = query.limit(limit);

    // ── Cursor-based pagination ──
    if (lastDocId && lastDocCreatedAt) {
      const lastDocRef = db.collection("fanBattles").doc(lastDocId);
      const lastDocSnap = await lastDocRef.get();
      if (lastDocSnap.exists) {
        query = query.startAfter(lastDocSnap);
      }
    }

    const snapshot = await query.get();

    const battles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      battles,
      pagination: {
        limit,
        hasMore: battles.length === limit,
        nextCursor:
          battles.length === limit
            ? {
                lastDocId: lastDoc?.id,
                lastDocCreatedAt: lastDoc?.data()?.createdAt,
              }
            : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/battles error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}