// app/api/roar/fans/[username]/profile/route.ts
// Public endpoint — returns any fan's ROAR profile by username.
// Used when clicking on another user's avatar in posts/comments.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Post } from "@/app/models/Post";

// Badge calculation logic (same as /api/roar/profile)
function calculateBadgesFromActivities(activities: any[]) {
  const counts = {
    posts: activities.filter((a) => ["ROAR_POST", "ROAR_HOT_TAKE", "ROAR_MEMORY"].includes(a.type)).length,
    predictions: activities.filter((a) => a.type === "ROAR_PREDICTION").length,
    debates: activities.filter((a) => a.type === "ROAR_DEBATE").length,
  };

  const totalActivity = activities.length;

  return [
    { id: "first_post", name: "First Post", unlocked: counts.posts >= 1 },
    { id: "10_posts", name: "10 Posts", unlocked: counts.posts >= 10 },
    { id: "prediction_expert", name: "Prediction Expert", unlocked: counts.predictions >= 5 },
    { id: "debate_starter", name: "Debate Starter", unlocked: counts.debates >= 3 },
    { id: "active_contributor", name: "Active Contributor", unlocked: totalActivity >= 20 },
    { id: "top_fan", name: "Top Fan", unlocked: totalActivity >= 50 },
  ];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    // Must be logged in to view any profile
    const requestingUser = await getUser(req);
    if (!requestingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = params;
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    // Find the user doc by username field
    const usersSnap = await db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ error: "Fan not found" }, { status: 404 });
    }

    const userDoc = usersSnap.docs[0];
    const resolvedUserId = userDoc.id;
    const userData = userDoc.data() as any;

    if (!userData || !userData.username || !userData.badge) {
      return NextResponse.json({ error: "Fan not onboarded" }, { status: 404 });
    }

    // Fetch room-aware activities from activityLog subcollection
    const [activitiesSnap, rivalSnap] = await Promise.all([
      db.collection("users").doc(resolvedUserId).collection("activityLog").orderBy("createdAt", "desc").get(),
      db.collection("rivals").doc(resolvedUserId).get(),
    ]);

    const allActivities = activitiesSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    
    // Calculate badges from room-aware activities
    const calculatedBadges = calculateBadgesFromActivities(allActivities);

    // Extract predictions and hot takes from activities
    const predictions = allActivities
      .filter((a) => a.type === "ROAR_PREDICTION" && userData.showPredHistory !== false)
      .slice(0, 20);

    const hotTakes = allActivities
      .filter((a) => a.type === "ROAR_DEBATE")
      .slice(0, 10);

    // Calculate accuracy from prediction activities
    const predictions_all = allActivities.filter((a) => a.type === "ROAR_PREDICTION");
    const correctPredictions = predictions_all.filter((a) => a.metadata?.correct === true).length;
    const accuracy =
      predictions_all.length > 0
        ? Math.round((correctPredictions / predictions_all.length) * 100)
        : 0;

    // Only expose public fields — no email, no FCM token etc.
    return NextResponse.json({
      success: true,
      user: {
        username: userData.username,
        handle: userData.handle ?? userData.username,
        badge: userData.badge,
        avatarUrl: userData.avatarUrl ?? null,
        favPlayer: userData.favPlayer ?? null,
        about: userData.about ?? null,
        fanSince: userData.fanSince ?? null,
        yearsFandom: userData.yearsFandom ?? null,
        reputationScore: userData.reputationScore ?? 0,
        totalActivity: allActivities.length,
        predictionCount: predictions_all.length,
        hotTakeCount: allActivities.filter((a) => a.type === "ROAR_DEBATE").length,
        correctPredictions,
        accuracy,
        showPredHistory: userData.showPredHistory !== false,
      },
      badges: calculatedBadges,
      predictions: userData.showPredHistory !== false ? predictions : [],
      hotTakes,
      rival: rivalSnap.exists ? rivalSnap.data() : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/fans/[username]/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
