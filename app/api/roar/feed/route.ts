// api/roar/feed/route.ts
//
// GET /api/roar/feed?filter=For+You&limit=20&lastDocId=xxx
//
// FIX: user resolution now uses getUserInfo (same resolver as posts/route.ts
// and likesection/route.ts) instead of a simplified users/{email}->users/{uid}
// check. The simplified check has no sanitized-email-id fallback, so for users
// whose Firestore doc id is in sanitized form (dots/@ replaced with _) it could
// resolve to a DIFFERENT id than the one likesection/route.ts wrote the like
// under -> reaction always read back as null/missing after refresh, even
// though the like document exists in Firestore. getUserInfo handles:
//   1. exact id match
//   2. fallback: query by email field
//   3. fallback: sanitized email id (foo.bar@x.com -> foo_bar_x_com)
//   4. fallback: de-sanitized id (foo_bar_x_com -> foo.bar@x.com)
//
// Quota cost per request (page of N posts, V votable):
//   1      — user doc lookup (parallel with posts query; may be 2-3 reads
//            internally if getUserInfo needs a fallback strategy)
//   1      — cursor doc read (only when paginating, skipped on first load)
//   N      — post docs
//   V      — vote subcollection docs   (hot_take / prediction / debate only)
//   N      — like subcollection docs   (all types)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { getUserInfo } from "@/lib/userPoints";
import type { Post, PostType } from "@/app/models/Post";

const VOTABLE_TYPES = new Set<PostType>(["hot_take", "prediction", "debate"]);

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
    const [info, snapshot] = await Promise.all([
      getUserInfo(user.userId, undefined, user.email),
      q.get(),
    ]);

    if (!info.exists) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    const resolvedUserId = info.actualUserId;

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
      // Reads the reaction field, not just existence. HomeFeed reads
      // userReaction to restore the emoji on refresh — without it, the
      // reaction always renders as unset even though the doc is in Firestore.
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
        userReaction: reactionMap.get(doc.id) ?? null,
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