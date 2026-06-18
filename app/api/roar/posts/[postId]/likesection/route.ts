// api/roar/posts/[postId]/likesection/route.ts
//
// POST   /api/roar/posts/:postId/likesection   body: { reaction }
//   - New reaction     → add like doc, increment likeCount
//   - Same reaction    → remove like doc, decrement likeCount  (toggle off)
//   - Different react  → update like doc reaction, count unchanged
//   Returns: { success, action, reaction, likeCount }
//
// DELETE /api/roar/posts/:postId/likesection
//   Removes the user's reaction regardless of type.
//   Returns: { success, action: "removed", reaction: null, likeCount }
//
// Quota cost per call:
//   1  — user auth
//   1  — transaction read (like doc)  +  1 write (like doc + post counter)
//   1  — post doc read after tx to get fresh likeCount
//   ─────────────────────────────────────────────
//   3 reads + 1–2 writes per call

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";

type ReactionType = "heart" | "fire" | "laugh" | "sad" | "thumb";
const VALID_REACTIONS = new Set<ReactionType>(["heart", "fire", "laugh", "sad", "thumb"]);

async function resolveUserId(email: string, uid: string): Promise<string | null> {
  const emailSnap = await db.collection("users").doc(email).get();
  if (emailSnap.exists) return email;
  const uidSnap = await db.collection("users").doc(uid).get();
  if (uidSnap.exists) return uid;
  return null;
}

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

    const resolvedUserId = await resolveUserId(user.email, user.userId);
    if (!resolvedUserId) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

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

    const resolvedUserId = await resolveUserId(user.email, user.userId);
    if (!resolvedUserId) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

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