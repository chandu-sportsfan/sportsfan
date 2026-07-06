

// // app/api/roar/profile/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import type { User } from "@/app/models/RoarUser";
// import type { BadgeProgress } from "@/app/models/BadgeProgress";
// import type { Post } from "@/app/models/Post";

// // ── Canonical doc resolution ───────────────────────────────────────────────
// // Priority flipped from doc(email)-first to doc(userId)-first.
// //
// // Reasoning: for users who already have two docs (email-keyed + sanitized-
// // userId-keyed, created by the now-fixed app/api/profile/route.ts bug),
// // the sanitized doc(userId) is the one accumulating their current/ongoing
// // activity (points, posts, badges). The email-keyed doc is frozen at
// // whatever it had before the duplicate was created. Trying doc(email)
// // first would silently surface stale data and cause PATCH to keep writing
// // to the stale doc, widening the split instead of converging on one doc.
// //
// // For users who only ever have ONE doc (no duplicate yet — most password-
// // only or not-yet-affected users), this still works correctly: doc(userId)
// // won't exist, so it falls back to doc(email) and finds their single doc
// // as before. Nothing changes for that group.
// async function resolveUserDoc(userId: string, email: string) {
//   let docRef = db.collection("users").doc(userId);
//   let snap = await docRef.get();
//   if (!snap.exists) {
//     docRef = db.collection("users").doc(email);
//     snap = await docRef.get();
//     if (!snap.exists) return null;
//   }
//   return { docRef, snap };
// }


// // async function resolveUserDoc(userId: string, email: string) {
// //   // ── 1. Try userId as doc ID (happy path for most users) ───────────────────
// //   let docRef = db.collection("users").doc(userId);
// //   let snap = await docRef.get();
// //   if (snap.exists) return { docRef, snap };

// //   // ── 2. Try raw email as doc ID (legacy users created before sanitization) ──
// //   docRef = db.collection("users").doc(email);
// //   snap = await docRef.get();
// //   if (snap.exists) return { docRef, snap };

// //   // ── 3. Query by email field (catches any non-standard doc ID) ─────────────
// //   // This is the same fallback getUserInfo() uses and is what finds users
// //   // whose doc ID doesn't match the derived userId or raw email — e.g.
// //   // "prince_princechandu357_gmail_com" when we derive "princechandu357_gmail_com".
// //   const emailQuery = await db
// //     .collection("users")
// //     .where("email", "==", email)
// //     .limit(1)
// //     .get();

// //   if (!emailQuery.empty) {
// //     const queryDoc = emailQuery.docs[0];
// //     return { docRef: queryDoc.ref, snap: queryDoc };
// //   }

// //   return null;
// // }

// // export async function GET(req: NextRequest) {
// //   try {
// //     const user = await getUser(req);
// //     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// //     const resolved = await resolveUserDoc(user.userId, user.email);
// //     if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

// //     const { docRef, snap } = resolved;
// //     const resolvedUserId = docRef.id;
// //     const userData = snap.data() as any;

// //     if (!userData || !userData.username || !userData.badge) {
// //       return NextResponse.json({ error: "ROAR profile not onboarded", onboarded: false }, { status: 404 });
// //     }

// //     const [badgesSnap, postsSnap, rivalSnap] = await Promise.all([
// //       db.collection("roarBadges").doc(resolvedUserId).collection("roarProgress").get(),
// //       db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
// //       db.collection("rivals").doc(resolvedUserId).get(),
// //     ]);

// //     const accuracy = userData.predictionCount > 0
// //       ? Math.round((userData.correctPredictions / userData.predictionCount) * 100) : 0;

// //     const allPosts = postsSnap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
// //     const sortedPosts = allPosts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

