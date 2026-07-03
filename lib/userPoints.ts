

// // lib/userPoints.ts
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";

// // ─── Activity label map ───────────────────────────────────────────────────────
// const ACTIVITY_LABELS: Record<string, (meta?: Record<string, unknown>) => string> = {
//   LISTEN_COMPLETE:  (m) => `Listened to "${m?.title ?? "audio drop"}"`,
//   FAN_BATTLE_WIN:   (m) => `Won a Fan Battle${m?.opponent ? ` vs ${m.opponent}` : ""}`,
//   FAN_BATTLE_PLAY:  ()  => "Played a Fan Battle",
//   POST_CREATED:     ()  => "Created a Fan Zone post",
//   TRIVIA_CORRECT:   (m) => `Answered trivia correctly${m?.topic ? ` — ${m.topic}` : ""}`,
//   REGISTRATION:     ()  => "Joined SportsFan360",
//   INVITE_ACCEPTED:  (m) => `Friend ${m?.friendName ?? "someone"} joined via your invite`,
// };

// function getActivityLabel(reason: string, meta?: Record<string, unknown>): string {
//   return ACTIVITY_LABELS[reason]?.(meta) ?? reason.replace(/_/g, " ").toLowerCase();
// }

// // ─── getUserInfo ──────────────────────────────────────────────────────────────
// // Resolves canonical user info from Firestore.
// // Falls back to email lookup for Google auth users whose UID may differ.
// //
// // Returns:
// //   actualUserId — Firestore DOCUMENT ID of the users doc  → use for users collection writes
// //   authUserId   — the original ID the client sent          → use for sessions + globalLeaderboard

// export async function getUserInfo(
//   userId: string,
//   fallbackName?: string,
//   fallbackEmail?: string
// ): Promise<{
//   userName: string;
//   userEmail: string;
//   exists: boolean;
//   actualUserId: string;
//   authUserId: string;
// }> {
//   try {
//     let snap = await db.collection("users").doc(userId).get();
//     let actualUserId = userId;

//     if (!snap.exists && fallbackEmail) {
//       const emailQuery = await db
//         .collection("users")
//         .where("email", "==", fallbackEmail)
//         .limit(1)
//         .get();

//       if (!emailQuery.empty) {
//         snap = emailQuery.docs[0];
//         actualUserId = snap.id;
//         console.log(`[getUserInfo] Found user by email: ${actualUserId} for authUserId: ${userId}`);
//       }
//     }

//     if (snap.exists) {
//       const d = snap.data()!;
//       const userName = d.firstName
//         ? [d.firstName, d.lastName].filter(Boolean).join(" ")
//         : d.name ||
//           (d.email ? d.email.split("@")[0] : fallbackName) ||
//           "User";
//       return {
//         userName,
//         userEmail: d.email || fallbackEmail || "",
//         exists: true,
//         actualUserId,
//         authUserId: userId,
//       };
//     }

//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//       actualUserId: userId,
//       authUserId: userId,
//     };
//   } catch (err) {
//     console.error("[getUserInfo] error:", err);
//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//       actualUserId: userId,
//       authUserId: userId,
//     };
//   }
// }

// // ─── awardUserPoints ──────────────────────────────────────────────────────────
// // Awards points to a user for any reason.
// //
// //  actualUserId  — Firestore doc ID → users collection writes
// //  authUserId    — stable auth ID   → globalLeaderboard doc ID + transactionId
// //                  For most users these are identical. They diverge only when
// //                  a Google auth user's Firestore doc was found via email lookup.
// //
// // Idempotent: if transactionId already exists, returns false and does nothing.
// // Dynamic breakdown keys: increment() on a missing field initialises it to 0+n.
// // Also writes an activityLog entry atomically with the points — same batch.

// export async function awardUserPoints({
//   actualUserId,
//   authUserId,
//   userName,
//   userEmail,
//   userExists,
//   points,
//   reason,
//   transactionId,
//   metadata,
// }: {
//   actualUserId: string;
//   authUserId?: string;
//   userName: string;
//   userEmail: string;
//   userExists: boolean;
//   points: number;
//   reason: string;
//   transactionId: string;
//   metadata?: Record<string, unknown>;
// }): Promise<boolean> {
//   if (points <= 0) return false;

//   const leaderboardUserId = authUserId ?? actualUserId;

