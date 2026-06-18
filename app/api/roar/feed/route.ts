// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import type { Post } from "@/app/models/Post";

// // GET  /api/roar/feed?filter=For+You&limit=20&lastDocId=xxx
// export async function GET(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(req.url);
//     const filter = searchParams.get("filter") ?? "For You";
//     const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
//     const lastDocId = searchParams.get("lastDocId");

//     // Fetch the recent active posts to filter in-memory.
//     // This avoids needing complex Firestore composite indexes that would crash the query at runtime.
//     const query = db
//       .collection("roarPosts")
//       .where("status", "==", "active")
//       .orderBy("createdAt", "desc")
//       .limit(500);

//     const snapshot = await query.get();
//     let posts: Post[] = snapshot.docs.map((doc) => ({
//       ...(doc.data() as Post),
//       postId: doc.id,
//     }));

//     // Apply filters in-memory
//     if (filter === "Cricket") {
//       posts = posts.filter((p) => p.sport === "cricket");
//     } else if (filter === "Football") {
//       posts = posts.filter((p) => p.sport === "football");
//     } else if (filter === "Live") {
//       posts = posts.filter((p) => p.isLive === true);
//     } else if (filter === "Predictions") {
//       posts = posts.filter((p) => p.type === "prediction");
//     }

//     // Paginate the filtered array in-memory
//     let startIndex = 0;
//     if (lastDocId) {
//       const idx = posts.findIndex((p) => p.postId === lastDocId);
//       if (idx !== -1) {
//         startIndex = idx + 1;
//       }
//     }

//     const paginatedPosts = posts.slice(startIndex, startIndex + limit);
//     const hasMore = startIndex + limit < posts.length;
//     const lastDoc = paginatedPosts[paginatedPosts.length - 1];

//     let userSnap = await db.collection("users").doc(user.email).get();
//     let resolvedUserId = user.email;
//     if (!userSnap.exists) {
//       userSnap = await db.collection("users").doc(user.userId).get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }

//     const postsWithVote = await Promise.all(
//       paginatedPosts.map(async (p) => {
//         const docRef = db.collection("roarPosts").doc(p.postId);
//         const voteSnap = await docRef.collection("votes").doc(resolvedUserId).get();
//         const userVote = voteSnap.exists ? (voteSnap.data() as any).vote : null;
//         return {
//           ...p,
//           userVote,
//         };
//       })
//     );

//     return NextResponse.json({
//       success: true,
//       posts: postsWithVote,
//       pagination: {
//         limit,
//         hasMore,
//         nextCursor: hasMore && lastDoc ? { lastDocId: lastDoc.postId } : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/feed error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }




// api/roar/feed/route.ts
//
// GET /api/roar/feed?filter=For+You&limit=20&lastDocId=xxx
//
// FIXES vs previous version:
//   1. userReaction missing  → likes vanished on refresh (root cause)
//   2. N+1 vote reads        → one await per post inside Promise.all, serial in practice
//   3. userLiked missing     → reaction picker had no initial state
//   4. Fetching 500 docs to filter 20 → replaced with targeted Firestore queries
//
// Quota cost per request (page of N posts, V votable):
//   1      — user doc (parallel with posts query)
//   1      — cursor doc read (only when paginating, skipped on first load)
//   N      — post docs
//   V      — vote subcollection docs   (hot_take / prediction / debate only)
//   N      — like subcollection docs   (all types)
//   ─────────────────────────────────────────────
//   1+N+V+N  reads  (was: 1 + 500 + N serial reads)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Post, PostType } from "@/app/models/Post";

const VOTABLE_TYPES = new Set<PostType>(["hot_take", "prediction", "debate"]);

