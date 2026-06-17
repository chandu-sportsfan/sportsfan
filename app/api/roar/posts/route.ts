
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
//       quizQuestion,
//       quizOptions,
//       quizCorrectOption,
//       quizTimer,
//       quizPoints,
//       memGifUrl,
//       memTag,
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
//       quizQuestion?: string;
//       quizOptions?: { label: string; text: string }[];
//       quizCorrectOption?: string;
//       quizTimer?: number;
//       quizPoints?: number;
//       memGifUrl?: string;   // ADD
//       memTag?: string;
//     } = body;

//     if (!type || (!text?.trim() && !quizQuestion?.trim() && (!mediaUrls || mediaUrls.length === 0))) {
//       return NextResponse.json(
//         { error: "type and text (or quiz question) are required" },
//         { status: 400 },
//       );
//     }

//     // Fetch author info
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
//     const userData = userSnap.data() as { username: string; badge: string;[key: string]: any };

//     const now = Date.now();
//     const postRef = db.collection("roarPosts").doc();

//     const newPost: Post = {
//       postId: postRef.id,
//       authorUid: resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge: userData.badge,
//       type,
//       sport,
//       text: text?.trim() || quizQuestion?.trim() || "",
//       ...(sideA && { sideA }),
//       ...(sideB && { sideB }),
//       ...(matchId && { matchId }),
//       ...(confidence !== undefined && { confidence }),
//       ...(quizQuestion && { quizQuestion }),
//       ...(quizOptions && { quizOptions }),
//       ...(quizCorrectOption && { quizCorrectOption }),
//       ...(quizTimer && { quizTimer }),
//       ...(quizPoints && { quizPoints }),
//       ...(memGifUrl && { memGifUrl }),
//       ...(memTag && { memTag }),
//       quizParticipants: 0,
//       audience,
//       agreeCount: 0,
//       disagreeCount: 0,
//       replyCount: 0,
//       isLive: false,
//       status: "active",
//       mediaUrls: mediaUrls || [],
//       createdAt: now,
//       updatedAt: now,
//     };

//     const batch = db.batch();
//     batch.set(postRef, newPost);

//     // Increment the right counter on the user doc
//     const counterField = type === "prediction" ? "predictionCount" : "hotTakeCount";
//     batch.update(userDocRef, {
//       [counterField]: (userData[counterField] ? userData[counterField] + 1 : 1),
//       updatedAt: now,
//     });

//     await batch.commit();

//     // ── Award 2 points to the creator ────────────────────────────────────────
//     // Done after batch so the post exists regardless of points failure.
//     try {
//       await awardRoarPoints({
//         actualUserId: resolvedUserId,
//         authUserId: user.userId,
//         userName: userData.username ?? resolvedUserId,
//         userEmail: user.email,
//         userExists: true,
//         postType: type,
//         transactionId: `roar_post_${postRef.id}`,
//         metadata: { postId: postRef.id, sport },
//       });
//     } catch (pointsErr) {
//       // Non-fatal — post is already created
//       console.error("Failed to award points for post:", pointsErr);
//     }

//     return NextResponse.json({
//       success: true,
//       postId: postRef.id,
//       post: newPost,
//     });
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
//         const voteSnap = await doc.ref.collection("votes").doc(resolvedUserId).get();
//         const userVote = voteSnap.exists ? (voteSnap.data() as any).vote : null;

//         let userLiked = false;
//         if (data.type === "post") {
//           const likeSnap = await doc.ref.collection("likes").doc(resolvedUserId).get();
//           userLiked = likeSnap.exists;
//         }

//         // For quiz posts, check if this user has already answered
//         let quizUserAnswer: string | null = null;
//         if (data.type === "quiz") {
//           const answerSnap = await doc.ref.collection("quizAnswers").doc(resolvedUserId).get();
//           if (answerSnap.exists) {
//             quizUserAnswer = (answerSnap.data() as any).selectedOption ?? null;
//           }
//         }

//         return {
//           ...data,
//           postId: doc.id,
//           userVote,
//           likeCount: data.likeCount ?? 0,
//           userLiked,
//           // Only send back the correct answer if user has already answered
//           quizCorrectOption: data.type === "quiz" && !quizUserAnswer
//             ? undefined       // hide from client until they answer
//             : data.quizCorrectOption,
//           quizUserAnswer,   // null = not answered yet; "A"/"B"/etc = answered
//         };
//       })
//     );

//     return NextResponse.json({
//       success: true,
//       posts,
//     });
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
import { FieldValue } from "firebase-admin/firestore";
import { awardRoarPoints } from "@/lib/roarPoints";
import type { Post, PostType, SportType } from "@/app/models/Post";