//   const transactionRef = db.collection("userPointTransactions").doc(transactionId);
//   const txSnap = await transactionRef.get();
//   if (txSnap.exists) return false;

//   const now = Date.now();
//   const batch = db.batch();
//
//   // 1. Transaction record (idempotency guard)
//   batch.set(transactionRef, {
//     userId: leaderboardUserId,
//     userEmail,
//     userName,
//     points,
//     reason,
//     metadata: metadata ?? {},
//     createdAt: now,
//   });

//   // 2. User doc — keyed on actualUserId (real Firestore doc ID)
//   if (userExists) {
//     const userRef = db.collection("users").doc(actualUserId);
//     batch.update(userRef, {
//       totalPoints: FieldValue.increment(points),
//       [`pointsBreakdown.${reason}`]: FieldValue.increment(points),
//       lastUpdated: now,
//     });
//   }

//   // 3. Global leaderboard — keyed on leaderboardUserId
//   const globalRef = db.collection("globalLeaderboard").doc(leaderboardUserId);
//   batch.set(
//     globalRef,
//     {
//       userId: leaderboardUserId,
//       userName,
//       userEmail,
//       totalPoints: FieldValue.increment(points),
//       lastUpdated: now,
//     },
//     { merge: true }
//   );

//   // 4. Activity log — one doc per event, subcollection under the user
//   //    Written in the same batch so it's atomic with the points write.
//   const activityRef = db
//     .collection("users")
//     .doc(actualUserId)
//     .collection("activityLog")
//     .doc();

//   batch.set(activityRef, {
//     type:      reason,
//     points:    points,
//     label:     getActivityLabel(reason, metadata),
//     metadata:  metadata ?? {},
//     createdAt: now,
//   });

//   await batch.commit();
//   return true;
// }







// // lib/userPoints.ts
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";

// // ─── Activity label map ───────────────────────────────────────────────────────
// const ACTIVITY_LABELS: Record<string, (meta?: Record<string, unknown>) => string> = {
//   LISTEN_COMPLETE:  (m) => `Listened to "${m?.title ?? "audio drop"}"`,
//   LISTEN_AUDIO_DROP: (m) => `Listened to "${m?.title ?? "audio drop"}"`,
//   FAN_BATTLE_WIN:   (m) => `Won a Fan Battle${m?.opponent ? ` vs ${m.opponent}` : ""}`,
//   FAN_BATTLE_PLAY:  ()  => "Played a Fan Battle",
//   CREATE_BATTLE:     ()  => "Created a Fan Battle",
//   PLAY_BATTLE:      ()  => "Played a Fan Battle",
//   POST_CREATED:     ()  => "Created a Fan Zone post",
//   CREATE_POST:      ()  => "Created a Fan Zone post",
//   TRIVIA_CORRECT:   (m) => `Answered trivia correctly${m?.topic ? ` — ${m.topic}` : ""}`,
//   REGISTRATION:     ()  => "Joined SportsFan360",
//   INVITE_ACCEPTED:  (m) => `Friend ${m?.friendName ?? "someone"} joined via your invite`,

//   // ── ROAR ──────────────────────────────────────────────────────────────────
//   ROAR_HOT_TAKE:    ()  => "Posted a ROAR Hot Take",
//   ROAR_PREDICTION:  (m) => `Made a ROAR Prediction${m?.sport ? ` — ${m.sport}` : ""}`,
//   ROAR_DEBATE:      (m) => `Started a ROAR Debate${m?.sideA ? ` (${m.sideA} vs ${m.sideB})` : ""}`,
//   ROAR_MEMORY:      ()  => "Created a ROAR Memory",
//   ROAR_POST:        ()  => "Created a ROAR Post",
//   ROAR_QUIZ:        ()  => "Answered a ROAR Quiz",
//   ROAR_RAW_REACTIONS: () => "Posted ROAR Raw Reactions",
// };

// function getActivityLabel(reason: string, meta?: Record<string, unknown>): string {
//   return ACTIVITY_LABELS[reason]?.(meta) ?? reason.replace(/_/g, " ").toLowerCase();
// }

// // // ─── getUserInfo 
// // export async function getUserInfo(
// //   userId: string,
// //   fallbackName?: string,
// //   fallbackEmail?: string
// // ): Promise<{
// //   userName: string;
// //   userEmail: string;
// //   exists: boolean;
// //   actualUserId: string;
// //   authUserId: string;
// // }> {
// //   try {
// //     let snap = await db.collection("users").doc(userId).get();
// //     let actualUserId = userId;