// //     return NextResponse.json({
// //       success: true,
// //       user: {
// //         ...userData,
// //         accuracy,
// //         actualUserId: resolvedUserId,
// //         // canonical names — Profile.tsx reads these
// //         favPlayer: userData.favPlayer ?? null,
// //         about: userData.about ?? null,
// //         avatarUrl: userData.avatarUrl ?? null,
// //       },
// //       badges: badgesSnap.docs.map((d) => ({ ...d.data(), badgeId: d.id })),
// //       predictions: sortedPosts.filter((p: any) => p.type === "prediction").slice(0, 20),
// //       hotTakes: sortedPosts.filter((p: any) => p.type === "hot_take").slice(0, 10),
// //       rival: rivalSnap.exists ? rivalSnap.data() : null,
// //     });
// //   } catch (error: unknown) {
// //     const msg = error instanceof Error ? error.message : "Unexpected error";
// //     console.error("GET /api/roar/profile error:", error);
// //     return NextResponse.json({ error: msg }, { status: 500 });
// //   }
// // }


// export async function GET(req: NextRequest) {
//   try {
//     // console.log("[profile] cookies:", req.cookies.getAll()); // ← add this
//     const user = await getUser(req);

//     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


//     const { searchParams } = new URL(req.url);
//     const targetUserId = searchParams.get("userId");

//     let docRef, snap;

//     if (targetUserId) {
//       // ── Other user's profile — direct doc-ID lookup, no email fallback ──
//       docRef = db.collection("users").doc(targetUserId);
//       snap = await docRef.get();
//       if (!snap.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
//     } else {
//       // ── Self — existing flow, unchanged ──
//       const resolved = await resolveUserDoc(user.userId, user.email);
//       if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
//       ({ docRef, snap } = resolved);
//     }

//     const resolvedUserId = docRef.id;
//     const userData = snap.data() as any;

//     // if (!userData || !userData.username || !userData.badge) {
//     //   return NextResponse.json({ error: "ROAR profile not onboarded", onboarded: false }, { status: 404 });
//     // }

//     const [badgesSnap, postsSnap, rivalSnap] = await Promise.all([
//       db.collection("roarBadges").doc(resolvedUserId).collection("roarProgress").get(),
//       db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
//       db.collection("rivals").doc(resolvedUserId).get(),
//     ]);

//     const predictionStats = userData.predictionStats ?? {};
//     const resolvedPredictionCount = predictionStats.participated ?? 0;
//     const correctPredictionCount = predictionStats.correct ?? 0;
//     const accuracy = resolvedPredictionCount > 0
//       ? Math.round((correctPredictionCount / resolvedPredictionCount) * 100) : 0;

//     const allPosts = postsSnap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
//     const sortedPosts = allPosts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

//     return NextResponse.json({
//       success: true,
//       user: {
//         ...userData,
//         accuracy,
//         predictionStats,
//         predictionCount: resolvedPredictionCount,
//         correctPredictions: correctPredictionCount,
//         actualUserId: resolvedUserId,
//         badge: userData.badge ?? null,
//         favPlayer: userData.favPlayer ?? null,
//         about: userData.about ?? null,
//         avatarUrl: userData.avatarUrl ?? null,
//       },
//       badges: badgesSnap.docs.map((d) => ({ ...d.data(), badgeId: d.id })),
//       predictions: sortedPosts.filter((p: any) => p.type === "prediction").slice(0, 20),
//       hotTakes: sortedPosts.filter((p: any) => p.type === "hot_take").slice(0, 10),
//       rival: rivalSnap.exists ? rivalSnap.data() : null,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/profile error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }


// export async function PATCH(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const body = await req.json();
//     const updates: Record<string, unknown> = { updatedAt: Date.now() };

//     // username (display name in Profile.tsx)
//     if (body.username !== undefined) {
//       const v = String(body.username).trim().replace(/\s+/g, " ");
//       if (v.length >= 2 && v.length <= 30 && /^[A-Za-z0-9_ -]+$/.test(v)) {
//         updates.username = v;
//       } else {
//         return NextResponse.json({ error: "Invalid username." }, { status: 422 });
//       }
//     }

//     // favPlayer
//     if (body.favPlayer !== undefined) {
//       updates.favPlayer = String(body.favPlayer).trim().slice(0, 60);
//     }

