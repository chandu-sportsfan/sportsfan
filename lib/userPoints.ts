// lib/userPoints.ts
// Single shared utility for awarding points to users.
// Import this in any route that needs to give a user points.
// Adding a new feature = just call awardUserPoints() with a new reason string.
// No lists to maintain, no schema migrations, no backfill scripts needed.

import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ─── getUserInfo ──────────────────────────────────────────────────────────────
// Resolves the canonical userId and display name from Firestore.
// Falls back to email lookup for Google auth users whose UID may differ.

export async function getUserInfo(
  userId: string,
  fallbackName?: string,
  fallbackEmail?: string
): Promise<{
  userName: string;
  userEmail: string;
  exists: boolean;
  actualUserId: string;
}> {
  try {
    let snap = await db.collection("users").doc(userId).get();
    let actualUserId = userId;

    if (!snap.exists && fallbackEmail) {
      const emailQuery = await db
        .collection("users")
        .where("email", "==", fallbackEmail)
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        snap = emailQuery.docs[0];
        actualUserId = snap.id;
        console.log(`[getUserInfo] Found user by email: ${actualUserId} for userId: ${userId}`);
      }
    }

    if (snap.exists) {
      const d = snap.data()!;
      const userName = d.firstName
        ? [d.firstName, d.lastName].filter(Boolean).join(" ")
        : d.name ||
          (d.email ? d.email.split("@")[0] : fallbackName) ||
          "User";
      return {
        userName,
        userEmail: d.email || fallbackEmail || "",
        exists: true,
        actualUserId,
      };
    }

    return {
      userName: fallbackName || "User",
      userEmail: fallbackEmail || "",
      exists: false,
      actualUserId: userId,
    };
  } catch (err) {
    console.error("[getUserInfo] error:", err);
    return {
      userName: fallbackName || "User",
      userEmail: fallbackEmail || "",
      exists: false,
      actualUserId: userId,
    };
  }
}

// ─── awardUserPoints ──────────────────────────────────────────────────────────
// Awards points to a user for any reason.
//
// Key behaviours:
//  - Idempotent: uses a caller-supplied deterministic transactionId.
//    If that doc already exists the function returns false and does nothing.
//  - Dynamic breakdown keys: Firestore increment() on a missing nested field
//    initialises it to 0 + n automatically — no hardcoded list needed.
//  - Always updates globalLeaderboard via merge so the leaderboard context
//    picks up points from every feature without extra wiring.
//
// @returns true  — points were awarded
//          false — transaction already existed (idempotent no-op)

export async function awardUserPoints({
  actualUserId,
  userName,
  userEmail,
  userExists,
  points,
  reason,
  transactionId,
  metadata,
}: {
  actualUserId: string;
  userName: string;
  userEmail: string;
  userExists: boolean;
  points: number;
  reason: string;        // e.g. "PLAY_BATTLE", "TRIVIA_CORRECT", "CREATE_BATTLE" — any string
  transactionId: string; // deterministic, unique per action e.g. `${userId}_${battleId}_PLAY_BATTLE`
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (points <= 0) return false;

  const transactionRef = db.collection("userPointTransactions").doc(transactionId);
  const txSnap = await transactionRef.get();

  // Already awarded — idempotent guard
  if (txSnap.exists) return false;

  const now = Date.now();
  const batch = db.batch();

  // 1. Idempotent transaction record
  batch.set(transactionRef, {
    userId: actualUserId,
    userEmail,
    userName,
    points,
    reason,
    metadata: metadata ?? {},
    createdAt: now,
  });

  // 2. User document
  // increment() on a missing field (e.g. pointsBreakdown.TRIVIA_CORRECT) sets it
  // to 0 + n — Firestore handles this natively, no pre-init or backfill needed.
  if (userExists) {
    const userRef = db.collection("users").doc(actualUserId);
    batch.update(userRef, {
      totalPoints: FieldValue.increment(points),
      [`pointsBreakdown.${reason}`]: FieldValue.increment(points),
      lastUpdated: now,
    });
  }

  // 3. Global leaderboard — merge so existing fields are preserved
  const globalRef = db.collection("globalLeaderboard").doc(actualUserId);
  batch.set(
    globalRef,
    {
      userId: actualUserId,
      userName,
      userEmail,
      totalPoints: FieldValue.increment(points),
      lastUpdated: now,
    },
    { merge: true }
  );

  await batch.commit();
  return true;
}