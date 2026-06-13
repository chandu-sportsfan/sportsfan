



// lib/roarPoints.ts
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebaseAdmin";
import { awardUserPoints } from "@/lib/userPoints";
import type { PostType } from "@/app/models/Post";

// ─── Point values per ROAR post type ─────────────────────────────────────────
export const ROAR_POINTS: Record<PostType | "post", number> = {
  hot_take:   2,
  prediction: 2,
  debate:     2,
  memory:     2,
  post:       2,
  quiz: 2,
};

// ─── Reason key from post type ────────────────────────────────────────────────
export function roarReasonFromType(type: PostType | "post"): string {
  const map: Record<PostType | "post", string> = {
    hot_take:   "ROAR_HOT_TAKE",
    prediction: "ROAR_PREDICTION",
    debate:     "ROAR_DEBATE",
    memory:     "ROAR_MEMORY",
    post:       "ROAR_POST",
     quiz:       "ROAR_QUIZ",  
  };
  return map[type];
}

// ─── awardRoarPoints ──────────────────────────────────────────────────────────
// 1. Delegates to awardUserPoints → handles userPointTransactions (idempotency),
//    users/{id} totalPoints + pointsBreakdown + activityLog, AND globalLeaderboard.
//    activityLog labels now come from ACTIVITY_LABELS in userPoints.ts which
//    includes all ROAR keys — so the frontend normalizeActivityKey can match them.
// 2. Additionally mirrors to roarLeaderboard — ROAR-only collection.
//
// If awardUserPoints returns false (duplicate transaction), the roarLeaderboard
// write is also skipped so both stay in sync.

export async function awardRoarPoints({
  actualUserId,
  authUserId,
  userName,
  userEmail,
  userExists,
  postType,
  transactionId,
  metadata,
}: {
  actualUserId: string;
  authUserId?: string;
  userName: string;
  userEmail: string;
  userExists: boolean;
  postType: PostType | "post";
  transactionId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ awarded: boolean; points: number }> {
  const points = ROAR_POINTS[postType] ?? 8;
  const reason = roarReasonFromType(postType);
  const leaderboardUserId = authUserId ?? actualUserId;

  // ── Step 1: shared utility ────────────────────────────────────────────────
  // Writes: userPointTransactions, users/{id} totalPoints + pointsBreakdown,
  //         activityLog (with correct ROAR label), globalLeaderboard
  const awarded = await awardUserPoints({
    actualUserId,
    authUserId,
    userName,
    userEmail,
    userExists,
    points,
    reason,
    transactionId,
    metadata,
  });

  if (!awarded) {
    // Duplicate transaction — skip roarLeaderboard too
    return { awarded: false, points };
  }

  // ── Step 2: mirror to roarLeaderboard ────────────────────────────────────
  const roarRef = db.collection("roarLeaderboard").doc(leaderboardUserId);
  await roarRef.set(
    {
      userId:      leaderboardUserId,
      userName,
      userEmail,
      totalPoints: FieldValue.increment(points),
      [`breakdown.${reason}`]: FieldValue.increment(points),
      lastUpdated: Date.now(),
    },
    { merge: true },
  );

  return { awarded: true, points };
}