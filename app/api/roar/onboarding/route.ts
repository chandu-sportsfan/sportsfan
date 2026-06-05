import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import type { User } from "../../../models/RoarUser";

export async function POST(req: NextRequest) {
  console.log("Hit the onboarding api");
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sports, teams, tenure, badge, firstContribution } = body;

    if (!sports?.length || !tenure || !badge) {
      return NextResponse.json(
        { error: "sports, tenure and badge are required" },
        { status: 400 },
      );
    }

    const tenureToYear: Record<string, string> = {
      rising: "2023",
      seasoned: "2015",
      og: "2005",
    };

    const now = Date.now();

    const userData: User = {
      uid: user.userId,
      username: user.name || user.email.split("@")[0],
      handle: user.email.split("@")[0].toLowerCase(),
      sports,
      teams: teams ?? [],
      tenure,
      badge,
      badgesUnlocked: [badge],
      fanSince: tenureToYear[tenure] ?? "2023",
      reputationScore: 0,
      predictionCount: 0,
      correctPredictions: 0,
      hotTakeCount: 0,
      rank: 9999,
      rivalUid: null,
      fcmToken: null,
      settings: {
        showPredictionHistory: true,
        audience: "Everyone",
      },
      createdAt: now,
      updatedAt: now,
    };

    // Write user doc
    await db
      .collection("users")
      .doc(user.userId)
      .set(userData, { merge: true });

    // Seed starter badge progress
    await db
      .collection("roarBadges")
      .doc(user.userId)
      .collection("roarProgress")
      .doc(badge)
      .set({
        badgeId: badge,
        uid: user.userId,
        unlocked: true,
        progress: 100,
        earnedAt: now,
      });

    // Seed progress=0 for all other badges so frontend can display them
    const otherBadges = [
      "ORACLE",
      "BOLD_CALLER",
      "CRICKET_HEAD",
      "CONTRARIAN",
      "OG_FAN",
      "SEASONED_FAN",
      "RISING_FAN",
    ].filter((b) => b !== badge);

    const batch = db.batch();
    for (const b of otherBadges) {
      const ref = db
        .collection("roarBadges")
        .doc(user.userId)
        .collection("roarProgress")
        .doc(b);
      batch.set(ref, {
        badgeId: b,
        uid: user.userId,
        unlocked: false,
        progress: 0,
      });
    }

    // First contribution post
    if (firstContribution) {
      const postRef = db.collection("posts").doc();
      batch.set(postRef, {
        postId: postRef.id,
        authorUid: user.userId,
        authorUsername: userData.username,
        authorBadge: badge,
        type: "hot_take",
        sport: sports[0],
        text: firstContribution,
        audience: "Everyone",
        agreeCount: 0,
        disagreeCount: 0,
        replyCount: 0,
        isLive: false,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, badge, uid: user.userId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/onboarding error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
