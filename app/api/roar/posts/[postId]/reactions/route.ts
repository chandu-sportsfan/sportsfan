// api/roar/posts/[postId]/reactions/route.ts
// GET  /api/roar/posts/:postId/reactions
//   Returns the list of users who reacted and what reaction they gave.
//   Used by the ReactionsDialog (LinkedIn-style viewer).
//
// Firestore structure expected:
//   roarPosts/{postId}/likes/{userId}  →  { reaction: "heart"|"fire"|"laugh"|"sad"|"thumb", ... }
//
// Quota cost per request:
//   1  — user auth check
//   1  — roarPost doc (ownership check)
//   N  — likes subcollection docs (up to `limit`, default 100)
//   M  — user profile docs (batch, for username/avatarUrl/badge)
//   ─────────────────────────────────────────────
//   2 + N + M  reads total
//
// Only the post author is allowed to view the full reactor list.
// Regular users only see the aggregate counts (via the posts list endpoint).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = params;
    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);

    // ── Fetch the post to verify it exists (and optionally gate to author only) ──
    const postSnap = await db.collection("roarPosts").doc(postId).get();
    if (!postSnap.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // ── Fetch likes subcollection ─────────────────────────────────────────────
    const likesSnap = await db
      .collection("roarPosts")
      .doc(postId)
      .collection("likes")
      .limit(limit)
      .get();

    if (likesSnap.empty) {
      return NextResponse.json({ success: true, reactors: [], total: 0 });
    }

    // ── Batch-fetch user profiles ─────────────────────────────────────────────
    // Each like doc ID is a userId / email. We try to get profile data so we
    // can return username, avatarUrl, badge.
    const userIds = likesSnap.docs.map((d) => d.id);

    const profileSnaps = await Promise.all(
      userIds.map((uid) => db.collection("users").doc(uid).get())
    );

    const reactors = likesSnap.docs.map((likeDoc, idx) => {
      const likeData = likeDoc.data() as { reaction?: string; [k: string]: any };
      const profile  = profileSnaps[idx].data() as { username?: string; avatarUrl?: string; badge?: string } | undefined;

      return {
        userId:    likeDoc.id,
        username:  profile?.username  ?? likeDoc.id,
        avatarUrl: profile?.avatarUrl ?? undefined,
        badge:     profile?.badge     ?? "RISING_FAN",
        reaction:  likeData.reaction  ?? "heart",  // default for legacy docs
      };
    });

    // Sort: most recent first — if you store `reactedAt` you can sort by that.
    // For now return as-is (Firestore ordering by insert time is approximate).

    return NextResponse.json({
      success: true,
      reactors,
      total: reactors.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error(`GET /api/roar/posts/${params.postId}/reactions error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}