



// // api/roar/posts/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { awardRoarPoints } from "@/lib/roarPoints";
// import type { Post, PostType, SportType } from "@/app/models/Post";

// export async function POST(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     const {
//       type,
//       text,
//       sport = "cricket",
//       sideA,
//       sideB,
//       matchId,
//       confidence,
//       audience = "Everyone",
//       mediaUrls,
//     }: {
//       type: PostType;
//       text: string;
//       sport: SportType;
//       sideA?: string;
//       sideB?: string;
//       matchId?: string;
//       confidence?: number;
//       audience?: string;
//       mediaUrls?: string[];
//     } = body;

//     if (!type || !text?.trim()) {
//       return NextResponse.json(
//         { error: "type and text are required" },
//         { status: 400 },
//       );
//     }

//     // ── Resolve user doc ──────────────────────────────────────────────────────
//     let userDocRef = db.collection("users").doc(user.email);
//     let userSnap = await userDocRef.get();
//     let resolvedUserId = user.email;

//     if (!userSnap.exists) {
//       userDocRef = db.collection("users").doc(user.userId);
//       userSnap = await userDocRef.get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }

//     if (!userSnap.exists) {
//       return NextResponse.json(
//         { error: "User profile not found" },
//         { status: 404 },
//       );
//     }

//     const userData = userSnap.data() as {
//       username: string;
//       badge: string;
//       firstName?: string;
//       lastName?: string;
//       name?: string;
//       email?: string;
//     };

//     // ── Resolve display name for points ──────────────────────────────────────
//     const resolvedName = userData.firstName
//       ? [userData.firstName, userData.lastName].filter(Boolean).join(" ")
//       : userData.name || userData.username || "User";
//     const resolvedEmail = userData.email || user.email || "";

//     // ── Build and save the ROAR post ─────────────────────────────────────────
//     const now = Date.now();
//     const postRef = db.collection("roarPosts").doc();

//     const newPost: Post = {
//       postId: postRef.id,
//       authorUid: resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge: userData.badge,
//       type,
//       sport,
//       text: text.trim(),
//       ...(sideA     && { sideA }),
//       ...(sideB     && { sideB }),
//       ...(matchId   && { matchId }),
//       ...(confidence !== undefined && { confidence }),
//       audience,
//       agreeCount:    0,
//       disagreeCount: 0,
//       replyCount:    0,
//       isLive:        false,
//       status:        "active",
//       createdAt:     now,
//       updatedAt:     now,
//     };

//     const batch = db.batch();
//     batch.set(postRef, newPost);

//     // Increment the right counter on the user doc
//     const counterField =
//       type === "prediction" ? "predictionCount" : "hotTakeCount";
//     batch.update(userDocRef, {
//       [counterField]: (userData as any)[counterField]
//         ? (userData as any)[counterField] + 1
//         : 1,
//       updatedAt: now,
//     });

//     await batch.commit();

//     // ── Award ROAR points ─────────────────────────────────────────────────────
//     let pointsAwarded = 0;
//     try {
//       const transactionId = `${resolvedUserId}_${postRef.id}_ROAR_${type.toUpperCase()}`;
//       const { awarded, points } = await awardRoarPoints({
//         actualUserId:  resolvedUserId,
//         authUserId:    user.userId !== resolvedUserId ? user.userId : undefined,
//         userName:      resolvedName,
//         userEmail:     resolvedEmail,
//         userExists:    true,
//         postType:      type,
//         transactionId,
//         metadata: {
//           postId: postRef.id,
//           sport,
//           ...(sideA && { sideA }),
//           ...(sideB && { sideB }),
//         },
//       });

//       if (awarded) {
//         pointsAwarded = points;
//         console.log(
//           ` ROAR post created: ${postRef.id} | +${points} pts (${type}) awarded to ${resolvedUserId}`,
//         );
//       }
//     } catch (pointsErr) {
//       // Points failure must never block the post response
//       console.error("[roar/posts] Failed to award points:", pointsErr);
//     }

//     return NextResponse.json(
//       {
//         success:       true,
//         postId:        postRef.id,
//         post:          newPost,
//         pointsAwarded,
//         message:       pointsAwarded
//           ? `ROAR posted! +${pointsAwarded} points awarded!`
//           : "ROAR posted successfully!",
//       },
//       { status: 201 },
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/roar/posts error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// export async function GET(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
//     const sport = searchParams.get("sport");

//     let query = db
//       .collection("roarPosts")
//       .orderBy("createdAt", "desc")
//       .limit(limit);

//     if (sport) {
//       query = query.where("sport", "==", sport);
//     }

//     let userSnap = await db.collection("users").doc(user.email).get();
//     let resolvedUserId = user.email;
//     if (!userSnap.exists) {
//       userSnap = await db.collection("users").doc(user.userId).get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }

