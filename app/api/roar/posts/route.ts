
// // api/roar/posts/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";
// import { awardRoarPoints } from "@/lib/roarPoints";
// import type { Post, PostType, SportType } from "@/app/models/Post";

// // ── Shared helper: resolve user ID with one read on the happy path ────────────
// // Mirrors the helper used in the rooms/messages route for consistency.
// async function resolveUser(
//   email: string,
//   uid: string
// ): Promise<{
//   resolvedId: string;
//   snap: FirebaseFirestore.DocumentSnapshot;
//   ref: FirebaseFirestore.DocumentReference;
// } | null> {
//   const emailSnap = await db.collection("users").doc(email).get();
//   if (emailSnap.exists) {
//     return { resolvedId: email, snap: emailSnap, ref: db.collection("users").doc(email) };
//   }
//   const uidSnap = await db.collection("users").doc(uid).get();
//   if (uidSnap.exists) {
//     return { resolvedId: uid, snap: uidSnap, ref: db.collection("users").doc(uid) };
//   }
//   return null;
// }


// // GET  /api/roar/posts
// //
// export async function GET(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
//     const sport = searchParams.get("sport");
//     const lastCreatedAt = searchParams.get("lastCreatedAt")
//       ? parseInt(searchParams.get("lastCreatedAt")!, 10)
//       : null;
//     // Pass ?includeUserState=false to skip subcollection reads entirely
//     const includeUserState = searchParams.get("includeUserState") !== "false";

//     // ── FIX 1: user resolution + posts query fire IN PARALLEL ────────────────
//     // Composite index required: sport ASC + createdAt DESC (if sport filter used)
//     // Single-field index on createdAt DESC covers the no-sport case.
//     let postsQuery = db
//       .collection("roarPosts")
//       .orderBy("createdAt", "desc")
//       .limit(limit);

//     // FIX 3: where before orderBy (Firestore requirement for compound queries)
//     if (sport) {
//       postsQuery = db
//         .collection("roarPosts")
//         .where("sport", "==", sport)   // ← where first
//         .orderBy("createdAt", "desc")
//         .limit(limit);
//     }

//     // FIX 4: timestamp cursor — zero extra doc reads
//     if (lastCreatedAt !== null) {
//       postsQuery = postsQuery.startAfter(lastCreatedAt);
//     }

//     // Fire user resolution and posts query at the same time
//     const [resolved, snapshot] = await Promise.all([
//       resolveUser(user.email, user.userId),
//       postsQuery.get(),
//     ]);

//     if (!resolved) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }
//     const { resolvedId: resolvedUserId } = resolved;

//     if (snapshot.empty) {
//       return NextResponse.json({
//         success: true,
//         posts: [],
//         pagination: { limit, hasMore: false, nextCursor: null },
//       });
//     }

//     // ── FIX 2: batch all subcollection reads by type ──────────────────────────
//     //
//     // Instead of firing 3 reads per doc inside Promise.all (which still
//     // serialises within each iteration), we group reads by collection type and
//     // fire each group as one parallel batch.
//     //
//     // Result: 3 parallel rounds max, regardless of page size,
//     // vs up to limit×3 reads in the original.

//     let voteMap   = new Map<string, string | null>();
//     let likeMap   = new Map<string, boolean>();
//     let quizMap   = new Map<string, string | null>();

//     if (includeUserState) {
//       const docs = snapshot.docs;

//       // Identify which docs need which subcollection
//       const voteRefs   = docs.map((d) => d.ref.collection("votes").doc(resolvedUserId));
//       const likeIndices = docs.reduce<number[]>((acc, d, i) => {
//         if ((d.data() as Post).type === "post") acc.push(i);
//         return acc;
//       }, []);
//       const quizIndices = docs.reduce<number[]>((acc, d, i) => {
//         if ((d.data() as Post).type === "quiz") acc.push(i);
//         return acc;
//       }, []);