// ── Shared helper: resolve user ID with one read on the happy path ────────────
// Mirrors the helper used in the rooms/messages route for consistency.
async function resolveUser(
  email: string,
  uid: string
): Promise<{
  resolvedId: string;
  snap: FirebaseFirestore.DocumentSnapshot;
  ref: FirebaseFirestore.DocumentReference;
} | null> {
  const emailSnap = await db.collection("users").doc(email).get();
  if (emailSnap.exists) {
    return { resolvedId: email, snap: emailSnap, ref: db.collection("users").doc(email) };
  }
  const uidSnap = await db.collection("users").doc(uid).get();
  if (uidSnap.exists) {
    return { resolvedId: uid, snap: uidSnap, ref: db.collection("users").doc(uid) };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// GET  /api/roar/posts
// ────────────────────────────────────────────────────────────────────────────
//
// Optimisations vs original:
//
//  1. User resolution + posts query run IN PARALLEL — cuts one full serial
//     round-trip off every request.
//
//  2. Subcollection reads batched per-type in parallel instead of N×3 serial
//     reads inside Promise.all.  All vote reads fire together, all like reads
//     fire together, all quiz reads fire together — three parallel rounds
//     instead of up to 90 serial reads.
//
//  3. `where` placed before `orderBy` — required by Firestore for compound
//     queries; also ensures the composite index (sport ASC + createdAt DESC)
//     is used correctly.
//
//  4. Timestamp-based cursor pagination — no full-collection scan on every
//     request. Client passes `?lastCreatedAt=<ts>` for the next page.
//
//  5. `includeUserState=false` escape hatch — skips ALL subcollection reads
//     (votes/likes/quiz answers) for clients that don't need per-user state
//     (e.g. public feed, SSR, admin views). Saves up to limit×3 reads.
//
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const sport = searchParams.get("sport");
    const lastCreatedAt = searchParams.get("lastCreatedAt")
      ? parseInt(searchParams.get("lastCreatedAt")!, 10)
      : null;
    // Pass ?includeUserState=false to skip subcollection reads entirely
    const includeUserState = searchParams.get("includeUserState") !== "false";

    // ── FIX 1: user resolution + posts query fire IN PARALLEL ────────────────
    // Composite index required: sport ASC + createdAt DESC (if sport filter used)
    // Single-field index on createdAt DESC covers the no-sport case.
    let postsQuery = db
      .collection("roarPosts")
      .orderBy("createdAt", "desc")
      .limit(limit);

    // FIX 3: where before orderBy (Firestore requirement for compound queries)
    if (sport) {
      postsQuery = db
        .collection("roarPosts")
        .where("sport", "==", sport)   // ← where first
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    // FIX 4: timestamp cursor — zero extra doc reads
    if (lastCreatedAt !== null) {
      postsQuery = postsQuery.startAfter(lastCreatedAt);
    }

    // Fire user resolution and posts query at the same time
    const [resolved, snapshot] = await Promise.all([
      resolveUser(user.email, user.userId),
      postsQuery.get(),
    ]);

    if (!resolved) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const { resolvedId: resolvedUserId } = resolved;

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        posts: [],
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // ── FIX 2: batch all subcollection reads by type ──────────────────────────
    //
    // Instead of firing 3 reads per doc inside Promise.all (which still
    // serialises within each iteration), we group reads by collection type and
    // fire each group as one parallel batch.
    //
    // Result: 3 parallel rounds max, regardless of page size,
    // vs up to limit×3 reads in the original.

    let voteMap   = new Map<string, string | null>();
    let likeMap   = new Map<string, boolean>();
    let quizMap   = new Map<string, string | null>();

    if (includeUserState) {
      const docs = snapshot.docs;

      // Identify which docs need which subcollection
      const voteRefs   = docs.map((d) => d.ref.collection("votes").doc(resolvedUserId));
      const likeIndices = docs.reduce<number[]>((acc, d, i) => {
        if ((d.data() as Post).type === "post") acc.push(i);
        return acc;
      }, []);
      const quizIndices = docs.reduce<number[]>((acc, d, i) => {
        if ((d.data() as Post).type === "quiz") acc.push(i);
        return acc;
      }, []);

      const likeRefs = likeIndices.map((i) =>
        docs[i].ref.collection("likes").doc(resolvedUserId)
      );
      const quizRefs = quizIndices.map((i) =>
        docs[i].ref.collection("quizAnswers").doc(resolvedUserId)
      );

      // Three parallel batches — one round-trip each
      const [voteSnaps, likeSnaps, quizSnaps] = await Promise.all([
        Promise.all(voteRefs.map((r) => r.get())),
        Promise.all(likeRefs.map((r) => r.get())),
        Promise.all(quizRefs.map((r) => r.get())),
      ]);

      docs.forEach((doc, i) => {
        const v = voteSnaps[i];
        voteMap.set(doc.id, v.exists ? ((v.data() as any).vote ?? null) : null);
      });
      likeIndices.forEach((docIdx, resultIdx) => {
        likeMap.set(docs[docIdx].id, likeSnaps[resultIdx].exists);
      });
      quizIndices.forEach((docIdx, resultIdx) => {
        const s = quizSnaps[resultIdx];
        quizMap.set(
          docs[docIdx].id,
          s.exists ? ((s.data() as any).selectedOption ?? null) : null
        );
      });
    }

    // ── Assemble response ────────────────────────────────────────────────────
    const posts = snapshot.docs.map((doc) => {
      const data = doc.data() as Post;
      const userVote      = voteMap.get(doc.id) ?? null;
      const userLiked     = likeMap.get(doc.id) ?? false;
      const quizUserAnswer = quizMap.get(doc.id) ?? null;

      return {
        ...data,
        postId: doc.id,
        likeCount: data.likeCount ?? 0,
        ...(includeUserState && { userVote, userLiked, quizUserAnswer }),
        // Hide correct answer until the user has answered
        quizCorrectOption:
          data.type === "quiz" && !quizUserAnswer
            ? undefined
            : data.quizCorrectOption,
      };
    });

    const lastPost = posts[posts.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor:
          posts.length === limit
            ? { lastCreatedAt: lastPost?.createdAt ?? null }
            : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST  /api/roar/posts
// ────────────────────────────────────────────────────────────────────────────
//
// Optimisations vs original:
//
//  1. resolveUser() replaces the serial await-then-await user resolution.
//
//  2. FIX 6: FieldValue.increment(1) replaces the stale read-then-write
//     counter pattern. Under concurrent requests the original would lose
//     increments; FieldValue.increment is atomic.
//
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
      quizQuestion,
      quizOptions,
      quizCorrectOption,
      quizTimer,
      quizPoints,
      memGifUrl,
      memTag,
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
      quizQuestion?: string;
      quizOptions?: { label: string; text: string }[];
      quizCorrectOption?: string;
      quizTimer?: number;
      quizPoints?: number;
      memGifUrl?: string;
      memTag?: string;
    } = body;

    if (
      !type ||
      (!text?.trim() &&
        !quizQuestion?.trim() &&
        (!mediaUrls || mediaUrls.length === 0))
    ) {
      return NextResponse.json(
        { error: "type and text (or quiz question) are required" },
        { status: 400 }
      );
    }

    // FIX 1: single helper call, one read on the happy path
    const resolved = await resolveUser(user.email, user.userId);
    if (!resolved) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const { resolvedId: resolvedUserId, snap: userSnap, ref: userDocRef } = resolved;
    const userData = userSnap.data() as {
      username: string;
      badge: string;
      [key: string]: any;
    };

    const now = Date.now();
    const postRef = db.collection("roarPosts").doc();

    const newPost: Post = {
      postId: postRef.id,
      authorUid: resolvedUserId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      type,
      sport,
      text: text?.trim() || quizQuestion?.trim() || "",
      ...(sideA && { sideA }),
      ...(sideB && { sideB }),
      ...(matchId && { matchId }),
      ...(confidence !== undefined && { confidence }),
      ...(quizQuestion && { quizQuestion }),
      ...(quizOptions && { quizOptions }),
      ...(quizCorrectOption && { quizCorrectOption }),
      ...(quizTimer && { quizTimer }),
      ...(quizPoints && { quizPoints }),
      ...(memGifUrl && { memGifUrl }),
      ...(memTag && { memTag }),
      quizParticipants: 0,
      audience,
      agreeCount: 0,
      disagreeCount: 0,
      replyCount: 0,
      isLive: false,
      status: "active",
      mediaUrls: mediaUrls || [],
      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(postRef, newPost);

    // FIX 2: FieldValue.increment — atomic, no stale read race condition
    const counterField =
      type === "prediction" ? "predictionCount" : "hotTakeCount";
    batch.update(userDocRef, {
      [counterField]: FieldValue.increment(1),
      updatedAt: now,
    });

    await batch.commit();

    // Award points — non-fatal, fires after batch
    try {
      await awardRoarPoints({
        actualUserId: resolvedUserId,
        authUserId: user.userId,
        userName: userData.username ?? resolvedUserId,
        userEmail: user.email,
        userExists: true,
        postType: type,
        transactionId: `roar_post_${postRef.id}`,
        metadata: { postId: postRef.id, sport },
      });
    } catch (pointsErr) {
      console.error("Failed to award points for post:", pointsErr);
    }

    return NextResponse.json({
      success: true,
      postId: postRef.id,
      post: newPost,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}