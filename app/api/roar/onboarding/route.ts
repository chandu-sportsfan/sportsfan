// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import type { User } from "../../../models/RoarUser";

// export async function POST(req: NextRequest) {
//   console.log("Hit the onboarding api");
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     const { sports, teams, tenure, badge, firstContribution } = body;

//     if (!sports?.length || !tenure || !badge) {
//       return NextResponse.json(
//         { error: "sports, tenure and badge are required" },
//         { status: 400 },
//       );
//     }

//     const tenureToYear: Record<string, string> = {
//       rising: "2023",
//       seasoned: "2015",
//       og: "2005",
//     };

//     const now = Date.now();

//     let userDocRef = db.collection("users").doc(user.email);
//     let userDoc = await userDocRef.get();
//     let resolvedUserId = user.email;
//     if (!userDoc.exists) {
//       userDocRef = db.collection("users").doc(user.userId);
//       userDoc = await userDocRef.get();
//       if (userDoc.exists) {
//         resolvedUserId = user.userId;
//       }
//     }

//     let defaultUsername = user.name || user.email.split("@")[0];
//     if (userDoc.exists) {
//       const data = userDoc.data();
//       if (data?.firstName || data?.lastName) {
//         defaultUsername = `${data.firstName || ""} ${data.lastName || ""}`.trim();
//       } else if (data?.username) {
//         defaultUsername = data.username;
//       }
//     }

//     const hasFirstContribution = !!firstContribution;

//     const userData: User = {
//       uid: resolvedUserId,
//       username: defaultUsername,
//       handle: user.email.split("@")[0].toLowerCase(),
//       sports,
//       teams: teams ?? [],
//       tenure,
//       badge,
//       badgesUnlocked: [badge],
//       fanSince: tenureToYear[tenure] ?? "2023",
//       reputationScore: 0,
//       predictionCount: 0,
//       correctPredictions: 0,
//       hotTakeCount: hasFirstContribution ? 1 : 0,
//       rank: 9999,
//       rivalUid: null,
//       fcmToken: null,
//       settings: {
//         showPredictionHistory: true,
//         audience: "Everyone",
//       },
//       createdAt: now,
//       updatedAt: now,
//     };

//     // Write user doc
//     await userDocRef.set(userData, { merge: true });

//     // Seed starter badge progress
//     await db
//       .collection("roarBadges")
//       .doc(resolvedUserId)
//       .collection("roarProgress")
//       .doc(badge)
//       .set({
//         badgeId: badge,
//         uid: resolvedUserId,
//         unlocked: true,
//         progress: 100,
//         earnedAt: now,
//       });

//     // Seed progress=0 for all other badges so frontend can display them
//     const otherBadges = [
//       "ORACLE",
//       "BOLD_CALLER",
//       "CRICKET_HEAD",
//       "CONTRARIAN",
//       "OG_FAN",
//       "SEASONED_FAN",
//       "RISING_FAN",
//     ].filter((b) => b !== badge);

//     const batch = db.batch();
//     for (const b of otherBadges) {
//       const ref = db
//         .collection("roarBadges")
//         .doc(resolvedUserId)
//         .collection("roarProgress")
//         .doc(b);
//       batch.set(ref, {
//         badgeId: b,
//         uid: resolvedUserId,
//         unlocked: false,
//         progress: 0,
//       });
//     }

//     // First contribution post
//     if (firstContribution) {
//       const postRef = db.collection("roarPosts").doc();
//       const text = firstContribution === "agree" || firstContribution === "disagree"
//         ? (sports[0] === "cricket"
//           ? "Virat Kohli in 2025 is better than Sachin Tendulkar ever was. Change my mind."
//           : "ISL is now world-class football. Change my mind.")
//         : firstContribution;

//       batch.set(postRef, {
//         postId: postRef.id,
//         authorUid: resolvedUserId,
//         authorUsername: userData.username,
//         authorBadge: badge,
//         type: "hot_take",
//         sport: sports[0],
//         text,
//         audience: "Everyone",
//         agreeCount: 0,
//         disagreeCount: 0,
//         replyCount: 0,
//         isLive: false,
//         status: "active",
//         createdAt: now,
//         updatedAt: now,
//       });
//     }

//     await batch.commit();

//     return NextResponse.json({ success: true, badge, uid: resolvedUserId });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/roar/onboarding error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }




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
    const { sports, badge, firstContribution, firstVote, repPointsAwarded } = body;

    if (!sports?.length || !badge) {
      return NextResponse.json(
        { error: "sports and badge are required" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const repPoints = typeof repPointsAwarded === "number" ? repPointsAwarded : 0;

    let userDocRef = db.collection("users").doc(user.email);
    let userDoc = await userDocRef.get();
    let resolvedUserId = user.email;
    if (!userDoc.exists) {
      userDocRef = db.collection("users").doc(user.userId);
      userDoc = await userDocRef.get();
      if (userDoc.exists) {
        resolvedUserId = user.userId;
      }
    }

    let defaultUsername = user.name || user.email.split("@")[0];
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data?.firstName || data?.lastName) {
        defaultUsername = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      } else if (data?.username) {
        defaultUsername = data.username;
      }
    }

    const hasFirstContribution = !!firstContribution;

    const userData: User = {
      uid: resolvedUserId,
      username: defaultUsername,
      handle: user.email.split("@")[0].toLowerCase(),
      sports,
      badge,
      badgesUnlocked: [badge],
      reputationScore: repPoints,
      predictionCount: 0,
      correctPredictions: 0,
      hotTakeCount: hasFirstContribution ? 1 : 0,
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
    await userDocRef.set(userData, { merge: true });

    // Seed starter badge progress
    await db
      .collection("roarBadges")
      .doc(resolvedUserId)
      .collection("roarProgress")
      .doc(badge)
      .set({
        badgeId: badge,
        uid: resolvedUserId,
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
        .doc(resolvedUserId)
        .collection("roarProgress")
        .doc(b);
      batch.set(ref, {
        badgeId: b,
        uid: resolvedUserId,
        unlocked: false,
        progress: 0,
      });
    }

    // First contribution post
    if (firstContribution) {
      const postRef = db.collection("roarPosts").doc();
      const voteCounts =
        firstVote === "agree"
          ? { agreeCount: 1, disagreeCount: 0 }
          : firstVote === "disagree"
            ? { agreeCount: 0, disagreeCount: 1 }
            : { agreeCount: 0, disagreeCount: 0 };

      batch.set(postRef, {
        postId: postRef.id,
        authorUid: resolvedUserId,
        authorUsername: userData.username,
        authorBadge: badge,
        type: "hot_take",
        sport: sports[0],
        text: firstContribution,
        audience: "Everyone",
        ...voteCounts,
        replyCount: 0,
        isLive: false,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, badge, uid: resolvedUserId, username: userData.username, });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/onboarding error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}