// api/roar/posts/[postId]/likesection/route.ts
//
// FIX: user resolution now uses getUserInfo (same resolver as posts/route.ts
// and feed/route.ts) instead of a simplified users/{email}->users/{uid}
// check. See feed/route.ts header comment for the full explanation — in short,
// the simplified check has no sanitized-email-id fallback, so it could
// resolve a DIFFERENT doc id than the read path, making likes appear to
// "disappear" on refresh even though they're correctly stored in Firestore.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { getUserInfo } from "@/lib/userPoints";
import { FieldValue } from "firebase-admin/firestore";

type ReactionType = "heart" | "fire" | "laugh" | "sad" | "thumb";
const VALID_REACTIONS = new Set<ReactionType>(["heart", "fire", "laugh", "sad", "thumb"]);

// ── POST: add or change reaction ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { postId } = params;
    if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const reaction: ReactionType = VALID_REACTIONS.has(body.reaction) ? body.reaction : "heart";

    const info = await getUserInfo(user.userId, undefined, user.email);
    if (!info.exists) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    const resolvedUserId = info.actualUserId;

    const postRef = db.collection("roarPosts").doc(postId);
    const likeRef = postRef.collection("likes").doc(resolvedUserId);

    // Transactionally read + write so concurrent reactions can't double-count
    const result = await db.runTransaction(async (tx) => {
      const [likeSnap, postSnap] = await Promise.all([tx.get(likeRef), tx.get(postRef)]);

      if (!postSnap.exists) throw new Error("Post not found");

      if (!likeSnap.exists) {
        // No existing reaction → add it
        tx.set(likeRef, { reaction, userId: resolvedUserId, reactedAt: Date.now() });
        tx.update(postRef, { likeCount: FieldValue.increment(1) });
        return {
          action: "added",
          reaction,
          likeCount: ((postSnap.data() as any).likeCount ?? 0) + 1,
        };
      }

      const existing = likeSnap.data() as { reaction?: string };

      if (existing.reaction === reaction) {
        // Same reaction → toggle off
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: FieldValue.increment(-1) });
        return {
          action: "removed",
          reaction: null,
          likeCount: Math.max(0, ((postSnap.data() as any).likeCount ?? 1) - 1),
        };
      }

      // Different reaction → swap type only, count unchanged
      tx.update(likeRef, { reaction, reactedAt: Date.now() });
      return {
        action: "updated",
        reaction,
        likeCount: (postSnap.data() as any).likeCount ?? 0,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error(`POST /api/roar/posts/${params.postId}/likesection error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE: remove reaction entirely ─────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { postId } = params;
    if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

    const info = await getUserInfo(user.userId, undefined, user.email);
    if (!info.exists) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    const resolvedUserId = info.actualUserId;

    const postRef = db.collection("roarPosts").doc(postId);
    const likeRef = postRef.collection("likes").doc(resolvedUserId);

    const likeCount = await db.runTransaction(async (tx) => {
      const [snap, postSnap] = await Promise.all([tx.get(likeRef), tx.get(postRef)]);
      if (snap.exists) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: FieldValue.increment(-1) });
        return Math.max(0, ((postSnap.data() as any).likeCount ?? 1) - 1);
      }
      return (postSnap.data() as any).likeCount ?? 0;
    });

    return NextResponse.json({ success: true, action: "removed", reaction: null, likeCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error(`DELETE /api/roar/posts/${params.postId}/likesection error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}