// app/api/roar/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
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

// GET: Inquire profile stats (Service 2 - fully merged with legacy predictions, hot takes and accuracy data)
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    let docRef, snap;

    if (targetUserId) {
      // Other user's profile
      docRef = db.collection("users").doc(targetUserId);
      snap = await docRef.get();
      if (!snap.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    } else {
      // Self
      const resolved = await resolveUserDoc(user.userId, user.email);
      if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      ({ docRef, snap } = resolved);
    }

    const resolvedUserId = docRef.id;
    const userData = snap.data() as any;

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
      trivia:      actCounts.ROAR_TRIVIA_CORRECT ?? 0,       
      fanBattle:   actCounts.ROAR_BATTLE_PARTICIPATE ?? 0,    
      community:   actCounts.likesReceived ?? 0,              
      shares:      actCounts.ROAR_SHARE ?? 0,                 
      comments:    actCounts.ROAR_COMMENT ?? 0,               
      media:       actCounts.ROAR_MEDIA_UPLOAD ?? 0,          
    };

    const featureBadges = getAllFeatureBadges(featureCounts);

    const globalXp = userData.totalPoints ?? userData.reputationScore ?? 0;
    const legacyGlobalTier = getGlobalTier(globalXp);
    const globalTierProgress = getGlobalTierProgress(globalXp);

    const specialBadges = getSpecialBadges(
      {
        longestStreak: userData.longestStreak ?? userData.currentStreak ?? 0,
        hasViralPost: userData.hasViralPost ?? false,      
        hasSeasonTop100: userData.hasSeasonTop100 ?? false, 
        hasSeasonTop3: userData.hasSeasonTop3 ?? false,
      },
      featureBadges
    );

    // Merge and return the legacy format plus our new optimized gamification fields
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
        
        // New Gamification Fields (Service 2 - dynamic lookup parameters)
        totalXP: userData.totalXP ?? globalXp,
        totalPoints: userData.totalPoints ?? globalXp,
        reputationScore: userData.reputationScore ?? globalXp,
        globalTier: userData.globalTier ?? legacyGlobalTier.tier,
        subRank: userData.subRank ?? legacyGlobalTier.subRank,
        currentLoginStreak: userData.currentLoginStreak ?? 0,
        loginStreakMultiplier: userData.loginStreakMultiplier ?? 1.0,
        streakFreezeCount: userData.streakFreezeCount ?? 0,
        featureStats: userData.featureStats ?? {},
        featureLevels: userData.featureLevels ?? {},
        isCompletionist: userData.isCompletionist ?? false
      },
      globalTier: legacyGlobalTier,            
      globalTierProgress,    
      featureBadges,          
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

// PATCH: Update user profile settings (unchanged to prevent breakages)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (body.username !== undefined) {
      const v = String(body.username).trim().replace(/\s+/g, " ");
      if (v.length >= 2 && v.length <= 30 && /^[A-Za-z0-9_ -]+$/.test(v)) {
        updates.username = v;
      } else {
        return NextResponse.json({ error: "Invalid username." }, { status: 422 });
      }
    }

    if (body.favPlayer !== undefined) {
      updates.favPlayer = String(body.favPlayer).trim().slice(0, 60);
    }

    if (body.about !== undefined) {
      updates.about = String(body.about).trim().slice(0, 300);
    }

    if (body.avatarUrl !== undefined) {
      const v = String(body.avatarUrl).trim();
      if (v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("http://")) {
        updates.avatarUrl = v;
      } else {
        return NextResponse.json({ error: "Invalid avatarUrl." }, { status: 422 });
      }
    }

    if (body.showPredHistory !== undefined) {
      updates.showPredHistory = Boolean(body.showPredHistory);
    }

    if (body.showActivity !== undefined) {
      updates.showActivity = Boolean(body.showActivity);
    }

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