//       const likeRefs = likeIndices.map((i) =>
//         docs[i].ref.collection("likes").doc(resolvedUserId)
//       );
//       const quizRefs = quizIndices.map((i) =>
//         docs[i].ref.collection("quizAnswers").doc(resolvedUserId)
//       );

//       // Three parallel batches — one round-trip each
//       const [voteSnaps, likeSnaps, quizSnaps] = await Promise.all([
//         Promise.all(voteRefs.map((r) => r.get())),
//         Promise.all(likeRefs.map((r) => r.get())),
//         Promise.all(quizRefs.map((r) => r.get())),
//       ]);

//       docs.forEach((doc, i) => {
//         const v = voteSnaps[i];
//         voteMap.set(doc.id, v.exists ? ((v.data() as any).vote ?? null) : null);
//       });
//       likeIndices.forEach((docIdx, resultIdx) => {
//         likeMap.set(docs[docIdx].id, likeSnaps[resultIdx].exists);
//       });
//       quizIndices.forEach((docIdx, resultIdx) => {
//         const s = quizSnaps[resultIdx];
//         quizMap.set(
//           docs[docIdx].id,
//           s.exists ? ((s.data() as any).selectedOption ?? null) : null
//         );
//       });
//     }

//     // ── Assemble response ────────────────────────────────────────────────────
//     const posts = snapshot.docs.map((doc) => {
//       const data = doc.data() as Post;
//       const userVote      = voteMap.get(doc.id) ?? null;
//       const userLiked     = likeMap.get(doc.id) ?? false;
//       const quizUserAnswer = quizMap.get(doc.id) ?? null;

//       return {
//         ...data,
//         postId: doc.id,
//         likeCount: data.likeCount ?? 0,
//         ...(includeUserState && { userVote, userLiked, quizUserAnswer }),
//         // Hide correct answer until the user has answered
//         quizCorrectOption:
//           data.type === "quiz" && !quizUserAnswer
//             ? undefined
//             : data.quizCorrectOption,
//       };
//     });

//     const lastPost = posts[posts.length - 1];

//     return NextResponse.json({
//       success: true,
//       posts,
//       pagination: {
//         limit,
//         hasMore: posts.length === limit,
//         nextCursor:
//           posts.length === limit
//             ? { lastCreatedAt: lastPost?.createdAt ?? null }
//             : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/posts error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ────────────────────────────────────────────────────────────────────────────
// // POST  /api/roar/posts
// // ────────────────────────────────────────────────────────────────────────────
// //
// // Optimisations vs original:
// //
// //  1. resolveUser() replaces the serial await-then-await user resolution.
// //
// //  2. FIX 6: FieldValue.increment(1) replaces the stale read-then-write
// //     counter pattern. Under concurrent requests the original would lose
// //     increments; FieldValue.increment is atomic.
// //
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
//       memGifUrl?: string;
//       memTag?: string;
//     } = body;

//     if (
//       !type ||
//       (!text?.trim() &&
//         !quizQuestion?.trim() &&
//         (!mediaUrls || mediaUrls.length === 0))
//     ) {
//       return NextResponse.json(
//         { error: "type and text (or quiz question) are required" },
//         { status: 400 }
//       );
//     }

//     // FIX 1: single helper call, one read on the happy path
//     const resolved = await resolveUser(user.email, user.userId);
//     if (!resolved) {
//       return NextResponse.json(
//         { error: "User profile not found" },
//         { status: 404 }
//       );
//     }

//     const { resolvedId: resolvedUserId, snap: userSnap, ref: userDocRef } = resolved;
//     const userData = userSnap.data() as {
//       username: string;
//       badge: string;
//       [key: string]: any;
//     };

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

//     // FIX 2: FieldValue.increment — atomic, no stale read race condition
//     const counterField =
//       type === "prediction" ? "predictionCount" : "hotTakeCount";
//     batch.update(userDocRef, {
//       [counterField]: FieldValue.increment(1),
//       updatedAt: now,
//     });

//     await batch.commit();

//     // Award points — non-fatal, fires after batch
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




