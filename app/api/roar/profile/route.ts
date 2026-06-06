import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { User } from "@/app/models/RoarUser";
import type { BadgeProgress } from "@/app/models/BadgeProgress";
import type { Post } from "@/app/models/Post";

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userSnap, badgesSnap, postsSnap, rivalSnap] =
      await Promise.all([
        db.collection("users").doc(user.email).get(),
        db.collection("roarBadges").doc(user.userId).collection("roarProgress").get(),
        db
          .collection("roarPosts")
          .where("authorUid", "==", user.userId)
          .get(),
        db.collection("rivals").doc(user.userId).get(),
      ]);

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const userData = userSnap.data() as User;
    const accuracy =
      userData.predictionCount > 0
        ? Math.round(
            (userData.correctPredictions / userData.predictionCount) * 100,
          )
        : 0;

    const allPosts = postsSnap.docs.map((d) => ({
      ...(d.data() as Post),
      postId: d.id,
    }));

    const sortedPosts = allPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const predictions = sortedPosts.filter((p) => p.type === "prediction").slice(0, 20);
    const hotTakes = sortedPosts.filter((p) => p.type === "hot_take").slice(0, 10);

    return NextResponse.json({
      success: true,
      user: { ...userData, accuracy },
      badges: badgesSnap.docs.map((d) => ({
        ...(d.data() as BadgeProgress),
        badgeId: d.id,
      })),
      predictions,
      hotTakes,
      rival: rivalSnap.exists ? rivalSnap.data() : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/roar/profile  — edit display name, settings, fcmToken
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const allowedFields = [
      "username",
      "fcmToken",
      "settings",
      "teams",
      "sports",
    ];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    await db.collection("users").doc(user.email).update(updates);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
