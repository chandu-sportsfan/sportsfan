import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { VoteType, Vote } from "@/app/models/Vote";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const vote: VoteType | null = body.vote; // null = toggle off

    if (vote !== null && vote !== "agree" && vote !== "disagree") {
      return NextResponse.json(
        { error: "vote must be 'agree', 'disagree', or null" },
        { status: 400 },
      );
    }

    let userSnap = await db.collection("users").doc(user.email).get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const postRef = db.collection("roarPosts").doc(postId);
    const voteRef = postRef.collection("votes").doc(resolvedUserId);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const [postSnap, voteSnap] = await Promise.all([
        tx.get(postRef),
        tx.get(voteRef),
      ]);

      if (!postSnap.exists) throw new Error("Post not found");

      const postData = postSnap.data() as any;
      let agreeCount: number = postData.agreeCount ?? 0;
      let disagreeCount: number = postData.disagreeCount ?? 0;

      // Step 1: Undo previous vote
      if (voteSnap.exists) {
        const prev = (voteSnap.data() as Vote).vote;
        if (prev === "agree") {
          agreeCount = Math.max(agreeCount - 1, 0);
        } else if (prev === "disagree") {
          disagreeCount = Math.max(disagreeCount - 1, 0);
        }
        tx.delete(voteRef);
      }

      // Step 2: Apply new vote
      if (vote) {
        if (vote === "agree") {
          agreeCount += 1;
        } else {
          disagreeCount += 1;
        }
        tx.set(voteRef, {
          uid: resolvedUserId,
          postId,
          vote,
          createdAt: now,
        } satisfies Vote);
      }

      // Single atomic write to the post doc (avoids double-write issue in Firestore)
      tx.update(postRef, {
        agreeCount,
        disagreeCount,
        updatedAt: now,
      });
    });

    return NextResponse.json({ success: true, vote });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts/[postId]/vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
