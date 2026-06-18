// api/roar/posts/[postId]/like/route.ts
// POST /api/roar/posts/:postId/like
//   Body: { reaction?: "heart" | "fire" | "laugh" | "sad" | "thumb" }
//   - If no existing like: add reaction, increment likeCount
//   - If same reaction: remove like, decrement likeCount  (toggle off)
//   - If different reaction: update reaction type only (no count change)
//
// DELETE /api/roar/posts/:postId/like
//   Removes the user's reaction (decrement likeCount).
//
// Quota cost per POST/DELETE:
//   1  — user auth
//   1  — transaction (like doc read + post likeCount update + like doc write)
//   ─────────────────────────────────────────────
//   2  reads + 1-2 writes per call

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = params;
    const body = await req.json().catch(() => ({}));
    const reaction: ReactionType = VALID_REACTIONS.has(body.reaction) ? body.reaction : "heart";

    const resolvedUserId = await resolveUserId(user.email, user.userId);
    if (!resolvedUserId) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const postRef = db.collection("roarPosts").doc(postId);
    const likeRef = postRef.collection("likes").doc(resolvedUserId);

    // Transaction: read current like state, then update atomically
    const result = await db.runTransaction(async (tx) => {
      const likeSnap = await tx.get(likeRef);

      if (!likeSnap.exists) {
        // New reaction
        tx.set(likeRef, {
          reaction,
          userId: resolvedUserId,
          reactedAt: Date.now(),
        });
        tx.update(postRef, { likeCount: FieldValue.increment(1) });
        return { action: "added", reaction };
      }

      const existing = likeSnap.data() as { reaction?: string };

      if (existing.reaction === reaction) {
        // Same reaction → toggle off
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: FieldValue.increment(-1) });
        return { action: "removed", reaction: null };
      }

      // Different reaction → update type, count stays the same
      tx.update(likeRef, { reaction, reactedAt: Date.now() });
      return { action: "updated", reaction };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error(`POST /api/roar/posts/${params.postId}/like error:`, error);
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = params;
    const resolvedUserId = await resolveUserId(user.email, user.userId);
    if (!resolvedUserId) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const postRef = db.collection("roarPosts").doc(postId);
    const likeRef = postRef.collection("likes").doc(resolvedUserId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(likeRef);
      if (snap.exists) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: FieldValue.increment(-1) });
      }
    });

    return NextResponse.json({ success: true, action: "removed", reaction: null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error(`DELETE /api/roar/posts/${params.postId}/like error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}