//     // about
//     if (body.about !== undefined) {
//       updates.about = String(body.about).trim().slice(0, 300);
//     }

//     // avatarUrl
//     if (body.avatarUrl !== undefined) {
//       const v = String(body.avatarUrl).trim();
//       if (v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("http://")) {
//         updates.avatarUrl = v;
//       } else {
//         return NextResponse.json({ error: "Invalid avatarUrl." }, { status: 422 });
//       }
//     }

//     // showPredHistory
//     if (body.showPredHistory !== undefined) {
//       updates.showPredHistory = Boolean(body.showPredHistory);
//     }

//     // standard passthrough fields
//     for (const field of ["fcmToken", "settings", "teams", "sports"]) {
//       if (body[field] !== undefined) updates[field] = body[field];
//     }

//     const meaningfulKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
//     if (meaningfulKeys.length === 0) {
//       return NextResponse.json({ error: "No fields to update." }, { status: 400 });
//     }

//     const resolved = await resolveUserDoc(user.userId, user.email);
//     if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

//     await resolved.docRef.set(updates, { merge: true });

//     return NextResponse.json({ success: true, updatedFields: meaningfulKeys });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("PATCH /api/roar/profile error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






// app/api/roar/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { getUserInfo } from "@/lib/userPoints";
import type { User } from "@/app/models/RoarUser";
import type { BadgeProgress } from "@/app/models/BadgeProgress";
import type { Post } from "@/app/models/Post";
import {
  getGlobalTier,
  getGlobalTierProgress,
  getAllFeatureBadges,
  getSpecialBadges,
  FeatureKey,
} from "@/lib/roarBadges";

// ── Canonical doc resolution ───────────────────────────────────────────────
// Priority flipped from doc(email)-first to doc(userId)-first.
//
// Reasoning: for users who already have two docs (email-keyed + sanitized-
// userId-keyed, created by the now-fixed app/api/profile/route.ts bug),
// the sanitized doc(userId) is the one accumulating their current/ongoing
// activity (points, posts, badges). The email-keyed doc is frozen at
// whatever it had before the duplicate was created. Trying doc(email)
// first would silently surface stale data and cause PATCH to keep writing
// to the stale doc, widening the split instead of converging on one doc.
//
// For users who only ever have ONE doc (no duplicate yet — most password-
// only or not-yet-affected users), this still works correctly: doc(userId)
// won't exist, so it falls back to doc(email) and finds their single doc
// as before. Nothing changes for that group.
async function resolveUserDoc(userId: string, email: string) {
  let docRef = db.collection("users").doc(userId);
  let snap = await docRef.get();
  if (!snap.exists) {
    docRef = db.collection("users").doc(email);
    snap = await docRef.get();
    if (!snap.exists) return null;
  }
  return { docRef, snap };
}


// async function resolveUserDoc(userId: string, email: string) {
//   // ── 1. Try userId as doc ID (happy path for most users) ───────────────────
//   let docRef = db.collection("users").doc(userId);
//   let snap = await docRef.get();
//   if (snap.exists) return { docRef, snap };

//   // ── 2. Try raw email as doc ID (legacy users created before sanitization) ──
//   docRef = db.collection("users").doc(email);
//   snap = await docRef.get();
//   if (snap.exists) return { docRef, snap };

//   // ── 3. Query by email field (catches any non-standard doc ID) ─────────────
//   // This is the same fallback getUserInfo() uses and is what finds users
//   // whose doc ID doesn't match the derived userId or raw email — e.g.
//   // "prince_princechandu357_gmail_com" when we derive "princechandu357_gmail_com".
//   const emailQuery = await db
//     .collection("users")
//     .where("email", "==", email)
//     .limit(1)
//     .get();

//   if (!emailQuery.empty) {
//     const queryDoc = emailQuery.docs[0];
//     return { docRef: queryDoc.ref, snap: queryDoc };
//   }

//   return null;
// }

// export async function GET(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const resolved = await resolveUserDoc(user.userId, user.email);
//     if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

//     const { docRef, snap } = resolved;
//     const resolvedUserId = docRef.id;
//     const userData = snap.data() as any;