// //     if (!snap.exists && fallbackEmail) {
// //       const emailQuery = await db
// //         .collection("users")
// //         .where("email", "==", fallbackEmail)
// //         .limit(1)
// //         .get();

// //       if (!emailQuery.empty) {
// //         snap = emailQuery.docs[0];
// //         actualUserId = snap.id;
// //         console.log(`[getUserInfo] Found user by email: ${actualUserId} for authUserId: ${userId}`);
// //       }
// //     }

// //     if (snap.exists) {
// //       const d = snap.data()!;
// //       const userName = d.firstName
// //         ? [d.firstName, d.lastName].filter(Boolean).join(" ")
// //         : d.name ||
// //           (d.email ? d.email.split("@")[0] : fallbackName) ||
// //           "User";
// //       return {
// //         userName,
// //         userEmail: d.email || fallbackEmail || "",
// //         exists: true,
// //         actualUserId,
// //         authUserId: userId,
// //       };
// //     }

// //     return {
// //       userName: fallbackName || "User",
// //       userEmail: fallbackEmail || "",
// //       exists: false,
// //       actualUserId: userId,
// //       authUserId: userId,
// //     };
// //   } catch (err) {
// //     console.error("[getUserInfo] error:", err);
// //     return {
// //       userName: fallbackName || "User",
// //       userEmail: fallbackEmail || "",
// //       exists: false,
// //       actualUserId: userId,
// //       authUserId: userId,
// //     };
// //   }
// // }




// // ─── getUserInfo ──────────────────────────────────────────────────────────────
// export async function getUserInfo(
//   userId: string,
//   fallbackName?: string,
//   fallbackEmail?: string
// ): Promise<{
//   userName: string;
//   userEmail: string;
//   exists: boolean;
//   actualUserId: string;
//   authUserId: string;
// }> {
//   try {
//     let snap = await db.collection("users").doc(userId).get();
//     let actualUserId = userId;

//     // If not found by exact ID, try email lookup
//     if (!snap.exists && fallbackEmail) {
//       const emailQuery = await db
//         .collection("users")
//         .where("email", "==", fallbackEmail)
//         .limit(1)
//         .get();

//       if (!emailQuery.empty) {
//         snap = emailQuery.docs[0];
//         actualUserId = snap.id;
//         console.log(`[getUserInfo] Found user by email: ${actualUserId} for authUserId: ${userId}`);
//       }
//     }

//     // ✅ NEW: If userId contains '@' (email format), try the sanitized version
//     if (!snap.exists && userId.includes('@')) {
//       const sanitizedId = userId.replace(/\./g, '_').replace(/@/g, '_');
//       const sanitizedSnap = await db.collection("users").doc(sanitizedId).get();
      
//       if (sanitizedSnap.exists) {
//         snap = sanitizedSnap;
//         actualUserId = sanitizedId;
//         console.log(`[getUserInfo] Found user by sanitized ID: ${actualUserId} for authUserId: ${userId}`);
//       }
//     }

//     // ✅ NEW: If userId is sanitized format (contains '_' and no '@'), try email format
//     if (!snap.exists && userId.includes('_') && !userId.includes('@')) {
//       const emailFormatId = userId.replace(/_/g, '.');
//       const emailSnap = await db.collection("users").doc(emailFormatId).get();
      
//       if (emailSnap.exists) {
//         snap = emailSnap;
//         actualUserId = emailFormatId;
//         console.log(`[getUserInfo] Found user by email format: ${actualUserId} for authUserId: ${userId}`);
//       }
//     }

//     if (snap.exists) {
//       const d = snap.data()!;
//       const userName = d.firstName
//         ? [d.firstName, d.lastName].filter(Boolean).join(" ")
//         : d.name ||
//           (d.email ? d.email.split("@")[0] : fallbackName) ||
//           "User";
//       return {
//         userName,
//         userEmail: d.email || fallbackEmail || "",
//         exists: true,
//         actualUserId,
//         authUserId: userId,
//       };
//     }

