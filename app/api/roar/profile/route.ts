// app/api/roar/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { User } from "@/app/models/RoarUser";
import type { BadgeProgress } from "@/app/models/BadgeProgress";
import type { Post } from "@/app/models/Post";

async function resolveUserDoc(userId: string, email: string) {
  let docRef = db.collection("users").doc(email);
  let snap = await docRef.get();
  if (!snap.exists) {
    docRef = db.collection("users").doc(userId);
    snap = await docRef.get();
    if (!snap.exists) return null;
  }
  return { docRef, snap };
}

// ─── Badge calculation from room activities ──────────────────────────────────
interface ActivityItem {
  type: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface BadgeData {
  id: string;
  name: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
}

function calculateBadgesFromActivities(activities: ActivityItem[]): BadgeData[] {
  const postCount = activities.filter((a) =>
    ["ROAR_POST", "ROAR_HOT_TAKE", "ROAR_MEMORY"].includes(a.type)
  ).length;

  const predictionCount = activities.filter((a) => a.type === "ROAR_PREDICTION").length;
  const debateCount = activities.filter((a) => a.type === "ROAR_DEBATE").length;
  const totalActivities = activities.length;

  const firstActivityTime = activities.length > 0 ? activities[activities.length - 1].createdAt : undefined;

  return [
    {
      id: "FIRST_POST",
      name: "First Post",
      unlocked: postCount >= 1,
      unlockedAt: postCount >= 1 ? firstActivityTime : undefined,
      progress: postCount,
    },
    {
      id: "POST_10",
      name: "10 Posts",
      unlocked: postCount >= 10,
      progress: Math.min(postCount, 10),
    },
    {
      id: "PREDICTION_EXPERT",
      name: "Prediction Expert",
      unlocked: predictionCount >= 5,
      progress: Math.min(predictionCount, 5),
    },
    {
      id: "DEBATE_STARTER",
      name: "Debate Starter",
      unlocked: debateCount >= 3,
      progress: Math.min(debateCount, 3),
    },
    {
      id: "ACTIVE_CONTRIBUTOR",
      name: "Active Contributor",
      unlocked: totalActivities >= 20,
      progress: Math.min(totalActivities, 20),
    },
    {
      id: "TOP_FAN",
      name: "Top Fan",
      unlocked: totalActivities >= 50,
      progress: Math.min(totalActivities, 50),
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = await resolveUserDoc(user.userId, user.email);
    if (!resolved) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const { docRef, snap } = resolved;
    const resolvedUserId = docRef.id;
    const userData = snap.data() as any;

    if (!userData || !userData.username || !userData.badge) {
      return NextResponse.json({ error: "ROAR profile not onboarded", onboarded: false }, { status: 404 });
    }

    // ── Fetch activities from activityLog (room-aware) ─────────────────────────
    const [activitiesSnap, rivalSnap] = await Promise.all([
      db
        .collection("users")
        .doc(resolvedUserId)
        .collection("activityLog")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get(),
      db.collection("rivals").doc(resolvedUserId).get(),
    ]);

    const activities = activitiesSnap.docs
      .map((d) => ({
        id: d.id,
        type: d.data().type || d.data().reason,
        createdAt: d.data().createdAt,
        metadata: d.data().metadata,
        points: d.data().points,
        label: d.data().label,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    // ── Calculate badges from room activities ──────────────────────────────────
    const badges = calculateBadgesFromActivities(activities);

    // ── Extract predictions and debates from activities ────────────────────────
    const predictions = activities
      .filter((a) => a.type === "ROAR_PREDICTION")
      .map((a) => ({
        id: a.id,
        postId: a.metadata?.postId,
        label: a.label,
        text: a.metadata?.statement || a.label,
        sport: a.metadata?.sport,
        createdAt: a.createdAt,
        status: "PENDING", // Activities don't have status; use as-is or fetch separately if needed
      }))
      .slice(0, 20);

    const hotTakes = activities
      .filter((a) => a.type === "ROAR_DEBATE")
      .map((a) => ({
        id: a.id,
        postId: a.metadata?.postId,
        label: a.label,
        text: a.metadata?.statement || a.label,
        sideA: a.metadata?.sideA,
        sideB: a.metadata?.sideB,
        createdAt: a.createdAt,
      }))
      .slice(0, 10);

    // ── Calculate accuracy from activities (if tracking is available) ──────────
    // For now, use the stored accuracy from userData, or calculate from corrections
    const accuracy = userData.predictionCount > 0
      ? Math.round((userData.correctPredictions / userData.predictionCount) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        accuracy,
        predictionCount: predictions.length,
        hotTakeCount: hotTakes.length,
        // canonical names — Profile.tsx reads these
        favPlayer: userData.favPlayer ?? null,
        about: userData.about ?? null,
        avatarUrl: userData.avatarUrl ?? null,
      },
      badges,
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    // username (display name in Profile.tsx)
    if (body.username !== undefined) {
      const v = String(body.username).trim();
      if (v.length >= 2 && v.length <= 30 && /^[A-Za-z0-9_]+$/.test(v)) {
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