//     if (!userData || !userData.username || !userData.badge) {
//       return NextResponse.json({ error: "ROAR profile not onboarded", onboarded: false }, { status: 404 });
//     }

//     const [badgesSnap, postsSnap, rivalSnap] = await Promise.all([
//       db.collection("roarBadges").doc(resolvedUserId).collection("roarProgress").get(),
//       db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
//       db.collection("rivals").doc(resolvedUserId).get(),
//     ]);

//     const accuracy = userData.predictionCount > 0
//       ? Math.round((userData.correctPredictions / userData.predictionCount) * 100) : 0;

//     const allPosts = postsSnap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
//     const sortedPosts = allPosts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

//     return NextResponse.json({
//       success: true,
//       user: {
//         ...userData,
//         accuracy,
//         actualUserId: resolvedUserId,
//         // canonical names — Profile.tsx reads these
//         favPlayer: userData.favPlayer ?? null,
//         about: userData.about ?? null,
//         avatarUrl: userData.avatarUrl ?? null,
//       },
//       badges: badgesSnap.docs.map((d) => ({ ...d.data(), badgeId: d.id })),
//       predictions: sortedPosts.filter((p: any) => p.type === "prediction").slice(0, 20),
//       hotTakes: sortedPosts.filter((p: any) => p.type === "hot_take").slice(0, 10),
//       rival: rivalSnap.exists ? rivalSnap.data() : null,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/profile error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }


export async function GET(req: NextRequest) {
  try {
    // console.log("[profile] cookies:", req.cookies.getAll()); // ← add this
    const user = await getUser(req);

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    let docRef, snap;

    if (targetUserId) {
      // ── Other user's profile — resolve through getUserInfo's fallback
      // chain instead of a bare doc-ID lookup.
      //
      // targetUserId typically arrives here as whatever ID some other part
      // of the app attached to a post/message/reaction (authorUid, reactor
      // userId, etc). Not every write path resolves that ID through
      // getUserInfo before storing it (e.g. likesection previously stored
      // the raw session userId), so targetUserId is not guaranteed to be
      // the literal users/{id} doc ID. Resolving here means:
      //   1. It's still correct for write paths that already resolve properly.
      //   2. It's now also correct for write paths that don't (yet).
      //   3. It self-heals old/legacy docs written before those paths were fixed.
      const info = await getUserInfo(targetUserId);
      if (!info.exists) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      docRef = db.collection("users").doc(info.actualUserId);
      snap = await docRef.get();
      if (!snap.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    } else {
      // ── Self — existing flow, unchanged ──
      const resolved = await resolveUserDoc(user.userId, user.email);
      if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      ({ docRef, snap } = resolved);
    }

    const resolvedUserId = docRef.id;
    const userData = snap.data() as any;

    // if (!userData || !userData.username || !userData.badge) {
    //   return NextResponse.json({ error: "ROAR profile not onboarded", onboarded: false }, { status: 404 });
    // }

    // const [badgesSnap, postsSnap, rivalSnap] = await Promise.all([
    //   db.collection("roarBadges").doc(resolvedUserId).collection("roarProgress").get(),
    //   db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
    //   db.collection("rivals").doc(resolvedUserId).get(),
    // ]);
    const [postsSnap, rivalSnap] = await Promise.all([
      db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
      db.collection("rivals").doc(resolvedUserId).get(),
    ]);

    const predictionStats = userData.predictionStats ?? {};
    const resolvedPredictionCount = predictionStats.participated ?? 0;
    const correctPredictionCount = predictionStats.correct ?? 0;
    const accuracy = resolvedPredictionCount > 0
      ? Math.round((correctPredictionCount / resolvedPredictionCount) * 100) : 0;

    const allPosts = postsSnap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
    const sortedPosts = allPosts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    const actCounts = userData.activityCounts ?? {};

  const featureCounts: Partial<Record<FeatureKey, number>> = {
  post:        actCounts.ROAR_POST ?? 0,
  debate:      actCounts.ROAR_DEBATE_PARTICIPATE ?? 0,
  prediction:  actCounts.ROAR_PREDICTION_PARTICIPATE ?? 0,
  trivia:      actCounts.ROAR_TRIVIA_CORRECT ?? 0,       // fixed: was ROAR_QUIZ
  fanBattle:   actCounts.ROAR_BATTLE_PARTICIPATE ?? 0,    // fixed: was ROAR_FAN_BATTLE_PARTICIPATE
  community:   actCounts.likesReceived ?? 0,              // not tracked yet — see below
  shares:      actCounts.ROAR_SHARE ?? 0,                 // not tracked yet — see below
  comments:    actCounts.ROAR_COMMENT ?? 0,               // not tracked yet — see below
  media:       actCounts.ROAR_MEDIA_UPLOAD ?? 0,          // not tracked yet — see below
};

    const featureBadges = getAllFeatureBadges(featureCounts);

    const globalXp = userData.totalPoints ?? userData.reputationScore ?? 0;
    const globalTier = getGlobalTier(globalXp);
    const globalTierProgress = getGlobalTierProgress(globalXp);

    const specialBadges = getSpecialBadges(
      {
        longestStreak: userData.longestStreak ?? userData.currentStreak ?? 0,
        hasViralPost: userData.hasViralPost ?? false,      // wire up when viral-post tracking exists
        hasSeasonTop100: userData.hasSeasonTop100 ?? false, // wire up when seasons exist
        hasSeasonTop3: userData.hasSeasonTop3 ?? false,
      },
      featureBadges
    );

    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        accuracy,
        predictionStats,
        predictionCount: resolvedPredictionCount,
        correctPredictions: correctPredictionCount,
        actualUserId: resolvedUserId,
        badge: userData.badge ?? null,
        favPlayer: userData.favPlayer ?? null,
        about: userData.about ?? null,
        avatarUrl: userData.avatarUrl ?? null,
      },
      // badges: badgesSnap.docs.map((d) => ({ ...d.data(), badgeId: d.id })),
      globalTier,            // { tier, tierLevel, subRank, label, min, max }
      globalTierProgress,    // 0-100
      featureBadges,          // FeatureBadgeState[] — 9 entries
      specialBadges,
      predictions: sortedPosts.filter((p: any) => p.type === "prediction").slice(0, 20),
      hotTakes: sortedPosts.filter((p: any) => p.type === "hot_take").slice(0, 10),
      rival: rivalSnap.exists ? rivalSnap.data() : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    // username (display name in Profile.tsx)
    if (body.username !== undefined) {
      const v = String(body.username).trim().replace(/\s+/g, " ");
      if (v.length >= 2 && v.length <= 30 && /^[A-Za-z0-9_ -]+$/.test(v)) {
        updates.username = v;
      } else {
        return NextResponse.json({ error: "Invalid username." }, { status: 422 });
      }
    }

    // favPlayer
    if (body.favPlayer !== undefined) {
      updates.favPlayer = String(body.favPlayer).trim().slice(0, 60);
    }

    // about
    if (body.about !== undefined) {
      updates.about = String(body.about).trim().slice(0, 300);
    }

    // avatarUrl
    if (body.avatarUrl !== undefined) {
      const v = String(body.avatarUrl).trim();
      if (v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("http://")) {
        updates.avatarUrl = v;
      } else {
        return NextResponse.json({ error: "Invalid avatarUrl." }, { status: 422 });
      }
    }

    // showPredHistory
    if (body.showPredHistory !== undefined) {
      updates.showPredHistory = Boolean(body.showPredHistory);
    }

    if (body.showActivity !== undefined) {
      updates.showActivity = Boolean(body.showActivity);
    }

    // standard passthrough fields
    for (const field of ["fcmToken", "settings", "teams", "sports"]) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const meaningfulKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (meaningfulKeys.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const resolved = await resolveUserDoc(user.userId, user.email);
    if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    await resolved.docRef.set(updates, { merge: true });

    return NextResponse.json({ success: true, updatedFields: meaningfulKeys });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}