//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//       actualUserId: userId,
//       authUserId: userId,
//     };
//   } catch (err) {
//     console.error("[getUserInfo] error:", err);
//     return {
//       userName: fallbackName || "User",
//       userEmail: fallbackEmail || "",
//       exists: false,
//       actualUserId: userId,
//       authUserId: userId,
//     };
//   }
// }



// // ─── awardUserPoints ──────────────────────────────────────────────────────────
// export async function awardUserPoints({
//   actualUserId,
//   authUserId,
//   userName,
//   userEmail,
//   userExists,
//   points,
//   reason,
//   transactionId,
//   metadata,
// }: {
//   actualUserId: string;
//   authUserId?: string;
//   userName: string;
//   userEmail: string;
//   userExists: boolean;
//   points: number;
//   reason: string;
//   transactionId: string;
//   metadata?: Record<string, unknown>;
// }): Promise<boolean> {
//   if (points <= 0) return false;

//   const leaderboardUserId = authUserId ?? actualUserId;

//   const transactionRef = db.collection("userPointTransactions").doc(transactionId);
//   const txSnap = await transactionRef.get();
//   if (txSnap.exists) return false;

//   const now = Date.now();
//   const batch = db.batch();
//   const defaultActivityLabel =
//     reason === "LISTEN_AUDIO_DROP" || reason === "LISTEN_COMPLETE"
//       ? "Listen Audio Drops"
//       : reason;
//   const defaultActivityType =
//     reason === "LISTEN_AUDIO_DROP" || reason === "LISTEN_COMPLETE"
//       ? "LISTEN_AUDIO_DROP"
//       : reason;
//   const activityLabel =
//     typeof metadata?.activityLabel === "string" ? metadata.activityLabel : defaultActivityLabel;
//   const activityType =
//     typeof metadata?.activityType === "string" ? metadata.activityType : defaultActivityType;

//   // 1. Transaction record (idempotency guard)
//   batch.set(transactionRef, {
//     userId: leaderboardUserId,
//     userEmail,
//     userName,
//     points,
//     reason,
//     type: activityType,
//     label: activityLabel,
//     metadata: metadata ?? {},
//     createdAt: now,
//   });

//   // 2. User doc — keyed on actualUserId
//   if (userExists) {
//     const userRef = db.collection("users").doc(actualUserId);
//     batch.update(userRef, {
//       totalPoints: FieldValue.increment(points),
//       [`pointsBreakdown.${reason}`]: FieldValue.increment(points),
//        [`activityCounts.${reason}`]: FieldValue.increment(1),
//       [`activityCounts.total`]: FieldValue.increment(1),
//       lastUpdated: now,
//     });
//   }

//   // 3. Global leaderboard — keyed on leaderboardUserId
//   const globalRef = db.collection("globalLeaderboard").doc(leaderboardUserId);
//   batch.set(
//     globalRef,
//     {
//       userId: leaderboardUserId,
//       userName,
//       userEmail,
//       totalPoints: FieldValue.increment(points),
//       lastUpdated: now,
//     },
//     { merge: true }
//   );

//   // 4. Activity log — atomic with the points write
//   const activityRef = db
//     .collection("users")
//     .doc(actualUserId)
//     .collection("activityLog")
//     .doc();

//   batch.set(activityRef, {
//     type:      reason,
//     points:    points,
//     label:     getActivityLabel(reason, metadata),
//     metadata:  metadata ?? {},
//     createdAt: now,
//   });

//   await batch.commit();
//   return true;
// }