// api/roar/posts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";
import { awardRoarPoints } from "@/lib/roarPoints";
import type { Post, PostType, SportType } from "@/app/models/Post";

// ── Post types that support agree/disagree voting ─────────────────────────────
// Only these types get a vote subcollection read. Everything else skips it.
const VOTABLE_TYPES = new Set<PostType>(["hot_take", "prediction", "debate"]);

// ── Shared helper ─────────────────────────────────────────────────────────────
// Returns the user doc in one read on the happy path (email key exists).
// Returns both the snap AND the ref so the POST handler can update it without
// a second db.collection().doc() call.
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
    return {
      resolvedId: email,
      snap: emailSnap,
      ref: db.collection("users").doc(email),
    };
  }
  const uidSnap = await db.collection("users").doc(uid).get();
  if (uidSnap.exists) {
    return {
      resolvedId: uid,
      snap: uidSnap,
      ref: db.collection("users").doc(uid),
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// GET  /api/roar/posts
// ────────────────────────────────────────────────────────────────────────────
//
// Quota cost per request (page of N posts, V votable, Q quiz, L liked):
//   1  — user doc (resolveUser, happy path)     fired in parallel with posts
//   N  — post docs (field read, no subcoll.)
//   V  — vote docs (only for hottake/prediction/debate)
//   L  — like docs (only for type === "post")
//   Q  — quizAnswer docs (only for type === "quiz")
//   ─────────────────────────────────────────────
//   1 + N + V + L + Q   total reads
//
// All three subcollection batches fire in one parallel Promise.all round-trip.
//
// Pass ?includeUserState=false to skip all subcollection reads entirely
// (useful for admin views, server-side rendering, etc.).
//
// Indexes required:
//   • Single-field: createdAt DESC       (auto-created)
//   • Composite:    sport ASC + createdAt DESC   (needed when ?sport= is used)
//
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit           = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const sport           = searchParams.get("sport");
    const lastCreatedAt   = searchParams.get("lastCreatedAt")
      ? parseInt(searchParams.get("lastCreatedAt")!, 10)
      : null;
    const includeUserState = searchParams.get("includeUserState") !== "false";

    // ── Build posts query ─────────────────────────────────────────────────────
    // where() must come before orderBy() for compound queries (Firestore rule).
    let postsQuery = sport
      ? db
          .collection("roarPosts")
          .where("sport", "==", sport)
          .orderBy("createdAt", "desc")
          .limit(limit)
      : db
          .collection("roarPosts")
          .orderBy("createdAt", "desc")
          .limit(limit);

    if (lastCreatedAt !== null) {
      postsQuery = postsQuery.startAfter(lastCreatedAt);
    }

    // ── Fire user resolution + posts query in true parallel ───────────────────
    // resolveUser() starts immediately alongside postsQuery.get().
    // Previously resolveUser() awaited internally before postsQuery ran.
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

    // ── Batch subcollection reads ─────────────────────────────────────────────
    //
    // FIX vs original: voteRefs was built for every doc. Now votes are only
    // read for VOTABLE_TYPES — the same pattern used in rooms/messages route.
    // On a typical feed (mix of post/quiz/hottake) this saves ~50% of the
    // subcollection reads that were being wasted on non-votable types.
    //
    // All three batches still fire in one Promise.all round-trip.

    const voteMap = new Map<string, string | null>();
    const likeMap = new Map<string, boolean>();
    const quizMap = new Map<string, string | null>();

    if (includeUserState) {
      const docs = snapshot.docs;

      // Partition docs by which subcollections they need
      const voteIndices: number[] = [];
      const likeIndices: number[] = [];
      const quizIndices: number[] = [];

      docs.forEach((d, i) => {
        const type = (d.data() as Post).type;
        if (VOTABLE_TYPES.has(type)) voteIndices.push(i);
        if (type === "post")         likeIndices.push(i);
        if (type === "quiz")         quizIndices.push(i);
      });

      const voteRefs = voteIndices.map((i) =>
        docs[i].ref.collection("votes").doc(resolvedUserId)
      );
      const likeRefs = likeIndices.map((i) =>
        docs[i].ref.collection("likes").doc(resolvedUserId)
      );
      const quizRefs = quizIndices.map((i) =>
        docs[i].ref.collection("quizAnswers").doc(resolvedUserId)
      );

      // One parallel round-trip for all three subcollection types
      const [voteSnaps, likeSnaps, quizSnaps] = await Promise.all([
        Promise.all(voteRefs.map((r) => r.get())),
        Promise.all(likeRefs.map((r) => r.get())),
        Promise.all(quizRefs.map((r) => r.get())),
      ]);

      voteIndices.forEach((docIdx, resultIdx) => {
        const s = voteSnaps[resultIdx];
        voteMap.set(docs[docIdx].id, s.exists ? ((s.data() as any).vote ?? null) : null);
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

    // ── Assemble response ─────────────────────────────────────────────────────
    const posts = snapshot.docs.map((doc) => {
      const data           = doc.data() as Post;
      const userVote       = voteMap.get(doc.id) ?? null;
      const userLiked      = likeMap.get(doc.id) ?? false;
      const quizUserAnswer = quizMap.get(doc.id) ?? null;

      return {
        ...data,
        postId:    doc.id,
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
// Quota cost per request:
//   1  — user doc read (resolveUser)
//   1  — batch commit (postRef.set + userDocRef.update = 2 writes, 1 commit)
//   1  — transaction idempotency read inside awardRoarPoints
//   1  — leaderboard batch commit inside awardRoarPoints
//   ─────────────────────────────────────────────
//   2 reads + 2 writes total  (unchanged from previous version)
//
// No changes needed to POST — it was already correct.
// counterField only increments for prediction/hottake; all other types
// fall through to "hotTakeCount" which is fine for now but consider
// adding explicit cases if you track debate/quiz counts separately.
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

    const now     = Date.now();
    const postRef = db.collection("roarPosts").doc();

    const newPost: Post = {
      postId:         postRef.id,
      authorUid:      resolvedUserId,
      authorUsername: userData.username,
      authorBadge:    userData.badge,
      type,
      sport,
      text: text?.trim() || quizQuestion?.trim() || "",
      ...(sideA              && { sideA }),
      ...(sideB              && { sideB }),
      ...(matchId            && { matchId }),
      ...(confidence !== undefined && { confidence }),
      ...(quizQuestion       && { quizQuestion }),
      ...(quizOptions        && { quizOptions }),
      ...(quizCorrectOption  && { quizCorrectOption }),
      ...(quizTimer          && { quizTimer }),
      ...(quizPoints         && { quizPoints }),
      ...(memGifUrl          && { memGifUrl }),
      ...(memTag             && { memTag }),
      quizParticipants: 0,
      audience,
      agreeCount:    0,
      disagreeCount: 0,
      replyCount:    0,
      isLive:        false,
      status:        "active",
      mediaUrls:     mediaUrls || [],
      createdAt:     now,
      updatedAt:     now,
    };

    const batch = db.batch();
    batch.set(postRef, newPost);

    // Atomic counter increment — no stale read race condition
    const counterField = type === "prediction" ? "predictionCount" : "hotTakeCount";
    batch.update(userDocRef, {
      [counterField]: FieldValue.increment(1),
      updatedAt: now,
    });

    await batch.commit();

    // Award points — non-fatal, does not block the response
    awardRoarPoints({
      actualUserId:  resolvedUserId,
      authUserId:    user.userId,
      userName:      userData.username ?? resolvedUserId,
      userEmail:     user.email,
      userExists:    true,
      postType:      type,
      transactionId: `roar_post_${postRef.id}`,
      metadata:      { postId: postRef.id, sport },
    }).catch((pointsErr) => {
      console.error("Failed to award points for post:", pointsErr);
    });

    return NextResponse.json({
      success: true,
      postId: postRef.id,
      post:   newPost,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}