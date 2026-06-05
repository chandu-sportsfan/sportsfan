import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { VoteType, Vote } from "@/models/Vote";

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  try {
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

    const postRef = db.collection("posts").doc(params.postId);
    const voteRef = postRef.collection("votes").doc(user.userId);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const [postSnap, voteSnap] = await Promise.all([
        tx.get(postRef),
        tx.get(voteRef),
      ]);

      if (!postSnap.exists) throw new Error("Post not found");

      // Remove previous vote if exists
      if (voteSnap.exists) {
        const prev = (voteSnap.data() as Vote).vote;
        const decrementField =
          prev === "agree" ? "agreeCount" : "disagreeCount";
        tx.update(postRef, {
          [decrementField]: Math.max(
            (postSnap.data() as any)[decrementField] - 1,
            0,
          ),
          updatedAt: now,
        });
        tx.delete(voteRef);
      }

      // Apply new vote
      if (vote) {
        const incrementField =
          vote === "agree" ? "agreeCount" : "disagreeCount";
        tx.set(voteRef, {
          uid: user.userId,
          postId: params.postId,
          vote,
          createdAt: now,
        } satisfies Vote);
        tx.update(postRef, {
          [incrementField]: ((postSnap.data() as any)[incrementField] ?? 0) + 1,
          updatedAt: now,
        });
      }
    });

    return NextResponse.json({ success: true, vote });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts/[postId]/vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