// lib/userPoints.ts
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Activity label map ───────────────────────────────────────────────────────
const ACTIVITY_LABELS: Record<string, (meta?: Record<string, unknown>) => string> = {
  LISTEN_COMPLETE:  (m) => `Listened to "${m?.title ?? "audio drop"}"`,
  LISTEN_AUDIO_DROP: (m) => `Listened to "${m?.title ?? "audio drop"}"`,
  FAN_BATTLE_WIN:   (m) => `Won a Fan Battle${m?.opponent ? ` vs ${m.opponent}` : ""}`,
  FAN_BATTLE_PLAY:  ()  => "Played a Fan Battle",
  CREATE_BATTLE:     ()  => "Created a Fan Battle",
  PLAY_BATTLE:      ()  => "Played a Fan Battle",
  POST_CREATED:     ()  => "Created a Fan Zone post",
  CREATE_POST:      ()  => "Created a Fan Zone post",
  TRIVIA_CORRECT:   (m) => `Answered trivia correctly${m?.topic ? ` — ${m.topic}` : ""}`,
  REGISTRATION:     ()  => "Joined SportsFan360",
  INVITE_ACCEPTED:  (m) => `Friend ${m?.friendName ?? "someone"} joined via your invite`,

  // ── ROAR ──────────────────────────────────────────────────────────────────
  ROAR_HOT_TAKE:    ()  => "Posted a ROAR Hot Take",
  ROAR_PREDICTION:  (m) => `Made a ROAR Prediction${m?.sport ? ` — ${m.sport}` : ""}`,
  ROAR_DEBATE:      (m) => `Started a ROAR Debate${m?.sideA ? ` (${m.sideA} vs ${m.sideB})` : ""}`,
  ROAR_DEBATE_PARTICIPATE: () => "Voted on a ROAR Debate",
  ROAR_PREDICTION_PARTICIPATE: () => "Voted on a ROAR Prediction",
  ROAR_MEMORY:      ()  => "Created a ROAR Memory",
  ROAR_POST:        ()  => "Created a ROAR Post",
  ROAR_QUIZ:        ()  => "Answered a ROAR Quiz",
  ROAR_RAW_REACTIONS: () => "Posted ROAR Raw Reactions",
  ROAR_TRIVIA_CORRECT: (m) => `Answered a ROAR Trivia question correctly${m?.matchTitle ? ` — ${m.matchTitle}` : ""}`,
  ROAR_BATTLE_PARTICIPATE: (m) => `Voted in a ROAR Battle${m?.matchTitle ? ` — ${m.matchTitle}` : ""}`,
};

function getActivityLabel(reason: string, meta?: Record<string, unknown>): string {
  return ACTIVITY_LABELS[reason]?.(meta) ?? reason.replace(/_/g, " ").toLowerCase();
}

// Simple in-memory cache for user profiles to reduce Firestore reads
interface CachedUserProfile {
  userName: string;
  userEmail: string;
  exists: boolean;
  actualUserId: string;
  authUserId: string;
  cachedAt: number;
}

const userProfileCache = new Map<string, CachedUserProfile>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── getUserInfo ──────────────────────────────────────────────────────────────
export async function getUserInfo(
  userId: string,
  fallbackName?: string,
  fallbackEmail?: string
): Promise<{
  userName: string;
  userEmail: string;
  exists: boolean;
  actualUserId: string;
  authUserId: string;
}> {
  // Check cache first
  const cached = userProfileCache.get(userId);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return {
      userName: cached.userName,
      userEmail: cached.userEmail,
      exists: cached.exists,
      actualUserId: cached.actualUserId,
      authUserId: cached.authUserId,
    };
  }

  try {
    let snap = await db.collection("users").doc(userId).get();
    let actualUserId = userId;

    // If not found by exact ID, run fallback queries in parallel
    if (!snap.exists) {
      const fallbackPromises: Promise<any>[] = [];
      const promiseTypes: string[] = [];

      if (fallbackEmail) {
        fallbackPromises.push(
          db.collection("users").where("email", "==", fallbackEmail).limit(1).get()
        );
        promiseTypes.push("email");
      }

      let sanitizedId = "";
      if (userId.includes('@')) {
        sanitizedId = userId.replace(/\./g, '_').replace(/@/g, '_');
        fallbackPromises.push(db.collection("users").doc(sanitizedId).get());
        promiseTypes.push("sanitized");
      }

      let emailFormatId = "";
      if (userId.includes('_') && !userId.includes('@')) {
        emailFormatId = userId.replace(/_/g, '.');
        fallbackPromises.push(db.collection("users").doc(emailFormatId).get());
        promiseTypes.push("emailFormat");
      }

      const results = await Promise.all(fallbackPromises);

      for (let i = 0; i < results.length; i++) {
        const type = promiseTypes[i];
        const res = results[i];

        if (type === "email" && !res.empty) {
          snap = res.docs[0];
          actualUserId = snap.id;
          console.log(`[getUserInfo] Found user by email: ${actualUserId} for authUserId: ${userId}`);
          break;
        } else if (type === "sanitized" && res.exists) {
          snap = res;
          actualUserId = sanitizedId;
          console.log(`[getUserInfo] Found user by sanitized ID: ${actualUserId} for authUserId: ${userId}`);
          break;
        } else if (type === "emailFormat" && res.exists) {
          snap = res;
          actualUserId = emailFormatId;
          console.log(`[getUserInfo] Found user by email format: ${actualUserId} for authUserId: ${userId}`);
          break;
        }
      }
    }

    let resolvedProfile;

    if (snap.exists) {
      const d = snap.data()!;
      const userName = d.firstName
        ? [d.firstName, d.lastName].filter(Boolean).join(" ")
        : d.name ||
          (d.email ? d.email.split("@")[0] : fallbackName) ||
          "User";
      resolvedProfile = {
        userName,
        userEmail: d.email || fallbackEmail || "",
        exists: true,
        actualUserId,
        authUserId: userId,
      };
    } else {
      resolvedProfile = {
        userName: fallbackName || "User",
        userEmail: fallbackEmail || "",
        exists: false,
        actualUserId: userId,
        authUserId: userId,
      };
    }

    // Cache the resolved profile
    userProfileCache.set(userId, {
      ...resolvedProfile,
      cachedAt: Date.now(),
    });

    return resolvedProfile;
  } catch (err) {
    console.error("[getUserInfo] error:", err);
    return {
      userName: fallbackName || "User",
      userEmail: fallbackEmail || "",
      exists: false,
      actualUserId: userId,
      authUserId: userId,
    };
  }
}