//     const snapshot = await query.get();
//     const posts = await Promise.all(
//       snapshot.docs.map(async (doc) => {
//         const data = doc.data() as Post;
//         const voteSnap = await doc.ref
//           .collection("roarVotes")
//           .doc(resolvedUserId)
//           .get();
//         const userVote = voteSnap.exists
//           ? (voteSnap.data() as any).vote
//           : null;
//         return { ...data, postId: doc.id, userVote };
//       }),
//     );

//     return NextResponse.json({ success: true, posts });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/posts error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }








// api/roar/posts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { getUserInfo } from "@/lib/userPoints"; // ✅ Add this import
import { awardRoarPoints } from "@/lib/roarPoints";
import type { Post, PostType, SportType } from "@/app/models/Post";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type,
      text,
      sport = "cricket",
      sideA,
      sideB,
      matchId,
      confidence,
      audience = "Everyone",
      mediaUrls,
    }: {
      type: PostType;
      text: string;
      sport: SportType;
      sideA?: string;
      sideB?: string;
      matchId?: string;
      confidence?: number;
      audience?: string;
      mediaUrls?: string[];
    } = body;

    if (!type || !text?.trim()) {
      return NextResponse.json(
        { error: "type and text are required" },
        { status: 400 },
      );
    }

    // ✅ FIX: Use getUserInfo instead of manual resolution
    const { 
      actualUserId, 
      userName: resolvedName, 
      userEmail: resolvedEmail, 
      exists 
    } = await getUserInfo(
      user.userId,      // auth user ID (might be email or sanitized)
      user.name,        // fallback name
      user.email        // fallback email
    );

    console.log("Original userId:", user.userId);
    console.log("Original email:", user.email);
    console.log("Resolved actualUserId:", actualUserId);
    console.log("User exists:", exists);

    if (!exists) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    // Get user data for additional fields (username, badge, etc.)
    const userDoc = await db.collection("users").doc(actualUserId).get();
    const userData = userDoc.data() as {
      username: string;
      badge: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string;
    };

    // ── Build and save the ROAR post ─────────────────────────────────────────
    const now = Date.now();
    const postRef = db.collection("roarPosts").doc();

    const newPost: Post = {
      postId: postRef.id,
      authorUid: actualUserId,  // ✅ Use resolved actualUserId
      authorUsername: userData.username,
      authorBadge: userData.badge,
      type,
      sport,
      text: text.trim(),
      ...(sideA     && { sideA }),
      ...(sideB     && { sideB }),
      ...(matchId   && { matchId }),
      ...(confidence !== undefined && { confidence }),
      audience,
      agreeCount:    0,
      disagreeCount: 0,
      replyCount:    0,
      isLive:        false,
      status:        "active",
      createdAt:     now,
      updatedAt:     now,
    };

    const batch = db.batch();
    batch.set(postRef, newPost);

    // Increment the right counter on the user doc
    const counterField =
      type === "prediction" ? "predictionCount" : "hotTakeCount";
    batch.update(db.collection("users").doc(actualUserId), {
      [counterField]: (userData as any)[counterField]
        ? (userData as any)[counterField] + 1
        : 1,
      updatedAt: now,
    });

    await batch.commit();

    // ── Award ROAR points ─────────────────────────────────────────────────────
    let pointsAwarded = 0;
    try {
      const transactionId = `${actualUserId}_${postRef.id}_ROAR_${type.toUpperCase()}`;
      const { awarded, points } = await awardRoarPoints({
        actualUserId: actualUserId,     // ✅ Use resolved actualUserId
        authUserId: user.userId,        // Original auth ID for leaderboard
        userName: resolvedName,
        userEmail: resolvedEmail,
        userExists: true,
        postType: type,
        transactionId,
        metadata: {
          postId: postRef.id,
          sport,
          ...(sideA && { sideA }),
          ...(sideB && { sideB }),
        },
      });

      if (awarded) {
        pointsAwarded = points;
        console.log(
          `✅ ROAR post created: ${postRef.id} | +${points} pts (${type}) awarded to ${actualUserId}`,
        );
      }
    } catch (pointsErr) {
      // Points failure must never block the post response
      console.error("[roar/posts] Failed to award points:", pointsErr);
    }

    return NextResponse.json(
      {
        success:       true,
        postId:        postRef.id,
        post:          newPost,
        pointsAwarded,
        message:       pointsAwarded
          ? `ROAR posted! +${pointsAwarded} points awarded!`
          : "ROAR posted successfully!",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const sport = searchParams.get("sport");

    let query = db
      .collection("roarPosts")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (sport) {
      query = query.where("sport", "==", sport);
    }

    // ✅ FIX: Use getUserInfo to resolve the correct user ID
    const { actualUserId } = await getUserInfo(
      user.userId,
      user.name,
      user.email
    );

    const snapshot = await query.get();
    const posts = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as Post;
        const voteSnap = await doc.ref
          .collection("roarVotes")
          .doc(actualUserId)  // ✅ Use resolved actualUserId
          .get();
        const userVote = voteSnap.exists
          ? (voteSnap.data() as any).vote
          : null;
        return { ...data, postId: doc.id, userVote };
      }),
    );

    return NextResponse.json({ success: true, posts });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}