async function resolveUserId(email: string, uid: string): Promise<string | null> {
  const emailSnap = await db.collection("users").doc(email).get();
  if (emailSnap.exists) return email;
  const uidSnap = await db.collection("users").doc(uid).get();
  if (uidSnap.exists) return uid;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filter    = searchParams.get("filter") ?? "For You";
    const limit     = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");

    // ── Build Firestore query ─────────────────────────────────────────────────
    // Only single-field where() clauses — no composite indexes needed beyond
    // the auto-created createdAt DESC index.
    const SPORT_FILTERS: Record<string, string>   = { Cricket: "cricket", Football: "football" };
    const TYPE_FILTERS:  Record<string, PostType> = {
      Predictions:  "prediction",
      Debates:      "debate",
      "Hot Takes":  "hot_take",
      Quizzes:      "quiz",
    };

    let baseQuery: FirebaseFirestore.Query = db
      .collection("roarPosts")
      .where("status", "==", "active");

    if (SPORT_FILTERS[filter]) {
      baseQuery = baseQuery.where("sport", "==", SPORT_FILTERS[filter]);
    } else if (TYPE_FILTERS[filter]) {
      baseQuery = baseQuery.where("type", "==", TYPE_FILTERS[filter]);
    } else if (filter === "Live") {
      baseQuery = baseQuery.where("isLive", "==", true);
    }
    // "For You" → no extra where(), gets all active posts

    let q = baseQuery.orderBy("createdAt", "desc").limit(limit + 1); // +1 to detect hasMore

    // Cursor pagination — fetch the anchor doc only when paginating
    if (lastDocId) {
      const cursorSnap = await db.collection("roarPosts").doc(lastDocId).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }

    // ── Parallel: resolve user + run query ────────────────────────────────────
    const [resolvedUserId, snapshot] = await Promise.all([
      resolveUserId(user.email, user.userId),
      q.get(),
    ]);

    if (!resolvedUserId) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        posts: [],
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    const hasMore = snapshot.docs.length > limit;
    const docs    = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    // ── Partition docs by subcollection need ──────────────────────────────────
    const voteIndices: number[] = [];
    const likeIndices: number[] = [];

    docs.forEach((d, i) => {
      const type = (d.data() as Post).type;
      if (VOTABLE_TYPES.has(type)) voteIndices.push(i);
      likeIndices.push(i); // all types are likeable
    });

    const voteRefs = voteIndices.map((i) => docs[i].ref.collection("votes").doc(resolvedUserId));
    const likeRefs = likeIndices.map((i) => docs[i].ref.collection("likes").doc(resolvedUserId));

    // ── One parallel round-trip — replaces N serial awaits ───────────────────
    const [voteSnaps, likeSnaps] = await Promise.all([
      Promise.all(voteRefs.map((r) => r.get())),
      Promise.all(likeRefs.map((r) => r.get())),
    ]);

    // ── Lookup maps ───────────────────────────────────────────────────────────
    const voteMap     = new Map<string, string | null>();
    const likeMap     = new Map<string, boolean>();
    const reactionMap = new Map<string, string | null>();

    voteIndices.forEach((docIdx, ri) => {
      const s = voteSnaps[ri];
      voteMap.set(docs[docIdx].id, s.exists ? ((s.data() as any).vote ?? null) : null);
    });

    likeIndices.forEach((docIdx, ri) => {
      const s  = likeSnaps[ri];
      const id = docs[docIdx].id;
      likeMap.set(id, s.exists);
      // THE FIX: read the reaction field, not just existence.
      // Old code only set userLiked (bool). HomeFeed reads userReaction to
      // restore the emoji — without it, reaction is always null on refresh.
      reactionMap.set(id, s.exists ? ((s.data() as any).reaction ?? "heart") : null);
    });

    // ── Assemble ──────────────────────────────────────────────────────────────
    const posts = docs.map((doc) => {
      const data = doc.data() as Post;
      return {
        ...data,
        postId:      doc.id,
        likeCount:   data.likeCount ?? 0,
        userVote:    voteMap.get(doc.id) ?? null,
        userLiked:   likeMap.get(doc.id) ?? false,
        userReaction: reactionMap.get(doc.id) ?? null, // ← restores emoji on refresh
      };
    });

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore ? { lastDocId: docs[docs.length - 1].id } : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/feed error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}