// ─── awardUserPoints ──────────────────────────────────────────────────────────
export async function awardUserPoints({
  actualUserId,
  authUserId,
  userName,
  userEmail,
  userExists,
  points,
  reason,
  transactionId,
  metadata,
}: {
  actualUserId: string;
  authUserId?: string;
  userName: string;
  userEmail: string;
  userExists: boolean;
  points: number;
  reason: string;
  transactionId: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (points <= 0) return false;

  const leaderboardUserId = authUserId ?? actualUserId;

  const transactionRef = db.collection("userPointTransactions").doc(transactionId);
  const userRef = db.collection("users").doc(actualUserId);
  const globalRef = db.collection("globalLeaderboard").doc(leaderboardUserId);
  const activityRef = db.collection("users").doc(actualUserId).collection("activityLog").doc();

  try {
    const success = await db.runTransaction(async (transaction) => {
      // 1. Read phase (idempotency guard)
      const txSnap = await transaction.get(transactionRef);
      if (txSnap.exists) {
        return false;
      }

      const now = Date.now();
      const defaultActivityLabel =
        reason === "LISTEN_AUDIO_DROP" || reason === "LISTEN_COMPLETE"
          ? "Listen Audio Drops"
          : reason;
      const defaultActivityType =
        reason === "LISTEN_AUDIO_DROP" || reason === "LISTEN_COMPLETE"
          ? "LISTEN_AUDIO_DROP"
          : reason;
      const activityLabel =
        typeof metadata?.activityLabel === "string" ? metadata.activityLabel : defaultActivityLabel;
      const activityType =
        typeof metadata?.activityType === "string" ? metadata.activityType : defaultActivityType;

      // 2. Write phase
      // A. Transaction record
      transaction.set(transactionRef, {
        userId: leaderboardUserId,
        userEmail,
        userName,
        points,
        reason,
        type: activityType,
        label: activityLabel,
        metadata: metadata ?? {},
        createdAt: now,
      });

      // B. User doc
      if (userExists) {
        transaction.update(userRef, {
          totalPoints: FieldValue.increment(points),
          [`pointsBreakdown.${reason}`]: FieldValue.increment(points),
          [`activityCounts.${reason}`]: FieldValue.increment(1),
          [`activityCounts.total`]: FieldValue.increment(1),
          lastUpdated: now,
        });
      }

      // C. Global leaderboard
      transaction.set(
        globalRef,
        {
          userId: leaderboardUserId,
          userName,
          userEmail,
          totalPoints: FieldValue.increment(points),
          lastUpdated: now,
        },
        { merge: true }
      );

      // D. Activity log
      transaction.set(activityRef, {
        type:      reason,
        points:    points,
        label:     getActivityLabel(reason, metadata),
        metadata:  metadata ?? {},
        createdAt: now,
      });

      return true;
    });

    return success;
  } catch (error) {
    console.error("[awardUserPoints] Transaction failed:", error);
    return false;
  }
}